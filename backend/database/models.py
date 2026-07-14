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


