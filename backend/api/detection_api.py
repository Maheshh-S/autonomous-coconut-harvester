from fastapi import APIRouter
from pydantic import BaseModel
from database.db import SessionLocal
from database.models import Detection, Task

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
        ripeness=data.ripeness,
        confidence=data.confidence,
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

        existing_task = db.query(Task).filter(
            Task.tree_id == data.tree_id,
            Task.coconut_id == data.coconut_id
        ).first()

        if not existing_task:

            task = Task(
                tree_id=data.tree_id,
                coconut_id=data.coconut_id,
                status="pending"
            )

            db.add(task)
            db.commit()


    db.close()

    return {"status": "stored"}