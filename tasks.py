"""
tasks.py - Celery Task Queue for Jungle Bet
Handles async Computer Vision video processing, vehicle detection/counting, and bet resolution.
"""

import os
import sys
import time
import logging
import asyncio
import datetime
from typing import Optional, Union, Dict, Any, List, Tuple

from celery import shared_task
from celery.signals import worker_process_init
from sqlalchemy import select

import cv2
import numpy as np

from celery_app import celery_app
from database import AsyncSessionLocal
from models import Bet, User, Transaction, BetStatus, CameraFeed
from resolver import resolve_bet
from traffic_cv import (
    load_model,
    get_yolo_model,
    count_vehicles_in_video,
    create_mock_traffic_video,
    parse_lane_regions,
    is_vehicle_in_mask,
    DEFAULT_VEHICLE_CLASSES,
    SimpleCentroidTracker
)
import concurrent.futures

logger = logging.getLogger("celery.tasks")
logger.setLevel(logging.INFO)


def run_sync(coro):
    """Safely execute an async coroutine synchronously, even if an event loop is already running in the current thread."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(asyncio.run, coro)
            return future.result()
    else:
        return asyncio.run(coro)


# Base directory for resolving static assets
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_VIDEOS_DIR = os.path.join(BASE_DIR, "static", "videos")


@worker_process_init.connect
def on_worker_process_init(**kwargs):
    """
    Celery worker startup signal:
    Pre-load the YOLOv8n model once into worker memory to avoid per-task cold starts.
    """
    logger.info("[Worker Startup] Pre-loading YOLOv8n model for vehicle detection...")
    try:
        load_model()
        logger.info("[Worker Startup] YOLOv8n model pre-loaded successfully.")
    except Exception as exc:
        logger.error("[Worker Startup] Failed to pre-load YOLO model: %s", exc)


def resolve_video_path(video_source: Optional[str]) -> str:
    """
    Resolve video path, checking absolute paths, static/videos directory,
    and fallback defaults.
    """
    if not video_source:
        default_candidates = [
            os.path.join(STATIC_VIDEOS_DIR, "sample_traffic.mp4"),
            os.path.join(STATIC_VIDEOS_DIR, "heavy_traffic.mp4"),
            os.path.join(STATIC_VIDEOS_DIR, "mock_traffic.mp4"),
        ]
        for candidate in default_candidates:
            if os.path.exists(candidate) and os.path.getsize(candidate) > 0:
                return candidate
        # Generate mock video if none exist
        mock_path = os.path.join(STATIC_VIDEOS_DIR, "mock_traffic.mp4")
        return create_mock_traffic_video(mock_path)

    # Check for stream URLs
    if video_source.startswith(("rtsp://", "http://", "https://", "rtmp://")):
        return video_source

    # Check if absolute and exists
    if os.path.isabs(video_source) and os.path.exists(video_source):
        return video_source

    # Check relative to base dir or static videos
    candidates = [
        os.path.join(BASE_DIR, video_source),
        os.path.join(STATIC_VIDEOS_DIR, os.path.basename(video_source)),
        os.path.join(BASE_DIR, "static", video_source),
        os.path.join(os.getcwd(), video_source)
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)

    return video_source


async def fetch_bet_details(bet_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve bet criteria from database asynchronously."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet).where(Bet.id == bet_id))
        bet = result.scalar_one_or_none()
        if not bet:
            return None
        return {
            "id": bet.id,
            "bet_type": bet.bet_type.value if hasattr(bet.bet_type, "value") else str(bet.bet_type),
            "criteria": bet.criteria or {},
            "amount": bet.amount,
            "user_id": bet.user_id,
            "status": bet.status
        }


async def fetch_camera_feed(feed_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve camera feed details from database asynchronously."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(CameraFeed).where(CameraFeed.id == feed_id))
        feed = result.scalar_one_or_none()
        if not feed:
            return None
        return {
            "id": feed.id,
            "name": feed.name,
            "location": feed.location,
            "rtsp_url": feed.rtsp_url,
            "country_code": feed.country_code,
            "status": feed.status,
            "lane_mask": feed.lane_mask
        }


async def update_feed_status(feed_id: int, status: str):
    """Update camera feed status (e.g. active, offline) in database."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(CameraFeed).where(CameraFeed.id == feed_id))
        feed = result.scalar_one_or_none()
        if feed:
            feed.status = status
            feed.updated_at = datetime.datetime.utcnow()
            await session.commit()
            logger.info("[DB] CameraFeed ID %d status set to '%s'", feed_id, status)


