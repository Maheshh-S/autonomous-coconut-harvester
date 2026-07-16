"""Harvest Planner & Mission Builder (Feature 10).

Turns the farmer's intent ("harvest mature coconuts") into one immutable Harvest
Mission with an ordered list of Harvest Mission Items. The planner:

  1. determines eligible trees from their *latest* Inventory Snapshots (§40),
  2. orders them with the frozen Nearest-Neighbour heuristic (§41),
  3. emits one HarvestMission + one HarvestMissionItem per tree (§38, §43).

It only *reads* inventory and *builds* a plan. It does NOT execute the robot,
modify inventory, or mutate any existing mission (PROJECT_SPECIFICATION.md §38.2).
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc

from database.db import SessionLocal
from database.models import (
    Tree,
    InventorySnapshot,
    SurveyMission,
    HarvestMission,
    HarvestMissionStatus,
    HarvestMissionItem,
    HarvestMissionItemStatus,
    ACTIVE_HARVEST_MISSION_STATUSES,
)

router = APIRouter()


# Valid harvest types. ``mature`` / ``potential`` / ``premature`` map 1:1 onto the
# Inventory Snapshot count columns frozen in Feature 9; ``all`` uses total_coconuts
# (any inventory). (PROJECT_SPECIFICATION.md §24, §40.2.)
HARVEST_TYPE_COLUMN = {
    "mature": "mature_count",
    "potential": "potential_count",
    "premature": "premature_count",
    "all": "total_coconuts",
}

# A tree is observable/reachable only while ACTIVE (§16, §40.1). MISSING/INACTIVE
# trees are never sent the robot.
ACTIVE_AVAILABILITY = "ACTIVE"


class HarvestMissionCreate(BaseModel):
    harvest_type: str
    notes: Optional[str] = None


def _now() -> datetime:
    return datetime.utcnow()


def _serialize_item(item: HarvestMissionItem) -> dict:
    return {
        "id": item.id,
        "mission_id": item.mission_id,
        "tree_id": item.tree_id,
        "tree_code": item.tree.tree_code if item.tree else None,
        "gps_lat": item.tree.gps_lat if item.tree else None,
        "gps_lon": item.tree.gps_lon if item.tree else None,
        "visit_order": item.visit_order,
        "expected_coconuts": item.expected_coconuts,
        "harvested": item.harvested,
        "status": item.status,
    }


def _serialize_mission(mission: HarvestMission, include_items: bool = False) -> dict:
    data = {
        "id": mission.id,
        "mission_code": mission.mission_code,
        "created_at": mission.created_at.isoformat() if mission.created_at else None,
        "completed_at": mission.completed_at.isoformat()
        if mission.completed_at
        else None,
        "status": mission.status,
        "harvest_type": mission.harvest_type,
        "total_trees": mission.total_trees,
        "total_expected_coconuts": mission.total_expected_coconuts,
        "notes": mission.notes,
    }
    if include_items:
        data["items"] = [_serialize_item(i) for i in mission.items]
    return data


def _assigned_tree_ids(db) -> set:
    """Tree ids already committed to an *active* (non-terminal) Harvest Mission.

    Prevents a tree from being planned into two live missions at once (§38, §40).
    """
    rows = (
        db.query(HarvestMissionItem.tree_id)
        .join(HarvestMission, HarvestMission.id == HarvestMissionItem.mission_id)
        .filter(HarvestMission.status.in_(ACTIVE_HARVEST_MISSION_STATUSES))
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def _eligible_trees(db, harvest_type: str) -> List[dict]:
    """Select eligible trees and their expected yield for a harvest type (§40).

    A tree is eligible only if ALL hold:
      - it has a latest Inventory Snapshot (``current_inventory_id`` set),
      - its availability is ACTIVE,
      - it is not already assigned to another active Harvest Mission,
      - the requested harvest type is present in that snapshot (count > 0).

    Returns a deterministic list (ascending tree id) of dicts carrying the tree's
    id, GPS, and ``expected_coconuts`` for the requested type.
    """
    count_attr = HARVEST_TYPE_COLUMN[harvest_type]
    assigned = _assigned_tree_ids(db)

    trees = (
        db.query(Tree)
        .filter(
            Tree.availability == ACTIVE_AVAILABILITY,
            Tree.current_inventory_id.isnot(None),
        )
        .order_by(Tree.id)
        .all()
    )

    # Bulk-load the Inventory Snapshots in ONE round-trip instead of one query per
    # tree — the previous per-tree db.get was an N+1 that became hundreds of
    # sequential round-trips against the remote Neon database.
    snapshot_ids = [
        t.current_inventory_id for t in trees if t.current_inventory_id is not None
    ]
    snapshots = (
        {
            s.id: s
            for s in db.query(InventorySnapshot)
            .filter(InventorySnapshot.id.in_(snapshot_ids))
            .all()
        }
        if snapshot_ids
        else {}
    )

    eligible: List[dict] = []
    for tree in trees:
        if tree.id in assigned:
            continue
        snap = snapshots.get(tree.current_inventory_id)
        if snap is None:
            continue
        expected = getattr(snap, count_attr)
        if expected is None or expected <= 0:
            continue
        eligible.append(
            {
                "id": tree.id,
                "gps_lat": tree.gps_lat,
                "gps_lon": tree.gps_lon,
                "expected_coconuts": int(expected),
            }
        )
    return eligible


def _depot_position(db) -> Optional[tuple]:
    """The robot's starting position: the active Survey Mission's base GPS (§41.5).

    The single-farm base coordinates are stored on the active survey mission. If
    unavailable, returns None and the planner starts from the lowest-id eligible
    tree instead (still deterministic).
    """
    mission = (
        db.query(SurveyMission)
        .filter(SurveyMission.is_active.is_(True))
        .order_by(desc(SurveyMission.id))
        .first()
    )
    if mission and mission.base_gps_lat is not None and mission.base_gps_lon is not None:
        return (mission.base_gps_lat, mission.base_gps_lon)
    return None


def _squared_distance(lat1, lon1, lat2, lon2) -> float:
    dlat = lat1 - lat2
    dlon = lon1 - lon2
    return dlat * dlat + dlon * dlon


def nearest_neighbour_order(
    trees: List[dict], start: Optional[tuple]
) -> List[dict]:
    """Order eligible trees with the frozen Nearest-Neighbour heuristic (§41).

    From the current position, repeatedly pick the closest unvisited tree, move
    there, and repeat until all are visited. Deterministic: the candidate list is
    processed in ascending tree-id order and ties use a strict ``<`` comparison,
    so equal distances always keep the lower-id tree. Uses squared Euclidean
    distance over (lat, lon) — monotonic, so it yields the same ordering as true
    distance without a sqrt.

    This is intentionally *not* TSP / A* / Dijkstra (§41.4).
    """
    remaining = sorted(trees, key=lambda t: t["id"])
    if start is not None:
        cur_lat, cur_lon = start
    elif remaining:
        # No depot: start from the lowest-id tree (visited first), then NN.
        first = remaining.pop(0)
        cur_lat, cur_lon = first["gps_lat"], first["gps_lon"]
        ordered = [first]
        while remaining:
            best_i, best_d = 0, None
            for i, t in enumerate(remaining):
                d = _squared_distance(cur_lat, cur_lon, t["gps_lat"], t["gps_lon"])
                if best_d is None or d < best_d:
                    best_d, best_i = d, i
            chosen = remaining.pop(best_i)
            ordered.append(chosen)
            cur_lat, cur_lon = chosen["gps_lat"], chosen["gps_lon"]
        return ordered

    ordered: List[dict] = []
    while remaining:
        best_i, best_d = 0, None
        for i, t in enumerate(remaining):
            d = _squared_distance(cur_lat, cur_lon, t["gps_lat"], t["gps_lon"])
            if best_d is None or d < best_d:
                best_d, best_i = d, i
        chosen = remaining.pop(best_i)
        ordered.append(chosen)
        cur_lat, cur_lon = chosen["gps_lat"], chosen["gps_lon"]
    return ordered


@router.post("/harvest/missions")
def create_harvest_mission(payload: HarvestMissionCreate):
    """Generate one immutable Harvest Mission for the requested harvest type.

    Reads latest Inventory Snapshots, filters eligible trees (§40), orders them
    via Nearest-Neighbour (§41), and writes one mission + one ordered item per
    tree. Repeated calls always create an independent new mission.
    """
    harvest_type = (payload.harvest_type or "").strip().lower()
    if harvest_type not in HARVEST_TYPE_COLUMN:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid harvest_type '{payload.harvest_type}'. "
                f"Allowed: {', '.join(sorted(HARVEST_TYPE_COLUMN))}"
            ),
        )

    db = SessionLocal()
    try:
        eligible = _eligible_trees(db, harvest_type)
        if not eligible:
            raise HTTPException(
                status_code=400,
                detail=f"No eligible trees for harvest type '{harvest_type}'",
            )

        ordered = nearest_neighbour_order(eligible, _depot_position(db))
        total_expected = sum(t["expected_coconuts"] for t in ordered)

        mission = HarvestMission(
            created_at=_now(),
            status=HarvestMissionStatus.CREATED.value,
            harvest_type=harvest_type,
            total_trees=len(ordered),
            total_expected_coconuts=total_expected,
            notes=payload.notes,
        )
        db.add(mission)
        db.commit()
        db.refresh(mission)

        # write-once public code, derived from the row id (§11.2)
        mission.mission_code = "HM-" + str(mission.id).zfill(4)

        for visit_order, t in enumerate(ordered, start=1):
            db.add(
                HarvestMissionItem(
                    mission_id=mission.id,
                    tree_id=t["id"],
                    visit_order=visit_order,
                    expected_coconuts=t["expected_coconuts"],
                    status=HarvestMissionItemStatus.PENDING.value,
                )
            )
        db.commit()
        db.refresh(mission)
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.get("/harvest/missions")
def list_harvest_missions(limit: int = 50):
    """List Harvest Missions, newest first (headers only)."""
    db = SessionLocal()
    try:
        rows = (
            db.query(HarvestMission)
            .order_by(desc(HarvestMission.created_at), desc(HarvestMission.id))
            .limit(limit)
            .all()
        )
        return {"missions": [_serialize_mission(m) for m in rows]}
    finally:
        db.close()


@router.get("/harvest/missions/{mission_id}")
def get_harvest_mission(mission_id: int):
    """One Harvest Mission with its ordered items."""
    db = SessionLocal()
    try:
        mission = db.get(HarvestMission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="Harvest mission not found")
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.get("/harvest/missions/{mission_id}/items")
def get_harvest_mission_items(mission_id: int):
    """The ordered Harvest Mission Items (the robot's visit queue) for a mission."""
    db = SessionLocal()
    try:
        mission = db.get(HarvestMission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="Harvest mission not found")
        items = (
            db.query(HarvestMissionItem)
            .filter(HarvestMissionItem.mission_id == mission_id)
            .order_by(HarvestMissionItem.visit_order)
            .all()
        )
        return {
            "mission_id": mission_id,
            "mission_code": mission.mission_code,
            "items": [_serialize_item(i) for i in items],
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Robot Mission Execution (Feature 11)
# ---------------------------------------------------------------------------
# The planner (above) only *builds* an immutable mission. This section executes
# it: it advances the mission/queue state machine (§43.2), never changes queue
# order, touches only execution state, and — on each completed tree — writes a
# *new* post-harvest Inventory Snapshot (§25, §44) without mutating history.

_TERMINAL_STATUSES = (
    HarvestMissionStatus.COMPLETED.value,
    HarvestMissionStatus.CANCELLED.value,
)


def _get_mission_or_404(db, mission_id: int) -> HarvestMission:
    mission = db.get(HarvestMission, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="Harvest mission not found")
    return mission


def _in_progress_item(db, mission_id: int):
    return (
        db.query(HarvestMissionItem)
        .filter(
            HarvestMissionItem.mission_id == mission_id,
            HarvestMissionItem.status == HarvestMissionItemStatus.IN_PROGRESS.value,
        )
        .first()
    )


def _next_pending_item(db, mission_id: int):
    return (
        db.query(HarvestMissionItem)
        .filter(
            HarvestMissionItem.mission_id == mission_id,
            HarvestMissionItem.status == HarvestMissionItemStatus.PENDING.value,
        )
        .order_by(HarvestMissionItem.visit_order)
        .first()
    )


def _require_no_other_active(db, mission_id: int):
    """Enforce the frozen "exactly one running mission" invariant (§43.1)."""
    other = (
        db.query(HarvestMission)
        .filter(
            HarvestMission.id != mission_id,
            HarvestMission.status.in_(ACTIVE_HARVEST_MISSION_STATUSES),
        )
        .first()
    )
    if other is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Mission {other.mission_code} is already {other.status}; "
                "only one Harvest Mission may run at a time"
            ),
        )


