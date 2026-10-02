"""Sonar loading + noise filtering (OpenCV)."""
import io
import os
from pathlib import Path

import cv2
import numpy as np

MAX_SIDE = 2048
MAX_PIXELS = int(os.getenv("TRINETRA_MAX_PIXELS", 1_500_000))  # keeps filtering fast


def _to_u8(arr: np.ndarray) -> np.ndarray:
    if arr.dtype == np.uint8:
        return arr
    return cv2.normalize(arr.astype(np.float32), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)


def load_sonar(data: bytes, filename: str) -> np.ndarray:
    """Decode PNG / TIFF / JPEG / DICOM bytes into a single-channel uint8 image."""
    if Path(filename).suffix.lower() in {".dcm", ".dicom"}:
        import pydicom

        ds = pydicom.dcmread(io.BytesIO(data))
        arr = ds.pixel_array
        if int(getattr(ds, "NumberOfFrames", 1) or 1) > 1:
            arr = arr[0]  # first frame of a multi-frame study
        if arr.ndim == 3:
            arr = arr.mean(axis=-1)
        gray = _to_u8(arr)
    else:
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
        if img is None:
            raise ValueError("could not decode image")
        if img.ndim == 3:
            code = cv2.COLOR_BGRA2GRAY if img.shape[2] == 4 else cv2.COLOR_BGR2GRAY
            img = cv2.cvtColor(img, code)
        gray = _to_u8(img)

    scale = min(MAX_SIDE / max(gray.shape), (MAX_PIXELS / gray.size) ** 0.5)
    if scale < 1:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return gray


def enhance(gray: np.ndarray) -> np.ndarray:
    """Despeckle then CLAHE. Default filter is fast (median + bilateral).

    Set TRINETRA_DENOISE=nlm for slower, higher-quality non-local-means.
    """
    if os.getenv("TRINETRA_DENOISE", "fast") == "nlm":
        den = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=5, searchWindowSize=11)
    else:
        den = cv2.bilateralFilter(cv2.medianBlur(gray, 5), d=5, sigmaColor=40, sigmaSpace=5)
    return cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(den)
