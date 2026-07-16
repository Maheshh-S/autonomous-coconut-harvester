"""NavigationService — orchestrates reads and serializes a NavigationResult.

This is the only place that touches the database for navigation. It is strictly
read-only: it loads the robot position + dock (V3.1 domain), the Harvest Mission
and its ordered items, each tree's representative ``TreeObservation`` target
(resolved through the faithful ``computeMosaicLayout`` port), and builds a
``NavigationResult`` via the pure ``RobotNavigator``. No writes occur — the
navigation layer never mutates Robot state.
"""

from typing import Optional

from sqlalchemy import desc

from database.models import (
    HarvestMission,
    HarvestMissionItem,
    Robot,
    DockStation,
    SurveyTile,
    TreeObservation,
    Tree,
    ACTIVE_HARVEST_MISSION_STATUSES,
)
from navigation.mosaic_layout import (
    TileGeometry,
    tile_placement_map,
    tree_target_pixel,
)
from navigation.service import RobotNavigator, NavigationResult


def _resolve_mission(db, mission_id: Optional[int]) -> Optional[HarvestMission]:
    """Resolve the target Harvest Mission.

    Precedence: explicit ``mission_id`` → the robot's ``current_mission_id`` → the
    active (non-terminal) harvest mission → the most recently created mission. This
    matches how the dashboard selects "the mission to watch" and keeps the endpoint
    deterministic for a given database state.
    """
    if mission_id is not None:
        return (
            db.query(HarvestMission)
            .filter(HarvestMission.id == mission_id)
            .first()
        )
    robot = db.query(Robot).order_by(Robot.id).first()
    if robot is not None and robot.current_mission_id is not None:
        m = (
            db.query(HarvestMission)
            .filter(HarvestMission.id == robot.current_mission_id)
            .first()
        )
        if m is not None:
            return m
    active = (
        db.query(HarvestMission)
        .filter(HarvestMission.status.in_(ACTIVE_HARVEST_MISSION_STATUSES))
        .order_by(desc(HarvestMission.created_at), desc(HarvestMission.id))
        .first()
    )
    if active is not None:
        return active
    return (
        db.query(HarvestMission)
        .order_by(desc(HarvestMission.created_at), desc(HarvestMission.id))
        .first()
    )


def _load_tile_geometry(db) -> list:
    """All SurveyTiles as minimal geometry (the farm mosaic the twin renders)."""
    tiles = (
        db.query(
            SurveyTile.id,
            SurveyTile.grid_col,
            SurveyTile.grid_row,
            SurveyTile.image_width,
            SurveyTile.image_height,
        )
        .all()
    )
    return [
        TileGeometry(
            id=t.id,
            grid_col=t.grid_col if t.grid_col is not None else 0,
            grid_row=t.grid_row if t.grid_row is not None else 0,
            image_width=t.image_width or 0,
            image_height=t.image_height or 0,
        )
        for t in tiles
    ]


def _resolve_tree_target(db, tree_id: int, placement: dict) -> Optional[tuple]:
    """Farm-pixel target of a tree via its representative observation.

    Uses ``Tree.current_observation_id`` first, else the most recent observation
    for the tree. Returns ``None`` if no locatable observation/tile exists.
    """
    tree = db.query(Tree).filter(Tree.id == tree_id).first()
    if tree is None:
        return None
    obs = None
    if tree.current_observation_id is not None:
        obs = (
            db.query(TreeObservation)
            .filter(TreeObservation.id == tree.current_observation_id)
            .first()
        )
    if obs is None:
        obs = (
            db.query(TreeObservation)
            .filter(TreeObservation.tree_id == tree_id)
            .order_by(desc(TreeObservation.id))
            .first()
        )
    if obs is None:
        return None
    return tree_target_pixel(
        placement, obs.survey_tile_id, obs.local_pixel_x, obs.local_pixel_y
    )


def build_navigation(
    db, mission_id: Optional[int] = None
) -> NavigationResult:
    """Compute the navigation result for the robot against a Harvest Mission.

    Read-only. Raises ``ValueError`` with a clear message if no mission can be
    resolved. Returns a fully-deterministic ``NavigationResult`` data object.
    """
    mission = _resolve_mission(db, mission_id)
    if mission is None:
        raise ValueError("No Harvest Mission available for navigation")

    robot = db.query(Robot).order_by(Robot.id).first()
    dock = (
        db.query(DockStation).order_by(DockStation.id).first()
        if robot is None or robot.dock_id is None
        else db.query(DockStation)
        .filter(DockStation.id == robot.dock_id)
        .first()
    )
    if robot is None:
        # Domain is seeded by init_db; this is defensive only.
        from api.robot_domain import ensure_robot_domain

        robot = ensure_robot_domain(db)
    if dock is None:
        dock = db.query(DockStation).order_by(DockStation.id).first()

    start = (robot.position_x, robot.position_y)
    dock_pos = (dock.farm_x, dock.farm_y) if dock else (0.0, 0.0)

    placement = tile_placement_map(_load_tile_geometry(db))

    items = (
        db.query(HarvestMissionItem)
        .filter(HarvestMissionItem.mission_id == mission.id)
        .order_by(HarvestMissionItem.visit_order)
        .all()
    )

    tree_targets: list = []
    for item in items:
        target = _resolve_tree_target(db, item.tree_id, placement)
        if target is None:
            continue
        tx, ty = target
        tree_targets.append(
            {
                "x": tx,
                "y": ty,
                "tree_id": item.tree_id,
                "mission_item_id": item.id,
                "visit_order": item.visit_order,
                "label": f"Tree {item.tree_id}",
            }
        )

    navigator = RobotNavigator()
    plan, skipped = navigator.compute_plan(start, dock_pos, tree_targets)

    return NavigationResult(
        robot_position={"x": robot.position_x, "y": robot.position_y},
        dock={
            "x": dock_pos[0],
            "y": dock_pos[1],
            "label": dock.label if dock else "Dock",
        },
        mission_id=mission.id,
        total_travel_distance=plan.total_distance,
        plan=plan,
        skipped_item_ids=skipped,
    )


def serialize_navigation(result: NavigationResult) -> dict:
    """Serialize a NavigationResult for the API (no execution, pure data)."""
    plan = result.plan
    next_wp = plan.next_destination()
    return {
        "mission_id": result.mission_id,
        "robot_position": result.robot_position,
        "dock": result.dock,
        "next_destination": (
            {
                "x": next_wp.x,
                "y": next_wp.y,
                "tree_id": next_wp.tree_id,
                "mission_item_id": next_wp.mission_item_id,
                "visit_order": next_wp.visit_order,
                "label": next_wp.label,
            }
            if next_wp
            else None
        ),
        "remaining_destinations": [
            {
                "x": w.x,
                "y": w.y,
                "tree_id": w.tree_id,
                "mission_item_id": w.mission_item_id,
                "visit_order": w.visit_order,
                "label": w.label,
            }
            for w in plan.remaining_destinations()
        ],
        "total_travel_distance": result.total_travel_distance,
        "tree_count": plan.tree_count,
        "skipped_item_ids": result.skipped_item_ids,
        "deterministic": result.deterministic,
        "plan": {
            "total_distance": plan.total_distance,
            "tree_count": plan.tree_count,
            "waypoints": [
                {
                    "kind": w.kind,
                    "x": w.x,
                    "y": w.y,
                    "tree_id": w.tree_id,
                    "mission_item_id": w.mission_item_id,
                    "visit_order": w.visit_order,
                    "label": w.label,
                    "leg_distance": w.leg_distance,
                }
                for w in plan.waypoints
            ],
        },
    }
