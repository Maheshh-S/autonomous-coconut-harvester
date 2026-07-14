# CLAUDE.md

Guidance for working in the Autonomous Coconut Harvester repository.

## Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 4, in `frontend/`.
- **Backend:** FastAPI + SQLAlchemy, in `backend/` (launched with `uvicorn`).
- **Database:** **PostgreSQL** (Neon) via `DATABASE_URL` in `.env`. No migration
  framework; schema is evolved manually and ensured at startup (see below).
- **ML:** Ultralytics YOLOv8 models in `models/` (`tree_detector.pt`,
  `coconut_detector.pt`). Both files are **gitignored** — they are local only.

## Common commands
- **Frontend:** `cd frontend && npm install`, then `npm run dev` (localhost:3000),
  `npm run lint`, `npm run test:e2e` (Playwright).
- **Backend (either works):**
  - from the project root: `uvicorn backend.main:app --reload` (port 8000)
  - from `backend/`: `uvicorn main:app --reload`
  A `sys.path` bootstrap in `backend/main.py` makes `from api…` / `from database…`
  resolve in both cases.
- **Database:** schema is ensured automatically when the backend starts
  (`database/init_db.init_db` → `create_all` + idempotent `ALTER … IF NOT EXISTS`).
  For a fresh clone, copy `.env.example` to `.env` and set `DATABASE_URL`.
- **Models / `.env` are gitignored** — never commit them, and the app will not
  start without a valid `DATABASE_URL`.

## Architecture
Frontend → `frontend/lib/api/detection.ts` → FastAPI routers in `backend/api/*`:
- `tree_api` — YOLO tree detection + trees summary
- `drone_api` — GPS dedup (4 m) → stores a `Tree`
- `coconut_api` — YOLO coconut ripeness detection
- `detection_api` — stores a `Detection` (ripeness normalised to lowercase) and
  gates `Task` creation by `harvest_type`
- `robot_api` — robot task polling / completion
- `planner_api` / `harvest_planner` — bulk task generation + harvest order
- `map_api` — geo data for the map view

Support modules: `mapping/coverage_path.py` (lawnmower GPS path),
`simulation/robot_simulator.py` (polls the task API), `perception/*` (detection
scripts). Shared task de-duplication lives in `backend/database/tasks.py`
(`create_task_if_needed`).

Data model (`backend/database/models.py`): `Tree` (gps + detected_time),
`Detection` (tree/coconut, ripeness, confidence, harvest_type), `Task`
(tree/coconut, status, priority, created_at, claimed_at).

## Conventions (from AGENTS.md)
- Frontend is presentation only; all business logic lives in the backend.
- Reuse existing code; keep API definitions single-source; no duplicated logic.
- Workflow: Understand → Plan → Implement → Verify → Docs → Commit.
- Models (`*.pt`) and `.env` are gitignored; do not commit them.

## Known gotchas
- Ripeness labels from the model are capitalised (`Mature`/`Premature`/`Potential`)
  but are **stored lowercased**; queries use `func.lower(...)`.
- `harvest_type` is accepted by `detection_api` and now persisted on `Detection`;
  it drives whether a `Task` is created (mature/tender/both).
- `GET /robot/next_task` mutates state: it claims the next pending task
  (`in_progress` + `claimed_at`) and reclaims tasks stuck `in_progress` for >5 min.
- The DB schema is migrated by `init_db` at startup; there are no Alembic
  migrations (see `DECISIONS.md`: "migrations will be manual").