@celery_app.task(bind=True, name="process_traffic_video", max_retries=3)
def process_traffic_video(
    self,
    video_source: Optional[Union[str, int]] = None,
    bet_id: Optional[int] = None,
    lane_regions: Optional[Union[Dict[str, Any], List[Any]]] = None,
    frame_skip: int = 5,
    target_resolution: Optional[Union[Tuple[int, int], List[int]]] = (640, 360),
    conf_threshold: float = 0.25,
    max_frames: Optional[int] = None
) -> Dict[str, Any]:
    """
    Celery task to run YOLOv8 Computer Vision traffic counting on a video or RTSP stream,
    and resolve associated bets in the database.

    Args:
        video_source: Video file path or RTSP stream URL (or bet_id if first arg is int).
        bet_id: Optional ID of the bet to resolve.
        lane_regions: Defined lane regions for coordinate masking.
        frame_skip: Skip frames (default: process every 5th frame).
        target_resolution: Downscale resolution (default: (640, 360)).
        conf_threshold: YOLO detection confidence threshold.
        max_frames: Max frames to process (useful for streams).

    Returns:
        Dict with detection results and resolution status.
    """
    task_id = self.request.id if self.request else "direct_call"
    logger.info("[Worker %s] Starting process_traffic_video (source=%s, bet_id=%s)...",
                task_id, video_source, bet_id)

    # Handle argument swap: if first arg is int, treat as bet_id
    if isinstance(video_source, int) and bet_id is None:
        bet_id = video_source
        video_source = None

    # Fetch bet details if bet_id provided
    bet_criteria = {}
    if bet_id is not None:
        bet_info = run_sync(fetch_bet_details(bet_id))
        if bet_info:
            bet_criteria = bet_info.get("criteria", {})
            if not video_source:
                video_source = (
                    bet_criteria.get("video_source")
                    or bet_criteria.get("video_url")
                    or bet_criteria.get("video_path")
                )
            if lane_regions is None:
                lane_regions = bet_criteria.get("lane_regions")
            if "feed_id" in bet_criteria:
                feed_id = int(bet_criteria["feed_id"])
                logger.info("[Worker %s] Bet %s contains feed_id=%d, delegating to process_live_feed",
                            task_id, bet_id, feed_id)
                return process_live_feed(
                    feed_id=feed_id,
                    bet_id=bet_id,
                    lane_regions=lane_regions,
                    frame_skip=frame_skip,
                    target_resolution=target_resolution,
                    conf_threshold=conf_threshold,
                    max_frames=max_frames
                )

    # Resolve local or fallback video path
    resolved_source = resolve_video_path(str(video_source) if video_source else None)

    # Check existence for local video files
    is_stream = resolved_source.startswith(("rtsp://", "http://", "https://", "rtmp://"))
    if not is_stream and not os.path.exists(resolved_source):
        err_msg = f"Video file not found: {resolved_source}"
        logger.error("[Worker %s] %s for Bet ID: %s", task_id, err_msg, bet_id)
        if bet_id is not None:
            # Update bet to VOID on missing video
            run_sync(mark_bet_void(bet_id, err_msg))
        return {"status": "error", "error": err_msg, "bet_id": bet_id}

    # Convert resolution format if list
    target_res = tuple(target_resolution) if target_resolution else None

    try:
        # Run YOLOv8 vehicle detection & lane counting pipeline
        cv_result = count_vehicles_in_video(
            video_source=resolved_source,
            lane_regions=lane_regions,
            frame_skip=frame_skip,
            target_resolution=target_res,
            conf_threshold=conf_threshold,
            max_frames=max_frames
        )

        logger.info(
            "[Audit/CV Worker %s] Bet %s Analysis Complete: %d vehicles detected (conf: %.4f) "
            "across lanes %s in %dms",
            task_id,
            bet_id,
            cv_result["detected_count"],
            cv_result["confidence_score"],
            cv_result.get("lane_counts", {}),
            cv_result["processing_time_ms"]
        )

        # Connect to bet resolution flow if bet_id provided
        if bet_id is not None:
            run_sync(update_database_with_result(bet_id, cv_result))

        cv_result["bet_id"] = bet_id
        return cv_result

    except Exception as exc:
        logger.exception("[Worker %s] Exception during traffic video processing: %s", task_id, exc)
        # Attempt task retry up to max_retries
        try:
            raise self.retry(exc=exc, countdown=5)
        except Exception:
            return {"status": "error", "error": str(exc), "bet_id": bet_id}


