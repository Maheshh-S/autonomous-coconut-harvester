"""Version 3.7 — Robot Mission History & Analytics API (read-only).

Exposes the backend-owned Operations Center data: run history, a single run's
summary/analytics, its synthesized timeline, per-tree activity, and the raw robot
event log. Every metric is computed in ``analytics/mission_history.py`` from the
immutable telemetry/events + mission records — the frontend only renders it and
never recomputes business logic (AGENTS.md / ROBOT_ARCHITECTURE.md).

All endpoints are GET (history is append-only and written only by the scheduler at
run termination). Read access requires no mutation.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from database.db import SessionLocal
from analytics.mission_history import (
    list_runs,
    get_run,
    build_timeline,
    build_tree_activity,
    build_robot_log,
)

router = APIRouter()


@router.get("/robot/runs")
def get_runs(limit: int = Query(100, ge=1, le=500)):
    """Mission history — newest first. Each row is the RobotRun summary."""
    db = SessionLocal()
    try:
        runs = list_runs(db, limit=limit)
        return [r.to_dict() for r in runs]
    finally:
        db.close()


@router.get("/robot/runs/{run_id}")
def get_run_detail(run_id: int):
    """A single run's full summary + analytics payload."""
    db = SessionLocal()
    try:
        run = get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        return run.to_dict()
    finally:
        db.close()


@router.get("/robot/runs/{run_id}/timeline")
def get_run_timeline(run_id: int):
    """Chronological, visual timeline of the run (backend-synthesized)."""
    db = SessionLocal()
    try:
        run = get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        return build_timeline(db, robot_id=run.robot_id, mission_id=run.mission_id)
    finally:
        db.close()


@router.get("/robot/runs/{run_id}/tree-activity")
def get_run_tree_activity(run_id: int):
    """Per-tree activity for the run, joined to Tree / Item / Inspection."""
    db = SessionLocal()
    try:
        run = get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        return build_tree_activity(db, robot_id=run.robot_id, mission_id=run.mission_id)
    finally:
        db.close()


@router.get("/robot/runs/{run_id}/robot-log")
def get_run_robot_log(run_id: int, limit: int = Query(500, ge=1, le=2000)):
    """Raw robot event log for the run."""
    db = SessionLocal()
    try:
        run = get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        return build_robot_log(
            db, robot_id=run.robot_id, mission_id=run.mission_id, limit=limit
        )
    finally:
        db.close()
