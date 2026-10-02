"""TRINETRA API: run from backend/ with `uvicorn app.main:app --reload`."""
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import cv2
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db
from .detector import SonarDetector
from .preprocess import enhance, load_sonar

STORAGE = Path(os.getenv("TRINETRA_STORAGE", "storage"))
PROCESSED = STORAGE / "processed"
PROCESSED.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 25 * 1024 * 1024
ID_RE = re.compile(r"^[a-f0-9]{12}$")

Risk = Literal["Low", "Medium", "High", "Critical"]

app = FastAPI(title="TRINETRA Sonar Intelligence API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/files", StaticFiles(directory=PROCESSED), name="files")

detector = SonarDetector(os.getenv("TRINETRA_WEIGHTS", "weights/uatd_yolov8.pt"))
db.init()
router = APIRouter(prefix="/api/v1/sonar", tags=["sonar"])


# ------------------------------------------------------------------ schemas
class Box(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class Detection(BaseModel):
    id: str
    cls: str
    confidence: float = Field(ge=0, le=1)
    risk: Risk
    box: Box


class VerifiedDetection(Detection):
    status: Literal["confirmed", "rejected"]
    edited: bool = False
    manual: bool = False


class PredictRequest(BaseModel):
    image_id: str
    conf: float = Field(0.25, ge=0.01, le=0.99)


class VerifyRequest(BaseModel):
    image_id: str
    operator: str = Field("operator", max_length=64)
    log: str = Field("", max_length=4000)
    detections: list[VerifiedDetection] = Field(min_length=1)


# ------------------------------------------------------------------ helpers
def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _image_path(image_id: str) -> Path:
    if not ID_RE.match(image_id):
        raise HTTPException(400, "Invalid image_id")
    path = PROCESSED / f"{image_id}.png"
    if not path.exists():
        raise HTTPException(404, "Unknown image_id: upload the scan first")
    return path


# ---------------------------------------------------------------- endpoints
@app.get("/health")
def health():
    return {"status": "ok", "model": detector.name, "demo_mode": detector.demo}


@router.post("/upload")
def upload(file: UploadFile = File(...)):
    """Accept PNG/TIFF/JPEG/DICOM, run despeckling + CLAHE, store the cleaned image."""
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 25 MB")
    t0 = time.perf_counter()
    try:
        gray = load_sonar(data, file.filename or "")
    except Exception as exc:
        raise HTTPException(415, f"Unsupported or unreadable sonar file: {exc}") from exc
    clean = enhance(gray)
    ms = (time.perf_counter() - t0) * 1000

    image_id = uuid.uuid4().hex[:12]
    cv2.imwrite(str(PROCESSED / f"{image_id}.png"), clean)
    h, w = clean.shape
    with db.session() as c:
        c.execute(
            "INSERT INTO scans (id, filename, width, height, preprocess_ms, created_at) VALUES (?,?,?,?,?,?)",
            (image_id, file.filename, w, h, ms, _now()),
        )
    return {
        "image_id": image_id,
        "filename": file.filename,
        "width": w,
        "height": h,
        "preprocess_ms": round(ms, 1),
        "preview_url": f"/files/{image_id}.png",
    }


@router.post("/predict")
def predict(req: PredictRequest):
    """Run the detector on a preprocessed scan; returns normalised boxes (0-1)."""
    path = _image_path(req.image_id)
    gray = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    t0 = time.perf_counter()
    dets = detector.predict(gray, req.conf)
    ms = (time.perf_counter() - t0) * 1000
    with db.session() as c:
        c.execute(
            "UPDATE scans SET latency_ms=?, n_det=?, demo=?, detections_json=? WHERE id=?",
            (ms, len(dets), int(detector.demo), json.dumps(dets), req.image_id),
        )
    return {
        "image_id": req.image_id,
        "detections": dets,
        "latency_ms": round(ms, 1),
        "model": detector.name,
        "demo_mode": detector.demo,
    }


@router.post("/verify")
def verify(req: VerifyRequest):
    """Persist operator-verified detections. Re-verifying a scan replaces earlier records."""
    _image_path(req.image_id)
    now = _now()
    rows = [
        (req.image_id, d.id, d.cls, d.confidence, d.risk, d.status,
         d.box.x, d.box.y, d.box.w, d.box.h, int(d.edited), int(d.manual), now)
        for d in req.detections
    ]
    with db.session() as c:
        c.execute("DELETE FROM records WHERE image_id=?", (req.image_id,))
        c.executemany(
            "INSERT INTO records (image_id, det_id, cls, confidence, risk, status, x, y, w, h, edited, manual, created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
        c.execute(
            "UPDATE scans SET operator=?, log=?, verified_at=? WHERE id=?",
            (req.operator, req.log, now, req.image_id),
        )
    confirmed = sum(d.status == "confirmed" for d in req.detections)
    return {"saved": len(rows), "confirmed": confirmed, "rejected": len(rows) - confirmed}


@router.get("/analytics")
def analytics():
    """Aggregate stats for the dashboard."""
    risks = ["Low", "Medium", "High", "Critical"]
    with db.session() as c:
        scans = c.execute(
            "SELECT id, latency_ms, n_det, detections_json, created_at FROM scans "
            "WHERE latency_ms IS NOT NULL ORDER BY created_at"
        ).fetchall()
        status = {r["status"]: r["n"] for r in c.execute("SELECT status, COUNT(*) n FROM records GROUP BY status")}
        verified_risk = {r["risk"]: r["n"] for r in c.execute(
            "SELECT risk, COUNT(*) n FROM records WHERE status='confirmed' GROUP BY risk")}

    predicted_risk = dict.fromkeys(risks, 0)
    conf_log = []
    for s in scans:
        for d in json.loads(s["detections_json"] or "[]"):
            predicted_risk[d["risk"]] += 1
            conf_log.append({"scan_id": s["id"], "cls": d["cls"], "confidence": d["confidence"], "risk": d["risk"]})

    decided = status.get("confirmed", 0) + status.get("rejected", 0)
    lat = [s["latency_ms"] for s in scans]
    return {
        "total_scans": len(scans),
        "total_detections": sum(s["n_det"] for s in scans),
        "avg_latency_ms": round(sum(lat) / len(lat), 1) if lat else 0,
        "confirmed": status.get("confirmed", 0),
        "rejected": status.get("rejected", 0),
        "operator_precision": round(status.get("confirmed", 0) / decided, 3) if decided else None,
        "risk_distribution": predicted_risk,
        "verified_risk_distribution": {r: verified_risk.get(r, 0) for r in risks},
        "latency_series": [{"scan": i + 1, "ms": round(v, 1)} for i, v in enumerate(lat[-20:], start=max(0, len(lat) - 20))],
        "confidence_log": [{"n": i + 1, **row} for i, row in enumerate(conf_log[-40:])],
    }


app.include_router(router)
