import sys
from pathlib import Path

# Ensure the backend package root is importable regardless of the current
# working directory, so `from api…` / `from database…` resolve both when the
# app is launched as `uvicorn main:app` (from backend/) and as
# `uvicorn backend.main:app` (from the project root).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from api.detection_api import router as detection_router
from api.planner_api import router as planner_router
from api.robot_api import router as robot_router
from api.tree_api import router as tree_router
from api.drone_api import router as drone_router
from api.map_api import router as map_router
from api.harvest_planner import router as harvest_router
from fastapi.middleware.cors import CORSMiddleware
from api.coconut_api import router as coconut_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


# Ensure the database schema matches the models on startup. This is idempotent
# (create_all + conditional ALTERs) and safe to run on every boot.
from database.init_db import init_db

init_db()


@app.get("/")
def root():
    return {"message": "Autonomous Coconut Harvesting System API running"}