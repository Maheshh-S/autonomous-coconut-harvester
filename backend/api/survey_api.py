from datetime import datetime
from pathlib import Path
from typing import List, Optional

import uuid
import math
import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func, text

from database.db import SessionLocal
from database.models import (
    SurveyMission,
    SurveyMissionStatus,
    SurveyImage,
    SurveyTile,
    SurveyTileStatus,
    TileDetection,
    Tree,
    TreeObservation,
)
# Reuse the single YOLO tree-detection model already loaded by the tree API
# (PROJECT_SPECIFICATION.md §9.2). Avoids loading the weights twice.
from api.tree_api import tree_model
# Reuse the GPS projection + Haversine service (single source, §10/§11).
from api.gps_projection import (
    gps_distance,
    project_detection_gps,
    DISTANCE_THRESHOLD,
)
# Version 2.8.3 — simulated Flight Planner is the source of truth for tile
# spatial placement; mission geometry is planner-config-defined, not image-derived.
from api.flight_planner import plan_flight, FlightPlannerError

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


def _serialize_tile(tile: SurveyTile, image: "SurveyImage | None" = None) -> dict:
    # V2.2 (Digital Twin Farm Viewer, §V2.5): the mosaic renderer needs a
    # directly-loadable image URL per tile so it can reconstruct the farm without
    # decoding every file. Built from the tile's SurveyImage (same mission_id).
    image_url = None
    if image is not None:
        image_url = f"/survey/uploads/{tile.mission_id}/{image.filename}"
    return {
        "id": tile.id,
        "mission_id": tile.mission_id,
        "image_id": tile.image_id,
        "image_url": image_url,
        "status": tile.status,
        "grid_row": tile.grid_row,
        "grid_col": tile.grid_col,
        # Version 2 tile metadata (§V2.5) — persisted, source of truth for the twin.
        "capture_order": tile.capture_order,
        "center_gps_lat": tile.center_gps_lat,
        "center_gps_lon": tile.center_gps_lon,
        "image_width": tile.image_width,
        "image_height": tile.image_height,
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

    # Version 2.8.3 — the survey geometry is produced by the simulated Flight
    # Planner (``SimulationFlightPlanner``) from an EXPLICIT ``PlannerConfig``
    # (rows/cols/origin/pattern/spacing — §DECISIONS Decision 6b), NOT from the
    # image count. The grid is persisted onto each tile so the frontend never
    # infers positions (§V2, Decision 4). Images only populate the planned capture
    # positions; an overflow (more images than planned cells) is a validation
    # error, never a silently-extended grid. Image dimensions are filled later
    # during tile processing (``process_tile``) — the only stage that decodes the
    # file.
    try:
        flight = plan_flight(db, mission_id)
    except FlightPlannerError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    placement_by_image = {p.image_id: p for p in flight.placements}

    created = 0
    for image in images:
        if image.id in existing:
            continue
        p = placement_by_image[image.id]
        db.add(
            SurveyTile(
                mission_id=mission_id,
                image_id=image.id,
                status=SurveyTileStatus.PENDING.value,
                capture_order=p.capture_order,
                grid_row=p.grid_row,
                grid_col=p.grid_col,
                center_gps_lat=p.center_gps_lat,
                center_gps_lon=p.center_gps_lon,
            )
        )
        created += 1
    db.commit()

    # Backfill metadata for any pre-V2 tiles that predate these columns, so a
    # re-run heals older rows (image dimensions still require reprocessing).
    for tile in (
        db.query(SurveyTile).filter(SurveyTile.mission_id == mission_id).all()
    ):
        if tile.grid_row is None or tile.capture_order is None:
            p = placement_by_image.get(tile.image_id)
            if p is None:
                continue
            tile.grid_row = p.grid_row
            tile.grid_col = p.grid_col
            tile.capture_order = p.capture_order
            tile.center_gps_lat = p.center_gps_lat
            tile.center_gps_lon = p.center_gps_lon
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

    # Feature 6: convert the freshly generated detections into permanent Trees.
    # Idempotent — reprojecting the same detections finds the existing Trees
    # (within the 4 m GPS radius) and reuses them, so re-running never creates
    # duplicate permanent trees.
    match_trees_for_mission(db, mission_id)
    return created


# -------------------------
# Permanent Tree Matching (Feature 6)
# -------------------------
# Converts a mission's SurveyTile detections into stable permanent Tree records.
# For every detection it projects a GPS coordinate, searches nearby permanent
# Trees, and reuses an existing one (GPS-proximity, §11.3) or creates a new one.
# Candidate selection and the reported match confidence also use a geometry
# comparison (detection centre + bounding-box dimensions), per the hybrid
# matching requirement.

# Hybrid confidence weights: GPS proximity is the primary, frozen reuse signal;
# geometry refines which candidate wins and is reported as the match confidence.
GPS_WEIGHT = 0.7
GEO_WEIGHT = 0.3


def _representative_sort_key(obs: TreeObservation, tile_dims: dict) -> tuple:
    """Frozen representative-observation ordering (PROJECT_SPECIFICATION.md §V2.7).

    Smaller tuple wins under ``min``: (1) highest confidence, (2) closest to the
    tile centre, (3) newest mission. Distance is unknown when the tile lacks
    persisted dimensions (pre-V2 rows) — such observations sort last on the
    tie-break but can still win on confidence alone.
    """

    w, h = tile_dims.get(obs.survey_tile_id, (None, None))
    if w and h:
        dist = math.hypot(obs.local_pixel_x - w / 2.0, obs.local_pixel_y - h / 2.0)
    else:
        dist = float("inf")
    return (-obs.confidence, dist, -obs.mission_id)


def _recompute_representative_observations(db, tree_ids) -> None:
    """Repoint ``Tree.current_observation_id`` at each tree's representative.

    Considers *all* of a tree's observations across *all* missions (a re-survey
    can promote a newer, better observation), per the frozen rule in §V2.7.
    """

    tree_ids = [tid for tid in tree_ids if tid is not None]
    if not tree_ids:
        return

    observations = (
        db.query(TreeObservation)
        .filter(TreeObservation.tree_id.in_(tree_ids))
        .all()
    )
    tile_ids = {o.survey_tile_id for o in observations}
    tile_dims = {}
    if tile_ids:
        for tile in (
            db.query(SurveyTile).filter(SurveyTile.id.in_(list(tile_ids))).all()
        ):
            tile_dims[tile.id] = (tile.image_width, tile.image_height)

    by_tree: dict = {}
    for obs in observations:
        by_tree.setdefault(obs.tree_id, []).append(obs)

    # Bulk-load the affected Trees in one query — a per-tree lookup here is an
    # N+1 that turns into hundreds of round-trips on a real (remote) database.
    trees = {
        t.id: t
        for t in db.query(Tree).filter(Tree.id.in_(list(by_tree.keys()))).all()
    }
    for tree_id, obs_list in by_tree.items():
        representative = min(
            obs_list, key=lambda o: _representative_sort_key(o, tile_dims)
        )
        tree = trees.get(tree_id)
        if tree is not None:
            tree.current_observation_id = representative.id


def match_trees_for_mission(db, mission_id: int) -> int:
    mission = (
        db.query(SurveyMission).filter(SurveyMission.id == mission_id).first()
    )
    if mission is None:
        return 0

    # The GPS Projection service always reads the coordinates from the Survey
    # Mission (single-farm system — no fallback origin). The UI prefills the
    # farmer's real farm coordinates, so these are always present.
    base_lat = mission.base_gps_lat
    base_lon = mission.base_gps_lon

    tiles = (
        db.query(SurveyTile)
        .filter(SurveyTile.mission_id == mission_id)
        .filter(SurveyTile.status == SurveyTileStatus.COMPLETED.value)
        .order_by(SurveyTile.id)
        .all()
    )
    # Working set of all permanent Trees for GPS matching. Kept as *plain dicts*
    # (id + match fields only) rather than live ORM objects: holding 302 persistent
    # ``Tree`` rows in the session makes them dirty, and the implicit autoflush
    # before each write would re-emit every one as its own UPDATE round-trip over
    # the remote DB. Newly created Trees are still ORM objects (needed for INSERT).
    all_trees = [
        {
            "id": t.id,
            "gps_lat": t.gps_lat,
            "gps_lon": t.gps_lon,
            "last_box_w": t.last_box_w,
            "last_box_h": t.last_box_h,
            "times_seen": t.times_seen,
        }
        for t in db.query(Tree).all()
    ]

    # Version 2 (§V2.5, Decision 2): observations are mission-scoped and rebuilt
    # idempotently. Clearing only THIS mission's observations preserves every
    # other mission's history — observations are never overwritten across surveys.
    db.query(TreeObservation).filter(
        TreeObservation.mission_id == mission_id
    ).delete()

    touched_tree_ids: set = set()
    created = 0
    observation_data: list = []
    # (lightweight_dict, ORM_Tree) pairs for trees created this run. Resolved to
    # real ids in the post-flush pass below; keyed by pair (not by dict identity,
    # which is unhashable) so we can repoint the dict and record the real id.
    new_tree_pairs: list = []
    # Deferred Tree updates: applied once via a single executemany UPDATE after the
    # loop, so the ~N existing-tree UPDATEs collapse into one round-trip.
    tree_updates: dict = {}
    for tile in tiles:
        # Grid position and image dimensions come from the persisted tile metadata
        # (§V2.5); decode the image only as a fallback for pre-V2 tiles that lack
        # dimensions, so re-processing legacy data still works.
        row = tile.grid_row if tile.grid_row is not None else 0
        col = tile.grid_col if tile.grid_col is not None else 0
        img_w = tile.image_width
        img_h = tile.image_height
        if img_w is None or img_h is None:
            image = (
                db.query(SurveyImage)
                .filter(SurveyImage.id == tile.image_id)
                .first()
            )
            if image is None:
                continue
            img_path = SURVEY_UPLOAD_ROOT / str(mission_id) / image.filename
            if not img_path.exists():
                continue
            frame = cv2.imdecode(
                np.frombuffer(img_path.read_bytes(), np.uint8), cv2.IMREAD_COLOR
            )
            if frame is None:
                continue
            img_h, img_w = frame.shape[:2]
            tile.image_width = int(img_w)
            tile.image_height = int(img_h)

        detections = (
            db.query(TileDetection)
            .filter(TileDetection.survey_tile_id == tile.id)
            .order_by(TileDetection.detection_index)
            .all()
        )
        for d in detections:
            cx = (d.x1 + d.x2) / 2.0
            cy = (d.y1 + d.y2) / 2.0
            bw = d.x2 - d.x1
            bh = d.y2 - d.y1
            lat, lon = project_detection_gps(
                base_lat, base_lon, row, col, img_w, img_h, cx, cy
            )

            # Step 1+2: candidate search by projected GPS, then geometry compare.
            best = None
            best_conf = -1.0
            for t in all_trees:
                dist = gps_distance(lat, lon, t["gps_lat"], t["gps_lon"])
                if dist > DISTANCE_THRESHOLD:
                    continue
                geo = 1.0
                if t["last_box_w"] and t["last_box_h"]:
                    geo = (
                        min(bw, t["last_box_w"]) / max(bw, t["last_box_w"])
                        * min(bh, t["last_box_h"]) / max(bh, t["last_box_h"])
                    )
                # Step 3: hybrid matching confidence (0..1).
                conf = GPS_WEIGHT * max(0.0, 1.0 - dist / DISTANCE_THRESHOLD) + GEO_WEIGHT * geo
                if conf > best_conf:
                    best_conf = conf
                    best = t

            if best is not None:
                # Reuse existing permanent Tree (§11.2 invariants). The match set
                # holds plain dicts, never live ORM objects, so nothing here marks a
                # persistent Tree dirty. All refreshes are deferred to
                # ``tree_updates`` and written in one batch (see below).
                if best["id"] in tree_updates:
                    upd = tree_updates[best["id"]]
                    upd["times_seen"] = (upd.get("times_seen") or 0) + 1
                else:
                    upd = {
                        "id": best["id"],
                        "last_seen_mission_id": mission_id,
                        "times_seen": (best["times_seen"] or 0) + 1,
                        "last_matching_confidence": None,
                        "last_box_w": None,
                        "last_box_h": None,
                        "availability": "ACTIVE",
                    }
                    tree_updates[best["id"]] = upd
                upd["last_matching_confidence"] = round(best_conf, 4)
                upd["last_box_w"] = bw
                upd["last_box_h"] = bh
                upd["last_seen_mission_id"] = mission_id
                # Carry the resolved tree as a lightweight dict for the observation.
                resolved = best
            else:
                resolved_tree = Tree(
                    gps_lat=lat,
                    gps_lon=lon,
                    detected_time=str(datetime.utcnow()),
                    first_seen_mission_id=mission_id,
                    last_seen_mission_id=mission_id,
                    times_seen=1,
                    last_matching_confidence=None,
                    availability="ACTIVE",
                    lifecycle_state="DETECTED",
                    last_box_w=bw,
                    last_box_h=bh,
                )
                db.add(resolved_tree)
                new_id = None  # assigned by the batched flush after the loop
                # Mirror the new tree into the match set as a plain dict so later
                # detections in this run can converge on it.
                resolved = {
                    "id": new_id,
                    "gps_lat": lat,
                    "gps_lon": lon,
                    "last_box_w": bw,
                    "last_box_h": bh,
                    "times_seen": 1,
                }
                all_trees.append(resolved)
                # Id assigned by the single batched flush after the loop (below),
                # so the observation's tree_id is populated before the bulk insert.
                # Track the (dict, ORM) pair so the post-flush pass can repoint the
                # dict to the real id and record that id in touched_tree_ids.
                new_tree_pairs.append((resolved, resolved_tree))
                created += 1

            # Version 2 (§V2.5): record this detection as a permanent, historical
            # observation of the resolved tree — the tile/pixel/bbox/GPS chain the
            # Digital Twin renders. The Tree row is never given this metadata.
            # Rows are assembled after the post-loop flush (when new-tree ids exist)
            # and written in one batched statement instead of one round-trip each.
            observation_data.append(
                {
                    "tree": resolved,
                    "mission_id": mission_id,
                    "survey_tile_id": tile.id,
                    "local_pixel_x": cx,
                    "local_pixel_y": cy,
                    "bbox_x1": d.x1,
                    "bbox_y1": d.y1,
                    "bbox_x2": d.x2,
                    "bbox_y2": d.y2,
                    "confidence": d.confidence,
                    "gps_lat": lat,
                    "gps_lon": lon,
                    "created_at": datetime.utcnow(),
                }
            )
            touched_tree_ids.add(resolved["id"])

    # One batched flush inserts the new Trees (executemany) and assigns their ids,
    # which both the observation rows and the deferred tree updates depend on.
    # ``no_autoflush`` guarantees the only writes are our explicit batched ones —
    # no per-object UPDATE round-trips for the matched (dict-held) trees.
    with db.no_autoflush:
        db.flush()
        # Map each new ORM Tree back to the lightweight dict used during matching,
        # so the observation rows assembled below carry the real (assigned) id.
        # Multiple detections can converge on the SAME new stub tree — they share
        # the same dict reference — so we resolve by (dict, Tree) pair rather than
        # zipping observation dicts 1:1 with the ORM objects; a 1:1 zip would drop
        # the extra converged observations and leave their tree_id NULL on insert.
        # We also record the real id in touched_tree_ids so the representative pass
        # below repoints these brand-new trees' current_observation_id. Previously
        # only None was added (the stub's id before flush) and was silently skipped,
        # leaving every new tree's current_observation_id NULL and the Digital Twin
        # empty for a first survey.
        for rdict, t in new_tree_pairs:
            # Immutable public code derived from the row id — unique/stable.
            t.tree_code = f"TREE-{t.id:04d}"
            rdict["id"] = t.id
            touched_tree_ids.add(t.id)
            tree_updates[t.id] = {
                "id": t.id,
                "last_seen_mission_id": mission_id,
                "times_seen": 1,
                "last_matching_confidence": None,
                "last_box_w": t.last_box_w,
                "last_box_h": t.last_box_h,
                "availability": "ACTIVE",
            }

    # Batched Tree UPDATEs (§V2.5): every existing-tree metadata refresh collapses
    # into a single executemany round-trip instead of one UPDATE per tree over the
    # remote DB. A raw statement is used because SQLAlchemy's bulk_update_mappings
    # issues a round-trip per row here (79s for 302 rows) — see verification notes.
    if tree_updates:
        db.execute(
            text(
                "UPDATE trees SET "
                "last_seen_mission_id = :last_seen_mission_id, "
                "times_seen = :times_seen, "
                "last_matching_confidence = :last_matching_confidence, "
                "last_box_w = :last_box_w, "
                "last_box_h = :last_box_h, "
                "availability = :availability "
                "WHERE id = :id"
            ),
            [
                {
                    "id": u["id"],
                    "last_seen_mission_id": u["last_seen_mission_id"],
                    "times_seen": u["times_seen"],
                    "last_matching_confidence": u["last_matching_confidence"],
                    "last_box_w": u["last_box_w"],
                    "last_box_h": u["last_box_h"],
                    "availability": u["availability"],
                }
                for u in tree_updates.values()
                if u.get("id") is not None
            ],
        )

    # Assemble the observation rows now that every tree id (including freshly
    # inserted ones) is known, then write them in a single batched INSERT — this
    # collapses ~N detection round-trips into one query against the remote DB.
    observation_rows = [
        {
            "tree_id": od["tree"]["id"],
            "mission_id": od["mission_id"],
            "survey_tile_id": od["survey_tile_id"],
            "local_pixel_x": od["local_pixel_x"],
            "local_pixel_y": od["local_pixel_y"],
            "bbox_x1": od["bbox_x1"],
            "bbox_y1": od["bbox_y1"],
            "bbox_x2": od["bbox_x2"],
            "bbox_y2": od["bbox_y2"],
            "confidence": od["confidence"],
            "gps_lat": od["gps_lat"],
            "gps_lon": od["gps_lon"],
            "created_at": od["created_at"],
        }
        for od in observation_data
    ]
    if observation_rows:
        db.bulk_insert_mappings(
            TreeObservation, observation_rows
        )

    db.commit()

    # Choose each touched tree's representative observation (§V2.7) and repoint
    # ``Tree.current_observation_id``. Done after commit so all observation ids
    # exist and the selection sees the full, current observation history.
    _recompute_representative_observations(db, touched_tree_ids)
    db.commit()
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

        # Version 2 (§V2.5): persist the tile image dimensions here — this is the
        # single stage that already decodes the file, so the twin never re-decodes.
        img_h, img_w = frame.shape[:2]
        tile.image_width = int(img_w)
        tile.image_height = int(img_h)

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
        images = {
            img.id: img
            for img in db.query(SurveyImage)
            .filter(SurveyImage.mission_id == mission_id)
            .all()
        }
        return {
            "mission_id": mission_id,
            "tiles": [
                _serialize_tile(tile, images.get(tile.image_id)) for tile in tiles
            ],
            "count": len(tiles),
        }
    finally:
        db.close()


@router.get("/mission/{mission_id}/trees")
def list_mission_tree_overlays(mission_id: int):
    """Bulk tree-overlay data for the Digital Twin (PROJECT_SPECIFICATION.md §V2.4,
    §V2.10). Returns, for the requested mission, the persisted representative
    observation of every Permanent Tree whose representative tile belongs to this
    mission — i.e. the trees that actually appear in the mosaic. Uses only
    persisted data: `Tree.current_observation_id` already points at the §V2.7
    representative, so nothing is recomputed or re-derived from YOLO here. One
    bulk call, no per-tree round-trips."""
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission)
            .filter(SurveyMission.id == mission_id)
            .first()
        )
        if mission is None:
            raise HTTPException(status_code=404, detail="Survey mission not found")

        tile_ids = [
            tid
            for (tid,) in db.query(SurveyTile.id)
            .filter(SurveyTile.mission_id == mission_id)
            .all()
        ]
        if not tile_ids:
            return {"mission_id": mission_id, "trees": [], "count": 0}

        # Single bulk join (§V2.10: no per-tree round-trips). Select the tree
        # code + GPS + times_seen in the same query instead of lazy-loading
        # `o.tree` per row — the latter is an N+1 that exhausts the connection
        # pool. The extra columns feed the V2.5 Tree Details panel (§32) without
        # any additional request: tree_code, gps_lat/gps_lon (§32 GPS), and
        # times_seen (§33 "Times Seen") are all persisted on Tree.
        obs_rows = (
            db.query(
                TreeObservation,
                Tree.tree_code,
                Tree.gps_lat,
                Tree.gps_lon,
                Tree.times_seen,
            )
            .join(Tree, Tree.id == TreeObservation.tree_id)
            .filter(TreeObservation.id == Tree.current_observation_id)
            .filter(TreeObservation.survey_tile_id.in_(tile_ids))
            .all()
        )

        trees = [
            {
                "tree_id": o.tree_id,
                "tree_code": tree_code,
                "gps_lat": gps_lat,
                "gps_lon": gps_lon,
                "times_seen": times_seen,
                "survey_tile_id": o.survey_tile_id,
                "local_pixel_x": o.local_pixel_x,
                "local_pixel_y": o.local_pixel_y,
                "bbox_x1": o.bbox_x1,
                "bbox_y1": o.bbox_y1,
                "bbox_x2": o.bbox_x2,
                "bbox_y2": o.bbox_y2,
                "confidence": o.confidence,
            }
            for o, tree_code, gps_lat, gps_lon, times_seen in obs_rows
        ]
        return {"mission_id": mission_id, "trees": trees, "count": len(trees)}
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
        image = (
            db.query(SurveyImage).filter(SurveyImage.id == tile.image_id).first()
        )
        return _serialize_tile(tile, image)
    finally:
        db.close()