@celery_app.task(bind=True, name="process_video_blurring", max_retries=3)
def process_video_blurring(self, bet_id: int) -> Dict[str, Any]:
    """
    Legacy blurring task name kept for backward compatibility.
    Routes execution through the process_traffic_video CV pipeline.
    """
    logger.info("[Worker %s] process_video_blurring invoked for bet %d, forwarding to traffic CV...",
                self.request.id if self.request else "direct", bet_id)
    return process_traffic_video.run(video_source=None, bet_id=bet_id)


async def mark_bet_void(bet_id: int, reason: str):
    """Mark a bet as void when the video segment cannot be located."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet).where(Bet.id == bet_id))
        bet = result.scalar_one_or_none()
        if not bet:
            return
        bet.status = BetStatus.VOID
        bet.resolution_data = {"status": "void", "reason": reason}
        bet.resolved_at = datetime.datetime.utcnow()
        await session.commit()
        logger.info("[DB] Bet ID %d marked as VOID: %s", bet_id, reason)


async def update_database_with_result(bet_id: int, cv_output: dict):
    """
    Update the database 'bets' table status to 'won' or 'lost' based on
    the AI vehicle count vs. user prediction.
    Also handles user coin payouts and transaction records.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet).where(Bet.id == bet_id))
        bet = result.scalar_one_or_none()
        if not bet:
            logger.warning("[DB] Bet ID %d not found in database", bet_id)
            return

        status, multiplier = resolve_bet(bet.criteria, cv_output, bet.bet_type.value)
        bet.status = status
        bet.resolution_data = cv_output
        bet.resolved_at = datetime.datetime.utcnow()

        payout_amount = 0.0
        if status == BetStatus.WON:
            payout_amount = bet.amount * multiplier
            from transaction_service import transaction_service
            user_res = await session.execute(select(User).where(User.id == bet.user_id))
            user = user_res.scalar_one_or_none()
            username = user.username if user else None
            await transaction_service.process_bet_win(
                session=session,
                user_id=bet.user_id,
                stake=bet.amount,
                odds=multiplier,
                bet_id=bet_id,
                username=username,
            )
            logger.info("[DB/Audit] WINNER! User %d won %.2f coins (multiplier: %.1fx).",
                        bet.user_id, payout_amount, multiplier)

            # Fraud Detection Hook: trigger flag when user wins over 1,000 instantly
            if payout_amount > 1000.0:
                try:
                    from fraud_detection import fraud_service
                    await fraud_service.record_win(
                        user_id=bet.user_id,
                        win_amount=payout_amount,
                        bet_id=bet_id,
                        username=username,
                        session=session
                    )
                except Exception as fe:
                    logger.error("Error evaluating fraud win hook: %s", fe)
        elif status == BetStatus.LOST:
            from transaction_service import transaction_service
            await transaction_service.process_bet_loss(
                session=session,
                user_id=bet.user_id,
                stake=bet.amount,
                bet_id=bet_id
            )
            logger.info("[DB/Audit] Bet ID %d marked as LOST (AI Count: %s, Prediction: %s)",
                        bet_id, cv_output.get("detected_count"), bet.criteria)
        elif status == BetStatus.VOID:
            from transaction_service import transaction_service
            await transaction_service.processBet(
                session=session,
                user_id=bet.user_id,
                stake=bet.amount,
                outcome="void",
                bet_id=bet_id
            )
            logger.info("[DB/Audit] Bet ID %d VOID. Refunded %.2f coins to user %d.",
                        bet_id, bet.amount, bet.user_id)

        # Include payout in resolution data for frontend celebration overlay
        cv_output["payout"] = payout_amount
        cv_output["multiplier"] = multiplier
        cv_output["bet_status"] = status.value if hasattr(status, "value") else str(status)
        cv_output["status"] = "completed"
        bet.resolution_data = cv_output

        await session.commit()
        logger.info("[DB] Bet ID %d committed with status '%s'.", bet_id, status)


