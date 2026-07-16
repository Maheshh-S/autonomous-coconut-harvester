"""Version 3.4 — Simulation Scheduler (the only wall-clock / thread driver).

The ``SimulationScheduler`` is the bridge between the **pure** engine and the
**real world**. Everything wall-clock lives here; the engine and clock stay pure.

Responsibilities:
- ``start``: resolve the Harvest Mission, build the immutable ``NavigationPlan``
  via ``NavigationService``, create a ``SimulationContext`` + ``SimulationEngine``,
  kick off a daemon thread that ticks at a fixed real interval.
- Each tick: compute the simulation ``dt`` for the elapsed real time (scaled by
  ``speed_factor``), call ``engine.step(ctx, dt, transition_fn)``, then persist
  the context back onto the ``Robot`` / ``RobotBattery`` rows (a fresh DB session
  per tick — the engine itself never sees the database).
- ``pause`` / ``resume``: freeze / continue the ``SimulationClock``.
- ``stop``: halt the thread, reset the run, leave the robot where it is (caller
  may reset separately).

Discipline (ROBOT_ARCHITECTURE.md §5): the scheduler drives time; it does NOT
decide navigation (the plan is pre-built) and does NOT validate transitions (it
delegates to ``RobotStateMachine`` via ``transition_fn``). ``RobotStateMachine``
remains the sole mutator of persisted ``robot.status``.

This module is a **singleton** (one robot, one active run). The API router holds
the single instance.

Note on "no WebSocket / no telemetry": the scheduler collects the events the
engine returns each step into an in-memory ring (for the GET endpoint) but does
NOT persist or stream them. V3.5 telemetry will consume the same event objects.
"""

import threading
import time
from typing import List, Optional

from database.db import SessionLocal
from database.models import (
    Robot,
    RobotBattery,
    RobotConfiguration,
    RobotState,
)
from robot.state_machine import RobotStateMachine, IllegalTransition

from simulation.clock import SimulationClock
from simulation.context import SimulationContext, SimulationEvent
from simulation.engine import SimulationEngine
from navigation import build_navigation
from telemetry.event_bus import event_bus, TOPIC_SIM_EVENTS
from telemetry.service import telemetry_service

# Fixed real-time tick interval (seconds). One tick = one engine.step of
# (real_tick * speed_factor) simulation seconds. Smaller = smoother but more DB
# writes. 0.1 s real tick is a reasonable default.
REAL_TICK_INTERVAL_S = 0.1

# In-memory event ring per run (not persisted in V3.4).
MAX_EVENTS = 1000


