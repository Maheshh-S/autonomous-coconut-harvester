from fastapi import APIRouter, UploadFile, File
from database.db import SessionLocal
from database.models import Tree, Detection, Task
from pathlib import Path

import cv2
import numpy as np
import base64
from ultralytics import YOLO


router = APIRouter()


# -------------------------
# Load tree detection model
# -------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
tree_model_path = REPO_ROOT / "models" / "tree_model" / "tree_detector.pt"
tree_model = YOLO(str(tree_model_path))


# -------------------------
# Tree detection from image
# -------------------------

@router.post("/detect/trees")
async def detect_trees(file: UploadFile = File(...)):

    contents = await file.read()

    npimg = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    results = tree_model(image, conf=0.4)

    trees = []

    for r in results:
        for i, box in enumerate(r.boxes):

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0].tolist()
            )

            confidence = float(box.conf[0])

            trees.append({
                "id": i,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "confidence": confidence
            })

    annotated = results[0].plot()

    _, buffer = cv2.imencode(
        ".jpg",
        annotated
    )

    img_base64 = base64.b64encode(
        buffer
    ).decode("utf-8")

    return {
        "trees_detected": len(trees),
        "trees": trees,
        "annotated_image": img_base64
    }


# -------------------------
# Trees summary
# -------------------------

@router.get("/trees/summary")
def get_trees_summary():

    db = SessionLocal()

    trees = db.query(Tree).all()

    result = []

    for t in trees:

        coconuts = db.query(Detection).filter(
            Detection.tree_id == t.id
        ).count()

        tasks = db.query(Task).filter(
            Task.tree_id == t.id,
            Task.status != "completed"
        ).count()

        result.append({
            "tree_id": t.id,
            "gps_lat": t.gps_lat,
            "gps_lon": t.gps_lon,
            "coconuts_detected": coconuts,
            "tasks_remaining": tasks
        })

    db.close()

    return result