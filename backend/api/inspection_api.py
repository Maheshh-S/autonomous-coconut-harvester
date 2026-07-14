from datetime import datetime
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import desc, func

from database.db import SessionLocal
from database.models import (
    Inspection,
    InspectionStatus,
    Tree,
    InspectionImage,
    InspectionImageStatus,
    CoconutDetection,
)
# Reuse the single YOLO coconut-ripeness model already loaded by the coconut API
# (PROJECT_SPECIFICATION.md §22.3). Avoids loading the weights a second time.
from api.coconut_api import coconut_model


router = APIRouter()


# --- Image storage (Feature 8) ---------------------------------------------
# Uploaded close-up binaries live on disk under <repo>/uploads/inspection/
# <inspection_id>/ and are served back via the StaticFiles mount in main.py.
# This mirrors the Survey image storage pattern (PROJECT_SPECIFICATION.md §22.2).
REPO_ROOT = Path(__file__).resolve().parents[2]
INSPECTION_UPLOAD_ROOT = REPO_ROOT / "uploads" / "inspection"

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_IMAGE_BYTES = 25 * 1024 * 1024  # §55: enforce a size cap
# §22.4: drop weak detections before counting. YOLO already applies NMS.
RIPENESS_CONFIDENCE_THRESHOLD = 0.25


class InspectionCreate(BaseModel):
    tree_id: int
    notes: Optional[str] = None


class InspectionStart(BaseModel):
    notes: Optional[str] = None


class InspectionComplete(BaseModel):
    inspection_image_count: Optional[int] = None
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


def _serialize_image(img: InspectionImage) -> dict:
    summary: dict[str, int] = {}
    for d in img.coconut_detections:
        summary[d.detected_class] = summary.get(d.detected_class, 0) + 1
    return {
        "id": img.id,
        "inspection_id": img.inspection_id,
        "filename": img.filename,
        "original_filename": img.original_filename,
        "upload_order": img.upload_order,
        "created_at": img.created_at.isoformat() if img.created_at else None,
        "status": img.status,
        "detection_count": len(img.coconut_detections),
        "detection_summary": summary,
        "url": f"/inspection/uploads/{img.inspection_id}/{img.filename}",
    }


def _run_ripeness(image_path: Path) -> List[dict]:
    """Run the singleton ripeness model on one image and return detections.

    Each detection carries the bounding box, the (lowercased) ripeness class, and
    confidence (PROJECT_SPECIFICATION.md §22.2/§22.5).
    """
    contents = image_path.read_bytes()
    npimg = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    results = coconut_model(image)

    detections: List[dict] = []
    for r in results:
        for box in r.boxes:
            confidence = float(box.conf[0])
            if confidence < RIPENESS_CONFIDENCE_THRESHOLD:
                continue
            cls = int(box.cls[0])
            label = coconut_model.names[cls]
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            detections.append(
                {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "detected_class": label.lower(),
                    "confidence": confidence,
                }
            )
    return detections


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
        # Prefer an explicit count; otherwise derive it from uploaded images so the
        # field stays consistent with the actual InspectionImage rows.
        if payload.inspection_image_count is not None:
            insp.inspection_image_count = payload.inspection_image_count
        else:
            insp.inspection_image_count = (
                db.query(func.count(InspectionImage.id))
                .filter(InspectionImage.inspection_id == inspection_id)
                .scalar()
                or 0
            )
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


# -------------------------
# Inspection Image upload + ripeness processing (Feature 8)
# -------------------------


