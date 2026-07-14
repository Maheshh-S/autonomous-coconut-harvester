# ARCHITECTURE.md

## System Overview
The system coordinates three layers: a **frontend UI** (Next.js), a **backend
service** (FastAPI) and **machine-learning models** for perception. Data flows
from drone images → ML inference → backend → UI → robot simulation. State is
persisted in **PostgreSQL** (Neon).

## Frontend
- React/Next.js (App Router) application in `frontend/`. Pages: upload
  (`/`), tree dashboard (`/trees`), tree detail (`/trees/[treeId]`), map
  (`/map`), robot control (`/robot`).
- Talks to the backend through the thin wrapper in `frontend/lib/api/detection.ts`.
- Navigation is rendered inline in `frontend/app/layout.tsx`.

## Backend
- FastAPI routers in `backend/api/` expose endpoints for tree detection, coconut
  detection, task planning, and robot task management.
- SQLAlchemy sessions via `backend/database/db.py`; models in
  `backend/database/models.py` (`Tree`, `Detection`, `Task`).
- Business logic (planning, GPS de-duplication, task creation) lives here; the UI
  is kept presentation-only. Shared task de-duplication: `backend/database/tasks.py`.
- Schema is ensured at startup by `backend/database/init_db.py` (manual migrations).

## ML Models
- YOLOv8 model files under `models/` (`tree_detector.pt`, `coconut_detector.pt`)
  perform tree and coconut-ripeness detection. Both are gitignored.
- Perception scripts: `perception/detect_coconut.py`, `perception/drone_scan.py`.

## Mapping / Planning
- `mapping/coverage_path.py` generates a lawnmower GPS coverage path used by the
  drone scan orchestrator.
- `backend/api/planner_api.py` and `harvest_planner.py` turn mature detections
  into an ordered harvest plan.

## Simulation
- `simulation/robot_simulator.py` polls `GET /robot/next_task` and reports
  completion via `POST /robot/complete_task` to exercise the robot flow without
  hardware.

## Data Flow
1. Drone image uploaded by UI → `tree_api` runs YOLO → bounding boxes returned.
2. User selects a box → `drone_api` registers GPS (de-duped) → creates a `Tree`.
3. Coconut image uploaded → `coconut_api` → `detection_api` stores a `Detection`
   (ripeness lowercased) and may create a `Task` based on `harvest_type`.
4. `planner_api` / `harvest_planner` can bulk-generate tasks from mature detections.
5. Robot UI / `robot_simulator` polls `robot/next_task` → executes → `complete_task`.

## Major Modules
- **frontend/** – pages, components, API wrapper.
- **backend/** – FastAPI routers, DB session/models, shared task logic.
- **models/** – YOLO model files (gitignored).
- **mapping/** – coverage-path planning.
- **perception/** – detection scripts.
- **simulation/** – robot simulator.
