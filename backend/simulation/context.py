"""Version 3.4 — Simulation Context & internal Events.

These are the data carriers the pure ``SimulationEngine`` reads and writes.

``SimulationContext`` bundles every *input* and *live state* the engine needs to
advance by one ``step(dt)``. It is a plain dataclass (no ORM, no database) so the
engine stays pure and unit-testable: feed a context, call ``step``, inspect the
mutated context. The scheduler is responsible for copying the context's values
back onto the persisted ``Robot`` / ``RobotBattery`` rows after each step.

``SimulationEvent`` is an **internal** event emitted by the engine each step. It
is deliberately NOT persisted or streamed in V3.4 (telemetry/WebSocket belong to
later milestones, §A.6). It exists now so the engine's behaviour is observable and
so V3.5 telemetry can consume the same objects without redesign.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from navigation.service import NavigationWaypoint


@dataclass
class SimulationContext:
    """All live inputs + state the engine needs for a deterministic ``step``.

    Positional/continuous fields (``pos_x``, ``pos_y``, ``heading_deg``,
    ``battery_pct``, ``speed``) are NOT the state machine's ``status`` — they are
    continuous variables the engine writes directly. Only ``status`` is owned by
    ``RobotStateMachine`` (ROBOT_ARCHITECTURE.md V3.3.1: the machine is the sole
    mutator of ``Robot.status``).

    Attributes:
        waypoints: immutable ordered ``NavigationPlan`` waypoints (dock → trees →
            dock). The plan is consumed, never modified.
        wp_index: index of the *current* target waypoint in ``waypoints``.
        leg_progress: distance already travelled along the current leg (px).
        pos_x, pos_y: live farm-pixel position.
        heading_deg: live heading (degrees, 0 = +x axis).
        speed: farm-pixels per simulation-second (from RobotConfiguration, clamped
            to ``[0, max_speed]``).
        status: current ``RobotState`` value (mirrors ``robot.status``).
        battery_pct: live battery percentage (clamped to ``[0, 100]``).
        battery_low_threshold: pct at/below which the engine requests RETURNING.
        mission_id: the Harvest Mission being executed (immutable for the run).
        current_item_id: the HarvestMissionItem currently being serviced, or None.
        completed_item_ids: items fully harvested this run (deterministic order).
        state_timer: sim-seconds remaining in the current timed activity
            (CLIMBING / SCANNING / HARVESTING). 0 while MOVING / RETURNING.
        sim_time: current simulation time in seconds (advanced by the scheduler).
        battery_low: True once battery hit the low threshold (routes to dock).
        finished: True once the robot has returned to dock and the run is done.
    """

    waypoints: List[NavigationWaypoint] = field(default_factory=list)
    wp_index: int = 0
    leg_progress: float = 0.0
    pos_x: float = 0.0
    pos_y: float = 0.0
    heading_deg: float = 0.0
    speed: float = 1.0
    status: str = "IDLE"
    battery_pct: float = 100.0
    battery_low_threshold: float = 20.0
    mission_id: Optional[int] = None
    current_item_id: Optional[int] = None
    completed_item_ids: List[int] = field(default_factory=list)
    state_timer: float = 0.0
    sim_time: float = 0.0
    battery_low: bool = False
    finished: bool = False

    def current_waypoint(self) -> Optional[NavigationWaypoint]:
        if 0 <= self.wp_index < len(self.waypoints):
            return self.waypoints[self.wp_index]
        return None

    def is_active_state(self) -> bool:
        return self.status in {
            "MOVING",
            "CLIMBING",
            "SCANNING",
            "HARVESTING",
            "RETURNING",
        }


# Event types emitted internally by the engine (V3.5 telemetry will consume these;
# V3.4 does NOT persist or stream them).
EVENT_WAYPOINT_REACHED = "WaypointReached"
EVENT_TREE_REACHED = "TreeReached"
EVENT_HARVEST_STARTED = "HarvestStarted"
EVENT_HARVEST_FINISHED = "HarvestFinished"
EVENT_RETURNED_TO_DOCK = "ReturnedToDock"
EVENT_MISSION_COMPLETED = "MissionCompleted"
EVENT_BATTERY_LOW = "BatteryLow"
EVENT_STATE_CHANGED = "StateChanged"
EVENT_MOVING = "Moving"


@dataclass
class SimulationEvent:
    """An internal, non-persisted simulation event produced by one ``step``."""

    type: str
    sim_time: float
    detail: dict = field(default_factory=dict)
