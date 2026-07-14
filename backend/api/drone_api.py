from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Tree
from datetime import datetime

from api.gps_projection import gps_distance, DISTANCE_THRESHOLD

router = APIRouter()


@router.post("/drone/tree_detected")
@router.get("/drone/tree_detected")
def register_tree(gps_lat: float, gps_lon: float):

    db = SessionLocal()

    existing_trees = db.query(Tree).all()

    for tree in existing_trees:

        dist = gps_distance(
            gps_lat,
            gps_lon,
            tree.gps_lat,
            tree.gps_lon
        )

        if dist < DISTANCE_THRESHOLD:

            db.close()

            return {
                "status": "existing tree reused",
                "tree_id": tree.id
            }

    tree = Tree(
        gps_lat=gps_lat,
        gps_lon=gps_lon,
        detected_time=str(datetime.utcnow()),
        first_seen_mission_id=None,
        last_seen_mission_id=None,
        times_seen=1,
        availability="ACTIVE",
        lifecycle_state="DETECTED",
    )

    db.add(tree)
    db.flush()
    # Immutable public code derived from the row id — unique and stable.
    tree.tree_code = f"TREE-{tree.id:04d}"
    db.commit()
    db.refresh(tree)

    db.close()

    return {
        "status": "tree recorded",
        "tree_id": tree.id
    }