from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Detection, Task

router = APIRouter()


@router.post("/planner/generate_tasks")
def generate_tasks():

    db = SessionLocal()

    detections = db.query(Detection).filter(Detection.ripeness == "mature").all()

    created_tasks = []

    for detection in detections:

        existing_task = db.query(Task).filter(
            Task.tree_id == detection.tree_id,
            Task.coconut_id == detection.coconut_id
        ).first()

        if existing_task:
            continue

        task = Task(
            tree_id=detection.tree_id,
            coconut_id=detection.coconut_id,
            status="pending"
        )

        db.add(task)
        db.commit()
        db.refresh(task)

        created_tasks.append(task.id)

    db.close()

    return {"tasks_created": created_tasks}