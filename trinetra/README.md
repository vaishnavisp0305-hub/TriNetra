# TRINETRA: AI-Powered Sonar Intelligence & Underwater Object Detection
Team TriNova · CODEXspectra Hackathon 2026 · SIH Problem Statement 26057

```
trinetra/
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI: /upload /predict /verify /analytics (+ /health)
│   │   ├── detector.py     # YOLOv8 (PyTorch) wrapper, UATD classes, risk mapping, demo fallback
│   │   ├── preprocess.py   # PNG/TIFF/DICOM decode, despeckle + CLAHE (OpenCV)
│   │   └── db.py           # SQLite schema and session helper
│   ├── weights/            # put uatd_yolov8.pt here
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx                       # shell, state, confidence gate, workflow
    │   ├── api.js · constants.js · index.css
    │   └── components/
    │       ├── SonarCanvas.jsx           # RadarFeed (sweep) + detection overlay
    │       ├── VerificationPanel.jsx     # confirm / reject / edit / log
    │       ├── Analytics.jsx             # Recharts dashboard
    │       ├── Architecture.jsx          # interactive pipeline view
    │       └── UploadZone.jsx
    └── package.json, vite/tailwind config
```

## Run
```bash
# backend
cd backend && python -m venv .venv && c:\Users\vaish\OneDrive\Desktop\trinetra\backend\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```

## Real model vs demo mode
Without `backend/weights/uatd_yolov8.pt` the API runs in **demo mode**: an OpenCV bright-blob heuristic
so you can exercise the whole UI. The UI shows an amber banner when this is active. To use the real model:
```bash
# after converting UATD annotations to YOLO format and writing uatd.yaml
yolo detect train data=uatd.yaml model=yolov8s.pt imgsz=640 epochs=100
cp runs/detect/train/weights/best.pt backend/weights/uatd_yolov8.pt
```
The detector reads class names from the checkpoint. Update `RISK_BY_CLASS` (detector.py) and `CLASS_RISK` (constants.js) if your class list differs.

## Notes
- Risk priorities per class are starting assumptions; agree them with domain experts.
- Boxes travel as normalised 0-1 `{x,y,w,h}` so they are independent of display size.
- Verification replaces earlier records for the same scan. Analytics aggregate from SQLite; move to PostgreSQL by swapping `db.py`.
- The live feed is a simulator; there is no real sonar input.
