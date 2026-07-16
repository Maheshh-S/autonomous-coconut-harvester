# Autonomous Coconut Harvester

A Digital Twin platform for autonomous coconut harvesting. The system turns drone
surveys into a live, interactive model of a plantation and drives a (simulated)
robot to harvest it.

## Pipeline

```
Drone Survey
   ↓  (folder upload, tile grid, YOLO tree detection)
Tree Detection + Permanent Tree Generation
   ↓  (GPS/geometry matching → stable Tree records)
Farm Digital Twin
   ↓  (tile mosaic + YOLO bounding-box overlay)
Ripeness Inspection
   ↓  (close-up images → YOLO ripeness → Inventory Snapshot)
Inventory
   ↓  (per-tree mature / potential / premature counts)
Harvest Mission
   ↓  (Nearest-Neighbour planned route from latest inventory)
Robot Simulation
   ↓  (time-driven sim executes the mission, writes post-harvest inventory)
Mission History & Analytics
   ↓  (backend-owned run summaries over completed runs)
Dashboard / Digital Twin (read-only supervision)
```

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 4, in `frontend/`.
- **Backend:** FastAPI + SQLAlchemy, in `backend/` (launched with `uvicorn`).
- **Database:** PostgreSQL (Neon) via `DATABASE_URL` in `.env`. No migration
  framework; schema is evolved manually and ensured at startup (see below).
- **ML:** Ultralytics YOLOv8 models in `models/` (`tree_detector.pt`,
  `coconut_detector.pt`). Both files are **gitignored** — they are local only.

## Architecture Overview

The backend owns all business logic (detection, tree matching, inventory,
planning, robot state machine, simulation, analytics). The frontend is
presentation-only: it renders data from the backend API and emits intents; it
never computes business results.

Three layers cooperate:

- **Frontend UI** (Next.js) — pages, components, and a single typed API client
  (`frontend/lib/api/detection.ts`).
- **Backend service** (FastAPI) — routers in `backend/api/`, domain logic in
  `backend/{harvest,navigation,robot,simulation,telemetry,analytics}`, and
  SQLAlchemy models/session in `backend/database/`.
- **Machine-learning models** — YOLOv8 tree and coconut-ripeness detection.

### Survey → Twin → Inspection → Inventory → Harvest → Robot → Analytics

| Stage                       | Backend                                                                                                                                     | Frontend                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Survey                      | `api/survey_api.py` — `POST /mission/create`, image upload, tile generation, tree matching (`match_trees_for_mission`), permanent-tree list | `app/survey/page.tsx` (`DroneUploader`), `app/map/page.tsx` (twin) |
| Digital Twin                | `GET /mission/{id}/tiles`, `GET /mission/{id}/trees` (representative `TreeObservation` bounding boxes)                                      | `FarmMosaic`, `OverlayLayer`, `FarmViewer`, `TreeDetailsDrawer`    |
| Inspection                  | `api/inspection_api.py` — `POST /inspection/...`, ripeness model, `InventorySnapshot` builder                                               | `CoconutUploader`, Tree Details drawer                             |
| Harvest Planning            | `api/harvest_mission_api.py` — `POST /harvest/missions` (Nearest-Neighbour route from latest inventory)                                     | survey page harvest-mission selector                               |
| Robot Simulation            | `api/robot_simulation.py` + `simulation/scheduler.py` (pure `SimulationEngine.step(dt)` + `SimulationClock`)                                | `app/robot/page.tsx`, `RobotLayer` on `/map`                       |
| Telemetry                   | `telemetry/` — `EventBus`, `TelemetryService`, `WebSocketGateway` (`/ws/robot`)                                                             | `useRobotSimulation` hook + `RobotWebSocketClient`                 |
| Mission History & Analytics | `analytics/mission_history.py` + `api/robot_history.py`                                                                                     | `app/robot/history`, `app/robot/history/[id]`                      |
| Dashboard                   | `api/dashboard_api.py` — `GET /dashboard/overview`                                                                                          | `app/dashboard/page.tsx`, `DashboardFarmCard`                      |

## Backend

- FastAPI routers in `backend/api/` (survey, inspection, harvest mission, robot
  domain/navigation/simulation/telemetry/history, tree, dashboard, coconut,
  drone, map, detection, planner).
