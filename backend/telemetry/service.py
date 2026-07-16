"""Version 3.5 — Telemetry Service (persistence only, never mutates).

``TelemetryService`` is a **read-side consumer** of the simulation. It subscribes
to the ``EventBus`` ``TOPIC_SIM_EVENTS`` topic and, for every tick, persists:

- one ``RobotTelemetry`` row — the robot's full state snapshot at that sim-time
  (position, battery, status, progress), and
- one ``RobotEvent`` row per ``SimulationEvent`` the engine emitted this tick.

Hard discipline (ROBOT_ARCHITECTURE.md §5 / V3.5 scope): the service is strictly
append-only and **never** mutates the authoritative robot state (``Robot``),
navigation (``NavigationService``), or the state machine (``RobotStateMachine``).
It only *reads* the simulation's own event objects and *writes* telemetry history.
A failure inside persistence is caught by the ``EventBus`` so it cannot stall the
simulation producer.

This is a singleton (``telemetry_service``); the scheduler starts/stops it around
a run so history is scoped per run.
"""

import json
import logging
from typing import List, Optional

from database.db import SessionLocal
from database.models import RobotEvent, RobotTelemetry
from simulation.context import SimulationContext, SimulationEvent

from telemetry.event_bus import EventBus, TOPIC_SIM_EVENTS


logger = logging.getLogger(__name__)


class TelemetryService:
    """Persists append-only telemetry from simulation events."""

    def __init__(self, event_bus: EventBus) -> None:
        self._bus = event_bus
        self._subscribed = False

    def start(self) -> None:
        """Begin consuming simulation events. Idempotent."""
        if not self._subscribed:
            self._bus.subscribe(TOPIC_SIM_EVENTS, self._on_events)
            self._subscribed = True

    def stop(self) -> None:
        """Stop consuming. Telemetry history is left intact (append-only)."""
        if self._subscribed:
            self._bus.unsubscribe(TOPIC_SIM_EVENTS, self._on_events)
            self._subscribed = False

    # -- consumer -----------------------------------------------------------

    def _on_events(self, payload: object) -> None:
        """Persist one telemetry snapshot + the tick's events.

        ``payload`` is the dict published by ``SimulationScheduler``:
        ``{"events": [SimulationEvent...], "context": SimulationContext,
        "robot_id": int, "mission_id": Optional[int]}``.
        """
        if not isinstance(payload, dict):
            return
        context = payload.get("context")
        events = payload.get("events")
        robot_id = payload.get("robot_id")
        mission_id = payload.get("mission_id")
        if not isinstance(context, SimulationContext) or robot_id is None:
            return
        self._persist(context, events or [], robot_id, mission_id)

    def _persist(
        self,
        ctx: SimulationContext,
        events: List[SimulationEvent],
        robot_id: int,
        mission_id: Optional[int],
    ) -> None:
        db = SessionLocal()
        try:
            # One snapshot row for the tick's resulting state.
            db.add(
                RobotTelemetry(
                    robot_id=robot_id,
                    mission_id=mission_id,
                    sim_time=ctx.sim_time,
                    status=ctx.status,
                    battery_pct=ctx.battery_pct,
                    position_x=ctx.pos_x,
                    position_y=ctx.pos_y,
                    heading_deg=ctx.heading_deg,
                    speed=ctx.speed,
                    waypoint_index=ctx.wp_index,
                    completed_item_count=len(ctx.completed_item_ids),
                )
            )

            # One event row per engine event this tick.
            for ev in events:
                detail = ev.detail if isinstance(ev.detail, dict) else {}
                db.add(
                    RobotEvent(
                        robot_id=robot_id,
                        mission_id=mission_id,
                        event_type=ev.type,
                        sim_time=ev.sim_time,
                        detail=json.dumps(detail, default=str),
                    )
                )

            db.commit()
        except Exception as exc:  # never break the producer tick
            db.rollback()
            logger.warning("TelemetryService persist failed: %s", exc)
        finally:
            db.close()

    # -- backfill query helper (used by HTTP endpoints) ---------------------

    def latest_telemetry(self, robot_id: int, limit: int = 1):
        """Return the most recent ``RobotTelemetry`` rows (newest first)."""
        db = SessionLocal()
        try:
            return (
                db.query(RobotTelemetry)
                .filter(RobotTelemetry.robot_id == robot_id)
                .order_by(RobotTelemetry.sim_time.desc())
                .limit(limit)
                .all()
            )
        finally:
            db.close()

    def recent_events(self, robot_id: int, limit: int = 100):
        """Return the most recent ``RobotEvent`` rows (newest first)."""
        db = SessionLocal()
        try:
            return (
                db.query(RobotEvent)
                .filter(RobotEvent.robot_id == robot_id)
                .order_by(RobotEvent.id.desc())
                .limit(limit)
                .all()
            )
        finally:
            db.close()


# The single telemetry service (shares the singleton bus).
from telemetry.event_bus import event_bus as _event_bus

telemetry_service = TelemetryService(_event_bus)
