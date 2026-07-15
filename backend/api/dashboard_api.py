"""Read-only Dashboard aggregation (Feature 12).

This endpoint exists purely to *present* the current state of the whole system on
one operator surface (PROJECT_SPECIFICATION.md §28–§37). It introduces **no new
business logic**: every value is a descriptive aggregate read directly from the
existing models with basic SQL aggregates (§37.2). Eligibility, planning, matching,
inventory replacement, and mission state transitions all remain owned by their
existing subsystems — this module never mutates anything.

The Farm Summary is computed from the *latest* Inventory Snapshot of each Tree
(``Tree.current_inventory_id`` → ``InventorySnapshot``, §17.2, §30), so the numbers
always reflect the current digital twin, not stale history.

Live robot/harvest execution state is intentionally NOT recomputed here: the
endpoint returns ``current_harvest_mission`` (the mission the dashboard should watch)
and the frontend reuses the existing ``GET /harvest/missions/{id}/status`` endpoint
(§36) so that robot-state logic stays single-sourced in Robot Mission Execution
(Feature 11).
"""

from typing import Optional

from fastapi import APIRouter
from sqlalchemy import func

from database.db import SessionLocal
from database.models import (
    Tree,
    Inspection,
    InspectionStatus,
    InventorySnapshot,
    HarvestMission,
    HarvestMissionStatus,
    HarvestMissionItem,
    HarvestMissionItemStatus,
    SurveyMission,
    SurveyMissionStatus,
    ACTIVE_HARVEST_MISSION_STATUSES,
)

router = APIRouter()


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _serialize_survey(m: Optional[SurveyMission]) -> Optional[dict]:
    if m is None:
        return None
    return {
        "id": m.id,
        "status": m.status,
        "is_active": m.is_active,
        "source_folder": m.source_folder,
        "created_at": _iso(m.created_at),
        "completed_at": _iso(m.completed_at),
        "tile_count": m.tile_count,
        "processed_count": m.processed_count,
    }


def _serialize_harvest(m: Optional[HarvestMission]) -> Optional[dict]:
    if m is None:
        return None
    return {
        "id": m.id,
        "mission_code": m.mission_code,
        "status": m.status,
        "harvest_type": m.harvest_type,
        "total_trees": m.total_trees,
        "total_expected_coconuts": m.total_expected_coconuts,
        "created_at": _iso(m.created_at),
        "completed_at": _iso(m.completed_at),
    }


