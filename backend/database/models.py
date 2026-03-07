from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(Integer)
    coconut_id = Column(Integer)
    ripeness = Column(String)
    confidence = Column(Float)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(Integer)
    coconut_id = Column(Integer)
    status = Column(String, default="pending")