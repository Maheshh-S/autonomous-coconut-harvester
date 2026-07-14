from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc

from database.db import SessionLocal
from database.models import Inspection, InspectionStatus, Tree


router = APIRouter()


class InspectionCreate(BaseModel):
    tree_id: int
    notes: Optional[str] = None


class InspectionStart(BaseModel):
    notes: Optional[str] = None


class InspectionComplete(BaseModel):
    inspection_image_count: int = 0
    notes: Optional[str] = None


class InspectionFail(BaseModel):
    notes: Optional[str] = None


def _now() -> datetime:
    return datetime.utcnow()


def _serialize(insp: Inspection) -> dict:
    return {
        "id": insp.id,
        "inspection_code": insp.inspection_code,
        "tree_id": insp.tree_id,
        "tree_code": insp.tree.tree_code if insp.tree else None,
        "created_at": insp.created_at.isoformat() if insp.created_at else None,
        "completed_at": insp.completed_at.isoformat() if insp.completed_at else None,
        "status": insp.status,
        "inspection_image_count": insp.inspection_image_count,
        "notes": insp.notes,
    }


@router.post("/inspection/create")
def create_inspection(payload: InspectionCreate):
    db = SessionLocal()
    try:
        tree = db.get(Tree, payload.tree_id)
        if tree is None:
            raise HTTPException(status_code=404, detail="Tree not found")

        insp = Inspection(
            tree_id=payload.tree_id,
            notes=payload.notes,
            status=InspectionStatus.CREATED.value,
            created_at=_now(),
        )
        db.add(insp)
        db.commit()
        db.refresh(insp)

        # write-once public code, derived from the row id (PROJECT_SPECIFICATION.md §11.2)
        insp.inspection_code = "INSP-" + str(insp.id).zfill(4)
        db.commit()
        db.refresh(insp)
        return _serialize(insp)
    finally:
        db.close()


@router.post("/inspection/{inspection_id}/start")
def start_inspection(inspection_id: int, payload: InspectionStart = InspectionStart()):
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        if insp.status != InspectionStatus.CREATED.value:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot start inspection in status {insp.status}",
            )
        insp.status = InspectionStatus.IN_PROGRESS.value
        if payload.notes is not None:
            insp.notes = payload.notes
        db.commit()
        db.refresh(insp)
        return _serialize(insp)
    finally:
        db.close()


@router.post("/inspection/{inspection_id}/complete")
def complete_inspection(inspection_id: int, payload: InspectionComplete):
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        if insp.status not in (
            InspectionStatus.CREATED.value,
            InspectionStatus.IN_PROGRESS.value,
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot complete inspection in status {insp.status}",
            )
        insp.status = InspectionStatus.COMPLETED.value
        insp.completed_at = _now()
        insp.inspection_image_count = payload.inspection_image_count
        if payload.notes is not None:
            insp.notes = payload.notes
        db.commit()
        db.refresh(insp)
        return _serialize(insp)
    finally:
        db.close()


@router.post("/inspection/{inspection_id}/fail")
def fail_inspection(inspection_id: int, payload: InspectionFail):
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        if insp.status not in (
            InspectionStatus.CREATED.value,
            InspectionStatus.IN_PROGRESS.value,
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot fail inspection in status {insp.status}",
            )
        insp.status = InspectionStatus.FAILED.value
        insp.completed_at = _now()
        if payload.notes is not None:
            insp.notes = payload.notes
        db.commit()
        db.refresh(insp)
        return _serialize(insp)
    finally:
        db.close()


@router.get("/inspection/{inspection_id}")
def get_inspection(inspection_id: int):
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        return _serialize(insp)
    finally:
        db.close()


@router.get("/tree/{tree_id}/inspections")
def list_tree_inspections(tree_id: int):
    db = SessionLocal()
    try:
        tree = db.get(Tree, tree_id)
        if tree is None:
            raise HTTPException(status_code=404, detail="Tree not found")
        rows = (
            db.query(Inspection)
            .filter(Inspection.tree_id == tree_id)
            .order_by(desc(Inspection.created_at), desc(Inspection.id))
            .all()
        )
        return {
            "tree_id": tree_id,
            "tree_code": tree.tree_code,
            "inspections": [_serialize(r) for r in rows],
        }
    finally:
        db.close()


@router.get("/inspections")
def list_latest_inspections(limit: int = 50):
    db = SessionLocal()
    try:
        rows = (
            db.query(Inspection)
            .order_by(desc(Inspection.created_at), desc(Inspection.id))
            .limit(limit)
            .all()
        )
        return {"inspections": [_serialize(r) for r in rows]}
    finally:
        db.close()
