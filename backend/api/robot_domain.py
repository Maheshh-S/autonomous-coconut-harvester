"""Version 3.1 — Robot Domain Foundation (backend only).

This milestone establishes the robot's *persisted domain* and the HTTP contract for
inspecting and resetting it. It is deliberately narrow:

- creates the Robot domain models (``Robot``, ``DockStation``, ``RobotBattery``,
  ``RobotConfiguration``) and seeds them as singletons;
- exposes the read/command endpoints scoped to V3.1:
  ``GET /robot``, ``GET /robot/state``, ``POST /robot/reset``,
  ``POST /robot/recharge``, ``POST /robot/speed``.

Explicitly **out of scope** for V3.1 (owned by later milestones): simulation engine,
movement/navigation, the state machine controller, telemetry/events, WebSockets, and
all frontend visualization. ``RobotTelemetry`` / ``RobotEvent`` are NOT created here.

All business rules live in this backend module (Major Design Principle: backend owns
behaviour, frontend only visualizes). The live V1 ``/robot/*`` endpoints
(``robot_api.py``) are untouched — the V3.1 paths do not collide with them.

Determinism (ROBOT_ARCHITECTURE.md §1.1): seeding and reset are fixed-value and
side-effect free; no randomness is introduced.
"""

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from database.db import SessionLocal
from database.models import (
    Robot,
    DockStation,
    RobotBattery,
    RobotBatteryStatus,
    RobotConfiguration,
    RobotState,
    DEFAULT_DOCK_X,
    DEFAULT_DOCK_Y,
    DEFAULT_ROBOT_SPEED,
    DEFAULT_ROBOT_MAX_SPEED,
    DEFAULT_BATTERY_LOW_THRESHOLD,
    DEFAULT_BATTERY_CRITICAL_THRESHOLD,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Domain services (pure-ish: each takes/returns via the DB session; deterministic).
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.utcnow()


def ensure_robot_domain(db) -> Robot:
    """Idempotently create the singleton Robot + its dock, battery, and configuration.

    Safe to call on every boot (init_db) and on read — it never overwrites an
    existing domain row, so a previously mutated robot survives a restart.
    """
    robot = db.query(Robot).order_by(Robot.id).first()
    if robot is None:
        dock = DockStation(
            farm_x=DEFAULT_DOCK_X, farm_y=DEFAULT_DOCK_Y, label="Home Dock"
        )
        db.add(dock)
        db.flush()

        robot = Robot(
            name="Harvester-01",
            status=RobotState.IDLE.value,
            position_x=dock.farm_x,
            position_y=dock.farm_y,
            heading_deg=0.0,
            current_mission_id=None,
            current_task_id=None,
            speed=DEFAULT_ROBOT_SPEED,
            dock_id=dock.id,
        )
        db.add(robot)
        db.flush()

        battery = RobotBattery(
            robot_id=robot.id,
            pct=100.0,
            status=RobotBatteryStatus.IDLE.value,
            last_change_ts=_now(),
        )
        config = RobotConfiguration(
            robot_id=robot.id,
            default_speed=DEFAULT_ROBOT_SPEED,
            max_speed=DEFAULT_ROBOT_MAX_SPEED,
            battery_low_threshold=DEFAULT_BATTERY_LOW_THRESHOLD,
            battery_critical_threshold=DEFAULT_BATTERY_CRITICAL_THRESHOLD,
        )
        db.add_all([battery, config])
        db.flush()
        robot.battery_id = battery.id
        db.commit()
    return robot


def _reset_robot_to_default(db, robot: Robot) -> None:
    """Return the robot to its factory-default state (IDLE, full, docked, no work)."""
    dock = (
        db.query(DockStation).filter(DockStation.id == robot.dock_id).first()
        if robot.dock_id
        else db.query(DockStation).order_by(DockStation.id).first()
    )
    if dock is None:
        dock = DockStation(
            farm_x=DEFAULT_DOCK_X, farm_y=DEFAULT_DOCK_Y, label="Home Dock"
        )
        db.add(dock)
        db.flush()

    config = (
        db.query(RobotConfiguration)
        .filter(RobotConfiguration.robot_id == robot.id)
        .first()
    )
    default_speed = config.default_speed if config else DEFAULT_ROBOT_SPEED

    robot.name = "Harvester-01"
    robot.status = RobotState.IDLE.value
    robot.position_x = dock.farm_x
    robot.position_y = dock.farm_y
    robot.heading_deg = 0.0
    robot.current_mission_id = None
    robot.current_task_id = None
    robot.speed = default_speed
    robot.dock_id = dock.id
    robot.updated_at = _now()

    battery = (
        db.query(RobotBattery)
        .filter(RobotBattery.robot_id == robot.id)
        .first()
    )
    if battery is None:
        battery = RobotBattery(robot_id=robot.id)
        db.add(battery)
    battery.pct = 100.0
    battery.status = RobotBatteryStatus.IDLE.value
    battery.last_change_ts = _now()
    robot.battery_id = battery.id

    db.commit()
    db.refresh(robot)


def _serialize_robot(db, robot: Robot) -> dict:
    dock = (
        db.query(DockStation).filter(DockStation.id == robot.dock_id).first()
        if robot.dock_id
        else None
    )
    battery = (
        db.query(RobotBattery)
        .filter(RobotBattery.robot_id == robot.id)
        .first()
    )
    config = (
        db.query(RobotConfiguration)
        .filter(RobotConfiguration.robot_id == robot.id)
        .first()
    )
    return {
        "id": robot.id,
        "name": robot.name,
        "status": robot.status,
        "position": {"x": robot.position_x, "y": robot.position_y},
        "heading_deg": robot.heading_deg,
        "speed": robot.speed,
        "current_mission_id": robot.current_mission_id,
        "current_task_id": robot.current_task_id,
        "dock": (
            {"id": dock.id, "x": dock.farm_x, "y": dock.farm_y, "label": dock.label}
            if dock
            else None
        ),
        "battery": (
            {
                "pct": battery.pct,
                "status": battery.status,
                "last_change_ts": battery.last_change_ts.isoformat(),
            }
            if battery
            else None
        ),
        "config": (
            {
                "default_speed": config.default_speed,
                "max_speed": config.max_speed,
                "battery_low_threshold": config.battery_low_threshold,
                "battery_critical_threshold": config.battery_critical_threshold,
            }
            if config
            else None
        ),
        "updated_at": robot.updated_at.isoformat(),
    }


def _serialize_state(robot: Robot, battery: RobotBattery) -> dict:
    return {
        "status": robot.status,
        "battery_pct": battery.pct if battery else None,
        "position": {"x": robot.position_x, "y": robot.position_y},
        "heading_deg": robot.heading_deg,
        "speed": robot.speed,
        "current_mission_id": robot.current_mission_id,
        "current_task_id": robot.current_task_id,
        "docked": robot.status == RobotState.DOCKED.value
        or (
            robot.current_mission_id is None
            and robot.current_task_id is None
            and robot.status == RobotState.IDLE.value
        ),
    }


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------


@router.get("/robot")
def get_robot():
    """Full robot domain snapshot: robot + dock + battery + configuration."""
    db = SessionLocal()
    try:
        robot = ensure_robot_domain(db)
        return _serialize_robot(db, robot)
    finally:
        db.close()


@router.get("/robot/state")
def get_robot_state():
    """Lightweight on-demand state (status, battery, position, mission, task, speed)."""
    db = SessionLocal()
    try:
        robot = ensure_robot_domain(db)
        battery = (
            db.query(RobotBattery)
            .filter(RobotBattery.robot_id == robot.id)
            .first()
        )
        return _serialize_state(robot, battery)
    finally:
        db.close()


@router.post("/robot/reset")
def reset_robot():
    """Return the robot to its default state (IDLE, 100% battery, docked, no work)."""
    db = SessionLocal()
    try:
        robot = ensure_robot_domain(db)
        _reset_robot_to_default(db, robot)
        battery = (
            db.query(RobotBattery)
            .filter(RobotBattery.robot_id == robot.id)
            .first()
        )
        return _serialize_state(robot, battery)
    finally:
        db.close()


@router.post("/robot/recharge")
def recharge_robot():
    """Restore the battery to 100%. Leaves the robot's lifecycle state untouched."""
    db = SessionLocal()
    try:
        robot = ensure_robot_domain(db)
        battery = (
            db.query(RobotBattery)
            .filter(RobotBattery.robot_id == robot.id)
            .first()
        )
        if battery is None:
            battery = RobotBattery(robot_id=robot.id)
            db.add(battery)
        battery.pct = 100.0
        battery.status = RobotBatteryStatus.IDLE.value
        battery.last_change_ts = _now()
        db.commit()
        db.refresh(battery)
        return _serialize_state(robot, battery)
    finally:
        db.close()


class RobotSpeedRequest(BaseModel):
    speed: float


@router.post("/robot/speed")
def set_robot_speed(data: RobotSpeedRequest):
    """Set the operator traversal speed. Clamped to (0, config.max_speed]."""
    if data.speed <= 0:
        return {"error": "speed must be a positive number"}
    db = SessionLocal()
    try:
        robot = ensure_robot_domain(db)
        config = (
            db.query(RobotConfiguration)
            .filter(RobotConfiguration.robot_id == robot.id)
            .first()
        )
        max_speed = config.max_speed if config else DEFAULT_ROBOT_MAX_SPEED
        robot.speed = min(data.speed, max_speed)
        robot.updated_at = _now()
        db.commit()
        db.refresh(robot)
        battery = (
            db.query(RobotBattery)
            .filter(RobotBattery.robot_id == robot.id)
            .first()
        )
        result = _serialize_state(robot, battery)
        result["requested_speed"] = data.speed
        result["applied_speed"] = robot.speed
        return result
    finally:
        db.close()
