import sys
from pathlib import Path

# Ensure the backend package root is importable regardless of the current
# working directory, so `from api…` / `from database…` resolve both when the
# app is launched as `uvicorn main:app` (from backend/) and as
# `uvicorn backend.main:app` (from the project root).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from api.detection_api import router as detection_router
from api.planner_api import router as planner_router
from api.robot_api import router as robot_router
from api.tree_api import router as tree_router
from api.drone_api import router as drone_router
from api.map_api import router as map_router
from api.harvest_planner import router as harvest_router
from fastapi.middleware.cors import CORSMiddleware
from api.coconut_api import router as coconut_router
from api.survey_api import router as survey_router, SURVEY_UPLOAD_ROOT
from api.inspection_api import (
    router as inspection_router,
    INSPECTION_UPLOAD_ROOT,
)
from api.harvest_mission_api import router as harvest_mission_router
from api.dashboard_api import router as dashboard_router
from api.robot_domain import router as robot_domain_router
from api.robot_navigation import router as robot_navigation_router
from api.robot_simulation import router as robot_simulation_router

app = FastAPI()

# Serve uploaded Survey Mission images (Feature 2). Binary assets are stored on
# disk under ``uploads/survey``; this mount exposes them at ``/survey/uploads``.
SURVEY_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
app.mount(
    "/survey/uploads",
    StaticFiles(directory=str(SURVEY_UPLOAD_ROOT)),
    name="survey_uploads",
)

# Serve uploaded Inspection close-up images (Feature 8). Stored under
# ``uploads/inspection``; exposed at ``/inspection/uploads``.
INSPECTION_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
app.mount(
    "/inspection/uploads",
    StaticFiles(directory=str(INSPECTION_UPLOAD_ROOT)),
    name="inspection_uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(detection_router)
app.include_router(planner_router)
app.include_router(robot_router)
app.include_router(tree_router)
app.include_router(drone_router)
app.include_router(map_router)
app.include_router(harvest_router)
app.include_router(coconut_router)
app.include_router(survey_router)
app.include_router(inspection_router)
app.include_router(harvest_mission_router)
app.include_router(dashboard_router)
app.include_router(robot_domain_router)
app.include_router(robot_navigation_router)
app.include_router(robot_simulation_router)


# Ensure the database schema matches the models on startup. This is idempotent
# (create_all + conditional ALTERs) and safe to run on every boot.
from database.init_db import init_db

init_db()


@app.get("/")
def root():
    return {"message": "Autonomous Coconut Harvesting System API running"}