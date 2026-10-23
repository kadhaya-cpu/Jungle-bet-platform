"""
traffic_cv.py - Computer Vision Module for RUSH HOUR BET
Real-time traffic vehicle detection, tracking, and lane counting using YOLOv8 (CPU optimized).
"""

import os
import time
import logging
import threading
from typing import Optional, Union, Dict, Any, List, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

# Configure module logger
logger = logging.getLogger("traffic_cv")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# COCO Vehicle Classes: 2 = car, 3 = motorcycle, 5 = bus, 7 = truck
DEFAULT_VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

# Global singleton model cache
_model_lock = threading.Lock()
_yolo_model: Optional[YOLO] = None
_model_path_loaded: Optional[str] = None


def resolve_model_path(model_path: Optional[str] = None) -> str:
    """Resolve the location of the pre-trained YOLOv8n model weight file."""
    if model_path and os.path.exists(model_path):
        return model_path

    env_path = os.getenv("YOLO_MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    # Check common relative project paths
    candidate_paths = [
        "yolov8n.pt",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "yolov8n.pt"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "yolov8n.pt"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "yolov8n.pt"),
        os.path.join(os.getcwd(), "yolov8n.pt"),
    ]

    for p in candidate_paths:
        if os.path.exists(p):
            return os.path.abspath(p)

    # Fallback to model name (Ultralytics will locate or auto-download)
    return "yolov8n.pt"


def load_model(model_path: Optional[str] = None) -> YOLO:
    """
    Load and configure the pre-trained YOLOv8n model once at startup.
    Thread-safe singleton pattern ensures the model is not reloaded per task.
    """
    global _yolo_model, _model_path_loaded

    with _model_lock:
        if _yolo_model is None:
            resolved_path = resolve_model_path(model_path)
            logger.info("Initializing pre-trained YOLOv8n model from: %s", resolved_path)
            start_t = time.time()
            model = YOLO(resolved_path)
            import torch
            preferred_device = os.getenv("YOLO_DEVICE")
            if not preferred_device:
                preferred_device = "cuda" if torch.cuda.is_available() else "cpu"
            try:
                model.to(preferred_device)
                logger.info("YOLOv8n model assigned to device: %s", preferred_device)
            except Exception as e:
                logger.warning("Could not set device %s, falling back to CPU: %s", preferred_device, e)
                model.to("cpu")
            _yolo_model = model
            _model_path_loaded = resolved_path
            logger.info(
                "YOLOv8n model loaded successfully in %.2fs (device: %s, classes: %d)",
                time.time() - start_t,
                preferred_device,
                len(model.names)
            )
        return _yolo_model


def get_yolo_model(model_path: Optional[str] = None) -> YOLO:
    """Utility function to retrieve the cached YOLOv8 model instance."""
    if _yolo_model is None:
        return load_model(model_path)
    return _yolo_model


def is_model_loaded() -> bool:
    """Check if the YOLOv8 model has already been loaded into memory."""
    return _yolo_model is not None


class SimpleCentroidTracker:
    """
    Fallback centroid tracker when tracking IDs are not assigned by the model
    (e.g., single frames or short clips).
    """
    def __init__(self, max_distance: float = 60.0):
        self.next_object_id = 1
        self.objects: Dict[int, Tuple[float, float]] = {}
        self.max_distance = max_distance

    def update(self, centroids: List[Tuple[float, float]]) -> List[int]:
        assigned_ids = []
        if len(self.objects) == 0:
            for c in centroids:
                self.objects[self.next_object_id] = c
                assigned_ids.append(self.next_object_id)
                self.next_object_id += 1
            return assigned_ids

        object_ids = list(self.objects.keys())
        object_centroids = list(self.objects.values())

        if len(centroids) == 0:
            return []

        # Pairwise distance matrix
        dists = np.zeros((len(centroids), len(object_centroids)))
        for i, (cx, cy) in enumerate(centroids):
            for j, (ox, oy) in enumerate(object_centroids):
                dists[i, j] = np.hypot(cx - ox, cy - oy)

        matched_objects = set()
        for i, c in enumerate(centroids):
            min_col = int(np.argmin(dists[i]))
            if dists[i, min_col] < self.max_distance and min_col not in matched_objects:
                obj_id = object_ids[min_col]
                self.objects[obj_id] = c
                matched_objects.add(min_col)
                assigned_ids.append(obj_id)
            else:
                self.objects[self.next_object_id] = c
                assigned_ids.append(self.next_object_id)
                self.next_object_id += 1

        return assigned_ids


