"""Version 3.4 — Simulation Engine (pure, deterministic ``step(dt)``).

The engine is the **executor** only (ROBOT_ARCHITECTURE.md §5). It does NOT:
- decide navigation (``RobotNavigator`` / ``NavigationService`` own that),
- validate the transition *set* (``RobotStateMachine`` owns that),
- emit WebSocket messages (telemetry, V3.5),
- render UI (frontend, V3.5).

It consumes a ``SimulationContext`` (position, battery, status, the immutable
``NavigationPlan`` waypoints) and advances it by one fixed ``dt`` (simulation
seconds). Given the same ``(context, dt)`` it always produces the same result —
no wall-clock, no randomness, no database, no I/O.

State transitions are delegated to an injected ``transition_fn(current, target,
reason) -> new_status``. The production scheduler wires this to
``RobotStateMachine.transition(db, ...)`` so the state machine remains the
**sole** mutator of persisted ``Robot.status``; unit tests inject a pure in-memory
validator, keeping the engine free of the database.

Movement is simple linear interpolation between waypoints in farm-pixel space
(no curves, no obstacle avoidance, no physics). Battery drains while the robot is
in an active state (MOVING / CLIMBING / SCANNING / HARVESTING / RETURNING) and is
clamped to ``[0, 100]``. When it reaches the configured low threshold the engine
routes to the dock (skipping remaining trees) by requesting RETURNING.
"""

from typing import Callable, List

from simulation.context import SimulationContext, SimulationEvent
from simulation.context import (
    EVENT_WAYPOINT_REACHED,
    EVENT_TREE_REACHED,
    EVENT_HARVEST_STARTED,
    EVENT_HARVEST_FINISHED,
    EVENT_RETURNED_TO_DOCK,
    EVENT_MISSION_COMPLETED,
    EVENT_BATTERY_LOW,
    EVENT_STATE_CHANGED,
    EVENT_MOVING,
)
# V3.7.3 — battery drain rate is a shared, calibrated constant (per simulation
# second) so it stays in one place and retargets with the default speed.
from simulation.config import BATTERY_DRAIN_PER_S

# --- Deterministic activity durations (simulation seconds) -----------------
# These are fixed, operator-independent constants. They live here (not in
# RobotConfiguration) because the spec scopes V3.4 to "execute the plan"; tunable
# per-tree timing is a later concern. They make the engine fully deterministic.
CLIMB_DURATION_S = 2.0
SCAN_DURATION_S = 2.0
HARVEST_DURATION_S = 3.0


def _distance(ax: float, ay: float, bx: float, by: float) -> float:
    return ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5


def _heading_deg(dx: float, dy: float) -> float:
    import math

    return math.degrees(math.atan2(dy, dx))


