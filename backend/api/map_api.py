from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Tree, Detection, Task

router = APIRouter()

@router.get("/plantation/map")
def get_tree_map():

    db = SessionLocal()

    trees = db.query(Tree).all()

    result = []

    for tree in trees:

        coconut_count = db.query(Detection).filter(
            Detection.tree_id == tree.id
        ).count()

        pending_tasks = db.query(Task).filter(
            Task.tree_id == tree.id,
            Task.status != "completed"
        ).count()

        result.append({
            "tree_id": tree.id,
            "gps_lat": tree.gps_lat,
            "gps_lon": tree.gps_lon,
            "coconuts_detected": coconut_count,
            "tasks_remaining": pending_tasks
        })

    db.close()

    return result