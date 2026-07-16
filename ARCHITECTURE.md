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
- `backend/api/flight_planner.py` is the **simulated Flight Planner** and the
  **source of truth for survey mission geometry** (Version 2.8.3). It owns
  `rows`, `cols`, `origin`, `traversal_pattern`, `row_spacing` and `column_spacing`
  via an explicit `PlannerConfig` (NOT derived from the image count — no
  `sqrt`/divisor/nearest-rectangle heuristic). It emits `rows*cols` **waypoints**
  (capture positions) in flown (boustrophedon) order and slots the uploaded images
  into those positions by `upload_order`; fewer images populate only the available
  positions, more images raise a validation error (HTTP 422). Centre GPS per
  position comes from `gps_projection.project_tile_center_gps`. `survey_api.
  generate_tiles_for_mission` persists the planner output onto each `SurveyTile` so
  the frontend never infers positions (replaces the old `ceil(sqrt(n))` ragged-grid
  heuristic — VERSION 2.8.1 root cause #1; hardened in V2.8.3 so the planner defines
  geometry rather than inferring it from image count).
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

## Version 2 (FROZEN v2.0 — not yet implemented)
- The **Digital Twin Farm Viewer** amendment (v2.0) is frozen: survey tiles
  arranged into one continuous **seam-de-emphasised mosaic** by grid row/column
  (no orthomosaic, no stitching), with YOLO bounding boxes as the interactive
  layer. It **replaces** the V1 Leaflet/OSM `/map` (single viewer). GPS becomes
  backend-only metadata; per-tree tile/pixel/bbox is persisted in a new
  mission-scoped `TreeObservation` model (`Tree.current_observation_id` pointer),
  and `SurveyTile.grid_row/col/image_width/image_height` are persisted during
  survey processing. See `PROJECT_SPECIFICATION.md §V2`. **No code changes yet**;
  the V1 architecture above stays in force until implementation begins.

