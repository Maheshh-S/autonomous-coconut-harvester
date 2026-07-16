# ARCHITECTURE.md

## System Overview

The system turns drone surveys into a live, interactive **Digital Twin** of a
plantation and drives a (simulated) robot to harvest it. Three layers cooperate:

- a **frontend UI** (Next.js) — presentation only;
- a **backend service** (FastAPI) — owns all business logic;
- **machine-learning models** — YOLOv8 tree and coconut-ripeness detection.

State is persisted in **PostgreSQL** (Neon) via `DATABASE_URL`. The backend is the
single source of truth; the frontend never computes business results.

## Frontend

- React/Next.js (App Router) application in `frontend/`. Pages: `/` (Drone
  Uploader), `/dashboard`, `/survey`, `/map` (Digital Twin), `/robot`,
  `/robot/history`, `/robot/history/[id]`, `/trees`, `/trees/[treeId]`.
- Talks to the backend through the single typed wrapper
  `frontend/lib/api/detection.ts`.
- Navigation is rendered inline in `frontend/app/layout.tsx`.
- Digital Twin components: `FarmMosaic` (tile canvas), `OverlayLayer` (tree boxes,
  presentation-only), `FarmViewer` (zoom/pan/fit viewport + selection state),
  `TreeDetailsDrawer` (read-only details). `RobotLayer` mounts **inside** the same
  transformed stage and shares the one farm-pixel transform.

## Backend

- FastAPI routers in `backend/api/` (`survey_api`, `inspection_api`,
  `harvest_mission_api`, `robot_domain`, `robot_navigation`, `robot_simulation`,
  `robot_telemetry`, `robot_history`, `tree_api`, `dashboard_api`, `coconut_api`,
  `drone_api`, `map_api`, `detection_api`, `planner_api`, `harvest_planner`).
- SQLAlchemy session/engine in `backend/database/db.py`; models in
  `backend/database/models.py` (`Tree`, `TreeObservation`, `Inspection`,
  `InventorySnapshot`, `HarvestMission`, `HarvestMissionItem`, `Robot`,
  `DockStation`, `RobotBattery`, `RobotConfiguration`, `RobotStateTransition`,
  `RobotTelemetry`, `RobotEvent`, `RobotRun`, and the legacy V1 `Task` / `Detection`).
- Business logic lives in focused modules, not in the routers:
  - `harvest/execution.py` — single source of truth for harvest-mission execution
    (`complete_item`, `advance_mission`, `finalize_mission`), shared by the manual
    advance endpoint and the simulation run loop.
  - `navigation/` — pure, deterministic robot movement planning (`RobotNavigator`,
    `NavigationService`); reads `HarvestMission` / `TreeObservation` / `SurveyTile` /
    `Robot` + `DockStation`.
  - `robot/state_machine.py` — `RobotStateMachine` enforces the frozen
    `LEGAL_TRANSITIONS`; the **only** component permitted to mutate `robot.status`.
  - `simulation/` — `SimulationClock` (deterministic sim-time = wall × speed_factor),
    `SimulationEngine` (pure `step(dt)`), `Scheduler` (the only wall-clock/thread
    driver), `config` (`DEFAULT_SIMULATION_SPEED`, `BATTERY_DRAIN_PER_S`).
  - `telemetry/` — `EventBus` (pub/sub), `TelemetryService` (append-only
    `RobotTelemetry` / `RobotEvent` writers, read-side only), `WebSocketGateway`
    (observe-only `/ws/robot` broadcast).
  - `analytics/mission_history.py` — backend-owned Mission History & Analytics.
- Schema is ensured at startup by `backend/database/init_db.py` (manual migrations,
  idempotent `ALTER … IF NOT EXISTS`).

## ML Models

- YOLOv8 model files under `models/` (`tree_model/tree_detector.pt`,
  `coconut_model/coconut_detector.pt`) perform tree and coconut-ripeness detection.
  Both are gitignored.

## Mapping / Planning

- `backend/api/flight_planner.py` is the **Flight Planner** and the **source of
  truth for survey-mission geometry**. An explicit `PlannerConfig` (`rows`, `cols`,
  `origin`, `traversal_pattern`, `row_spacing`, `column_spacing`) owns the tile
  grid — never derived from the image count (no `sqrt` / divisor / nearest-rectangle
  heuristic). It emits `rows*cols` waypoints in boustrophedon (lawnmower) order and
  slots uploaded images into those positions by `upload_order`; fewer images populate
  only available positions, more images raise a validation error (HTTP 422). Centre
  GPS per position comes from `api/gps_projection.py`. `survey_api.
  generate_tiles_for_mission` persists the planner output onto each `SurveyTile` so
  the frontend never infers positions.
- `backend/api/harvest_mission_api.py` (with `harvest_planner.py`) builds the
  ordered `HarvestMission` from the latest inventory using the frozen Nearest-
  Neighbour route.

