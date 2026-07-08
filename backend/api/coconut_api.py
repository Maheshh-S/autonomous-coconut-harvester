from fastapi import APIRouter, UploadFile, File
from pathlib import Path
import cv2
import numpy as np
import base64
from ultralytics import YOLO

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[2]
coconut_model_path = REPO_ROOT / "models" / "coconut_model" / "coconut_detector.pt"
coconut_model = YOLO(str(coconut_model_path))


@router.post("/detect/coconuts")
async def detect_coconuts(file: UploadFile = File(...)):

    contents = await file.read()

    npimg = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    results = coconut_model(image)

    coconuts = []

    for r in results:

        for box in r.boxes:

            cls = int(box.cls[0])
            label = coconut_model.names[cls]

            coconuts.append({
                "ripeness": label,
                "confidence": float(box.conf[0])
            })

    annotated = results[0].plot()

    _, buffer = cv2.imencode(".jpg", annotated)

    img_base64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "coconuts_detected": len(coconuts),
        "detections": coconuts,
        "annotated_image": img_base64
    }