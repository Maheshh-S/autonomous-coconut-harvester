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

*Add new decisions here as they are made; never delete existing entries.*
