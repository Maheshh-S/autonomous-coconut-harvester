from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base

Base = declarative_base()

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