## Major Modules
- **frontend/** – pages, components, API wrapper.
- **backend/** – FastAPI routers, DB session/models, shared task logic.
- **models/** – YOLO model files (gitignored).
- **mapping/** – coverage-path planning.
- **perception/** – detection scripts.
- **simulation/** – robot simulator.

## Version 3 — Robot Simulation (FROZEN baseline, architecture only)

> No production code. Design only. Version 2 (Digital Twin) stays frozen.

- One **simulated, time-driven harvesting robot** executes a `HarvestMission` on the
  Digital Twin. **Backend owns all robot behaviour**; the frontend only visualizes
  backend state (Decision 6 + V3 Major Design Principle).
- **Domain (Appendix A.2):** new `Robot`, `DockStation`, `RobotBattery`,
  `RobotTelemetry`, `RobotEvent` tables; `RobotTask` / `RobotMission` are **adapters**
  over the existing immutable `HarvestMissionItem` / `HarvestMission` (no duplicate
  queue — §42/§43).
- **State machine (A.3):** the 7-state `RobotState` (Idle/Moving/Climbing/Scanning/
  Harvesting/Returning/Error) from §26/§45.1, plus a `DOCKED` battery sub-state.
  Transitions driven only by the backend `RobotController`.
- **Navigation split (A.5):** (1) **route planning** = Harvest Planner Nearest-
  Neighbour (§41, unchanged); (2) **movement planning** = new pure `RobotNavigator`
  (farm-pixel trajectory, no mutation); (3) **execution** = `RobotSimulationEngine`
  (pure `step(dt)`) + `SimulationClock` (sim time = wall × speed_factor) +
  `RobotTicker` driver.
   - **V3.1 + V3.2 + V3.3 implemented (not yet committed):** the Robot Domain
     (`Robot`, `DockStation`, `RobotBattery`, `RobotConfiguration`; `GET /robot`,
     `GET /robot/state`, `POST /robot/reset`, `POST /robot/recharge`,
     `POST /robot/speed`), the Navigation layer (`backend/navigation/`: faithful
     `computeMosaicLayout` port, pure `RobotNavigator`, `NavigationService`;
     `GET /robot/navigation`, `GET /robot/navigation/plan`), and the State Machine
     (`backend/robot/state_machine.py`: frozen `LEGAL_TRANSITIONS`, append-only
      `robot_state_transitions` history; `POST /robot/state`, `GET /robot/state/
      history`) are real and verified. **V3.3.1** refines the machine so every
      operational state may fault into `ERROR` (recovery unchanged: `ERROR`→
      `{RETURNING,IDLE}` only); `RobotStateMachine` remains the sole `robot.status`
      mutator. **V3.4 Robot Simulation Engine** is now real (`backend/simulation/`:
      pure `SimulationClock` + `SimulationEngine` (`step(dt)`, linear movement,
      battery drain, transitions via `RobotStateMachine`, internal events) +
      `SimulationScheduler` thread driver; `POST`/`GET /robot/simulation`). No
      WebSocket, no telemetry persistence, no frontend, no charging in V3.4. The
      engine stays pure and deterministic; `RobotStateMachine` remains the sole
      `robot.status` mutator. **V3.5 Robot Telemetry & WebSocket** is now real
      (`backend/telemetry/`: `EventBus` pub/sub decoupling; `TelemetryService`
      append-only `RobotEvent`/`RobotTelemetry` writers — read-side, no mutation;
      `WebSocketGateway` observe-only `/ws/robot` multi-client broadcast) + new
      `RobotTelemetry`/`RobotEvent` models + `GET /robot/telemetry`,
      `GET /robot/telemetry/events`; the `SimulationScheduler` publishes each tick's
      engine events onto the `EventBus`. Frontend still untouched. See `CURRENT.md`.
 - **Coordinate system:** robot position is in the **same farm-pixel space** as
   `computeMosaicLayout`/`TreeObservation` — one plane for robot + tree boxes (no SLAM,
   §5).
 - **Telemetry (A.6):** commands over **HTTP** (existing `HarvestMission` endpoints +
   new `Robot` commands); **live** state/position/battery streamed over **WebSocket
   `/ws/robot`** (event-driven, no polling for live state); `RobotEvent` (append-only)
    + `RobotTelemetry` (time-series) persisted for the Operations Center (history,
     summary, timeline, tree-activity, analytics, robot log).
   - **Frontend (A.7):** additive `RobotLayer` (marker + path + battery ring) mounts
     **inside** `FarmViewer`'s transformed stage (shares the one zoom/pan/fit transform
     with `OverlayLayer`); `RobotMarker`/`RobotPathLayer` are counter-scaled by `1/scale`;
     `RobotStatusCard` + `SimulationControls`; `useRobotSimulation` hook + observe-only
     `RobotWebSocketClient` (single WS connection, no dup frames); wired into `/map`,
     `/robot`, and the dashboard. **V3.7 adds the Mission History & Analytics page
     (`/robot/history`) — presentation-only; every metric is computed backend-side in
     `analytics/mission_history.py`** (supersedes the earlier "Playback" concept: no
     replay, read-only derived analytics over completed runs).
   - **Milestones (A.8):** V3.1 Domain → V3.2 Navigation → V3.3 State Machine → V3.4
     Robot Simulation Engine → V3.5 Telemetry & WebSocket → V3.6 Visualization
     (implemented, not committed) → V3.7 Mission History & Analytics (implemented, not
     committed) → V3.8 Production Hardening.
- Full specification: `PROJECT_SPECIFICATION.md` **Appendix A (FROZEN)**; companion
  design doc: **`ROBOT_ARCHITECTURE.md`**.
- **Version 2.9 (stabilization, completed PROPOSED-ready):** dead unused imports/vars
  removed (`survey_api` unused `project_tile_center_gps` import + dead `base_lat/base_lon`
  in `generate_tiles_for_mission`; `dashboard_api` unused `SurveyMissionStatus` import);
  legacy V1 `Task` system retained (live, spec keeps V1 endpoints); empty Version 3
  package dirs created (`backend/{simulation,navigation,telemetry,websocket}`,
  `frontend/components/{digitalTwin,dashboard,robot}`, `frontend/robot`) with no
  implementation; `ROBOT_ARCHITECTURE.md` added. No business-logic or behaviour change.
