#!/usr/bin/env python3
"""
celery_autoscaler.py - Horizontal Autoscaler for Jungle Bet Celery Workers

Monitors Celery queue depth in Redis. If queue depth exceeds 50, scales
celery-worker to 5 replicas. Scales down to 1 replica when the queue depth
clears and cooldown period has expired.
"""

import os
import sys
import time
import signal
import logging
import subprocess
from typing import Optional, Dict, Any

try:
    import redis
except ImportError:
    redis = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [CeleryAutoscaler] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("CeleryAutoscaler")

# Autoscaling Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_NAME = os.getenv("QUEUE_NAME", "celery")
QUEUE_DEPTH_THRESHOLD = int(os.getenv("QUEUE_DEPTH_THRESHOLD", "50"))
SCALE_UP_REPLICAS = int(os.getenv("SCALE_UP_REPLICAS", "5"))
MIN_REPLICAS = int(os.getenv("MIN_REPLICAS", "1"))
SCALE_DOWN_THRESHOLD = int(os.getenv("SCALE_DOWN_THRESHOLD", "10"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
COOLDOWN_SECONDS = int(os.getenv("COOLDOWN_SECONDS", "30"))
COMPOSE_FILE = os.getenv("COMPOSE_FILE", "docker-compose.prod.yml")
SERVICE_NAME = os.getenv("SERVICE_NAME", "celery-worker")

class CeleryAutoscaler:
    def __init__(
        self,
        redis_url: str = REDIS_URL,
        queue_name: str = QUEUE_NAME,
        threshold: int = QUEUE_DEPTH_THRESHOLD,
        max_replicas: int = SCALE_UP_REPLICAS,
        min_replicas: int = MIN_REPLICAS,
        scale_down_threshold: int = SCALE_DOWN_THRESHOLD,
        cooldown: int = COOLDOWN_SECONDS,
        dry_run: bool = False
    ):
        self.redis_url = redis_url
        self.queue_name = queue_name
        self.threshold = threshold
        self.max_replicas = max_replicas
        self.min_replicas = min_replicas
        self.scale_down_threshold = scale_down_threshold
        self.cooldown = cooldown
        self.dry_run = dry_run
        
        self.current_replicas = min_replicas
        self.SERVICE_NAME = SERVICE_NAME
        self.last_scale_time = 0.0
        self.running = True
        self.r_client: Optional[Any] = None

        if redis is None:
            logger.warning("Redis python package not installed. Autoscaler running in mock mode.")

    def get_redis_client(self):
        if self.r_client is None and redis is not None:
            try:
                self.r_client = redis.from_url(self.redis_url, socket_timeout=3)
                self.r_client.ping()
            except Exception as e:
                logger.error(f"Failed to connect to Redis at {self.redis_url}: {e}")
                self.r_client = None
        return self.r_client

    def get_queue_depth(self) -> int:
        """Fetch total queue depth from Redis for the target Celery queues."""
        client = self.get_redis_client()
        if client is None:
            return 0

        try:
            # Check primary queue length (Redis LLEN)
            depth = client.llen(self.queue_name)
            # Also check if any additional queues exist
            for extra_q in ["video_processing", "high_priority"]:
                try:
                    depth += client.llen(extra_q)
                except Exception:
                    pass
            return int(depth)
        except Exception as e:
            logger.error(f"Error querying Redis queue depth: {e}")
            return 0

    def apply_scale(self, target_replicas: int, reason: str) -> bool:
        """Invoke docker compose scale command to horizontally scale workers."""
        if target_replicas == self.current_replicas:
            return True

        logger.info(
            f"🔄 SCALING EVENT: {self.SERVICE_NAME} replicas {self.current_replicas} -> {target_replicas} "
            f"| Reason: {reason}"
        )

        if self.dry_run:
            logger.info(f"[DRY-RUN] Executing scale command for {self.SERVICE_NAME}={target_replicas}")
            self.current_replicas = target_replicas
            self.last_scale_time = time.time()
            return True

        cmd = [
            "docker", "compose",
            "-f", COMPOSE_FILE,
            "up", "-d",
            "--scale", f"{self.SERVICE_NAME}={target_replicas}",
            "--no-recreate"
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0:
                logger.info(f"✅ Successfully scaled {self.SERVICE_NAME} to {target_replicas} replicas.")
                self.current_replicas = target_replicas
                self.last_scale_time = time.time()
                return True
            else:
                logger.warning(f"Docker scale command returned code {res.returncode}: {res.stderr.strip()}")
                # Update current replica tracker nonetheless to prevent spamming
                self.current_replicas = target_replicas
                self.last_scale_time = time.time()
                return False
        except FileNotFoundError:
            logger.warning("Docker binary not found on host. Recording scale state in memory.")
            self.current_replicas = target_replicas
            self.last_scale_time = time.time()
            return False

    def evaluate(self, force_depth: Optional[int] = None) -> Dict[str, Any]:
        """Evaluate current metrics against thresholds and trigger scale action if needed."""
        depth = force_depth if force_depth is not None else self.get_queue_depth()
        now = time.time()
        time_since_scale = now - self.last_scale_time
        action_taken = "NONE"

        # Scale UP Condition: Queue depth exceeds 50
        if depth > self.threshold:
            if self.current_replicas < self.max_replicas:
                reason = f"Queue depth {depth} exceeds threshold of {self.threshold}"
                self.apply_scale(self.max_replicas, reason)
                action_taken = "SCALE_UP"
            else:
                logger.debug(f"Queue depth {depth} > {self.threshold}, but already at max replicas ({self.max_replicas}).")
        
        # Scale DOWN Condition: Queue depth has drained <= 10 and cooldown passed
        elif depth <= self.scale_down_threshold:
            if self.current_replicas > self.min_replicas:
                if time_since_scale >= self.cooldown:
                    reason = f"Queue depth {depth} <= {self.scale_down_threshold} and cooldown ({self.cooldown}s) elapsed"
                    self.apply_scale(self.min_replicas, reason)
                    action_taken = "SCALE_DOWN"
                else:
                    logger.debug(
                        f"Queue drained ({depth}), but cooldown active "
                        f"({int(time_since_scale)}/{self.cooldown}s remaining)."
                    )

        return {
            "queue_depth": depth,
            "current_replicas": self.current_replicas,
            "action": action_taken,
            "threshold": self.threshold,
            "time_since_scale": time_since_scale
        }

    def run_loop(self):
        """Continuous monitoring loop."""
        logger.info("================================================================")
        logger.info(f" Jungle Bet: Celery Horizontal Autoscaler Started")
        logger.info(f" Target Service:         {self.SERVICE_NAME}")
        logger.info(f" Queue Name:             {self.queue_name}")
        logger.info(f" Scale-up Threshold:     Queue Depth > {self.threshold} -> {self.max_replicas} Replicas")
        logger.info(f" Scale-down Threshold:   Queue Depth <= {self.scale_down_threshold} -> {self.min_replicas} Replicas")
        logger.info(f" Cooldown Period:        {self.cooldown} seconds")
        logger.info(f" Poll Interval:          {POLL_INTERVAL} seconds")
        logger.info("================================================================")

        def sig_handler(sig, frame):
            logger.info("Shutdown signal received. Exiting Celery autoscaler gracefully...")
            self.running = False

        signal.signal(signal.SIGINT, sig_handler)
        signal.signal(signal.SIGTERM, sig_handler)

        while self.running:
            try:
                status = self.evaluate()
                logger.info(
                    f"Queue '{self.queue_name}' Depth: {status['queue_depth']} | "
                    f"Workers: {status['current_replicas']} | "
                    f"Action: {status['action']}"
                )
            except Exception as e:
                logger.error(f"Unexpected error in autoscaler loop: {e}")

            time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    autoscaler = CeleryAutoscaler(dry_run=dry)
    autoscaler.run_loop()
