from datetime import datetime, timedelta

from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Task
from pydantic import BaseModel

router = APIRouter()

# Tasks claimed longer ago than this without being completed are considered
# stale and are released back to the pending pool on the next poll.
STUCK_TASK_THRESHOLD = timedelta(minutes=5)

@router.get("/robot/next_task")
def get_next_task():

    db = SessionLocal()

    # Release tasks that were claimed but never completed (e.g. robot crashed).
    cutoff = datetime.utcnow() - STUCK_TASK_THRESHOLD
    stale_tasks = db.query(Task).filter(
        Task.status == "in_progress",
        Task.claimed_at < cutoff,
    ).all()

    for stale in stale_tasks:
        stale.status = "pending"
        stale.claimed_at = None

    if stale_tasks:
        db.commit()

    task = db.query(Task).filter(
        Task.status == "pending"
    ).order_by(Task.priority.desc(), Task.tree_id).first()

    if not task:
        db.close()
        return {"message": "no pending tasks"}

    task.status = "in_progress"
    task.claimed_at = datetime.utcnow()
    db.commit()

    response = {
        "task_id": task.id,
        "tree_id": task.tree_id,
        "coconut_id": task.coconut_id,
        "status": task.status
    }

    db.close()

    return response

class TaskComplete(BaseModel):
    task_id: int

@router.post("/robot/complete_task")
def complete_task(data: TaskComplete):

    db = SessionLocal()

    task = db.query(Task).filter(Task.id == data.task_id).first()

    if not task:
        db.close()
        return {"error": "task not found"}

    task.status = "completed"

    db.commit()

    db.close()

    return {"status": "task completed", "task_id": data.task_id}