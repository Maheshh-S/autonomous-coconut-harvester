from database.models import Task


def create_task_if_needed(db, tree_id, coconut_id):
    """Create a pending harvest Task for a tree/coconut unless one already exists.

    Returns the new task id on creation, or None if a task already existed.
    Centralises the tree/coconut de-duplication used by both the detection and
    planner APIs so the rule lives in one place.
    """
    existing = db.query(Task).filter(
        Task.tree_id == tree_id,
        Task.coconut_id == coconut_id,
    ).first()

    if existing:
        return None

    task = Task(tree_id=tree_id, coconut_id=coconut_id, status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)
    return task.id