class SimulationEngine:
    """Pure, deterministic simulation executor.

    ``step(ctx, dt, transition_fn)`` mutates ``ctx`` in place and returns the list
    of events produced during the step. It never reads a clock,
    never touches the database, and never mutates ``ctx.status`` except through
    ``transition_fn``.
    """

    def step(
        self,
        ctx: SimulationContext,
        dt: float,
        transition_fn: Callable[[str, str, str], str],
    ) -> List[SimulationEvent]:
        events: List[SimulationEvent] = []
        if ctx.finished or dt <= 0:
            return events

        ctx.sim_time += dt

        # --- 1. battery drain (active states only) -------------------------
        if ctx.is_active_state():
            ctx.battery_pct = max(0.0, ctx.battery_pct - BATTERY_DRAIN_PER_S * dt)
            if (
                not ctx.battery_low
                and ctx.battery_pct <= ctx.battery_low_threshold
                and ctx.status not in {"RETURNING", "DOCKED", "ERROR"}
            ):
                ctx.battery_low = True
                # Per spec: on hitting the low threshold the robot requests
                # RETURNING. The legal edge set routes MOVING/CLIMBING/SCANNING/
                # HARVESTING → RETURNING; the machine is the sole status mutator.
                self._transition(
                    ctx, "RETURNING", "battery low", transition_fn, events
                )
                # Re-target the leg straight to the dock so the robot abandons the
                # current tree and heads home (skipping remaining trees).
                self._divert_to_dock(ctx)
                events.append(
                    SimulationEvent(
                        EVENT_BATTERY_LOW,
                        ctx.sim_time,
                        {"battery_pct": ctx.battery_pct},
                    )
                )

        # --- 2. dispatch on current state ----------------------------------
        handler = {
            "MOVING": self._step_moving,
            "CLIMBING": self._step_timed,
            "SCANNING": self._step_timed,
            "HARVESTING": self._step_timed,
            "RETURNING": self._step_moving,
        }.get(ctx.status, self._step_idle)

        new_events = handler(ctx, dt, transition_fn)
        events.extend(new_events)
        return events

    # -- state handlers ----------------------------------------------------

    def _step_idle(self, ctx, dt, transition_fn) -> List[SimulationEvent]:
        # Idle means the run has not been kicked off; the scheduler starts the
        # run by requesting MOVING itself. Nothing advances here.
        return []

    def _step_moving(self, ctx, dt, transition_fn) -> List[SimulationEvent]:
        events: List[SimulationEvent] = []
        target = ctx.current_waypoint()
        if target is None:
            # No more waypoints: the run is complete.
            self._complete(ctx, transition_fn, events)
            return events

        dx = target.x - ctx.pos_x
        dy = target.y - ctx.pos_y
        remaining = _distance(ctx.pos_x, ctx.pos_y, target.x, target.y)
        travel = ctx.speed * dt

        if travel >= remaining:
            # Arrived at the waypoint this step.
            ctx.pos_x = target.x
            ctx.pos_y = target.y
            if remaining > 0:
                ctx.heading_deg = _heading_deg(dx, dy)
            events.append(
                SimulationEvent(
                    EVENT_WAYPOINT_REACHED,
                    ctx.sim_time,
                    {"waypoint_index": ctx.wp_index, "kind": target.kind},
                )
            )
            self._on_arrive(ctx, target, transition_fn, events)
        else:
            # Partial leg: interpolate linearly.
            if remaining > 0:
                ctx.heading_deg = _heading_deg(dx, dy)
                ux, uy = dx / remaining, dy / remaining
                ctx.pos_x += ux * travel
                ctx.pos_y += uy * travel
            events.append(
                SimulationEvent(
                    EVENT_MOVING,
                    ctx.sim_time,
                    {"pos": {"x": ctx.pos_x, "y": ctx.pos_y}},
                )
            )
        return events

    def _step_timed(self, ctx, dt, transition_fn) -> List[SimulationEvent]:
        events: List[SimulationEvent] = []
        ctx.state_timer -= dt
        if ctx.state_timer <= 0:
            self._advance_after_timed(ctx, transition_fn, events)
        return events

    # -- arrival / completion ----------------------------------------------

    def _on_arrive(self, ctx, target, transition_fn, events) -> None:
        if target.kind == "dock":
            if ctx.status == "MOVING":
                # We reached the dock while still in the MOVING leg. The legal
                # edge set routes MOVING → RETURNING → DOCKED, so transition to
                # RETURNING here; the next tick re-arrives (already at dock) and
                # completes to DOCKED.
                self._transition(
                    ctx, "RETURNING", "entering dock leg", transition_fn, events
                )
                return
            # status == RETURNING (already at dock): finalize.
            self._transition(ctx, "DOCKED", "arrived at dock", transition_fn, events)
            events.append(
                SimulationEvent(EVENT_RETURNED_TO_DOCK, ctx.sim_time, {})
            )
            self._complete(ctx, transition_fn, events)
            return

        # A tree waypoint. Begin the climb → scan → harvest sequence.
        self._transition(ctx, "CLIMBING", "arrived at tree", transition_fn, events)
        events.append(
            SimulationEvent(
                EVENT_TREE_REACHED,
                ctx.sim_time,
                {
                    "tree_id": target.tree_id,
                    "mission_item_id": target.mission_item_id,
                },
            )
        )
        ctx.current_item_id = target.mission_item_id
        ctx.state_timer = CLIMB_DURATION_S

    def _advance_after_timed(self, ctx, transition_fn, events) -> None:
        if ctx.status == "CLIMBING":
            self._transition(ctx, "SCANNING", "canopy reached", transition_fn, events)
            ctx.state_timer = SCAN_DURATION_S
        elif ctx.status == "SCANNING":
            self._transition(
                ctx, "HARVESTING", "scan complete", transition_fn, events
            )
            events.append(
                SimulationEvent(
                    EVENT_HARVEST_STARTED, ctx.sim_time, {"tree_id": ctx.current_item_id}
                )
            )
            ctx.state_timer = HARVEST_DURATION_S
        elif ctx.status == "HARVESTING":
            # Harvest done: record completion, then head to the next waypoint
            # (or, if battery low, divert to the dock).
            events.append(
                SimulationEvent(
                    EVENT_HARVEST_FINISHED,
                    ctx.sim_time,
                    {"tree_id": ctx.current_item_id},
                )
            )
            if ctx.current_item_id is not None:
                ctx.completed_item_ids.append(ctx.current_item_id)
            ctx.current_item_id = None
            self._transition(ctx, "MOVING", "harvest complete", transition_fn, events)
            self._advance_waypoint(ctx)

    def _advance_waypoint(self, ctx) -> None:
        """Move to the next target waypoint (or divert to dock if battery low).

        The plan always ends at the return dock, so "divert to dock" means jumping
        the index to the final waypoint. Otherwise advance to the next index.
        """
        if ctx.battery_low:
            self._divert_to_dock(ctx)
        else:
            ctx.wp_index += 1
        ctx.leg_progress = 0.0

    def _divert_to_dock(self, ctx) -> None:
        """Re-target the current leg to the final return-dock waypoint."""
        ctx.wp_index = max(0, len(ctx.waypoints) - 1)
        ctx.leg_progress = 0.0

    def _complete(self, ctx, transition_fn, events) -> None:
        if not ctx.finished:
            ctx.finished = True
            events.append(
                SimulationEvent(EVENT_MISSION_COMPLETED, ctx.sim_time, {})
            )

    def _transition(self, ctx, target, reason, transition_fn, events) -> None:
        new_status = transition_fn(ctx.status, target, reason)
        if new_status != ctx.status:
            events.append(
                SimulationEvent(
                    EVENT_STATE_CHANGED,
                    ctx.sim_time,
                    {"from": ctx.status, "to": new_status, "reason": reason},
                )
            )
            ctx.status = new_status
