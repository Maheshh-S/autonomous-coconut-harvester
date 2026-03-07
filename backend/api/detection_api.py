from fastapi import APIRouter
from pydantic import BaseModel
from database.db import SessionLocal
from database.models import Detection

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
    db.refresh(detection)

    db.close()

    return {
        "status": "stored",
        "id": detection.id
    }