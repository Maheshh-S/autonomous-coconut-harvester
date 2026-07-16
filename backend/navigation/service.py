"""Version 3.2 — Robot Navigation Foundation (backend only).

This milestone builds the *navigation layer* only. Its single responsibility is
**route computation**: given the robot's position, a Harvest Mission (and its
ordered items), the trees' farm-pixel targets, and the dock, it produces an
ordered navigation plan. It does NOT move the robot, does NOT animate, does NOT
execute anything, and never mutates Robot state. It is fully deterministic.

Per PROJECT_SPECIFICATION.md Appendix A §A.5 the navigation concern is kept strictly
separate from (1) route *ordering* — owned by the Harvest Planner's Nearest-
Neighbour (§41) and already frozen in ``HarvestMissionItem.visit_order`` — and (2)
movement *execution* — owned by the Simulation Engine (V3.6). This module only
answers "where should the robot go, in what order, and how far" using the existing
single source of truth (``computeMosaicLayout`` port, ``TreeObservation``,
``SurveyTile``, ``HarvestMission``). No A*, no obstacle avoidance, no re-optimisation.

All business logic lives here in the backend (Major Design Principle); the frontend
only visualizes. The V3.1 ``Robot`` / ``DockStation`` models are read but never
written by this layer.
"""

from dataclasses import dataclass, field
from typing import List, Optional

# Deterministic Euclidean distance in farm-pixel space. Straight-line legs between
# waypoints (no obstacle avoidance, per V3.2 scope).
def _distance(ax: float, ay: float, bx: float, by: float) -> float:
    return ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5


@dataclass
class NavigationWaypoint:
    """One stop in the navigation plan.

    ``kind`` is ``"dock"`` or ``"tree"``. For a tree waypoint ``tree_id`` and
    ``mission_item_id`` identify which harvest stop; ``visit_order`` preserves the
    Harvest Mission ordering. ``leg_distance`` is the travel distance **from the
    previous waypoint** (0 for the first waypoint).
    """

    kind: str
    x: float
    y: float
    tree_id: Optional[int] = None
    mission_item_id: Optional[int] = None
    visit_order: Optional[int] = None
    label: str = ""
    leg_distance: float = 0.0


@dataclass
class NavigationPlan:
    """An ordered sequence of waypoints the robot would traverse.

    Always starts at the dock and ends back at the dock (round trip). ``tree_count``
    is the number of harvest stops; ``total_distance`` is the sum of all leg
    distances (dock → first tree → … → last tree → dock).
    """

    waypoints: List[NavigationWaypoint] = field(default_factory=list)
    total_distance: float = 0.0
    tree_count: int = 0

    def next_destination(self) -> Optional[NavigationWaypoint]:
        """First tree waypoint to visit (or None if the plan has no trees)."""
        for wp in self.waypoints:
            if wp.kind == "tree":
                return wp
        return None

    def remaining_destinations(self) -> List[NavigationWaypoint]:
        """Tree waypoints after the first (what remains once the first is reached)."""
        return [wp for wp in self.waypoints if wp.kind == "tree"][1:]


@dataclass
class NavigationResult:
    """The full computed navigation output for a given robot + mission.

    Pure data; never triggers side effects. ``deterministic`` is always ``True``
    for this planner (documents the invariant). ``skipped_item_ids`` records harvest
    items whose tree target could not be resolved (no representative observation /
    tile) so the plan is transparent rather than silently wrong.
    """

    robot_position: dict
    dock: dict
    mission_id: Optional[int]
    total_travel_distance: float
    plan: NavigationPlan
    skipped_item_ids: List[int] = field(default_factory=list)
    deterministic: bool = True


class RobotNavigator:
    """Pure, deterministic navigation planner.

    Stateless. ``compute_plan`` takes resolved inputs and returns a
    ``NavigationPlan``. Given identical inputs it always returns an identical plan
    (no randomness, no clock, no DB access). This is the component unit-tested in
    isolation for determinism (ROBOT_ARCHITECTURE.md §1.1).
    """

    def compute_plan(
        self,
        start: tuple,
        dock: tuple,
        tree_targets: List[dict],
    ) -> tuple:
        """Build the round-trip plan.

        ``start`` / ``dock`` are ``(x, y)`` farm-pixel tuples. ``tree_targets`` is a
        list of dicts (ordered already by the caller) each with at least
        ``x``, ``y``, and optional ``tree_id`` / ``mission_item_id`` /
        ``visit_order`` / ``label``.

        Returns ``(NavigationPlan, skipped_item_ids)``. Trees with no resolvable
        target are skipped and reported.
        """
        waypoints: List[NavigationWaypoint] = []
        skipped: List[int] = []

        # Begin at the dock (round trip always returns here).
        dock_wp = NavigationWaypoint(
            kind="dock", x=dock[0], y=dock[1], label="Dock"
        )
        waypoints.append(dock_wp)

        # Legs are measured from the *robot's current position* to the first stop,
        # then dock → tree → tree → … → dock. The starting leg originates at the
        # robot, not the dock, so the plan reflects where the robot actually is.
        cursor_x, cursor_y = start[0], start[1]

        for t in tree_targets:
            tx, ty = t.get("x"), t.get("y")
            if tx is None or ty is None:
                if t.get("mission_item_id") is not None:
                    skipped.append(t["mission_item_id"])
                continue
            leg = _distance(cursor_x, cursor_y, tx, ty)
            wp = NavigationWaypoint(
                kind="tree",
                x=tx,
                y=ty,
                tree_id=t.get("tree_id"),
                mission_item_id=t.get("mission_item_id"),
                visit_order=t.get("visit_order"),
                label=t.get("label", ""),
                leg_distance=leg,
            )
            waypoints.append(wp)
            cursor_x, cursor_y = tx, ty

        # Return to dock from the last tree (or from the robot if no trees).
        return_leg = _distance(cursor_x, cursor_y, dock[0], dock[1])
        dock_return = NavigationWaypoint(
            kind="dock",
            x=dock[0],
            y=dock[1],
            label="Dock (return)",
            leg_distance=return_leg,
        )
        waypoints.append(dock_return)

        total = sum(wp.leg_distance for wp in waypoints)
        plan = NavigationPlan(
            waypoints=waypoints,
            total_distance=total,
            tree_count=sum(1 for w in waypoints if w.kind == "tree"),
        )
        return plan, skipped
