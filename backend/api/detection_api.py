from fastapi import APIRouter
from pydantic import BaseModel
from database.db import SessionLocal
from database.models import Detection
from database.tasks import create_task_if_needed

router = APIRouter()


# -----------------------------
# Request model
# -----------------------------

class CoconutDetection(BaseModel):
    tree_id: int
    coconut_id: int
    ripeness: str
    confidence: float
    harvest_type: str   # NEW


# -----------------------------
# Store detection
# -----------------------------

@router.post("/drone/detection")
def receive_detection(data: CoconutDetection):

    db = SessionLocal()

    # -------------------------
    # store detection
    # -------------------------

    detection = Detection(
        tree_id=data.tree_id,
        coconut_id=data.coconut_id,
        ripeness=data.ripeness.lower(),
        confidence=data.confidence,
        harvest_type=data.harvest_type,
    )

    db.add(detection)
    db.commit()


    # -------------------------
    # TASK CREATION FILTER
    # -------------------------

    create_task = False


    # Farmer wants only mature coconuts
    if data.harvest_type == "mature":
        if data.ripeness.lower() == "mature":
            create_task = True


    # Farmer wants tender coconuts
    elif data.harvest_type == "tender":
        if data.ripeness.lower() == "premature":
            create_task = True


    # Farmer wants both
    elif data.harvest_type == "both":
        create_task = True


    # -------------------------
    # create task if allowed
    # -------------------------

    if create_task:
        create_task_if_needed(db, data.tree_id, data.coconut_id)


    db.close()

    return {"status": "stored"}