- SQLAlchemy session/engine in `backend/database/db.py`; models in
  `backend/database/models.py`. Schema is ensured at startup by
  `backend/database/init_db.py` (manual migrations, idempotent `ALTER … IF NOT
EXISTS`).
- Business logic lives in focused modules:
  - `harvest/execution.py` — single source of truth for harvest-mission execution
    (complete item, advance, finalize) shared by the manual advance endpoint and
    the simulation run loop.
  - `navigation/` — pure, deterministic robot movement planning
    (`RobotNavigator`, `NavigationService`); reads `HarvestMission` /
    `TreeObservation` / `SurveyTile` / `Robot` + `DockStation`.
  - `robot/state_machine.py` — `RobotStateMachine` enforces the frozen
    `LEGAL_TRANSITIONS`; the only component permitted to mutate `robot.status`.
  - `simulation/` — `SimulationClock` (deterministic sim-time), `SimulationEngine`
    (pure `step(dt)`), `Scheduler` (the only wall-clock/thread driver).
  - `telemetry/` — `EventBus` pub/sub, `TelemetryService` (append-only
    `RobotTelemetry` / `RobotEvent` writers), `WebSocketGateway` (observe-only
    `/ws/robot` broadcast).
  - `analytics/mission_history.py` — backend-owned Mission History & Analytics.
- The **Flight Planner** (`api/flight_planner.py`) is the source of truth for
  survey-mission geometry: an explicit `PlannerConfig` (`rows`, `cols`, `origin`,
  `traversal_pattern`, `row_spacing`, `column_spacing`) owns the tile grid — never
  derived from the image count.

## Frontend

- React/Next.js (App Router) in `frontend/`. Pages: `/` (Drone Uploader),
  `/dashboard`, `/survey`, `/map` (Digital Twin), `/robot`, `/robot/history`,
  `/robot/history/[id]`, `/trees`, `/trees/[treeId]`.
- Talks to the backend through the single typed wrapper
  `frontend/lib/api/detection.ts`.
- Digital Twin components: `FarmMosaic` (tile canvas), `OverlayLayer` (tree boxes,
  presentation-only), `FarmViewer` (zoom/pan/fit viewport + selection state),
  `TreeDetailsDrawer` (read-only details). `RobotLayer` mounts inside the same
  transformed stage and shares the one zoom/pan/fit transform.
- Navigation is rendered inline in `frontend/app/layout.tsx`.

## Database

PostgreSQL (Neon) via `DATABASE_URL`. Key tables: `SurveyMission`, `SurveyImage`,
`SurveyTile`, `Tree`, `TreeObservation` (mission-scoped representative
observation; `Tree.current_observation_id` pointer), `Inspection`,
`InspectionImage`, `InventorySnapshot` (`Tree.current_inventory_id` pointer),
`HarvestMission` / `HarvestMissionItem` (immutable `visit_order` route), `Robot`,
`DockStation`, `RobotBattery`, `RobotConfiguration`, `RobotStateTransition`,
`RobotTelemetry`, `RobotEvent`, `RobotRun`.

Legacy V1 `Task` / `Detection` tables are retained (the spec keeps the V1
endpoints mounted) but the V3 workflow runs on the immutable `HarvestMission` /
`HarvestMissionItem` / `InventorySnapshot` model.

## Robot Simulation

One simulated, time-driven harvesting robot executes a `HarvestMission` on the
Digital Twin. The backend owns all robot behaviour; the frontend only visualizes
backend state.

- **State machine** (`robot/state_machine.py`): 8-state `RobotState`
  (IDLE / MOVING / CLIMBING / SCANNING / HARVESTING / RETURNING / ERROR / DOCKED)
  - frozen `LEGAL_TRANSITIONS`.
- **Navigation** (`navigation/`): route planning = Harvest Planner Nearest-
  Neighbour (unchanged); movement planning = pure `RobotNavigator` (farm-pixel
  trajectory); execution = `SimulationEngine.step(dt)` + `SimulationClock`
  (sim = wall × speed_factor) + `Scheduler`.
- **Telemetry**: commands over HTTP; live state/position/battery over WebSocket
  `/ws/robot` (event-driven, no polling for live state); append-only
  `RobotTelemetry` + `RobotEvent` persisted for Mission History & Analytics.
- **Determinism**: the engine is a pure function of its inputs — identical
  mission + clock + planner config always yields the same event/telemetry/
  transition/harvest sequence.
