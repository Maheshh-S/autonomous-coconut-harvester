from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class SurveyMissionStatus(str, Enum):
    """Lifecycle states for a Survey Mission (see PROJECT_SPECIFICATION.md §7.12).

    ``ACTIVE`` is intentionally NOT a status value: per §7.12 the active mission is
    represented by ``is_active = true`` on a ``COMPLETED`` row, which keeps the
    single-active-row invariant simple.
    """

    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    SUPERSEDED = "SUPERSEDED"
    FAILED = "FAILED"

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(Integer)
    coconut_id = Column(Integer)
    ripeness = Column(String)
    confidence = Column(Float)
    harvest_type = Column(String, nullable=True)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(Integer)
    coconut_id = Column(Integer)
    status = Column(String, default="pending")
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    claimed_at = Column(DateTime, nullable=True)

class Tree(Base):
    __tablename__ = "trees"

    id = Column(Integer, primary_key=True, index=True)
    gps_lat = Column(Float)
    gps_lon = Column(Float)
    detected_time = Column(String)

    # Feature 6 — Permanent Tree Matching & Digital Twin Foundation.
    # ``tree_code`` is the immutable public identifier (TREE-0001, TREE-0002, …).
    # It is write-once; Tree Matching is the only writer (PROJECT_SPECIFICATION.md §11.2, §14).
    tree_code = Column(String, unique=True, nullable=True, index=True)
    first_seen_mission_id = Column(Integer, nullable=True)
    last_seen_mission_id = Column(Integer, nullable=True)
    times_seen = Column(Integer, default=1, nullable=False)
    last_matching_confidence = Column(Float, nullable=True)
    # availability: ACTIVE / MISSING / INACTIVE (§16). Set ACTIVE on every observation.
    availability = Column(String, default="ACTIVE", nullable=False)
    # lifecycle_state: NEW → DETECTED → … (§15). Matching creates a tree in DETECTED.
    lifecycle_state = Column(String, default="DETECTED", nullable=False)
    # Representative detection bounding-box dimensions (pixels) used by the hybrid
    # geometry comparison in Tree Matching; refreshed on each observation.
    last_box_w = Column(Integer, nullable=True)
    last_box_h = Column(Integer, nullable=True)


class InspectionStatus(str, Enum):
    """Lifecycle states for a Tree Inspection Session (Feature 7).

    One session is one climbing-robot visit to one permanent tree
    (PROJECT_SPECIFICATION.md §20, Phase 5). The lifecycle is deterministic:

        CREATED → IN_PROGRESS → COMPLETED → FAILED

    ``CREATED`` is set on creation; the robot (or UI) moves it to ``IN_PROGRESS``
    on arrival, then to ``COMPLETED`` (or ``FAILED``) when the visit ends.
    """

    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Inspection(Base):
    """A Tree Inspection Session: one climbing-robot visit to one permanent Tree.

    Introduced in Feature 7 (Tree Inspection Session Foundation). This is the
    first building block of the robot's on-tree work; it deliberately records
    only the session/lifecycle metadata and the inspection history. Coconut
    inventory and ripeness are out of scope here and are not stored.

    ``inspection_code`` is the immutable public identifier (INSP-0001,
    INSP-0002, …), written once from the row id (PROJECT_SPECIFICATION.md §11.2).

    ``tree_id`` has no cascade delete so that deleting a tree can never delete
    its inspection history (PROJECT_SPECIFICATION.md §18): the FK restricts
    deletion of a tree that still has inspections.
    """

    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_code = Column(String, unique=True, nullable=True, index=True)
    tree_id = Column(
        Integer,
        ForeignKey("trees.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default=InspectionStatus.CREATED.value, nullable=False)
    inspection_image_count = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    tree = relationship("Tree")


class SurveyMission(Base):
    __tablename__ = "survey_missions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    source_folder = Column(String, nullable=False)
    status = Column(String, default=SurveyMissionStatus.PROCESSING.value, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    tile_count = Column(Integer, default=0, nullable=False)
    processed_count = Column(Integer, default=0, nullable=False)
    base_gps_lat = Column(Float, nullable=True)
    base_gps_lon = Column(Float, nullable=True)


class SurveyImage(Base):
    """One uploaded image belonging to a Survey Mission (Feature 2: ingestion).

    The binary file is stored on disk under ``uploads/survey/<mission_id>/``;
    this row records the metadata and the on-disk filename so the file can be
    served back. ``mission_id`` mirrors the existing convention of plain
    integer relation columns (no FK constraint), consistent with ``Tree`` /
    ``Detection`` / ``Task``.
    """

    __tablename__ = "survey_images"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, nullable=False, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=False, default=0)
    upload_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SurveyTileStatus(str, Enum):
    """Lifecycle states for a Survey Tile (see PROJECT_SPECIFICATION.md §8.5).

    A tile is one georeferenced drone frame from a survey. Processing creates
    and advances these states; this feature only introduces the entity and the
    states, it performs no processing.
    """

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SurveyTile(Base):
    """One Survey Tile: a georeferenced frame tied to a Survey Mission + Image.

    Introduced in Feature 3 as a first-class domain entity. Records are NOT
    created here (that happens in Feature 4); this model only defines the
    storage and lifecycle states.

    ``mission_id`` / ``image_id`` use the repository's plain-integer relation
    convention (no FK constraint), matching ``SurveyImage``. ``grid_row`` /
    ``grid_col`` capture the tile's position in the coverage grid
    (``plantation_position``, PROJECT_SPECIFICATION.md §8.3) and are populated
    when tiles are generated.
    """

    __tablename__ = "survey_tiles"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, nullable=False, index=True)
    image_id = Column(Integer, nullable=False, index=True, unique=True)
    status = Column(String, default=SurveyTileStatus.PENDING.value, nullable=False)
    grid_row = Column(Integer, nullable=True)
    grid_col = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class TileDetection(Base):
    """A raw, transient tree detection produced by running YOLO on one SurveyTile.

    Introduced in Feature 5. Each detection belongs to exactly one ``SurveyTile``
    (``survey_tile_id``, plain integer relation, no FK — matches the repo
    convention). Per PROJECT_SPECIFICATION.md §9.3 a detection stores only the
    bounding box (pixel coords) and confidence; no GPS, no permanent Tree ID, no
    matching. Permanent ``Tree`` records are created later by Tree Matching
    (out of scope here).
    """

    __tablename__ = "survey_tile_detections"
    __table_args__ = (
        # Enforce one detection row per (tile, index) within a tile. Reprocessing
        # a tile clears and rewrites its detections, so this also guards against
        # duplicate detections.
        UniqueConstraint(
            "survey_tile_id", "detection_index", name="uq_tile_detection_idx"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    survey_tile_id = Column(Integer, nullable=False, index=True)
    detection_index = Column(Integer, nullable=False, default=0)
    x1 = Column(Integer, nullable=False)
    y1 = Column(Integer, nullable=False)
    x2 = Column(Integer, nullable=False)
    y2 = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


