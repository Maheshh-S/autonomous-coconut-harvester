from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.orm import declarative_base

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