class SimulationScheduler:
    """Singleton driver for one robot simulation run."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._clock = SimulationClock()
        self._engine = SimulationEngine()
        self._ctx: Optional[SimulationContext] = None
        self._mission_id: Optional[int] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._events: List[SimulationEvent] = []
        self._status = "stopped"  # stopped | running | paused | finished
        self._last_wall = 0.0
        self._error: Optional[str] = None
        self._robot_id: Optional[int] = None

    # -- public control ----------------------------------------------------

    def start(
        self, mission_id: Optional[int] = None, speed_factor: float = 1.0
    ) -> dict:
        with self._lock:
            if self._status == "running":
                raise RuntimeError("simulation already running")
            self._stop_event.clear()
            self._error = None
            self._events = []

            # Build the immutable navigation plan (read-only; raises ValueError if
            # no mission resolves).
            db = SessionLocal()
            try:
                nav = build_navigation(db, mission_id=mission_id)
                mission_id_resolved = nav.mission_id
                robot = db.query(Robot).order_by(Robot.id).first()
                if robot is None:
                    from api.robot_domain import ensure_robot_domain

                    robot = ensure_robot_domain(db)
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
                speed = float(robot.speed) if robot.speed else 1.0
                battery_low = (
                    config.battery_low_threshold
                    if config
                    else 20.0
                )
            finally:
                db.close()

            # Assemble the pure context from the frozen plan. The robot begins at
            # the dock (waypoint 0) in IDLE, so the first leg targets waypoint 1
            # (first tree); we never re-traverse the starting dock. A run always
            # starts from a clean IDLE state regardless of any prior robot status.
            self._ctx = SimulationContext(
                waypoints=list(nav.plan.waypoints),
                wp_index=1 if len(nav.plan.waypoints) > 1 else 0,
                leg_progress=0.0,
                pos_x=nav.dock["x"],
                pos_y=nav.dock["y"],
                heading_deg=robot.heading_deg,
                speed=speed,
                status=RobotState.IDLE.value,
                battery_pct=battery.pct if battery else 100.0,
                battery_low_threshold=battery_low,
                mission_id=mission_id_resolved,
                current_item_id=None,
                completed_item_ids=[],
                state_timer=0.0,
                sim_time=0.0,
                battery_low=False,
                finished=False,
            )
            self._mission_id = mission_id_resolved
            self._robot_id = robot.id

            # The previous run (if any) left the *persisted* robot in its final
            # state (e.g. DOCKED after a completed run, or ERROR after a fault). A
            # fresh run always begins from a clean IDLE, so reset the persisted
            # robot to IDLE first. DOCKED -> IDLE and ERROR -> IDLE are both legal
            # edges; if it is already IDLE this is a no-op. Without this, the first
            # MOVING request would compare against the stale persisted status and
            # be rejected (e.g. DOCKED -> MOVING is illegal). The context's status
            # is already IDLE, so this reconciles the persisted row with it.
            if robot.status != RobotState.IDLE.value:
                self._reset_persisted_to_idle()

            # Begin telemetry collection (append-only; never mutates the robot).
            # The TelemetryService subscribes to the same bus the scheduler
            # publishes to each tick, so it observes without coupling.
            telemetry_service.start()

            # Kick the robot off the dock into MOVING toward the first waypoint
            # (the engine only advances once it is MOVING). Starts from IDLE, so
            # this is the legal IDLE → MOVING edge.
            self._apply_transition("MOVING", "mission start")

            self._clock.start(time.monotonic(), speed_factor=speed_factor)
            self._last_wall = time.monotonic()
            self._status = "running"

            # Persist the initial assignment (mission + task pointers) and launch.
            self._persist()
            self._thread = threading.Thread(
                target=self._run_loop, name="robot-sim", daemon=True
            )
            self._thread.start()
            return self.status()

    def pause(self) -> dict:
        with self._lock:
            if self._status != "running":
                return self.status()
            self._clock.pause(time.monotonic())
            self._status = "paused"
            return self.status()

    def resume(self) -> dict:
        with self._lock:
            if self._status != "paused":
                return self.status()
            self._clock.resume(time.monotonic())
            self._status = "running"
            return self.status()

    def stop(self) -> dict:
        with self._lock:
            was_running = self._status in ("running", "paused")
            self._stop_event.set()
            self._clock.stop()
            self._status = "stopped"
            # NOTE (V3.5.1): stopping the run must NOT discard the last run's
            # context. The completed/last mission context (mission_id,
            # completed_item_ids, waypoint_count, final statistics) stays
            # available via ``status()`` until the next ``start`` or an explicit
            # ``reset``. We only halt the driver thread and clear the transient
            # event ring — ``self._ctx`` / ``self._mission_id`` / ``self._robot_id``
            # are deliberately retained. ``Robot.state`` is left exactly as the last
            # tick persisted it (never overwritten by the simulation status here).
            self._events = []
            # Stop persisting telemetry (history is retained, append-only).
            telemetry_service.stop()
            if was_running and self._thread is not None:
                # Do not join (daemon thread); just mark stopped. Persisted robot
                # state is left as-is (caller may reset via /robot/reset).
                self._thread = None
            return self.status()

    def status(self) -> dict:
        with self._lock:
            return {
                "status": self._status,
                "mission_id": self._mission_id,
                "sim_time": self._ctx.sim_time if self._ctx else 0.0,
                "speed_factor": self._clock.speed_factor,
                "waypoint_index": self._ctx.wp_index if self._ctx else 0,
                "waypoint_count": len(self._ctx.waypoints) if self._ctx else 0,
                "completed_item_ids": (
                    list(self._ctx.completed_item_ids) if self._ctx else []
                ),
                "finished": self._ctx.finished if self._ctx else False,
                "error": self._error,
                "recent_events": [
                    {"type": e.type, "sim_time": e.sim_time, "detail": e.detail}
                    for e in self._events[-20:]
                ],
            }

    # -- internals ---------------------------------------------------------

    def _transition_fn(self, current: str, target: str, reason: str) -> str:
        """Wire engine transitions to the frozen ``RobotStateMachine``.

        The state machine is the **only** component permitted to mutate the
        persisted ``robot.status``. This callback runs inside the tick, opening
        its own session, performing the validated transition, and committing.

        The state machine is the **only** component permitted to mutate the
        persisted ``robot.status``. This callback runs inside the tick, opening its
        own session, performing the validated transition, and committing. If the
        transition is illegal, the machine raises ``IllegalTransition`` — we treat
        that as a fatal run error (the engine only ever requests legal edges).
        """
        db = SessionLocal()
        try:
            robot = db.query(Robot).order_by(Robot.id).first()
            if robot is None:
                from api.robot_domain import ensure_robot_domain

                robot = ensure_robot_domain(db)
            machine = RobotStateMachine(robot)
            machine.transition(db, target, reason=reason)
            new_status = robot.status
            db.commit()
            return new_status
        except IllegalTransition as exc:
            db.rollback()
            self._error = f"illegal transition {current}->{target}: {exc}"
            raise
        finally:
            db.close()

    def _apply_transition(self, target: str, reason: str) -> None:
        new_status = self._transition_fn(self._ctx.status, target, reason)
        if new_status != self._ctx.status:
            self._ctx.status = new_status

    def _reset_persisted_to_idle(self) -> None:
        """Reconcile the persisted robot to IDLE before a fresh run.

        A prior run (or a ``stop`` mid-run) may leave the persisted
        ``robot.status`` in any state. The state machine is the sole mutator of
        ``robot.status``, so we walk back to IDLE along the frozen legal edges
        (each step recorded as a transition): an active state first returns to
        the dock (MOVING/CLIMBING/SCANNING/HARVESTING -> RETURNING -> DOCKED),
        DOCKED -> IDLE, and ERROR -> IDLE. IDLE is a no-op. This guarantees the
        upcoming IDLE -> MOVING start transition is valid regardless of the prior
        run's final state.
        """
        db = SessionLocal()
        try:
            robot = db.query(Robot).order_by(Robot.id).first()
            if robot is None:
                from api.robot_domain import ensure_robot_domain

                robot = ensure_robot_domain(db)
            machine = RobotStateMachine(robot)
            guard = 0
            while robot.status != RobotState.IDLE.value and guard < 6:
                guard += 1
                if robot.status == RobotState.DOCKED.value:
                    machine.transition(db, RobotState.IDLE.value, reason="new run reset")
                elif robot.status == RobotState.ERROR.value:
                    machine.transition(db, RobotState.IDLE.value, reason="new run reset")
                elif robot.status == RobotState.RETURNING.value:
                    machine.transition(db, RobotState.DOCKED.value, reason="new run reset")
                else:  # MOVING / CLIMBING / SCANNING / HARVESTING -> head home first
                    machine.transition(
                        db, RobotState.RETURNING.value, reason="new run reset"
                    )
                db.commit()
        finally:
            db.close()

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            if self._status != "running" or self._ctx is None or self._ctx.finished:
                if self._ctx is not None and self._ctx.finished:
                    with self._lock:
                        self._status = "finished"
                    self._persist()
                    telemetry_service.stop()
                    break
                time.sleep(REAL_TICK_INTERVAL_S)
                continue

            now = time.monotonic()
            with self._lock:
                # Simulation dt for this real tick (scaled, never negative).
                dt = max(0.0, (now - self._last_wall) * self._clock.speed_factor)
                self._last_wall = now

            events = self._engine.step(
                self._ctx, dt, self._transition_fn
            )
            self._events.extend(events)
            if len(self._events) > MAX_EVENTS:
                self._events = self._events[-MAX_EVENTS:]

            # Publish this tick's events to the telemetry bus (V3.5). The bus is a
            # pure relay: the engine/scheduler never know who consumes these. The
            # TelemetryService persists them and the WebSocketGateway streams them.
            event_bus.publish(
                TOPIC_SIM_EVENTS,
                {
                    "events": events,
                    "context": self._ctx,
                    "robot_id": self._robot_id,
                    "mission_id": self._mission_id,
                },
            )

            self._persist()

            if self._ctx.finished:
                with self._lock:
                    self._status = "finished"
                telemetry_service.stop()
                break

            time.sleep(REAL_TICK_INTERVAL_S)

    def _persist(self) -> None:
        """Copy the pure context back onto the persisted robot/battery rows."""
        if self._ctx is None:
            return
        db = SessionLocal()
        try:
            robot = db.query(Robot).order_by(Robot.id).first()
            if robot is None:
                from api.robot_domain import ensure_robot_domain

                robot = ensure_robot_domain(db)
            battery = (
                db.query(RobotBattery)
                .filter(RobotBattery.robot_id == robot.id)
                .first()
            )
            if battery is None:
                battery = RobotBattery(robot_id=robot.id)
                db.add(battery)

            robot.position_x = self._ctx.pos_x
            robot.position_y = self._ctx.pos_y
            robot.heading_deg = self._ctx.heading_deg
            robot.speed = self._ctx.speed
            # Guard (V3.5.1): ``robot.status`` is the authoritative RobotState and
            # must never hold the *simulation* status (running/paused/stopped/
            # finished). Only a legal ``RobotState`` value is ever written here.
            # The engine always carries a valid RobotState, so this is a fail-safe.
            if self._ctx.status in {s.value for s in RobotState}:
                robot.status = self._ctx.status
            robot.current_mission_id = self._ctx.mission_id
            robot.current_task_id = self._ctx.current_item_id
            robot.updated_at = _utcnow()

            battery.pct = self._ctx.battery_pct
            battery.status = (
                "DISCHARGING" if self._ctx.is_active_state() else "IDLE"
            )
            battery.last_change_ts = _utcnow()

            db.commit()
        except Exception as exc:  # surface but do not crash the thread
            db.rollback()
            self._error = f"persist error: {exc}"
        finally:
            db.close()


def _utcnow():
    from datetime import datetime

    return datetime.utcnow()


# The single scheduler instance (one robot, one run).
scheduler = SimulationScheduler()
