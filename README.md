# Autonomous Coconut Harvesting

An autonomous system that detects coconut trees from drone imagery, assesses
coconut ripeness, plans harvest tasks, and coordinates a (simulated) robot to
collect the fruit.

## Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 4
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL (Neon) via `DATABASE_URL`
- **ML:** Ultralytics YOLOv8 (`tree_detector.pt`, `coconut_detector.pt`)

## Setup
1. **Backend**
   ```bash
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt   # see note below
   cp .env.example .env              # then set your DATABASE_URL
   uvicorn backend.main:app --reload # or: cd backend && uvicorn main:app --reload
   ```
   The schema is created/migrated automatically at startup
   (`backend/database/init_db.py`).
2. **Frontend**
   ```bash
   cd frontend && npm install && npm run dev   # http://localhost:3000
   ```

> Note: `requirements.txt` is currently a placeholder and does not list all
> dependencies. Install at least: `fastapi uvicorn sqlalchemy psycopg2-binary
> python-dotenv ultralytics opencv-python pillow requests`.

> Model weights (`models/*.pt`) and `.env` are gitignored and must be present
> locally for detection endpoints to work.

## Implemented flow
- `frontend/components/DroneUploader.tsx` → `POST /detect/trees`
  (`backend/api/tree_api.py`) → user selects a box →
  `POST /drone/tree_detected` (`backend/api/drone_api.py`) creates/reuses a `Tree`.
- Tree detail page (`frontend/app/trees/[treeId]/page.tsx`) mounts
  `CoconutUploader.tsx` → `POST /detect/coconuts` (`coconut_api.py`) →
  `POST /drone/detection` (`detection_api.py`) stores a `Detection` and may
  create a `Task`.
- Robot page (`frontend/app/robot/page.tsx`) → `GET /robot/next_task` /
  `POST /robot/complete_task` (`robot_api.py`).

## Intended full pipeline
`perception/drone_scan.py` walks a coverage path (`mapping/coverage_path.py`),
runs tree + coconut detection, and posts results to the same APIs. Bulk task
generation: `POST /planner/generate_tasks` (`planner_api.py`); ordered harvest
plan: `GET /planner/harvest_order` (`harvest_planner.py`). Execution is driven by
`simulation/robot_simulator.py`.

## Notes / gotchas
- Ripeness from the model is capitalised (`Mature`/`Premature`/`Potential`) but is
  stored lowercased; planner/harvest queries use `func.lower(...)`.
- `GET /robot/next_task` claims a task (`in_progress` + `claimed_at`) and reclaims
  tasks stuck for >5 minutes.
- There is no Alembic migration framework; schema changes are applied manually
  via `init_db` (see `DECISIONS.md`).
