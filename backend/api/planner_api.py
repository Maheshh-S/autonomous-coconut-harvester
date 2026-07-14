from fastapi import APIRouter
from sqlalchemy import func

from database.db import SessionLocal
from database.models import Detection
from database.tasks import create_task_if_needed

router = APIRouter()


@router.post("/planner/generate_tasks")
def generate_tasks():

    db = SessionLocal()

    detections = db.query(Detection).filter(
        func.lower(Detection.ripeness) == "mature"
    ).all()

    created_tasks = []

    for detection in detections:
        task_id = create_task_if_needed(db, detection.tree_id, detection.coconut_id)
        if task_id is not None:
            created_tasks.append(task_id)

    db.close()

    return {"tasks_created": created_tasks}