def _decrease_harvest(snap: InventorySnapshot, harvest_type: str, amount: int):
    """Reduce the harvested category of a (new) snapshot by ``amount`` (§25, §43).

    ``harvest_type`` maps onto a snapshot column via the same rule the planner
    uses (§40.2): mature/potential/premature decrease that single column; ``all``
    harvests everything, so each category is reduced proportionally (and total is
    recomputed). Counts are clamped at 0 — never negative.
    """
    amount = int(amount)
    if harvest_type == "mature":
        snap.mature_count = max(0, snap.mature_count - amount)
    elif harvest_type == "potential":
        snap.potential_count = max(0, snap.potential_count - amount)
    elif harvest_type == "premature":
        snap.premature_count = max(0, snap.premature_count - amount)
    elif harvest_type == "all":
        total = snap.mature_count + snap.potential_count + snap.premature_count
        if total > 0:
            snap.mature_count = max(
                0, snap.mature_count - round(amount * snap.mature_count / total)
            )
            snap.potential_count = max(
                0,
                snap.potential_count - round(amount * snap.potential_count / total),
            )
            snap.premature_count = max(
                0,
                snap.premature_count
                - round(amount * snap.premature_count / total),
            )
    snap.total_coconuts = (
        snap.mature_count + snap.potential_count + snap.premature_count
    )
    return snap