@router.get("/mission/{mission_id}/permanent-trees")
def get_permanent_trees(mission_id: int):
    """Permanent Trees touched by a mission (Feature 6).

    Summarises the digital-twin foundation for the selected mission: how many
    permanent Trees were first seen vs. re-observed, and the average matching
    confidence over re-observations. Stable Tree IDs are the core guarantee.
    """
    db = SessionLocal()
    try:
        mission = (
            db.query(SurveyMission).filter(SurveyMission.id == mission_id).first()
        )
        if mission is None:
            raise HTTPException(
                status_code=404, detail="Survey mission not found"
            )

        observed = (
            db.query(Tree).filter(Tree.last_seen_mission_id == mission_id).all()
        )
        newly_created = [t for t in observed if t.first_seen_mission_id == mission_id]
        matched_existing = [
            t for t in observed if t.first_seen_mission_id != mission_id
        ]
        confs = [
            t.last_matching_confidence
            for t in matched_existing
            if t.last_matching_confidence is not None
        ]
        avg_conf = round(sum(confs) / len(confs), 4) if confs else None

        return {
            "mission_id": mission_id,
            "total": len(observed),
            "newly_created": len(newly_created),
            "matched_existing": len(matched_existing),
            "avg_match_confidence": avg_conf,
            "trees": [
                {
                    "id": t.id,
                    "tree_code": t.tree_code or f"TREE-{t.id:04d}",
                    "gps_lat": t.gps_lat,
                    "gps_lon": t.gps_lon,
                    "times_seen": t.times_seen,
                    "first_seen_mission_id": t.first_seen_mission_id,
                    "last_seen_mission_id": t.last_seen_mission_id,
                    "last_matching_confidence": t.last_matching_confidence,
                    "is_new": t.first_seen_mission_id == mission_id,
                }
                for t in observed
            ],
        }
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