@router.post("/inspection/{inspection_id}/images")
async def upload_inspection_images(
    inspection_id: int, files: List[UploadFile] = File(...)
):
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        # Validate every file before writing anything, so a bad file does not
        # leave a half-committed batch on disk or in the database.
        received = []
        for upload in files:
            ext = Path(upload.filename or "").suffix.lower()
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Unsupported image type '{ext or upload.filename}'. "
                        "Allowed formats: jpg, jpeg, png"
                    ),
                )
            contents = await upload.read()
            if len(contents) == 0:
                raise HTTPException(
                    status_code=400, detail=f"File '{upload.filename}' is empty"
                )
            if len(contents) > MAX_IMAGE_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{upload.filename}' exceeds the size limit",
                )
            received.append((upload, ext, contents))

        insp_dir = INSPECTION_UPLOAD_ROOT / str(inspection_id)
        insp_dir.mkdir(parents=True, exist_ok=True)

        start_order = (
            db.query(func.max(InspectionImage.upload_order))
            .filter(InspectionImage.inspection_id == inspection_id)
            .scalar()
            or 0
        )

        saved = []
        for order, (upload, ext, contents) in enumerate(
            received, start=start_order + 1
        ):
            stored = f"{uuid.uuid4().hex}{ext}"
            (insp_dir / stored).write_bytes(contents)
            img = InspectionImage(
                inspection_id=inspection_id,
                filename=stored,
                original_filename=upload.filename or stored,
                upload_order=order,
                status=InspectionImageStatus.PENDING.value,
            )
            db.add(img)
            saved.append(img)

        db.commit()
        for img in saved:
            db.refresh(img)

        # Keep inspection_image_count in sync with the uploaded images.
        insp.inspection_image_count = (
            db.query(func.count(InspectionImage.id))
            .filter(InspectionImage.inspection_id == inspection_id)
            .scalar()
            or 0
        )
        db.commit()

        return {
            "inspection_id": inspection_id,
            "uploaded": [_serialize_image(img) for img in saved],
            "uploaded_count": len(saved),
        }
    finally:
        db.close()


@router.post("/inspection/{inspection_id}/process")
def process_inspection_images(inspection_id: int):
    """Run ripeness detection on every not-yet-COMPLETED image of an inspection.

    Idempotent: a COMPLETED image is skipped, and re-processing a PENDING/FAILED
    image first clears its prior detections, so repeated processing never creates
    duplicate detections (PROJECT_SPECIFICATION.md §22, Feature 8 quality reqs).
    """
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")

        images = (
            db.query(InspectionImage)
            .filter(InspectionImage.inspection_id == inspection_id)
            .order_by(InspectionImage.upload_order)
            .all()
        )

        processed = 0
        detections_created = 0
        for img in images:
            if img.status == InspectionImageStatus.COMPLETED.value:
                continue  # never reprocess a completed image

            img.status = InspectionImageStatus.PROCESSING.value
            db.commit()

            try:
                # Clear prior detections for idempotent reprocessing.
                db.query(CoconutDetection).filter(
                    CoconutDetection.inspection_image_id == img.id
                ).delete()
                dets = _run_ripeness(
                    INSPECTION_UPLOAD_ROOT / str(inspection_id) / img.filename
                )
                for d in dets:
                    db.add(
                        CoconutDetection(
                            inspection_image_id=img.id,
                            x1=d["x1"],
                            y1=d["y1"],
                            x2=d["x2"],
                            y2=d["y2"],
                            detected_class=d["detected_class"],
                            confidence=d["confidence"],
                        )
                    )
                    detections_created += 1
                img.status = InspectionImageStatus.COMPLETED.value
                processed += 1
            except Exception:
                img.status = InspectionImageStatus.FAILED.value

            db.commit()

        return {
            "inspection_id": inspection_id,
            "processed": processed,
            "detections_created": detections_created,
            "images": [_serialize_image(img) for img in images],
        }
    finally:
        db.close()


@router.get("/inspection/{inspection_id}/images")
def list_inspection_images(inspection_id: int):
    db = SessionLocal()
    try:
        insp = db.get(Inspection, inspection_id)
        if insp is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        images = (
            db.query(InspectionImage)
            .filter(InspectionImage.inspection_id == inspection_id)
            .order_by(InspectionImage.upload_order)
            .all()
        )
        return {
            "inspection_id": inspection_id,
            "images": [_serialize_image(img) for img in images],
        }
    finally:
        db.close()
