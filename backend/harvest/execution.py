"""Version 3.7.2 — Shared Harvest Mission Execution.

This module is the single source of truth for *mutating* Harvest Mission
execution state (Feature 11). It was factored out of ``api/harvest_mission_api.py``
so that **both** the manual advance endpoint AND the robot simulation run loop
drive exactly the same completion / inventory / mission-finalisation logic —
eliminating the previous divergence where the robot sim ran but never updated
the Harvest Mission, Inventory Snapshots, or Permanent Trees.

Per the frozen architecture: backend owns all business logic; this module never
imports frontend code and never touches websockets. It only writes to the
database and is safe to call from any request thread or the simulation scheduler
thread.

All functions are idempotent on the item/mission they touch so that re-delivered
simulation events never double-harvest a tree.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database.models import (
    Tree,
    InventorySnapshot,
    HarvestMission,
    HarvestMissionStatus,
    HarvestMissionItem,
    HarvestMissionItemStatus,
)

# Harvest type -> snapshot count column (PROJECT_SPECIFICATION.md §40.2).
HARVEST_TYPE_COLUMN = {
    "mature": "mature_count",
    "potential": "potential_count",
    "premature": "premature_count",
    "all": "total_coconuts",
}

_TERMINAL_STATUSES = (
    HarvestMissionStatus.COMPLETED.value,
    HarvestMissionStatus.CANCELLED.value,
)


def _now() -> datetime:
    return datetime.utcnow()


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


def complete_item(db: Session, mission_item_id: int, harvest_type: str) -> None:
    """Mark a Harvest Mission Item COMPLETED and write its post-harvest snapshot.

    Idempotent: if the item is already COMPLETED (e.g. a re-delivered sim event)
    this is a no-op. Copies the tree's current snapshot into a brand-new row with
    the harvested category decreased; ``Tree.current_inventory_id`` is repointed
    at the new snapshot (§44.5). The old snapshot is never modified.
    """
    item = db.get(HarvestMissionItem, mission_item_id)
    if item is None:
        return
    if item.status == HarvestMissionItemStatus.COMPLETED.value:
        return

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


def advance_mission(db: Session, mission_id: int, harvest_type: str) -> HarvestMission:
    """Advance a RUNNING mission by one tree (§43, §44).

    Completes the current IN_PROGRESS item (writing its post-harvest snapshot),
    then claims the next PENDING tree (PENDING -> IN_PROGRESS). When no PENDING
    trees remain, the mission becomes COMPLETED (§43.5).

    Returns the refreshed ``HarvestMission``. Caller is responsible for the
    surrounding HTTP response serialisation.
    """
    mission = db.get(HarvestMission, mission_id)
    if mission is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Harvest mission not found")
    if mission.status != HarvestMissionStatus.RUNNING.value:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=409,
            detail=(
                f"Mission is {mission.status}; resume a paused mission "
                "before advancing"
            ),
        )

    cur = (
        db.query(HarvestMissionItem)
        .filter(
            HarvestMissionItem.mission_id == mission_id,
            HarvestMissionItem.status == HarvestMissionItemStatus.IN_PROGRESS.value,
        )
        .first()
    )
    if cur is not None:
        complete_item(db, cur.id, harvest_type)

    nxt = (
        db.query(HarvestMissionItem)
        .filter(
            HarvestMissionItem.mission_id == mission_id,
            HarvestMissionItem.status == HarvestMissionItemStatus.PENDING.value,
        )
        .order_by(HarvestMissionItem.visit_order)
        .first()
    )
    if nxt is not None:
        # Exactly one IN_PROGRESS at a time (§42.3).
        assert (
            db.query(HarvestMissionItem)
            .filter(
                HarvestMissionItem.mission_id == mission_id,
                HarvestMissionItem.status
                == HarvestMissionItemStatus.IN_PROGRESS.value,
            )
            .first()
            is None
        )
        nxt.status = HarvestMissionItemStatus.IN_PROGRESS.value
    else:
        # Queue exhausted -> mission complete (§43.5).
        mission.status = HarvestMissionStatus.COMPLETED.value
        mission.completed_at = _now()
    db.commit()
    db.refresh(mission)
    return mission


def finalize_mission(db: Session, mission_id: int) -> None:
    """Mark a mission COMPLETED if it has no remaining work (used by sim end).

    Called when the robot returns to dock and the engine reports
    EVENT_MISSION_COMPLETED. Any remaining PENDING/IN_PROGRESS items are rolled
    up as COMPLETED (they were physically serviced by the robot but the manual
    advance loop never ran). Idempotent: terminal missions are left untouched.
    """
    mission = db.get(HarvestMission, mission_id)
    if mission is None:
        return
    if mission.status in _TERMINAL_STATUSES:
        return

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
        .order_by(HarvestMissionItem.visit_order)
        .all()
    )
    for it in remaining:
        if it.status != HarvestMissionItemStatus.COMPLETED.value:
            complete_item(db, it.id, mission.harvest_type)

    mission.status = HarvestMissionStatus.COMPLETED.value
    mission.completed_at = _now()
    db.commit()