@celery_app.task(bind=True, name="process_live_feed", max_retries=3)
def process_live_feed(
    self,
    feed_id: Union[int, Any],
    bet_id: Optional[int] = None,
    lane_regions: Optional[Union[Dict[str, Any], List[Any]]] = None,
    frame_skip: int = 5,
    target_resolution: Optional[Union[Tuple[int, int], List[int]]] = (640, 360),
    conf_threshold: float = 0.25,
    duration_seconds: Optional[int] = 10,
    max_frames: Optional[int] = None,
    max_connection_retries: int = 3
) -> Dict[str, Any]:
    """
    Celery task to ingest a live RTSP stream, perform YOLOv8 vehicle detection
    with frame skipping and lane coordinate masking, log vehicle count per second,
    and resolve associated bets.

    Args:
        feed_id: Database ID of the camera feed.
        bet_id: Optional ID of the bet to resolve.
        lane_regions: Defined lane regions for coordinate masking.
        frame_skip: Process every 5th frame (default: 5) to minimize latency.
        target_resolution: Downscale resolution (default: (640, 360)).
        conf_threshold: YOLO detection confidence threshold.
        duration_seconds: Stream ingestion window in seconds (default: 10s).
        max_frames: Optional max frames to process.
        max_connection_retries: Connection retries before marking offline (default: 3).

    Returns:
        Dict with detection results, per-second counts, and resolution status.
    """
    # Unpack task binding whether called via Celery, task.run, or direct call
    if not hasattr(self, "request") and isinstance(self, (int, str)):
        if bet_id is None and isinstance(feed_id, int):
            bet_id = feed_id
        feed_id = int(self)
        task_id = "direct_call"
    else:
        task_id = self.request.id if hasattr(self, "request") and self.request and self.request.id else "direct_call"
        feed_id = int(feed_id)

    logger.info("[Worker %s] Starting process_live_feed (feed_id=%d, bet_id=%s, frame_skip=%d)...",
                task_id, feed_id, bet_id, frame_skip)

    # 1. Fetch camera feed from DB
    feed_data = run_sync(fetch_camera_feed(feed_id))
    if not feed_data:
        err_msg = f"Camera feed ID {feed_id} not found in database."
        logger.error("[Worker %s] %s", task_id, err_msg)
        if bet_id is not None:
            run_sync(mark_bet_void(bet_id, err_msg))
        return {"status": "error", "error": err_msg, "feed_id": feed_id, "bet_id": bet_id}

    rtsp_url = feed_data["rtsp_url"]
    feed_name = feed_data["name"]

    # If bet_id provided, fetch bet details for lane regions or custom duration
    if bet_id is not None:
        bet_info = run_sync(fetch_bet_details(bet_id))
        if bet_info:
            bet_criteria = bet_info.get("criteria", {})
            if lane_regions is None:
                lane_regions = bet_criteria.get("lane_regions")
            if "duration_seconds" in bet_criteria:
                duration_seconds = int(bet_criteria["duration_seconds"])
            elif "duration" in bet_criteria:
                duration_seconds = int(bet_criteria["duration"])
            if "max_frames" in bet_criteria:
                max_frames = int(bet_criteria["max_frames"])

    # Fallback to feed default lane_mask if no specific lane_regions configured
    if lane_regions is None and feed_data.get("lane_mask"):
        lane_regions = feed_data.get("lane_mask")

    # 2. Connect to live stream using OpenCV without downloading the file
    cap = None
    connected = False

    # Optimize for real-time RTSP low-latency and fast failure timeout, plus HTTP headers for RWS/inmoves
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
        "rtsp_transport;tcp|stimeout;5000000|max_delay;500000|"
        "headers;Referer: https://www.rwsverkeersinfo.nl/\r\n"
    )

    for attempt in range(1, max_connection_retries + 1):
        logger.info("[Worker %s][Feed %d] Connecting to live stream (attempt %d/%d): %s",
                    task_id, feed_id, attempt, max_connection_retries, rtsp_url)
        try:
            # Fast timeout parameters for low latency and prompt offline detection
            timeout_params = []
            if hasattr(cv2, "CAP_PROP_OPEN_TIMEOUT_MSEC"):
                timeout_params.extend([cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 2500])
            if hasattr(cv2, "CAP_PROP_READ_TIMEOUT_MSEC"):
                timeout_params.extend([cv2.CAP_PROP_READ_TIMEOUT_MSEC, 2500])

            if timeout_params and hasattr(cv2, "CAP_FFMPEG"):
                cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG, timeout_params)
            else:
                cap = cv2.VideoCapture(rtsp_url)

            # Minimize buffer size for low latency
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if cap.isOpened():
                ret = cap.grab()
                if ret:
                    connected = True
                    logger.info("[Worker %s][Feed %d] Connected to live stream on attempt %d",
                                task_id, feed_id, attempt)
                    break
            if cap:
                cap.release()
                cap = None
        except Exception as conn_err:
            logger.warning("[Worker %s][Feed %d] Connection attempt %d failed: %s",
                           task_id, feed_id, attempt, conn_err)
            if cap:
                cap.release()
                cap = None

        if attempt < max_connection_retries:
            time.sleep(0.5)

    if not connected:
        err_msg = f"Failed to connect to live stream for feed {feed_id} ('{feed_name}') at {rtsp_url}"
        logger.error("[Worker %s] %s. Marking feed as offline.", task_id, err_msg)
        run_sync(update_feed_status(feed_id, "offline"))
        if bet_id is not None:
            run_sync(mark_bet_void(bet_id, f"Live stream feed {feed_id} is offline or unreachable"))
        return {
            "status": "error",
            "error": err_msg,
            "feed_id": feed_id,
            "bet_id": bet_id,
            "feed_status": "offline"
        }

    # If stream connected and previously marked offline, update status to active
    if feed_data.get("status") != "active":
        run_sync(update_feed_status(feed_id, "active"))

    # 3. Stream processing & YOLOv8 vehicle detection
    model = get_yolo_model()
    target_res = tuple(target_resolution) if target_resolution else (640, 360)
    proc_w, proc_h = target_res

    lane_masks = parse_lane_regions(lane_regions, proc_w, proc_h)
    lane_unique_ids = {name: set() for name in lane_masks.keys()}
    all_unique_ids = set()
    detection_confidences = []
    vehicle_type_counts = {v: 0 for v in DEFAULT_VEHICLE_CLASSES.values()}
    counts_per_second = []
    crossings = []
    fallback_tracker = SimpleCentroidTracker(max_distance=80.0)

    start_time = time.time()
    last_sec_timestamp = start_time
    last_sec_vehicles = 0
    sec_index = 1
    raw_frame_idx = 0
    processed_count = 0

    try:
        while cap.isOpened():
            now = time.time()
            elapsed = now - start_time

            # Log vehicle count per second
            if (now - last_sec_timestamp) >= 1.0:
                vps = len(all_unique_ids) - last_sec_vehicles
                logger.info(
                    "[Worker %s][Feed %d] Second %d: %d vehicles detected | Cumulative: %d | Stream FPS: %.1f",
                    task_id, feed_id, sec_index, vps, len(all_unique_ids),
                    raw_frame_idx / max(elapsed, 0.001)
                )
                counts_per_second.append({
                    "second": sec_index,
                    "count": vps,
                    "cumulative": len(all_unique_ids)
                })
                last_sec_vehicles = len(all_unique_ids)
                last_sec_timestamp = now
                sec_index += 1

            if duration_seconds is not None and elapsed >= duration_seconds:
                logger.info("[Worker %s][Feed %d] Target ingestion duration reached: %ds (%d frames)",
                            task_id, feed_id, duration_seconds, raw_frame_idx)
                break

            if max_frames is not None and raw_frame_idx >= max_frames:
                logger.info("[Worker %s][Feed %d] Reached max frames limit: %d",
                            task_id, feed_id, max_frames)
                break

            # Frame skipping: process every 5th frame to minimize latency
            if frame_skip > 1 and (raw_frame_idx % frame_skip != 0):
                ret = cap.grab()
                if not ret:
                    break
                raw_frame_idx += 1
                continue

            ret, frame = cap.read()
            if not ret or frame is None:
                break

            raw_frame_idx += 1
            processed_count += 1

            # Downscale frame
            curr_h, curr_w = frame.shape[:2]
            if curr_w != proc_w or curr_h != proc_h:
                frame = cv2.resize(frame, (proc_w, proc_h), interpolation=cv2.INTER_AREA)

            # YOLOv8 detection and tracking
            try:
                results = model.track(
                    frame,
                    persist=True,
                    classes=list(DEFAULT_VEHICLE_CLASSES.keys()),
                    conf=conf_threshold,
                    verbose=False
                )
            except Exception:
                results = model.predict(
                    frame,
                    classes=list(DEFAULT_VEHICLE_CLASSES.keys()),
                    conf=conf_threshold,
                    verbose=False
                )

            if not results or len(results) == 0:
                continue

            boxes = results[0].boxes
            if boxes is None or len(boxes) == 0:
                continue

            centroids = []
            box_data = []
            for i in range(len(boxes)):
                xyxy = boxes.xyxy[i].cpu().numpy()
                conf = float(boxes.conf[i].cpu().numpy())
                cls_id = int(boxes.cls[i].cpu().numpy())
                track_id = int(boxes.id[i].cpu().numpy()) if (boxes.id is not None and boxes.id[i] is not None) else None
                cx = float((xyxy[0] + xyxy[2]) / 2.0)
                cy = float((xyxy[1] + xyxy[3]) / 2.0)
                centroids.append((cx, cy))
                box_data.append({
                    "xyxy": xyxy,
                    "conf": conf,
                    "cls_id": cls_id,
                    "track_id": track_id
                })

            if any(b["track_id"] is None for b in box_data):
                assigned_ids = fallback_tracker.update(centroids)
                for b, aid in zip(box_data, assigned_ids):
                    if b["track_id"] is None:
                        b["track_id"] = aid

            for b in box_data:
                xyxy = b["xyxy"]
                tid = b["track_id"]
                conf = b["conf"]
                cls_name = DEFAULT_VEHICLE_CLASSES.get(b["cls_id"], "vehicle")

                in_any_lane = False
                for lane_name, mask in lane_masks.items():
                    if is_vehicle_in_mask(xyxy, mask, check_mode="bottom_center") or \
                       is_vehicle_in_mask(xyxy, mask, check_mode="center"):
                        in_any_lane = True
                        if tid not in lane_unique_ids[lane_name]:
                            lane_unique_ids[lane_name].add(tid)

                if in_any_lane:
                    detection_confidences.append(conf)
                    if tid not in all_unique_ids:
                        all_unique_ids.add(tid)
                        vehicle_type_counts[cls_name] = vehicle_type_counts.get(cls_name, 0) + 1
                        crossings.append({
                            "track_id": tid,
                            "timestamp": round(time.time() - start_time, 2),
                            "vehicle_type": cls_name,
                        })

    finally:
        # OPTIMIZATION: Ensure worker releases VideoCapture object immediately
        if cap is not None:
            cap.release()
            logger.info("[Worker %s][Feed %d] VideoCapture released immediately to prevent memory leaks.",
                        task_id, feed_id)

    elapsed_ms = int((time.time() - start_time) * 1000)
    final_count = len(all_unique_ids)
    lane_counts = {lane: len(ids) for lane, ids in lane_unique_ids.items()}
    avg_conf = round(float(np.mean(detection_confidences)), 4) if detection_confidences else 0.0

    # Ensure final second logged
    final_vps = final_count - last_sec_vehicles
    counts_per_second.append({
        "second": sec_index,
        "count": final_vps,
        "cumulative": final_count
    })

    logger.info(
        "[Worker %s][Feed %d] Live stream processing complete: %d vehicles detected across lanes (conf: %.2f) in %dms. Counts per sec: %s",
        task_id, feed_id, final_count, avg_conf, elapsed_ms, counts_per_second
    )

    cv_result = {
        "status": "completed",
        "feed_id": feed_id,
        "feed_name": feed_name,
        "location": feed_data.get("location"),
        "rtsp_url": rtsp_url,
        "detected_count": final_count,
        "confidence_score": avg_conf,
        "lane_counts": lane_counts,
        "vehicle_breakdown": {k: v for k, v in vehicle_type_counts.items() if v > 0},
        "counts_per_second": counts_per_second,
        "crossings": crossings,
        "processed_frames": processed_count,
        "total_frames": raw_frame_idx,
        "processing_time_ms": elapsed_ms,
        "duration_seconds": round(elapsed_ms / 1000.0, 2),
        "bet_id": bet_id
    }

    if bet_id is not None:
        run_sync(update_database_with_result(bet_id, cv_result))

    return cv_result


