# ARCHITECTURE.md

## System Overview
The system coordinates three main layers: a **frontend UI** (Next.js), a **backend service** (FastAPI) and **machine‑learning models** for perception. Data moves from drone images → ML inference → backend → UI → robot simulation.

## Frontend
- React/Next.js application serving pages for map view, robot control, and tree details.
- Communicates with the backend via thin wrapper functions in `frontend/lib/api/`.

## Backend
- FastAPI routers expose endpoints for tree detection, coconut detection, task planning, and robot task management.
- SQLAlchemy SQLite database stores `Tree`, `Detection`, and `Task` records.
- Business logic (planning, deduplication, task creation) lives here; the UI is kept presentation‑only.

## ML Models
- YOLO model files under `models/` perform tree and coconut detection.
- Perception modules (`perception/detect_coconut.py`, `perception/drone_scan.py`) load the models and return bounding‑box data.

## Data Flow
1. Drone image uploaded by UI → Backend `tree_api`.
2. Model inference → bounding boxes returned to UI.
3. User selects tree → backend registers GPS and creates a `Tree` entry.
4. Coconut detection data → backend may generate a harvesting `Task`.
5. Robot UI polls `robot/next_task` → robot simulation executes the task.

## Major Modules
- **frontend/** – pages, components, API wrapper.
- **backend/** – FastAPI routers, DB session, perception integration.
- **models/** – YOYO model files.
- **mapping/** – path‑planning utilities (future integration).
- **simulation/** – robot simulator for testing without hardware.