def _complete_item(db, item: HarvestMissionItem, harvest_type: str):
    """Mark an item COMPLETED and write a post-harvest Inventory Snapshot (§44.5).

    The tree's *current* snapshot is copied into a brand-new row with the
    harvested category decreased; the old snapshot is never modified, so
    Inventory History stays intact (§17, §18). ``Tree.current_inventory_id`` is
    repointed at the new snapshot.
    """
    tree = item.tree or db.get(Tree, item.tree_id)
    if tree is not None and tree.current_inventory_id is not None:
        snap = db.get(InventorySnapshot, tree.current_inventory_id)
        if snap is not None:
            new_snap = InventorySnapshot(
                tree_id=tree.id,
                inspection_id=None,  # post-harvest: no originating inspection
                created_at=_now(),
                total_coconuts=snap.total_coconuts,
                mature_count=snap.mature_count,
                potential_count=snap.potential_count,
                premature_count=snap.premature_count,
            )
            _decrease_harvest(new_snap, harvest_type, item.expected_coconuts)
            db.add(new_snap)
            db.commit()
            db.refresh(new_snap)
            # write-once public code (§11.2)
            new_snap.snapshot_code = "INV-" + str(new_snap.id).zfill(4)
            tree.current_inventory_id = new_snap.id
            db.commit()
    # Record the coconuts actually harvested (current F11 slice: equals the
    # planned yield). Reserved for future field-verified yields (§43.4).
    item.harvested = item.expected_coconuts
    item.status = HarvestMissionItemStatus.COMPLETED.value
    db.commit()