## Simulation

- The robot simulation is driven by `backend/simulation/` (see above). It is a pure,
  deterministic executor: identical mission + clock + planner config always yields
  the same event / telemetry / transition / harvest sequence. Live state and
  position stream to clients over `WebSocket /ws/robot` (event-driven); commands are
  HTTP (`/harvest/missions/{id}/start`, `/robot/simulation/*`).

## Data Flow

1. Drone folder uploaded via UI → `survey_api` creates a `SurveyMission`, extracts
   images into `SurveyTile`s, runs YOLO tree detection, and matches detections into
   permanent `Tree` records via `match_trees_for_mission`.
2. The Digital Twin renders the surveyed tiles (`GET /mission/{id}/tiles`) plus the
   representative `TreeObservation` bounding boxes (`GET /mission/{id}/trees`).
3. A close-up inspection (`inspection_api`) runs the coconut-ripeness model and writes
   an immutable `InventorySnapshot`; `Tree.current_inventory_id` points at the latest.
4. `harvest_mission_api` plans a `HarvestMission` (Nearest-Neighbour `visit_order`)
   from the latest inventory.
5. `POST /harvest/missions/{id}/start` flips the mission to RUNNING and auto-starts
   the robot simulation (`scheduler.start`). The run loop executes the mission via the
   shared `harvest/execution.py` service, writing post-harvest `InventorySnapshot`s as
   the robot harvests, and finalizes on dock return.
6. Each terminated run writes one `RobotRun` (`analytics/mission_history.py`) for the
   Mission History & Analytics Operations Center.

## Version 2 (FROZEN v2.0 — implemented)

The **Digital Twin Farm Viewer** is frozen: survey tiles arranged into one continuous
seam-de-emphasised mosaic by `grid_row`/`grid_col` (no orthomosaic, no stitching),
with YOLO bounding boxes as the interactive layer. It is the **single farm viewer**;
the legacy V1 Leaflet/OSM `/map` was removed in V2.7. GPS is backend-only metadata;
per-tree tile/pixel/bbox is persisted in a mission-scoped `TreeObservation` model
(`Tree.current_observation_id` pointer). See `PROJECT_SPECIFICATION.md §V2`.

## Major Modules

- **frontend/** – pages, components, API wrapper, farm-pixel transform.
- **backend/** – FastAPI routers, DB session/models, domain logic
  (`harvest/`, `navigation/`, `robot/`, `simulation/`, `telemetry/`, `analytics/`).
- **models/** – YOLO model files (gitignored).

## Version 3 — Robot Simulation (FROZEN baseline, architecture only at V3.0; implemented V3.1–V3.7.3)

- One **simulated, time-driven harvesting robot** executes a `HarvestMission` on the
  Digital Twin. **Backend owns all robot behaviour**; the frontend only visualizes
  backend state.
- **Domain:** `Robot`, `DockStation`, `RobotBattery`, `RobotConfiguration`; adapters
  `RobotTask` / `RobotMission` over the immutable `HarvestMissionItem` /
  `HarvestMission` (no duplicate queue). Robot position is in the **same farm-pixel
  space** as `computeMosaicLayout` / `TreeObservation` (single coordinate system, no
  SLAM).
- **State machine:** the 8-state `RobotState` (IDLE / MOVING / CLIMBING / SCANNING /
  HARVESTING / RETURNING / ERROR / DOCKED) from `robot/state_machine.py`, with frozen
  `LEGAL_TRANSITIONS`. Transitions driven only by the backend `RobotStateMachine`.
- **Navigation split:** (1) route planning = Harvest Planner Nearest-Neighbour
  (unchanged); (2) movement planning = pure `RobotNavigator` (farm-pixel trajectory,
  no mutation); (3) execution = `SimulationEngine` (`step(dt)`) + `SimulationClock`
  (sim = wall × speed_factor) + `Scheduler` (thread driver).
- **Telemetry:** commands over HTTP; live state/position/battery over `WebSocket
  /ws/robot` (event-driven, no polling for live state); `RobotEvent` (append-only) +
  `RobotTelemetry` (time-series) persisted for Mission History & Analytics.
- **Visualization:** additive `RobotLayer` (marker + path + battery ring) mounts
  **inside** `FarmViewer`'s transformed stage; `RobotStatusCard` +
  `SimulationControls`; `useRobotSimulation` hook + observe-only
  `RobotWebSocketClient` (single WS connection). Wired into `/map`, `/robot`, and the
  dashboard.
- **Mission History & Analytics:** `analytics/mission_history.py` computes every
  metric server-side; `robot_history_api` exposes read-only run/timeline/tree-activity/
  robot-log endpoints; the `/robot/history` pages are presentation-only.
- Full specification: `PROJECT_SPECIFICATION.md` **Appendix A (FROZEN)**; companion
  design doc: **`ROBOT_ARCHITECTURE.md`**.
