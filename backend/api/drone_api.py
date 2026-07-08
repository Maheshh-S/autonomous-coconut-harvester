from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Tree
from datetime import datetime
import math

router = APIRouter()


# distance between GPS points (meters)
def gps_distance(lat1, lon1, lat2, lon2):

    R = 6371000  # earth radius meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@router.post("/drone/tree_detected")
@router.get("/drone/tree_detected")
def register_tree(gps_lat: float, gps_lon: float):

    db = SessionLocal()

    existing_trees = db.query(Tree).all()

    DISTANCE_THRESHOLD = 4  # meters

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
        detected_time=str(datetime.utcnow())
    )

    db.add(tree)
    db.commit()
    db.refresh(tree)

    db.close()

    return {
        "status": "tree recorded",
        "tree_id": tree.id
    }