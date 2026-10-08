"""One-click demo reseed (deployment support).

``POST /admin/seed-demo`` rebuilds a working survey mission from the baked-in
demo images so a fresh or sleep-wiped deployment self-heals without a laptop:
it copies the bundled ``farm_view_*.png`` set into a new mission's upload
directory and then runs the *standard* survey pipeline (completion → tile
generation → YOLO detection → tree matching) by calling the existing
``survey_api`` flow directly. No pipeline logic is duplicated here; the planner
geometry, detection, GPS projection, and 4 m matching are all reused.

Source candidates, first hit wins:
1. ``/app/demo_seed/`` — baked into the Docker image (survives sleep; the
   writable ``uploads/`` layer does not).
2. ``<repo>/demo_images/farm_view_demo-images/`` — local-dev fallback.

The mission completes in-request when the pre-computed JSON is present
(all-SQL flow, safe everywhere); otherwise it stays PROCESSING for the
grind path (reprocess?limit=1 per tile, then /mission/complete).
Permanent trees dedupe by GPS, so re-seeding never duplicates the
registry. Demo convenience only.
"""

import json
import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from sqlalchemy import func

from database.db import SessionLocal
from database.models import SurveyImage, SurveyMission
from api.survey_api import (
    SURVEY_UPLOAD_ROOT,
    SurveyMissionComplete,
    SurveyMissionCreate,
    complete_survey_mission,
    create_survey_mission,
    generate_tiles_for_mission,
    match_trees_for_mission,
)

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_CANDIDATES = (
    Path("/app/demo_seed"),
    REPO_ROOT / "demo_images" / "farm_view_demo-images",
)


# Free-tier survival: full-size demo PNGs (~10 MB each) OOM the 512 MB
# instance during YOLO decode. Downscale to this longest side before saving —
# still plenty for the twin + detection, fraction of the RAM/time.
SEED_MAX_SIDE_PX = 1280


def _downscaled_png(contents: bytes) -> tuple[bytes, str]:
    npimg = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if frame is None:
        return contents, "image/png"
    h, w = frame.shape[:2]
    longest = max(h, w)
    if longest > SEED_MAX_SIDE_PX:
        scale = SEED_MAX_SIDE_PX / longest
        frame = cv2.resize(
            frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
        )
    ok, buf = cv2.imencode(".png", frame)
    if not ok:
        return contents, "image/png"
    return bytes(buf), "image/png"


# Pre-computed YOLO boxes for the demo set (generated locally with the same
# model + conf + downscale path; 26 KB, committed). Small hosts cannot run
# inference (512 MB OOM), so seeding inserts these rows instead of detecting.
# Same boxes localhost YOLO produces — literally produced by it.
PRECOMPUTED_PATH = Path(__file__).resolve().parent / "demo_seed_detections.json"


def _apply_precomputed(db, mission_id: int) -> int:
    """Generate tiles + insert pre-computed detections (no YOLO)."""
    from database.models import SurveyTile, SurveyTileStatus, TileDetection

    spec = json.loads(PRECOMPUTED_PATH.read_text())
    generate_tiles_for_mission(db, mission_id, process=False)

    tiles = (
        db.query(SurveyTile).filter(SurveyTile.mission_id == mission_id).all()
    )
    images = {
        img.id: img
        for img in db.query(SurveyImage)
        .filter(SurveyImage.mission_id == mission_id)
        .all()
    }
    total = 0
    for tile in tiles:
        img = images.get(tile.image_id)
        entry = spec.get(img.original_filename) if img else None
        if entry is None:
            continue
        tile.image_width = entry["width"]
        tile.image_height = entry["height"]
        db.query(TileDetection).filter(
            TileDetection.survey_tile_id == tile.id
        ).delete()
        for b in entry["boxes"]:
            db.add(
                TileDetection(
                    survey_tile_id=tile.id,
                    detection_index=b["i"],
                    x1=b["x1"],
                    y1=b["y1"],
                    x2=b["x2"],
                    y2=b["y2"],
                    confidence=b["conf"],
                )
            )
            total += 1
        tile.status = SurveyTileStatus.COMPLETED.value
    db.commit()
    match_trees_for_mission(db, mission_id)
    return total


