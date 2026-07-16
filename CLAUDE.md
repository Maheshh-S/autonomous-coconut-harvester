# CLAUDE.md

Claude-specific working notes for the Autonomous Coconut Harvester repository.

> **Canonical engineering guide:** `AGENTS.md` is the authoritative document for
> mission, workflow, principles, verification policy, and version policy. This file
> holds only the practical commands and gotchas Claude needs day-to-day; when they
> diverge, `AGENTS.md` wins.

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

## Backend router map (`backend/api/*`)

- `survey_api` — survey missions, tile generation, tree matching, permanent trees
- `inspection_api` — coconut ripeness inspection → `InventorySnapshot`
- `harvest_mission_api` — `HarvestMission` planning + start/pause/resume/cancel/advance
- `harvest_planner` / `planner_api` — Nearest-Neighbour ordering + legacy V1 bulk tasks
- `tree_api` — tree summary + YOLO tree detection
- `coconut_api` — YOLO coconut ripeness detection
- `drone_api` — GPS dedup (4 m) → stores a `Tree` (legacy V1)
- `detection_api` — stores a `Detection` (ripeness normalised to lowercase) and
  gates `Task` creation by `harvest_type` (legacy V1)
- `robot_api` — legacy V1 robot task polling / completion (`/robot/next_task`,
  `/robot/complete_task`)
- `map_api` — geo data for the map view
- `robot_domain` / `robot_navigation` / `robot_simulation` / `robot_telemetry` /
  `robot_history` — V3 robot subsystem
- `dashboard_api` — `GET /dashboard/overview` aggregation

Domain logic lives outside the routers: `harvest/execution.py` (harvest-mission
execution), `navigation/` (movement planning), `robot/state_machine.py` (frozen
transitions), `simulation/` (engine + clock + scheduler + config),
`telemetry/` (event bus + service + WebSocket), `analytics/mission_history.py`.

## Known gotchas

- Ripeness labels from the model are capitalised (`Mature`/`Premature`/`Potential`)
  but are **stored lowercased**; queries use `func.lower(...)`.
- `harvest_type` is accepted by `detection_api` and persisted on `Detection`; it
  drives whether a `Task` is created (mature/tender/both).
- `GET /robot/next_task` mutates state: it claims the next pending task
  (`in_progress` + `claimed_at`) and reclaims tasks stuck `in_progress` for >5 min.
- The DB schema is migrated by `init_db` at startup; there are no Alembic
  migrations (see `DECISIONS.md`: "migrations will be manual").
- The robot simulation is deterministic: `DEFAULT_SIMULATION_SPEED = 60` and
  `BATTERY_DRAIN_PER_S = 1 / 60` live in `backend/simulation/config.py` (single
  source). Live state streams over `WebSocket /ws/robot`; commands are HTTP.
