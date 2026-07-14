from datetime import datetime
from pathlib import Path
from typing import List, Optional

import uuid
import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func

from database.db import SessionLocal
from database.models import (
    SurveyMission,
    SurveyMissionStatus,
    SurveyImage,
    SurveyTile,
    SurveyTileStatus,
    TileDetection,
)
# Reuse the single YOLO tree-detection model already loaded by the tree API
# (PROJECT_SPECIFICATION.md §9.2). Avoids loading the weights twice.
from api.tree_api import tree_model


router = APIRouter()


# --- Image storage (Feature 2) ---------------------------------------------
# Uploaded binaries live on disk under <repo>/uploads/survey/<mission_id>/ and
# are served back via the StaticFiles mount declared in backend/main.py. This
# mirrors how the project keeps large binary assets (YOLO weights) on disk while
# recording relational metadata in PostgreSQL.
SURVEY_UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "survey"

# Supported formats per PROJECT_SPECIFICATION.md §7.3 (JPEG/PNG).
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_IMAGE_BYTES = 25 * 1024 * 1024  # §55: enforce a size cap


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


def _serialize_image(image: SurveyImage) -> dict:
    return {
        "id": image.id,
        "mission_id": image.mission_id,
        "filename": image.filename,
        "original_filename": image.original_filename,
        "content_type": image.content_type,
        "file_size": image.file_size,
        "upload_order": image.upload_order,
        "url": f"/survey/uploads/{image.mission_id}/{image.filename}",
        "created_at": image.created_at.isoformat() if image.created_at else None,
    }


def _serialize_tile(tile: SurveyTile) -> dict:
    return {
        "id": tile.id,
        "mission_id": tile.mission_id,
        "image_id": tile.image_id,
        "status": tile.status,
        "grid_row": tile.grid_row,
        "grid_col": tile.grid_col,
        "created_at": tile.created_at.isoformat() if tile.created_at else None,
        "updated_at": tile.updated_at.isoformat() if tile.updated_at else None,
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

        # Feature 4: generation is triggered automatically when a mission becomes
        # COMPLETED (no manual button). The service is idempotent, so re-running
        # completion would never duplicate tiles.
        generate_tiles_for_mission(db, mission.id)

        return _serialize(mission)
    finally:
        db.close()


# -------------------------
# Survey image ingestion (Feature 2)
# -------------------------


@router.post("/mission/{mission_id}/images")
async def upload_survey_images(
    mission_id: int, files: List[UploadFile] = File(...)
):
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")
        if mission.status != SurveyMissionStatus.PROCESSING.value:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Mission is in status {mission.status}; "
                    "images can only be uploaded to a PROCESSING mission"
                ),
            )
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
                    detail=(
                        f"File '{upload.filename}' exceeds the "
                        f"{MAX_IMAGE_BYTES} byte size limit"
                    ),
                )
            received.append((upload, ext, contents))

        mission_dir = SURVEY_UPLOAD_ROOT / str(mission_id)
        mission_dir.mkdir(parents=True, exist_ok=True)

        start_order = (
            db.query(func.max(SurveyImage.upload_order))
            .filter(SurveyImage.mission_id == mission_id)
            .scalar()
            or 0
        )

        saved = []
        for order, (upload, ext, contents) in enumerate(received, start=start_order + 1):
            stored_name = f"{uuid.uuid4().hex}{ext}"
            (mission_dir / stored_name).write_bytes(contents)
            image = SurveyImage(
                mission_id=mission_id,
                filename=stored_name,
                original_filename=upload.filename or stored_name,
                content_type=upload.content_type,
                file_size=len(contents),
                upload_order=order,
            )
            db.add(image)
            saved.append(image)

        db.commit()
        for image in saved:
            db.refresh(image)

        return {
            "mission_id": mission_id,
            "uploaded": [_serialize_image(image) for image in saved],
            "uploaded_count": len(saved),
        }
    finally:
        db.close()


