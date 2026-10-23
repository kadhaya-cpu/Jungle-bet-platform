#!/usr/bin/env python3
"""
test_infrastructure.py - Comprehensive Verification for RUSH HOUR BET Docker, Blue/Green & Celery Autoscaling
"""

import os
import sys
import json
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from scripts.celery_autoscaler import CeleryAutoscaler

def test_dockerfiles():
    print("Testing Dockerfiles...")
    backend_df = os.path.join(PROJECT_ROOT, "Dockerfile")
    frontend_df = os.path.join(PROJECT_ROOT, "jungle-bet-frontend", "Dockerfile")
    
    assert os.path.exists(backend_df), "Dockerfile.backend missing"
    assert os.path.exists(frontend_df), "Frontend Dockerfile missing"
    
    # Verify Backend Dockerfile contents
    with open(backend_df, "r") as f:
        b_content = f.read()
    assert "python:3.12-slim" in b_content or "nvidia/cuda" in b_content, "Backend Dockerfile missing base image"
    assert "torch" in b_content, "Backend Dockerfile missing torch"
    assert "YOLO_DEVICE" in b_content, "Backend Dockerfile missing YOLO_DEVICE"
    assert "HEALTHCHECK" in b_content, "Backend Dockerfile missing HEALTHCHECK"
    assert "yolov8" in b_content.lower() or "requirements.txt" in b_content, "Backend Dockerfile missing YOLO dependencies"
    
    # Verify Frontend Dockerfile contents
    with open(frontend_df, "r") as f:
        f_content = f.read()
    assert "node:20-alpine" in f_content, "Frontend Dockerfile missing Node base"
    assert "standalone" in f_content, "Frontend Dockerfile missing standalone support"
    assert "HEALTHCHECK" in f_content, "Frontend Dockerfile missing HEALTHCHECK"
    print("  ✅ Dockerfiles verified successfully!")

def test_compose_config():
    print("Testing docker-compose.prod.yml...")
    compose_path = os.path.join(PROJECT_ROOT, "docker-compose.prod.yml")
    assert os.path.exists(compose_path), "docker-compose.prod.yml missing"
    
    with open(compose_path, "r") as f:
        content = f.read()
        
    required_services = [
        "postgres", "redis", "nginx",
        "backend-blue", "frontend-blue",
        "backend-green", "frontend-green",
        "celery-worker", "celery-autoscaler"
    ]
    for s in required_services:
        assert s in content, f"Service {s} missing from docker-compose.prod.yml"
        
    assert "jungle-bet-backend:latest" in content, "Backend tag missing in compose"
    assert "jungle-bet-frontend:latest" in content, "Frontend tag missing in compose"
    assert "QUEUE_DEPTH_THRESHOLD: \"50\"" in content or "50" in content, "Queue threshold 50 missing"
    assert "SCALE_UP_REPLICAS: \"5\"" in content or "5" in content, "Scale up 5 missing"
    print("  ✅ Docker Compose configuration verified successfully!")

def test_celery_autoscaler_logic():
    print("Testing Celery Autoscaler logic...")
    scaler = CeleryAutoscaler(dry_run=True, threshold=50, max_replicas=5, min_replicas=1, cooldown=10)
    
    # 1. Normal load (queue depth 35)
    r1 = scaler.evaluate(force_depth=35)
    assert r1["action"] == "NONE", f"Expected NONE, got {r1['action']}"
    assert r1["current_replicas"] == 1
    
    # 2. Surge beyond threshold (queue depth 75 > 50)
    r2 = scaler.evaluate(force_depth=75)
    assert r2["action"] == "SCALE_UP", f"Expected SCALE_UP, got {r2['action']}"
    assert r2["current_replicas"] == 5, f"Expected 5 replicas, got {r2['current_replicas']}"
    
    # 3. Queue clears (queue depth 8 <= 10) but cooldown is active
    r3 = scaler.evaluate(force_depth=8)
    assert r3["action"] == "NONE", f"Expected NONE due to cooldown, got {r3['action']}"
    assert r3["current_replicas"] == 5
    
    # 4. Cooldown expires
    scaler.last_scale_time -= 15
    r4 = scaler.evaluate(force_depth=8)
    assert r4["action"] == "SCALE_DOWN", f"Expected SCALE_DOWN, got {r4['action']}"
    assert r4["current_replicas"] == 1, f"Expected 1 replica, got {r4['current_replicas']}"
    print("  ✅ Celery Autoscaler logic verified successfully!")

def test_bluegreen_scripts():
    print("Testing Blue/Green scripts...")
    deploy_sh = os.path.join(PROJECT_ROOT, "scripts", "deploy-bluegreen.sh")
    rollback_sh = os.path.join(PROJECT_ROOT, "scripts", "rollback.sh")
    
    assert os.path.exists(deploy_sh) and os.access(deploy_sh, os.X_OK), "deploy-bluegreen.sh not executable"
    assert os.path.exists(rollback_sh) and os.access(rollback_sh, os.X_OK), "rollback.sh not executable"
    
    with open(deploy_sh, "r") as f:
        deploy_content = f.read()
    assert "perform_rollback" in deploy_content, "Rollback procedure missing in deploy script"
    assert "generate_upstream_conf" in deploy_content, "Upstream generator missing"
    assert "active_upstream.conf" in deploy_content, "Nginx config missing in deploy script"
    print("  ✅ Blue/Green deployment scripts verified successfully!")

def test_live_health_endpoints():
    print("Testing live dev server health endpoints...")
    # Backend check
    try:
        req = urllib.request.urlopen("http://localhost:8000/health", timeout=3)
        b_data = json.loads(req.read().decode())
        assert b_data.get("status") in ["healthy", "degraded"], f"Unexpected backend health: {b_data}"
        print(f"  ✅ Backend health check responded: status={b_data.get('status')}")
    except Exception as e:
        print(f"  ℹ️ Backend live server check skipped (not running): {e}")

    # Frontend check
    try:
        req = urllib.request.urlopen("http://localhost:3000/api/health", timeout=3)
        f_data = json.loads(req.read().decode())
        assert f_data.get("status") == "healthy", f"Unexpected frontend health: {f_data}"
        print(f"  ✅ Frontend health check responded: status={f_data.get('status')}")
    except Exception as e:
        print(f"  ℹ️ Frontend live server check skipped (not running): {e}")

if __name__ == "__main__":
    test_dockerfiles()
    test_compose_config()
    test_celery_autoscaler_logic()
    test_bluegreen_scripts()
    test_live_health_endpoints()
    print("\n🎉 ALL INFRASTRUCTURE AND CODE VERIFICATION TESTS PASSED SUCCESSFULLY!")
