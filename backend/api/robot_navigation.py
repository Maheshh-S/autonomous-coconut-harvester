"""Version 3.2 — Robot Navigation API (read-only).

Exposes computed navigation only. Nothing here executes the robot or mutates any
state; both endpoints delegate to ``NavigationService.build_navigation`` (read-only)
and serialize the result. Mirrors the V3.1 ``robot_domain`` router style.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from database.db import SessionLocal
from navigation import build_navigation, serialize_navigation

router = APIRouter()


@router.get("/robot/navigation")
def get_robot_navigation(mission_id: Optional[int] = Query(None)):
    """Computed navigation for the robot against a Harvest Mission.

    Returns the next destination, remaining destinations, total travel distance,
    and the full plan. Read-only — no execution, no Robot-state mutation.
    """
    db = SessionLocal()
    try:
        try:
            result = build_navigation(db, mission_id=mission_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        return serialize_navigation(result)
    finally:
        db.close()


@router.get("/robot/navigation/plan")
def get_robot_navigation_plan(mission_id: Optional[int] = Query(None)):
    """The ordered navigation plan (waypoints) only — computed, not executed."""
    db = SessionLocal()
    try:
        try:
            result = build_navigation(db, mission_id=mission_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        return serialize_navigation(result)["plan"]
    finally:
        db.close()