@router.get("/mission/{mission_id}/images")
def list_survey_images(mission_id: int):
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")

        images = (
            db.query(SurveyImage)
            .filter(SurveyImage.mission_id == mission_id)
            .order_by(SurveyImage.upload_order)
            .all()
        )
        return {
            "mission_id": mission_id,
            "images": [_serialize_image(image) for image in images],
            "count": len(images),
        }
    finally:
        db.close()


# -------------------------
# Survey Tile generation (Feature 4)
# -------------------------
# Generates one SurveyTile per uploaded Survey Image for a completed mission.
# Idempotent: re-running never creates duplicate tiles (enforced by a pre-check
# against the unique ``image_id`` column, not by catching IntegrityError). No
# AI/processing happens here — tiles are created in PENDING and await downstream
# processing in a later feature (§7.9, §8.5).


def generate_tiles_for_mission(db, mission_id: int) -> int:
    images = (
        db.query(SurveyImage)
        .filter(SurveyImage.mission_id == mission_id)
        .order_by(SurveyImage.upload_order)
        .all()
    )
    existing = {
        row[0]
        for row in db.query(SurveyTile.image_id)
        .filter(SurveyTile.mission_id == mission_id)
        .all()
    }
    created = 0
    for image in images:
        if image.id in existing:
            continue
        db.add(
            SurveyTile(
                mission_id=mission_id,
                image_id=image.id,
                status=SurveyTileStatus.PENDING.value,
            )
        )
        created += 1
    db.commit()

    # Keep the denormalized mission tile counter in sync with the actual tile rows.
    mission = db.query(SurveyMission).filter(SurveyMission.id == mission_id).first()
    if mission is not None:
        mission.tile_count = (
            db.query(func.count(SurveyTile.id))
            .filter(SurveyTile.mission_id == mission_id)
            .scalar()
            or 0
        )
        db.commit()

    # Feature 5: tiles are processed as soon as they are generated. The pipeline
    # is idempotent — only PENDING tiles are picked up, and process_tile rewrites
    # a tile's detections on retry, so re-running never duplicates detections.
    process_pending_tiles_for_mission(db, mission_id)
    return created


# -------------------------
# Survey Tile processing (Feature 5)
# -------------------------
# Runs the existing YOLO tree model on each PENDING tile and stores raw
# detections. No permanent Tree records, no GPS, no matching.


def process_tile(db, tile: SurveyTile) -> int:
    image = (
        db.query(SurveyImage).filter(SurveyImage.id == tile.image_id).first()
    )
    if image is None:
        tile.status = SurveyTileStatus.FAILED.value
        db.commit()
        return 0

    img_path = SURVEY_UPLOAD_ROOT / str(image.mission_id) / image.filename
    if not img_path.exists():
        tile.status = SurveyTileStatus.FAILED.value
        db.commit()
        return 0

    # Mark PROCESSING so a concurrent/retry run cannot pick this tile up twice.
    tile.status = SurveyTileStatus.PROCESSING.value
    db.commit()

    try:
        contents = img_path.read_bytes()
        npimg = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("could not decode image bytes")

        results = tree_model(frame, conf=0.4)

        # Idempotent retry: clear any prior detections for this tile, then store
        # the fresh set. The (survey_tile_id, detection_index) unique constraint
        # is a secondary guard.
        db.query(TileDetection).filter(
            TileDetection.survey_tile_id == tile.id
        ).delete()

        created = 0
        for r in results:
            for i, box in enumerate(r.boxes):
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                confidence = float(box.conf[0])
                db.add(
                    TileDetection(
                        survey_tile_id=tile.id,
                        detection_index=i,
                        x1=x1,
                        y1=y1,
                        x2=x2,
                        y2=y2,
                        confidence=confidence,
                    )
                )
                created += 1

        tile.status = SurveyTileStatus.COMPLETED.value
        db.commit()
        return created
    except Exception:
        db.rollback()
        tile.status = SurveyTileStatus.FAILED.value
        db.commit()
        return 0