def _robot_state(mission_status: str, has_current: bool) -> str:
    """Derive a coarse robot operational state for the dashboard (§45)."""
    if mission_status == HarvestMissionStatus.COMPLETED.value:
        return "COMPLETED"
    if mission_status == HarvestMissionStatus.CANCELLED.value:
        return "CANCELLED"
    if mission_status == HarvestMissionStatus.PAUSED.value:
        return "PAUSED"
    if mission_status == HarvestMissionStatus.RUNNING.value:
        return "HARVESTING" if has_current else "IDLE"
    return "IDLE"  # CREATED


@router.post("/harvest/missions/{mission_id}/start")
def start_harvest_mission(mission_id: int):
    """CREATED → RUNNING; claim the first ordered tree (PENDING→IN_PROGRESS)."""
    db = SessionLocal()
    try:
        mission = _get_mission_or_404(db, mission_id)
        if mission.status != HarvestMissionStatus.CREATED.value:
            raise HTTPException(
                status_code=409,
                detail=f"Mission is {mission.status}; only CREATED missions can be started",
            )
        _require_no_other_active(db, mission_id)

        first = _next_pending_item(db, mission_id)
        if first is not None:
            # Exactly one IN_PROGRESS at a time (§42.3).
            assert _in_progress_item(db, mission_id) is None
            first.status = HarvestMissionItemStatus.IN_PROGRESS.value
            mission.status = HarvestMissionStatus.RUNNING.value
        else:
            # Nothing to harvest → the mission is already done.
            mission.status = HarvestMissionStatus.COMPLETED.value
            mission.completed_at = _now()
        db.commit()
        db.refresh(mission)
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.post("/harvest/missions/{mission_id}/pause")
def pause_harvest_mission(mission_id: int):
    """RUNNING → PAUSED. The current in-progress tree is left as-is (§46.1); the
    robot finishes it on the next advance after resume."""
    db = SessionLocal()
    try:
        mission = _get_mission_or_404(db, mission_id)
        if mission.status != HarvestMissionStatus.RUNNING.value:
            raise HTTPException(
                status_code=409,
                detail=f"Mission is {mission.status}; only RUNNING missions can be paused",
            )
        mission.status = HarvestMissionStatus.PAUSED.value
        db.commit()
        db.refresh(mission)
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.post("/harvest/missions/{mission_id}/resume")
def resume_harvest_mission(mission_id: int):
    """PAUSED → RUNNING. Continues from the next pending tree (§46.2)."""
    db = SessionLocal()
    try:
        mission = _get_mission_or_404(db, mission_id)
        if mission.status != HarvestMissionStatus.PAUSED.value:
            raise HTTPException(
                status_code=409,
                detail=f"Mission is {mission.status}; only PAUSED missions can be resumed",
            )
        mission.status = HarvestMissionStatus.RUNNING.value
        db.commit()
        db.refresh(mission)
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.post("/harvest/missions/{mission_id}/cancel")
def cancel_harvest_mission(mission_id: int):
    """RUNNING/PAUSED → CANCELLED. Completed trees are preserved; the remaining
    PENDING and current IN_PROGRESS trees are marked CANCELLED (§46.3)."""
    db = SessionLocal()
    try:
        mission = _get_mission_or_404(db, mission_id)
        if mission.status in _TERMINAL_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f"Mission is {mission.status}; terminal missions cannot be cancelled",
            )
        remaining = (
            db.query(HarvestMissionItem)
            .filter(
                HarvestMissionItem.mission_id == mission_id,
                HarvestMissionItem.status.in_(
                    [
                        HarvestMissionItemStatus.PENDING.value,
                        HarvestMissionItemStatus.IN_PROGRESS.value,
                    ]
                ),
            )
            .all()
        )
        for it in remaining:
            it.status = HarvestMissionItemStatus.CANCELLED.value
        mission.status = HarvestMissionStatus.CANCELLED.value
        mission.completed_at = _now()
        db.commit()
        db.refresh(mission)
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.post("/harvest/missions/{mission_id}/advance")
def advance_harvest_mission(mission_id: int):
    """Advance the robot to the next tree (§43, §44).

    Completes the current IN_PROGRESS item — writing its post-harvest Inventory
    Snapshot — then claims the next PENDING tree (PENDING→IN_PROGRESS). When no
    PENDING trees remain, the mission becomes COMPLETED (§43.5). Requires the
    mission to be RUNNING (resume a paused mission first).
    """
    db = SessionLocal()
    try:
        mission = _get_mission_or_404(db, mission_id)
        if mission.status != HarvestMissionStatus.RUNNING.value:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Mission is {mission.status}; resume a paused mission "
                    "before advancing"
                ),
            )

        cur = _in_progress_item(db, mission_id)
        if cur is not None:
            # Harvest the current tree and update its inventory (§25, §44.5).
            _complete_item(db, cur, mission.harvest_type)

        nxt = _next_pending_item(db, mission_id)
        if nxt is not None:
            # Exactly one IN_PROGRESS at a time.
            assert _in_progress_item(db, mission_id) is None
            nxt.status = HarvestMissionItemStatus.IN_PROGRESS.value
        else:
            # Queue exhausted → mission complete (§43.5).
            mission.status = HarvestMissionStatus.COMPLETED.value
            mission.completed_at = _now()
        db.commit()
        db.refresh(mission)
        return _serialize_mission(mission, include_items=True)
    finally:
        db.close()