def parse_lane_regions(
    lane_regions: Optional[Union[Dict[str, Any], List[Any]]],
    frame_width: int,
    frame_height: int
) -> Dict[str, np.ndarray]:
    """
    Build binary coordinate masks for defined lane regions.

    Supports:
    - Dict of named regions: {"lane_1": [x1, y1, x2, y2], "lane_2": [[x1, y1], [x2, y2], ...]}
    - List of regions: [[x1, y1, x2, y2], ...] or list of polygons
    - Bounding boxes or polygons
    - Normalized coordinates (values between 0.0 and 1.0) or absolute pixel coordinates

    If lane_regions is None or empty:
    Defaults to full frame road area mask.
    """
    masks: Dict[str, np.ndarray] = {}

    if not lane_regions:
        # Default lane region covering full frame
        full_mask = np.ones((frame_height, frame_width), dtype=np.uint8)
        masks["lane_all"] = full_mask
        return masks

    # Standardize input to dictionary format
    region_dict: Dict[str, Any] = {}
    if isinstance(lane_regions, dict) and "coordinates" in lane_regions and len(lane_regions) == 1:
        region_dict["lane_mask"] = lane_regions["coordinates"]
    elif isinstance(lane_regions, list):
        # Check if this is a single polygon: list of [x, y] coordinates
        if len(lane_regions) >= 3 and isinstance(lane_regions[0], (list, tuple)) and len(lane_regions[0]) == 2 and not isinstance(lane_regions[0][0], (list, tuple)):
            region_dict["lane_mask"] = lane_regions
        else:
            for idx, reg in enumerate(lane_regions):
                region_dict[f"lane_{idx + 1}"] = reg
    elif isinstance(lane_regions, dict):
        region_dict = lane_regions
    else:
        full_mask = np.ones((frame_height, frame_width), dtype=np.uint8)
        masks["lane_all"] = full_mask
        return masks

    for name, coords in region_dict.items():
        mask = np.zeros((frame_height, frame_width), dtype=np.uint8)

        # Case 1: Dict with coordinates {'x_min': ..., 'y_min': ..., 'x_max': ..., 'y_max': ...}
        if isinstance(coords, dict) and "x_min" in coords and "y_max" in coords:
            xmin, ymin = coords["x_min"], coords["y_min"]
            xmax, ymax = coords["x_max"], coords["y_max"]
            coords = [xmin, ymin, xmax, ymax]

        # Case 2: Bounding box [x1, y1, x2, y2]
        if isinstance(coords, (list, tuple)) and len(coords) == 4 and not isinstance(coords[0], (list, tuple)):
            x1, y1, x2, y2 = coords
            # Convert normalized coordinates if <= 1.0
            if max(x1, y1, x2, y2) <= 1.0:
                x1 = int(x1 * frame_width)
                x2 = int(x2 * frame_width)
                y1 = int(y1 * frame_height)
                y2 = int(y2 * frame_height)
            else:
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

            x1 = max(0, min(frame_width - 1, x1))
            x2 = max(0, min(frame_width, x2))
            y1 = max(0, min(frame_height - 1, y1))
            y2 = max(0, min(frame_height, y2))
            cv2.rectangle(mask, (x1, y1), (x2, y2), 1, thickness=-1)

        # Case 3: Polygon list of points [[x1, y1], [x2, y2], ...]
        elif isinstance(coords, (list, tuple)) and len(coords) >= 3 and isinstance(coords[0], (list, tuple)):
            pts = []
            for p in coords:
                px, py = p[0], p[1]
                if px <= 1.0 and py <= 1.0:
                    px = int(px * frame_width)
                    py = int(py * frame_height)
                else:
                    px = int(px)
                    py = int(py)
                pts.append([px, py])
            pts_arr = np.array([pts], dtype=np.int32)
            cv2.fillPoly(mask, pts_arr, 1)
        else:
            logger.warning("Unrecognized lane coordinate format for %s: %s", name, coords)
            mask.fill(1)

        masks[name] = mask

    return masks