- **Speed & battery**: `DEFAULT_SIMULATION_SPEED = 60` (sim-s per real-s) and
  `BATTERY_DRAIN_PER_S = 1 / DEFAULT_SIMULATION_SPEED` live in
  `simulation/config.py` (single source); at the default speed the robot loses
  ~1% battery per real second. Exposed via `GET /robot/simulation/config`.

## Digital Twin

The primary interface is a tile mosaic of the surveyed plantation (tiles laid out
by persisted `grid_row` / `grid_col`) with a YOLO-bounding-box overlay of
permanent trees, zoom/pan/fit, tree selection, and a read-only Tree Details
drawer. The robot marker, planned path, and current-target highlight render on
the same farm-pixel plane (`computeMosaicLayout` is the single source of the
transform, shared by frontend and backend navigation). `/map` is visualization-
only; `/robot` is the control centre; `/dashboard` is status-only.

## Analytics

Mission History & Analytics (`analytics/mission_history.py`) is a backend-owned
Operations Center over completed simulation runs. Each terminated run writes one
`RobotRun` row (distance, battery used, recharge count, deterministic
`mission_score`, etc.). Metrics are computed server-side from append-only
`RobotTelemetry` + `RobotEvent` + immutable mission/tree/inspection data; the
frontend renders only.

## Project Structure

```
backend/
  api/            FastAPI routers (survey, inspection, harvest_mission, robot_*,
                  tree, dashboard, coconut, drone, map, detection, planner)
  database/       SQLAlchemy models, engine/session, init_db (manual migrations)
  harvest/        execution.py — shared harvest-mission execution service
  navigation/     mosaic_layout, service (RobotNavigator, NavigationService)
  robot/          state_machine.py — RobotStateMachine (frozen transitions)
  simulation/     clock, context, engine (pure step(dt)), scheduler, config
  telemetry/      event_bus, service, websocket_gateway
  analytics/      mission_history.py — Mission History & Analytics
  main.py         app assembly, CORS, router mounting, init_db() at startup
frontend/
  app/            pages (/, /dashboard, /survey, /map, /robot, /robot/history,
                  /trees, /trees/[treeId])
  components/      FarmMosaic, OverlayLayer, FarmViewer, TreeDetailsDrawer,
                  DashboardFarmCard, DroneUploader, CoconutUploader, robot/
  lib/            api/detection.ts (single API client), mosaicLayout.ts,
                  useRobotSimulation.ts
models/           YOLOv8 weights (gitignored): tree_model/, coconut_model/
```

> The legacy `mapping/`, `perception/`, and `simulation/robot_simulator.py` V1
> scripts are retained for reference but are **not** part of the current pipeline
> (the Flight Planner and the V3 simulation engine supersede them).

## Setup

1. **Backend**

   ```bash
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env              # then set your DATABASE_URL
   uvicorn backend.main:app --reload # or: cd backend && uvicorn main:app --reload
   ```

   > The backend reads configuration from `.env` (via `python-dotenv`):
   > `DATABASE_URL` (required PostgreSQL/Neon connection string), and optionally
   > `CORS_ORIGINS` (comma-separated allowed origins; defaults to the local dev
   > frontend). The schema is created/migrated automatically at startup
   > (`backend/database/init_db.py`). `uvicorn[standard]` provides the WebSocket
   > support required by the `/ws/robot` endpoint.

2. **Frontend**
   ```bash
   cd frontend && npm install && npm run dev   # http://localhost:3000
   ```

> Model weights (`models/**/*.pt`) and `.env` are gitignored and must be present
> locally for detection endpoints to work.

## Run

- Backend: `uvicorn backend.main:app --reload` (port 8000). A `sys.path` bootstrap
  in `backend/main.py` makes `from api…` / `from database…` resolve whether you
  launch from the repo root or from `backend/`.
- Frontend: `cd frontend && npm run dev` (port 3000).
- Open http://localhost:3000.

## Verification

- **Backend:** `venv/bin/python -m py_compile` on changed modules; import the app;
  exercise endpoints against the running server.
- **Frontend:** `npx tsc --noEmit` must pass with zero errors; `npx next build`
  must succeed.
- **Playwright:** `frontend/verify_v26.js` (Digital Twin regression) and
  `frontend/verify_v361.js` (robot visualization) must pass with **0 console
  errors**.

See `AGENTS.md` for the full engineering guide, `ARCHITECTURE.md` for the
component/dependency map, `CURRENT.md` for version history, and
`PROJECT_SPECIFICATION.md` for the frozen specification.
