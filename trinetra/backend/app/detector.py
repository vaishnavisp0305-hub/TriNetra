"""Detector wrapper: YOLOv8 (PyTorch) trained on UATD, with a clearly-flagged demo fallback.

Drop your trained weights at backend/weights/uatd_yolov8.pt (or set TRINETRA_WEIGHTS).
Without weights the service runs in DEMO mode: an OpenCV bright-blob heuristic so the
UI and pipeline can be exercised end to end. Demo output is NOT a trained model.
"""
import threading
from pathlib import Path

import cv2
import numpy as np

UATD_CLASSES = [
    "cube", "ball", "cylinder", "human body", "tyre",
    "circle cage", "square cage", "metal bucket", "plane", "rov",
]

# Operational priority per class. This mapping is a starting assumption: tune it with
# your domain experts. Keep it in sync with frontend/src/constants.js (CLASS_RISK).
RISK_BY_CLASS = {
    "human body": "Critical",
    "cylinder": "High", "plane": "High", "rov": "High",
    "cube": "Medium", "square cage": "Medium", "circle cage": "Medium",
    "metal bucket": "Low", "tyre": "Low", "ball": "Low",
}


def risk_for(cls: str) -> str:
    return RISK_BY_CLASS.get(cls.lower(), "Medium")


def _det(i: int, cls: str, conf: float, x1: float, y1: float, x2: float, y2: float) -> dict:
    x1, y1 = max(0.0, x1), max(0.0, y1)
    x2, y2 = min(1.0, x2), min(1.0, y2)
    return {
        "id": f"d{i}",
        "cls": cls,
        "confidence": round(float(conf), 4),
        "risk": risk_for(cls),
        "box": {"x": round(x1, 5), "y": round(y1, 5), "w": round(x2 - x1, 5), "h": round(y2 - y1, 5)},
    }


def _overlap(b: dict, x: float, y: float, w: float, h: float) -> bool:
    """True if the candidate box overlaps a kept box by >25% of the smaller area."""
    ix = max(0.0, min(b["x"] + b["w"], x + w) - max(b["x"], x))
    iy = max(0.0, min(b["y"] + b["h"], y + h) - max(b["y"], y))
    return ix * iy > 0.25 * min(b["w"] * b["h"], w * h)


class SonarDetector:
    def __init__(self, weights: str):
        self._lock = threading.Lock()
        self.model = None
        self.demo = True
        self.name = "demo-heuristic (no weights loaded)"
        path = Path(weights)
        if path.exists():
            from ultralytics import YOLO  # PyTorch backend

            self.model = YOLO(str(path))
            self.demo = False
            self.name = f"yolov8/{path.stem}"

    def predict(self, gray: np.ndarray, conf: float = 0.25) -> list[dict]:
        return self._demo(gray, conf) if self.demo else self._yolo(gray, conf)

    # ------------------------------------------------------------------ YOLOv8
    def _yolo(self, gray: np.ndarray, conf: float) -> list[dict]:
        bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        with self._lock:
            res = self.model.predict(bgr, conf=conf, imgsz=640, verbose=False)[0]
        names = res.names
        out = []
        for i, b in enumerate(res.boxes):
            x1, y1, x2, y2 = b.xyxyn[0].tolist()
            cls = names.get(int(b.cls[0]), UATD_CLASSES[int(b.cls[0]) % len(UATD_CLASSES)])
            out.append(_det(i, cls, float(b.conf[0]), x1, y1, x2, y2))
        return sorted(out, key=lambda d: -d["confidence"])

    # -------------------------------------------------------------- demo mode
    def _demo(self, gray: np.ndarray, conf_min: float) -> list[dict]:
        h, w = gray.shape
        blur = cv2.GaussianBlur(gray, (0, 0), max(h, w) / 300)
        mask = (blur >= np.percentile(blur, 97)).astype(np.uint8) * 255
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        out = []
        for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:12]:
            x, y, bw, bh = cv2.boundingRect(c)
            area = bw * bh / (w * h)
            if area < 0.0004 or area > 0.25:
                continue
            pad = int(0.5 * max(bw, bh))
            outer = gray[max(0, y - pad): y + bh + pad, max(0, x - pad): x + bw + pad].mean()
            contrast = (gray[y: y + bh, x: x + bw].mean() - outer) / 255.0
            conf = float(np.clip(0.45 + 2.0 * contrast, 0.3, 0.9))
            if conf < conf_min:
                continue
            # Demo mode cannot know what an object is: never invent a class name.
            if any(_overlap(o["box"], x / w, y / h, bw / w, bh / h) for o in out):
                continue
            out.append(_det(len(out), "unclassified contact", conf, x / w, y / h, (x + bw) / w, (y + bh) / h))
        return sorted(out, key=lambda d: -d["confidence"])
