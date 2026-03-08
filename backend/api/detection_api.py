from fastapi import APIRouter
from pydantic import BaseModel
from database.db import SessionLocal
from database.models import Detection, Task

router = APIRouter()

class CoconutDetection(BaseModel):
    tree_id: int
    coconut_id: int
    ripeness: str
    confidence: float

    
@router.post("/drone/detection")
def receive_detection(data: CoconutDetection):

    db = SessionLocal()

    detection = Detection(
        tree_id=data.tree_id,
        coconut_id=data.coconut_id,
        ripeness=data.ripeness,
        confidence=data.confidence
    )

    db.add(detection)
    db.commit()

    # AUTO TASK CREATION
    if data.ripeness == "mature":

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