def _seed_dir() -> Path:
    for candidate in SEED_CANDIDATES:
        images = sorted(candidate.glob("farm_view_*.png")) if candidate.is_dir() else []
        if images:
            return candidate
    raise HTTPException(
        status_code=404,
        detail="No baked demo images found (looked in /app/demo_seed and demo_images/)",
    )


@router.post("/admin/seed-demo")
def seed_demo(resume: int = 0):
    seed_dir = _seed_dir()
    files = sorted(seed_dir.glob("farm_view_*.png"))
    if not files:
        raise HTTPException(status_code=404, detail="Demo image set is empty")

    db = SessionLocal()
    try:
        if resume:
            # Continue a proxy-cut seed: reuse the PROCESSING mission and skip
            # originals already copied. Per-image commits below make every
            # call's progress durable even if this request is cut too.
            mission = (
                db.query(SurveyMission).filter(SurveyMission.id == resume).first()
            )
            if mission is None or mission.status != "PROCESSING":
                raise HTTPException(
                    status_code=409,
                    detail=f"Mission {resume} is not resumable (need PROCESSING)",
                )
            mission_id = mission.id
            have = {
                row[0]
                for row in db.query(SurveyImage.original_filename)
                .filter(SurveyImage.mission_id == mission_id)
                .all()
            }
            files = [f for f in files if f.name not in have]
        else:
            created = create_survey_mission(
                SurveyMissionCreate(
                    source_folder="demo-seed",
                    # Same default farm origin the survey page uses
                    # (FARM_DEFAULT_LAT/LON) — the projector needs real floats.
                    base_gps_lat=12.1947222,
                    base_gps_lon=76.6100556,
                )
            )
            mission_id = created["id"]

        mission = db.query(SurveyMission).filter(SurveyMission.id == mission_id).first()
        if mission is None:
            raise HTTPException(status_code=500, detail="Seed mission vanished")
        mission_dir = SURVEY_UPLOAD_ROOT / str(mission_id)
        mission_dir.mkdir(parents=True, exist_ok=True)

        order_base = (
            db.query(func.max(SurveyImage.upload_order))
            .filter(SurveyImage.mission_id == mission_id)
            .scalar()
            or 0
        )
        saved = 0
        for order, src in enumerate(files, start=order_base + 1):
            contents, content_type = _downscaled_png(src.read_bytes())
            stored_name = f"{uuid.uuid4().hex}.png"
            (mission_dir / stored_name).write_bytes(contents)
            db.add(
                SurveyImage(
                    mission_id=mission_id,
                    filename=stored_name,
                    original_filename=src.name,
                    content_type=content_type,
                    file_size=len(contents),
                    upload_order=order,
                )
            )
            db.commit()  # durable per image: a cut request loses nothing saved
            saved += 1
    finally:
        db.close()

    # Fast path: pre-computed detections make this a cheap all-SQL flow
    # (tile rows → detection rows → match → ACTIVE) with zero inference —
    # safe on 512 MB hosts. Without the JSON, the mission stays PROCESSING
    # for the grind path (reprocess?limit=1 per tile, then /mission/complete).
    if PRECOMPUTED_PATH.exists():
        db = SessionLocal()
        try:
            detections = _apply_precomputed(db, mission_id)
        finally:
            db.close()
        completed = complete_survey_mission(
            SurveyMissionComplete(mission_id=mission_id)
        )
        completed["seed_images"] = saved
        completed["seed_detections"] = detections
        completed["seed_mode"] = "precomputed"
        return completed
    return {
        "mission_id": mission_id,
        "status": "PROCESSING",
        "seed_images": saved,
        "seed_mode": "grind",
        "next": f"POST /mission/{mission_id}/reprocess?generate=true&limit=1",
    }
