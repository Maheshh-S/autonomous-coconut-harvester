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

The new mission becomes ACTIVE via the normal completion path (previous ACTIVE
→ SUPERSEDED, §7.13); permanent trees dedupe by GPS, so re-seeding never
duplicates the tree registry. Not for production use — demo convenience only.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

from database.db import SessionLocal
from database.models import SurveyImage, SurveyMission
from api.survey_api import (
    SURVEY_UPLOAD_ROOT,
    SurveyMissionComplete,
    SurveyMissionCreate,
    complete_survey_mission,
    create_survey_mission,
)

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_CANDIDATES = (
    Path("/app/demo_seed"),
    REPO_ROOT / "demo_images" / "farm_view_demo-images",
)


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
def seed_demo():
    seed_dir = _seed_dir()
    files = sorted(seed_dir.glob("farm_view_*.png"))
    if not files:
        raise HTTPException(status_code=404, detail="Demo image set is empty")

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

    db = SessionLocal()
    try:
        mission = db.query(SurveyMission).filter(SurveyMission.id == mission_id).first()
        if mission is None:
            raise HTTPException(status_code=500, detail="Seed mission vanished")
        mission_dir = SURVEY_UPLOAD_ROOT / str(mission_id)
        mission_dir.mkdir(parents=True, exist_ok=True)

        for order, src in enumerate(files, start=1):
            contents = src.read_bytes()
            stored_name = f"{uuid.uuid4().hex}.png"
            (mission_dir / stored_name).write_bytes(contents)
            db.add(
                SurveyImage(
                    mission_id=mission_id,
                    filename=stored_name,
                    original_filename=src.name,
                    content_type="image/png",
                    file_size=len(contents),
                    upload_order=order,
                )
            )
        db.commit()
    finally:
        db.close()

    # Standard completion path: ACTIVE flip + tile generation + detection +
    # tree matching (Feature 4/5/6, idempotent). This is the slow step (YOLO).
    completed = complete_survey_mission(SurveyMissionComplete(mission_id=mission_id))
    completed["seed_images"] = len(files)
    return completed