@router.get("/harvest/missions/{mission_id}/status")
def harvest_mission_status(mission_id: int):
    """Current robot/mission status for the dashboard (§36, §45)."""
    db = SessionLocal()
    try:
        mission = _get_mission_or_404(db, mission_id)
        items = mission.items  # ordered by visit_order
        current = next(
            (
                i
                for i in items
                if i.status == HarvestMissionItemStatus.IN_PROGRESS.value
            ),
            None,
        )
        nxt = next(
            (
                i
                for i in items
                if i.status == HarvestMissionItemStatus.PENDING.value
            ),
            None,
        )
        completed = [
            i
            for i in items
            if i.status == HarvestMissionItemStatus.COMPLETED.value
        ]
        remaining = [
            i
            for i in items
            if i.status
            in (
                HarvestMissionItemStatus.PENDING.value,
                HarvestMissionItemStatus.IN_PROGRESS.value,
            )
        ]
        return {
            "mission_id": mission.id,
            "mission_code": mission.mission_code,
            "mission_status": mission.status,
            "robot_state": _robot_state(mission.status, current is not None),
            "current_item": _serialize_item(current) if current else None,
            "next_item": _serialize_item(nxt) if nxt else None,
            "completed_count": len(completed),
            "remaining_count": len(remaining),
            "total_trees": mission.total_trees,
            "total_expected_coconuts": mission.total_expected_coconuts,
            "harvested_coconuts": sum(i.expected_coconuts for i in completed),
        }
    finally:
        db.close()
