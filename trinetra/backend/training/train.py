"""Train YOLOv8 on the converted UATD data and install the result for the API.

Usage (from backend/):  python training/train.py <path-to>/uatd.yaml [epochs]
Needs internet the first time (downloads yolov8s.pt). A GPU is strongly recommended.
"""
import shutil
import sys
from pathlib import Path

from ultralytics import YOLO

data = sys.argv[1]
epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 100

model = YOLO("yolov8s.pt")
model.train(data=data, imgsz=640, epochs=epochs, batch=16, project="runs", name="uatd",
            hsv_h=0.0, hsv_s=0.0,  # sonar is grayscale: no colour jitter
            patience=25)
Path("weights").mkdir(exist_ok=True)
shutil.copy(model.trainer.best, "weights/uatd_yolov8.pt")
print("Installed weights/uatd_yolov8.pt: restart the API and demo mode switches off.")
