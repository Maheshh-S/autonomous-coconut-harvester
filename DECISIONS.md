# DECISIONS.md

*Append‑only record of high‑level architectural choices.*

- **Backend framework**: FastAPI was selected for its async support and easy integration with Python ML code.
- **Frontend framework**: Next.js (React) provides server‑side rendering, routing, and a familiar UI stack.
- **Data storage**: PostgreSQL (Neon) via SQLAlchemy, accessed through `DATABASE_URL` in `.env`; there is no migration framework, so schema is evolved manually and ensured at startup by `backend/database/init_db.py` (idempotent `create_all` + `ALTER … IF NOT EXISTS`).
- **ML inference**: YOLO models stored under `models/` are used for tree and coconut detection.
- **Simulation**: A software robot simulator (`simulation/robot_simulator.py`) is used instead of physical hardware for early development and testing.
- **API design**: Separate routers for each domain (tree, coconut, robot, planning) to keep responsibilities isolated.
- **Infrastructure**: The `.engineering/` directory houses specs, templates, and workflows that guide AI agents and contributors.

- **Digital Twin Farm Viewer (Version 2, FROZEN v2.0)**: The plantation visualisation moves from the V1 Leaflet/OSM marker map to a purpose-built tile-mosaic canvas where survey tiles are arranged by grid row/column and the YOLO bounding boxes are the interactive layer. GPS is demoted to backend metadata; a "farm-pixel" coordinate system becomes the primary spatial truth. Recorded as amendment v2.0 in `PROJECT_SPECIFICATION.md §V2`. Locked decisions: (1) "invisible boundaries" replaced by a seam-de-emphasised continuous farm mosaic — **no orthomosaic, no stitching** (§337 stays); (2) tile/pixel/bbox metadata lives in a new mission-scoped historical **`TreeObservation`** model with a `Tree.current_observation_id` pointer (mirroring `InventorySnapshot`), never flat on `Tree`; (3) representative observation = highest confidence → closest to tile centre → newest mission; (4) `SurveyTile.grid_row/grid_col/image_width/image_height` are persisted during survey processing, not recomputed; (5) the twin **replaces** `/map` — a single viewer, no parallel Leaflet map, unless a concrete technical constraint (to be recorded here) forces coexistence. Freeze authorises implementation; no code written yet.

- **Decision 6 — Rendering foundation stays React/DOM (Version 2.8.2 architecture review)**: The project will retain the current custom **React + DOM/CSS-transform** Digital Twin renderer (`FarmViewer` → `FarmMosaic` → `OverlayLayer`) as the rendering foundation. Rendering technology will **not** be changed during Version 2. After the Version 3 Robot Layer is implemented, rendering performance will be evaluated against the full roadmap (robot animation, path visualization, mission playback, heatmaps, multiple robots). A hybrid **Canvas/Konva** layer may be introduced **only if measured performance demonstrates that the DOM renderer has become the bottleneck** — a full engine        replacement (PixiJS/WebGL) is not justified at current scale (302 trees, 60 FPS, 0 console errors, validated culling/LOD). This preserves the V2.8.1 finding that the renderer is fundamentally correct and the spec's §V2.8 escalation clause (Canvas/WebGL only if box counts exceed a DOM threshold). The future Robot/Path/Animation/Heatmap layers are to be added as **additive** components sharing the existing `computeMosaicLayout` farm-pixel coordinate system, not as a rewrite.
  - **Decision 6b — Flight Planner owns mission geometry (Version 2.8.3)**: Survey
    tile spatial placement and **mission geometry** are produced by a **simulated
    Flight Planner** (`backend/api/flight_planner.py`), not by the frontend and not
    from the image count. The planner owns `rows`, `cols`, `origin`, `traversal_pattern`,
    `row_spacing`, `column_spacing` via an explicit, frozen `PlannerConfig`
    (`DEFAULT_PLANNER_CONFIG` = 5×2, TOP_LEFT, BOUSTROPHEDON, standard spacing —
    deterministic, configured for the demo dataset); it emits `rows*cols` **waypoints**
    and slots the uploaded images into the planned capture positions (by
    `upload_order`). **No `sqrt`, no divisor search, no nearest-rectangle heuristic
    remains** (the V2.8.2 `_choose_grid_shape` was deleted in V2.8.3). If fewer images
    than planned exist, only the available positions are populated; if more, the
    planner raises a validation error (surfaced as HTTP 422) — extra rows/cols are
    never invented. Centre GPS per position uses `gps_projection.project_tile_center_gps`
    (additively extended with `row_spacing_deg`/`col_spacing_deg`, default `SPACING_DEG`,
    §10 single source preserved). `survey_api.generate_tiles_for_mission` persists the
    planner output onto each `SurveyTile`; the frontend consumes the persisted
    `grid_row/col` and fits only the **occupied bounding box**
    (`mosaicLayout.computeMosaicLayout`), so the viewer never synthesises a layout.
  This is the Version 2.8.1 root-cause fix #1 (ragged last row → black voids /
  non-rectangular mosaic), hardened in V2.8.3 so the simulator behaves like a real
  autonomous survey mission. The Flight Planner is "simulated" because the
  drone/camera hardware is not yet integrated; the geometry contract is the
  deliverable, and a real autopilot path slots in behind the same
  `SimulationFlightPlanner` / `PlannerConfig` interface.