@router.get("/dashboard/overview")
def dashboard_overview():
    """One-shot, read-only snapshot of the entire system for the dashboard (§28–§37)."""
    db = SessionLocal()
    try:
        # --- Overview card counts ------------------------------------------
        survey_missions_count = db.query(func.count(SurveyMission.id)).scalar() or 0
        permanent_trees_count = db.query(func.count(Tree.id)).scalar() or 0
        trees_inspected_count = (
            db.query(func.count(func.distinct(Inspection.tree_id))).scalar() or 0
        )
        inventory_snapshots_count = (
            db.query(func.count(InventorySnapshot.id)).scalar() or 0
        )
        harvest_missions_count = db.query(func.count(HarvestMission.id)).scalar() or 0

        # --- Farm Summary: latest Inventory Snapshot of each Tree (§30) -----
        current_ids = [
            tid
            for (tid,) in db.query(Tree.current_inventory_id)
            .filter(Tree.current_inventory_id.isnot(None))
            .all()
        ]
        if current_ids:
            total_coconuts, mature, potential, premature = (
                db.query(
                    func.coalesce(func.sum(InventorySnapshot.total_coconuts), 0),
                    func.coalesce(func.sum(InventorySnapshot.mature_count), 0),
                    func.coalesce(func.sum(InventorySnapshot.potential_count), 0),
                    func.coalesce(func.sum(InventorySnapshot.premature_count), 0),
                )
                .filter(InventorySnapshot.id.in_(current_ids))
                .one()
            )
        else:
            total_coconuts = mature = potential = premature = 0

        # Farm-wide harvested count = coconuts removed by completed harvest items
        # (Feature 11 writes ``harvested`` on completion; fall back to expected).
        harvested_count = (
            db.query(
                func.coalesce(
                    func.sum(
                        func.coalesce(
                            HarvestMissionItem.harvested,
                            HarvestMissionItem.expected_coconuts,
                        )
                    ),
                    0,
                )
            )
            .filter(
                HarvestMissionItem.status
                == HarvestMissionItemStatus.COMPLETED.value
            )
            .scalar()
            or 0
        )

        farm_summary = {
            "total_trees": permanent_trees_count,
            "total_coconuts": int(total_coconuts),
            "mature": int(mature),
            "potential": int(potential),
            "premature": int(premature),
            "harvested_count": int(harvested_count),
        }

        # --- Survey section (§30, §34) -------------------------------------
        latest_survey = (
            db.query(SurveyMission)
            .order_by(SurveyMission.created_at.desc(), SurveyMission.id.desc())
            .first()
        )
        active_survey = (
            db.query(SurveyMission)
            .filter(SurveyMission.is_active.is_(True))
            .first()
        )
        last_scan_time = (
            db.query(func.max(SurveyMission.completed_at)).scalar()
        )
        survey = {
            "latest_survey": _serialize_survey(latest_survey),
            "active_survey": _serialize_survey(active_survey),
            "last_scan_time": _iso(last_scan_time),
        }

        # --- Current Harvest Mission (§36): active first, else most recent --
        current_mission = (
            db.query(HarvestMission)
            .filter(HarvestMission.status.in_(ACTIVE_HARVEST_MISSION_STATUSES))
            .order_by(HarvestMission.created_at.desc(), HarvestMission.id.desc())
            .first()
        )
        if current_mission is None:
            current_mission = (
                db.query(HarvestMission)
                .order_by(
                    HarvestMission.created_at.desc(), HarvestMission.id.desc()
                )
                .first()
            )

        # Harvest progress chart is derived from the current mission's items.
        if current_mission is not None:
            items = current_mission.items
            harvest_completed = sum(
                1
                for i in items
                if i.status == HarvestMissionItemStatus.COMPLETED.value
            )
            harvest_total = len(items)
        else:
            harvest_completed = 0
            harvest_total = 0

        # --- Recent Activity timeline (§33) --------------------------------
        events: list[dict] = []

        for m in (
            db.query(SurveyMission)
            .filter(SurveyMission.completed_at.isnot(None))
            .order_by(SurveyMission.completed_at.desc())
            .limit(25)
            .all()
        ):
            events.append(
                {
                    "type": "SURVEY_COMPLETED",
                    "label": f"Survey Mission #{m.id} completed",
                    "ts": _iso(m.completed_at),
                    "ref": str(m.id),
                }
            )

        for insp in (
            db.query(Inspection)
            .order_by(Inspection.created_at.desc())
            .limit(25)
            .all()
        ):
            events.append(
                {
                    "type": "INSPECTION_CREATED",
                    "label": f"Inspection {insp.inspection_code or insp.id} created",
                    "ts": _iso(insp.created_at),
                    "ref": insp.inspection_code or str(insp.id),
                }
            )
            if (
                insp.status == InspectionStatus.COMPLETED.value
                and insp.completed_at is not None
            ):
                events.append(
                    {
                        "type": "INSPECTION_COMPLETED",
                        "label": (
                            f"Inspection {insp.inspection_code or insp.id} completed"
                        ),
                        "ts": _iso(insp.completed_at),
                        "ref": insp.inspection_code or str(insp.id),
                    }
                )

        for snap in (
            db.query(InventorySnapshot)
            .order_by(InventorySnapshot.created_at.desc())
            .limit(25)
            .all()
        ):
            events.append(
                {
                    "type": "INVENTORY_CREATED",
                    "label": (
                        f"Inventory {snap.snapshot_code or snap.id} created "
                        f"({snap.total_coconuts} coconuts)"
                    ),
                    "ts": _iso(snap.created_at),
                    "ref": snap.snapshot_code or str(snap.id),
                }
            )

        for hm in (
            db.query(HarvestMission)
            .order_by(HarvestMission.created_at.desc())
            .limit(25)
            .all()
        ):
            events.append(
                {
                    "type": "HARVEST_MISSION_CREATED",
                    "label": f"Harvest Mission {hm.mission_code or hm.id} created",
                    "ts": _iso(hm.created_at),
                    "ref": hm.mission_code or str(hm.id),
                }
            )
            if (
                hm.status == HarvestMissionStatus.COMPLETED.value
                and hm.completed_at is not None
            ):
                events.append(
                    {
                        "type": "HARVEST_MISSION_COMPLETED",
                        "label": (
                            f"Harvest Mission {hm.mission_code or hm.id} completed"
                        ),
                        "ts": _iso(hm.completed_at),
                        "ref": hm.mission_code or str(hm.id),
                    }
                )

        # Newest first; events with no timestamp sort last.
        events.sort(key=lambda e: e["ts"] or "", reverse=True)
        recent_activity = events[:25]

        return {
            "overview": {
                "survey_missions": survey_missions_count,
                "permanent_trees": permanent_trees_count,
                "trees_inspected": trees_inspected_count,
                "inventory_snapshots": inventory_snapshots_count,
                "harvest_missions": harvest_missions_count,
            },
            "farm_summary": farm_summary,
            "survey": survey,
            "current_harvest_mission": _serialize_harvest(current_mission),
            "recent_activity": recent_activity,
            "charts": {
                "ripeness_distribution": {
                    "mature": int(mature),
                    "potential": int(potential),
                    "premature": int(premature),
                },
                "inspection_coverage": {
                    "inspected": trees_inspected_count,
                    "total": permanent_trees_count,
                },
                "harvest_progress": {
                    "completed": harvest_completed,
                    "total": harvest_total,
                },
            },
        }
    finally:
        db.close()
