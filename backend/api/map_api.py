from fastapi import APIRouter
from sqlalchemy import func
from database.db import SessionLocal
from database.models import Tree, Detection, Task

router = APIRouter()

@router.get("/plantation/map")
def get_tree_map():

    db = SessionLocal()

    try:
        trees = db.query(Tree).all()

        # Aggregate counts in two grouped queries instead of one query per tree
        # (avoids an N+1 that is crippling at plantation scale). Semantics and
        # response shape are unchanged.
        detection_counts = dict(
            db.query(Detection.tree_id, func.count(Detection.id))
            .group_by(Detection.tree_id)
            .all()
        )

        pending_task_counts = dict(
            db.query(Task.tree_id, func.count(Task.id))
            .filter(Task.status != "completed")
            .group_by(Task.tree_id)
            .all()
        )

        result = [
            {
                "tree_id": tree.id,
                "tree_code": tree.tree_code,
                "gps_lat": tree.gps_lat,
                "gps_lon": tree.gps_lon,
                "coconuts_detected": detection_counts.get(tree.id, 0),
                "tasks_remaining": pending_task_counts.get(tree.id, 0),
            }
            for tree in trees
        ]

        return result

    finally:
        db.close()