def is_vehicle_in_mask(
    box_xyxy: np.ndarray,
    mask: np.ndarray,
    check_mode: str = "bottom_center"
) -> bool:
    """
    Check if a vehicle bounding box is inside a lane coordinate mask.
    `check_mode` options:
    - 'bottom_center': tests the bottom-center point (road contact point)
    - 'center': tests the centroid of the bounding box
    - 'overlap': tests if any portion of the box overlaps the mask
    """
    x1, y1, x2, y2 = [int(v) for v in box_xyxy]
    h, w = mask.shape

    if check_mode == "bottom_center":
        bx = max(0, min(w - 1, (x1 + x2) // 2))
        by = max(0, min(h - 1, y2))
        return bool(mask[by, bx] > 0)
    elif check_mode == "center":
        cx = max(0, min(w - 1, (x1 + x2) // 2))
        cy = max(0, min(h - 1, (y1 + y2) // 2))
        return bool(mask[cy, cx] > 0)
    else:
        x1_c = max(0, min(w - 1, x1))
        x2_c = max(0, min(w, x2))
        y1_c = max(0, min(h - 1, y1))
        y2_c = max(0, min(h, y2))
        if x2_c > x1_c and y2_c > y1_c:
            return bool(np.any(mask[y1_c:y2_c, x1_c:x2_c] > 0))
        return False


def count_vehicles_in_video(
    video_source: str,
    lane_regions: Optional[Union[Dict[str, Any], List[Any]]] = None,
    frame_skip: int = 5,
    target_resolution: Optional[Tuple[int, int]] = (640, 360),
    conf_threshold: float = 0.25,
    max_frames: Optional[int] = None,
    classes: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    Core Computer Vision pipeline to detect and count vehicles using YOLOv8.

    Args:
        video_source: Local file path or RTSP/HTTP stream URL.
        lane_regions: Defined lane regions for coordinate masking.
        frame_skip: Process every N-th frame (e.g. 5 for every 5th frame).
        target_resolution: (width, height) to downscale frames for fast inference.
        conf_threshold: Minimum detection confidence score.
        max_frames: Optional maximum frames to process (useful for live streams).
        classes: List of COCO class IDs to detect. Defaults to [2, 3, 5, 7].

    Returns:
        Dict containing:
        - detected_count: Final vehicle count across defined lanes
        - confidence_score: Average detection confidence score
        - lane_counts: Dict of counts per lane
        - vehicle_breakdown: Counts grouped by vehicle type (car, truck, etc.)
        - processed_frames: Number of frames processed
        - total_frames: Total video frames read
        - processing_time_ms: Total duration in milliseconds
        - status: 'completed'
    """
    start_time = time.time()
    vehicle_classes = classes if classes is not None else list(DEFAULT_VEHICLE_CLASSES.keys())

    # Validate local video file existence
    is_stream = video_source.startswith(("rtsp://", "http://", "https://", "rtmp://"))
    if not is_stream and not os.path.exists(video_source):
        error_msg = f"Video file not found: {video_source}"
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)

    # Load cached model once
    model = get_yolo_model()

    logger.info("Opening video source: %s (frame_skip=%d, resolution=%s)",
                video_source, frame_skip, target_resolution)

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        error_msg = f"Failed to open video source: {video_source}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    # Retrieve video metadata
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    logger.info("Video opened: %dx%d @ %.1f FPS, total frames: %d",
                orig_w, orig_h, fps, total_video_frames)

    # Determine processing dimensions
    if target_resolution is not None:
        proc_w, proc_h = target_resolution
    else:
        proc_w, proc_h = (orig_w, orig_h) if (orig_w > 0 and orig_h > 0) else (640, 360)

    # Build lane coordinate masks
    lane_masks = parse_lane_regions(lane_regions, proc_w, proc_h)
    logger.info("Configured lane masks: %s", list(lane_masks.keys()))

    # Tracking structures
    lane_unique_ids: Dict[str, set] = {name: set() for name in lane_masks.keys()}
    all_unique_ids = set()
    detection_confidences: List[float] = []
    vehicle_type_counts: Dict[str, int] = {v: 0 for v in DEFAULT_VEHICLE_CLASSES.values()}

    fallback_tracker = SimpleCentroidTracker(max_distance=80.0)

    raw_frame_idx = 0
    processed_count = 0

    try:
        while cap.isOpened():
            if max_frames is not None and raw_frame_idx >= max_frames:
                logger.info("Reached maximum requested frames: %d", max_frames)
                break

            # Frame skipping optimization: use grab() on skipped frames
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

            # Resolution downscaling optimization
            curr_h, curr_w = frame.shape[:2]
            if curr_w != proc_w or curr_h != proc_h:
                frame = cv2.resize(frame, (proc_w, proc_h), interpolation=cv2.INTER_AREA)

            # Run YOLOv8 detection and tracking
            # Using persist=True keeps tracking state between consecutive frames
            try:
                results = model.track(
                    frame,
                    persist=True,
                    classes=vehicle_classes,
                    conf=conf_threshold,
                    verbose=False
                )
            except Exception as track_err:
                # If tracking has any issue, fall back to standard predict
                logger.debug("Tracking exception: %s. Falling back to predict", track_err)
                results = model.predict(
                    frame,
                    classes=vehicle_classes,
                    conf=conf_threshold,
                    verbose=False
                )

            if not results or len(results) == 0:
                continue

            boxes = results[0].boxes
            if boxes is None or len(boxes) == 0:
                continue

            # Extract detections
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
                    "track_id": track_id,
                    "cx": cx,
                    "cy": cy
                })

            # If tracking IDs were not assigned by model, use fallback tracker
            if any(b["track_id"] is None for b in box_data):
                assigned_ids = fallback_tracker.update(centroids)
                for b, aid in zip(box_data, assigned_ids):
                    if b["track_id"] is None:
                        b["track_id"] = aid

            # Evaluate coordinate masking for each lane region
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
                            logger.debug("New vehicle tracked in %s: ID %d (%s, conf=%.2f)",
                                         lane_name, tid, cls_name, conf)

                if in_any_lane:
                    detection_confidences.append(conf)
                    if tid not in all_unique_ids:
                        all_unique_ids.add(tid)
                        vehicle_type_counts[cls_name] = vehicle_type_counts.get(cls_name, 0) + 1

    finally:
        cap.release()

    elapsed_ms = int((time.time() - start_time) * 1000)

    # Compute final metrics
    final_count = len(all_unique_ids)
    lane_counts = {lane: len(ids) for lane, ids in lane_unique_ids.items()}

    avg_confidence = (
        round(float(np.mean(detection_confidences)), 4)
        if detection_confidences
        else 0.0
    )

    result_payload = {
        "status": "completed",
        "detected_count": final_count,
        "confidence_score": avg_confidence,
        "lane_counts": lane_counts,
        "vehicle_breakdown": {k: v for k, v in vehicle_type_counts.items() if v > 0},
        "processed_frames": processed_count,
        "total_frames": raw_frame_idx,
        "processing_time_ms": elapsed_ms,
        "video_source": video_source,
    }

    logger.info(
        "Traffic Analysis Complete: %d vehicles detected across lanes (conf: %.2f) in %dms. "
        "Processed %d/%d frames. Lane breakdown: %s",
        final_count, avg_confidence, elapsed_ms, processed_count, raw_frame_idx, lane_counts
    )

    return result_payload


def create_mock_traffic_video(
    output_path: str,
    num_frames: int = 50,
    width: int = 640,
    height: int = 360,
    fps: int = 15
) -> str:
    """
    Creates a synthetic video file for automated testing.
    Draws a 2-lane road with simulated vehicles moving across lanes.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # Vehicle positions and trajectories
    # vehicle: [x, y, w, h, dx, dy, color]
    vehicles = [
        {"x": 100, "y": 80, "w": 60, "h": 35, "dx": 6, "color": (50, 50, 200)},    # Red car in Lane 1
        {"x": 50, "y": 200, "w": 70, "h": 40, "dx": 8, "color": (200, 100, 50)},   # Blue car in Lane 2
        {"x": 250, "y": 80, "w": 120, "h": 45, "dx": 4, "color": (50, 180, 50)},   # Green truck in Lane 1
    ]

    for frame_idx in range(num_frames):
        # Gray asphalt background
        frame = np.full((height, width, 3), 50, dtype=np.uint8)

        # Draw road boundaries
        cv2.rectangle(frame, (0, 50), (width, 310), (70, 70, 70), -1)

        # Lane divider (dashed white line)
        dash_w = 30
        dash_gap = 20
        y_div = 175
        for x in range(0, width, dash_w + dash_gap):
            cv2.line(frame, (x, y_div), (min(width, x + dash_w), y_div), (240, 240, 240), 2)

        # Draw lane boundaries (solid yellow lines)
        cv2.line(frame, (0, 50), (width, 50), (0, 220, 220), 3)
        cv2.line(frame, (0, 310), (width, 310), (0, 220, 220), 3)

        # Draw moving vehicles
        for v in vehicles:
            vx = int(v["x"] + v["dx"] * frame_idx) % (width + 100) - 50
            vy = int(v["y"])
            vw = int(v["w"])
            vh = int(v["h"])
            # Vehicle body
            cv2.rectangle(frame, (vx, vy), (vx + vw, vy + vh), v["color"], -1)
            # Vehicle windshield
            cv2.rectangle(frame, (vx + vw - 15, vy + 5), (vx + vw - 5, vy + vh - 5), (220, 220, 220), -1)
            # Wheels
            cv2.rectangle(frame, (vx + 5, vy - 3), (vx + 15, vy), (20, 20, 20), -1)
            cv2.rectangle(frame, (vx + vw - 18, vy - 3), (vx + vw - 8, vy), (20, 20, 20), -1)
            cv2.rectangle(frame, (vx + 5, vy + vh), (vx + 15, vy + vh + 3), (20, 20, 20), -1)
            cv2.rectangle(frame, (vx + vw - 18, vy + vh), (vx + vw - 8, vy + vh + 3), (20, 20, 20), -1)

        out.write(frame)

    out.release()
    logger.info("Generated mock traffic video: %s (%d frames, %dx%d)",
                output_path, num_frames, width, height)
    return output_path
