"""Version 3.5 — Robot Telemetry HTTP API.

Read-only endpoints over the append-only telemetry history persisted by
``TelemetryService``. None of these mutate the robot, navigation, the state
machine, or the simulation; they only query the ``robot_telemetry`` /
``robot_events`` tables.

The live streaming endpoint is the WebSocket at ``/ws/robot`` (mounted in
``main.py``), not here.
"""

from typing import Optional

from fastapi import APIRouter, Query

from api.robot_domain import ensure_robot_domain
from database.db import SessionLocal
from database.models import Robot
from telemetry.service import telemetry_service

router = APIRouter()


def _robot_id() -> int:
    db = SessionLocal()
    try:
        robot = db.query(Robot).order_by(Robot.id).first()
        if robot is None:
            robot = ensure_robot_domain(db)
        return robot.id
    finally:
        db.close()


@router.get("/robot/telemetry")
def get_latest_telemetry(limit: int = Query(1, ge=1, le=100)):
    """Most recent telemetry snapshots (newest first). Default: the latest one."""
    rows = telemetry_service.latest_telemetry(_robot_id(), limit=limit)
    return {
        "count": len(rows),
        "telemetry": [
            {
                "id": r.id,
                "sim_time": r.sim_time,
                "status": r.status,
                "battery_pct": r.battery_pct,
                "position": {"x": r.position_x, "y": r.position_y},
                "heading_deg": r.heading_deg,
                "speed": r.speed,
                "waypoint_index": r.waypoint_index,
                "completed_item_count": r.completed_item_count,
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            }
            for r in rows
        ],
    }


@router.get("/robot/telemetry/events")
def get_telemetry_events(limit: int = Query(100, ge=1, le=1000)):
    """Most recent simulation events (newest first), for reconnect / history."""
    import json

    rows = telemetry_service.recent_events(_robot_id(), limit=limit)
    return {
        "count": len(rows),
        "events": [
            {
                "id": r.id,
                "event_type": r.event_type,
                "sim_time": r.sim_time,
                "detail": json.loads(r.detail) if r.detail else {},
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            }
            for r in rows
        ],
    }