@celery_app.task(name="daily_settlement_task")
def daily_settlement_task(operator_bank_account: Optional[str] = None):
    """
    Daily settlement job: Calculates today's net profit,
    prepares external operator bank transfer, and dispatches 11:59 PM summary report.
    """
    from transaction_service import transaction_service

    async def _execute():
        async with AsyncSessionLocal() as session:
            res = await transaction_service.daily_settlement(
                session=session,
                operator_bank_account=operator_bank_account
            )
            await session.commit()
            return res

    return run_sync(_execute())


@celery_app.task(name="daily_treasury_sweep_task")
def daily_treasury_sweep_task(amount: Optional[float] = None, operator_bank_account: Optional[str] = None):
    """
    Automated Daily Treasury Sweep Job (Cron 2:00 AM UTC):
    - Calculates Withdrawable Profit (House Balance - Required Safety Float).
    - If Withdrawable Amount > 0:
      * Transfers funds from House Revenue Wallet to Operator External Account.
      * Logs transaction as 'OPERATING_PROFIT_WITHDRAWAL'.
      * Sends Telegram alert: 'Daily Sweep Complete: Moved [amount] to Operating Account.'
    """
    from transaction_service import transaction_service

    async def _execute():
        async with AsyncSessionLocal() as session:
            res = await transaction_service.execute_sweep(
                session=session,
                amount=amount,
                operator_bank_account=operator_bank_account,
                is_manual=False,
            )
            await session.commit()
            return res

    return run_sync(_execute())


@celery_app.task(name="daily_profit_sweep")
def daily_profit_sweep(amount: Optional[float] = None, operator_bank_account: Optional[str] = None):
    """
    Automated Daily Profit Sweep (Celery scheduled task running at 02:00 AM local time):
    Logic:
    * Call 'calculate_safe_withdrawal()'.
    * If amount > 0:
      - Create a transaction record moving funds from 'House_Revenue_Wallet' to 'Operator_Operating_Wallet'.
      - Tag transaction type as 'PROFIT_WITHDRAWAL'.
      - Trigger Telegram alert to Admin: ' Daily Sweep: Moved 0 to Operating Account. Remaining Float: 0.'
    * If amount == 0: Send alert '⚠️ No profit available for withdrawal today. Maintaining safety float.'
    """
    from treasury_service import treasury_service

    async def _execute():
        async with AsyncSessionLocal() as session:
            res = await treasury_service.execute_profit_sweep(
                session=session,
                amount=amount,
                operator_bank_account=operator_bank_account,
                is_manual=False,
                transaction_type="PROFIT_WITHDRAWAL",
            )
            await session.commit()
            return res

    return run_sync(_execute())

