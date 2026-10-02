# Turning demo mode into the real detector

1. Download the UATD dataset (Figshare, CC BY 4.0): search "UATD dataset figshare".
   Unzip `UATD_Training.zip` (7,600 image/annotation pairs; `image/` BMP, `annotation/` XML).
2. From `backend/` with the venv active:
   ```
   python training/prepare_uatd.py <unzipped UATD_Training> data/uatd
   python training/train.py data/uatd/uatd.yaml 100
   ```
3. Restart `uvicorn`. The header stops saying "demo model" and the amber banner disappears.

Training on CPU takes many hours. Use a GPU machine or Google Colab, then copy
`weights/uatd_yolov8.pt` back into `backend/weights/`.
Evaluate on UATD_Test_1 / Test_2 before trusting any result.
