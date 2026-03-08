from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Tree
from datetime import datetime

router = APIRouter()

@router.post("/drone/tree_detected")
def register_tree(gps_lat: float, gps_lon: float):

    db = SessionLocal()

    tree = Tree(
        gps_lat=gps_lat,
        gps_lon=gps_lon,
        detected_time=datetime.utcnow()
    )

    db.add(tree)
    db.commit()
    db.refresh(tree)

    db.close()

    return {
        "status": "tree recorded",
        "tree_id": tree.id
    }