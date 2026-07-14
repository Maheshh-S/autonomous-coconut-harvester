from fastapi import APIRouter
from sqlalchemy import func

from database.db import SessionLocal
from database.models import Tree, Detection

router = APIRouter()

@router.get("/planner/harvest_order")
def harvest_order():

    db = SessionLocal()

    trees = db.query(Tree).all()

    result = []

    for tree in trees:

        coconut_count = db.query(Detection).filter(
            Detection.tree_id == tree.id,
            func.lower(Detection.ripeness) == "mature"
        ).count()

        result.append({
            "tree_id": tree.id,
            "gps_lat": tree.gps_lat,
            "gps_lon": tree.gps_lon,
            "mature_coconuts": coconut_count
        })

    result.sort(key=lambda x: x["mature_coconuts"], reverse=True)

    db.close()

    return result