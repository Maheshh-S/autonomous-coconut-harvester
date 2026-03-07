from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Task
from pydantic import BaseModel

router = APIRouter()

@router.get("/robot/next_task")
def get_next_task():

    db = SessionLocal()

    task = db.query(Task).filter(Task.status == "pending").first()

    if not task:
        db.close()
        return {"message": "no pending tasks"}

    task.status = "in_progress"
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