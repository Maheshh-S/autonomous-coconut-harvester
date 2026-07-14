from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database.db import SessionLocal
from database.models import SurveyMission, SurveyMissionStatus


router = APIRouter()


class SurveyMissionCreate(BaseModel):
    source_folder: str
    base_gps_lat: Optional[float] = None
    base_gps_lon: Optional[float] = None


class SurveyMissionComplete(BaseModel):
    mission_id: int


def _serialize(mission: SurveyMission) -> dict:
    return {
        "id": mission.id,
        "status": mission.status,
        "is_active": mission.is_active,
        "source_folder": mission.source_folder,
        "created_at": mission.created_at.isoformat() if mission.created_at else None,
        "completed_at": mission.completed_at.isoformat() if mission.completed_at else None,
        "tile_count": mission.tile_count,
        "processed_count": mission.processed_count,
        "base_gps_lat": mission.base_gps_lat,
        "base_gps_lon": mission.base_gps_lon,
    }


@router.post("/mission/create")
def create_survey_mission(payload: SurveyMissionCreate):
    db = SessionLocal()
    try:
        mission = SurveyMission(
            source_folder=payload.source_folder,
            base_gps_lat=payload.base_gps_lat,
            base_gps_lon=payload.base_gps_lon,
            status=SurveyMissionStatus.PROCESSING.value,
            is_active=False,
        )
        db.add(mission)
        db.commit()
        db.refresh(mission)
        return _serialize(mission)
    finally:
        db.close()


@router.get("/missions")
def list_survey_missions():
    db = SessionLocal()
    try:
        missions = (
            db.query(SurveyMission)
            .order_by(SurveyMission.created_at.desc())
            .all()
        )
        return {
            "missions": [_serialize(m) for m in missions],
            "count": len(missions),
        }
    finally:
        db.close()


@router.post("/mission/complete")
def complete_survey_mission(payload: SurveyMissionComplete):
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == payload.mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")

        if mission.status != SurveyMissionStatus.PROCESSING.value:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Mission is in status {mission.status}; "
                    "only PROCESSING missions can be completed"
                ),
            )

        # Lifecycle: the previously ACTIVE mission becomes SUPERSEDED (§7.13).
        previous_active = (
            db.query(SurveyMission)
            .filter(SurveyMission.is_active.is_(True))
            .filter(SurveyMission.id != mission.id)
            .first()
        )
        if previous_active is not None:
            previous_active.is_active = False
            previous_active.status = SurveyMissionStatus.SUPERSEDED.value

        mission.status = SurveyMissionStatus.COMPLETED.value
        mission.is_active = True
        mission.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(mission)
        return _serialize(mission)
    finally:
        db.close()