def process_pending_tiles_for_mission(db, mission_id: int) -> int:
    tiles = (
        db.query(SurveyTile)
        .filter(SurveyTile.mission_id == mission_id)
        .filter(SurveyTile.status == SurveyTileStatus.PENDING.value)
        .all()
    )
    total_detections = 0
    for tile in tiles:
        total_detections += process_tile(db, tile)
    return total_detections


# -------------------------
# Survey Tile management (Feature 3)
# -------------------------
# Tiles are introduced here as a first-class entity. No tile records are created
# by this feature (that is Feature 4); these endpoints only read and report.


@router.get("/mission/{mission_id}/tiles")
def list_survey_tiles(mission_id: int):
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")

        tiles = (
            db.query(SurveyTile)
            .filter(SurveyTile.mission_id == mission_id)
            .order_by(SurveyTile.id)
            .all()
        )
        return {
            "mission_id": mission_id,
            "tiles": [_serialize_tile(tile) for tile in tiles],
            "count": len(tiles),
        }
    finally:
        db.close()


@router.get("/mission/{mission_id}/tiles/stats")
def survey_tile_stats(mission_id: int):
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")

        rows = (
            db.query(SurveyTile.status, func.count(SurveyTile.id))
            .filter(SurveyTile.mission_id == mission_id)
            .group_by(SurveyTile.status)
            .all()
        )
        counts = {status: 0 for status in SurveyTileStatus}
        for status, count in rows:
            counts[status] = count
        total = sum(counts.values())

        # Feature 5: raw detections produced from this mission's tiles (audit
        # only — no permanent Tree records, no GPS, no matching).
        detections_total = (
            db.query(func.count(TileDetection.id))
            .join(SurveyTile, TileDetection.survey_tile_id == SurveyTile.id)
            .filter(SurveyTile.mission_id == mission_id)
            .scalar()
            or 0
        )

        return {
            "mission_id": mission_id,
            "total": total,
            "pending": counts[SurveyTileStatus.PENDING],
            "processing": counts[SurveyTileStatus.PROCESSING],
            "completed": counts[SurveyTileStatus.COMPLETED],
            "failed": counts[SurveyTileStatus.FAILED],
            "detections_total": detections_total,
            "processed_tiles": counts[SurveyTileStatus.COMPLETED],
            "remaining_tiles": counts[SurveyTileStatus.PENDING],
        }
    finally:
        db.close()


@router.get("/tile/{tile_id}")
def get_survey_tile(tile_id: int):
    db = SessionLocal()
    try:
        tile = db.query(SurveyTile).filter(SurveyTile.id == tile_id).first()
        if tile is None:
            raise HTTPException(status_code=404, detail="Survey tile not found")
        return _serialize_tile(tile)
    finally:
        db.close()


@router.get("/mission/{mission_id}/tile-generation")
def tile_generation_progress(mission_id: int):
    """Generation progress for a mission, computed from real DB counts (Feature 4).

    ``images_uploaded`` counts Survey Images; ``tiles_generated`` counts Survey
    Tiles; ``remaining`` is the gap. No simulated progress.
    """
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")

        images_uploaded = (
            db.query(func.count(SurveyImage.id))
            .filter(SurveyImage.mission_id == mission_id)
            .scalar()
            or 0
        )
        tiles_generated = (
            db.query(func.count(SurveyTile.id))
            .filter(SurveyTile.mission_id == mission_id)
            .scalar()
            or 0
        )
        remaining = max(images_uploaded - tiles_generated, 0)

        if images_uploaded == 0:
            status = "not_started"
        elif remaining == 0:
            status = "complete"
        else:
            status = "in_progress"

        return {
            "mission_id": mission_id,
            "images_uploaded": images_uploaded,
            "tiles_generated": tiles_generated,
            "remaining": remaining,
            "generation_status": status,
        }
    finally:
        db.close()