- **Decision 7 — Version 3 Robot Simulation architecture (FROZEN)**: Version 3
  introduces **one simulated, time-driven harvesting robot** that executes a
  `HarvestMission` on the (frozen) Digital Twin. **Backend owns all robot behaviour**
  (lifecycle, navigation, state machine, mission execution, battery, telemetry,
  events); the frontend only visualizes backend state. Frozen §5 exclusions hold: no
  ROS, no SLAM, no multi-robot, no live drone telemetry, no physical autonomous
  navigation, no hardware control, no auth. Key architectural commitments:
  (1) **single coordinate system** — the robot moves in the *same farm-pixel space*
  as `computeMosaicLayout` / `TreeObservation` (no GPS localiser); (2) **no duplicate
  queue** — `RobotTask` / `RobotMission` are adapters over the existing immutable
  `HarvestMissionItem` / `HarvestMission` (§42/§43), not new tables; (3) **navigation
  split** — route planning (Harvest Planner NN, §41) ≠ movement planning (pure
  `RobotNavigator`) ≠ execution (`RobotSimulationEngine`, a pure `step(dt)` driven by a
  `SimulationClock` with `sim = wall × speed_factor`); (4) **event-driven telemetry** —
  live state/position/battery stream over **WebSocket `/ws/robot`**, commands stay
  HTTP, persisted `RobotEvent` (append-only) + `RobotTelemetry` (time-series) enable
  playback; (5) **renderer freeze (Decision 6)** — the robot is an additive
  `RobotLayer` sharing the `FarmViewer` transformed stage, never rewriting
  `FarmMosaic`/`OverlayLayer`/`TreeDetailsDrawer`; (6) **real-robot swap** — the
  contract boundary is the WebSocket telemetry frame + HTTP command set, so a real
  robot replaces only `RobotSimulationEngine`. Full spec: `PROJECT_SPECIFICATION.md`
  Appendix A (PROPOSED) and companion **`ROBOT_ARCHITECTURE.md`**. No production code
  has been written; Version 2 architecture is untouched. **Frozen as the approved V3.0
  baseline; implementation proceeds at V3.1.**

- **Decision 8 — Version 2.9 stabilization (completed, PROPOSED-ready)**: before
  Version 3, a stabilization pass removed only **provably unused** code — the unused
  `project_tile_center_gps` import and dead `base_lat`/`base_lon` locals in
  `survey_api.generate_tiles_for_mission`, and the unused `SurveyMissionStatus` import
  in `dashboard_api` (verified with `pyflakes`, 0 issues). The legacy V1 `Task`-based
  subsystem (`robot_api.py`, `database/tasks.py`, `map_api`/`tree_api` `Task` usage,
  `Task` model) was **retained** — it is live (mounted in `main.py`) and the spec keeps
  V1 endpoints intentionally, so removal would change behaviour. Empty Version 3
  package directories were created (`backend/{simulation,navigation,telemetry,
  websocket}`, `frontend/components/{digitalTwin,dashboard,robot}`, `frontend/robot`)
  with no implementation; `ROBOT_ARCHITECTURE.md` was added. No business logic or
  user-visible behaviour changed; Version 2 architecture stays frozen.

*Add new decisions here as they are made; never delete existing entries.*

Future Architecture Note

PlannerConfig currently uses a single DEFAULT_PLANNER_CONFIG.

Before integrating a real drone flight planner, PlannerConfig should become mission-scoped and stored on SurveyMission so that each mission carries its own planning configuration.

This refinement is intentionally deferred because it does not affect the current simulator.

