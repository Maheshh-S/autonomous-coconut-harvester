# CURRENT.md

- **Project Version:** 0.2.0
- **Current Sprint:** Sprint 1 – Baseline Integration (hardening)
- **Current Feature:** End‑to‑end tree detection, ripeness analysis, task planning, and robot execution
- **Completed:**
  - Backend API routers (tree, coconut, detection, drone, robot, planner, harvest, map)
  - Next.js pages (upload, dashboard, tree detail, map, robot)
  - YOLOv8 tree + coconut‑ripeness models wired into detection endpoints
  - Task planning (per‑detection + bulk `planner/generate_tasks`) and harvest ordering
  - Robot task flow with stale‑task reclamation
  - Database schema ensured at startup via `init_db` (manual migrations)
  - **Feature 9 — Inventory Builder & Inventory Snapshot:** `InventorySnapshot`
    (`total_coconuts`/`mature_count`/`potential_count`/`premature_count`,
    `inspection_id` nullable for harvest‑origin snapshots); `Tree.current_inventory_id`
    pointer; ripeness → snapshot counts.
  - **Feature 10 — Harvest Planner & Mission Builder:** `HarvestMission` /
    `HarvestMissionItem` (immutable `visit_order` route, nearest‑neighbour ordering);
    `POST /harvest/missions` plans from latest inventory; `GET` endpoints for missions,
    a mission, and its ordered items.
  - **Feature 11 — Robot Mission Execution:** start/pause/resume/cancel/advance
    endpoints + `GET …/status` (coarse `robot_state`); advances the mission/queue
    state machine, writes a new post‑harvest `InventorySnapshot` per completed tree
    (decrementing only the harvested category), repoints `Tree.current_inventory_id`,
    and auto‑completes the mission when the queue is exhausted. Frontend survey page
    drives the flow with live queue progress and zero console errors (verified E2E).
  - **Feature 12 — Final Dashboard & System Overview:** read‑only V1 dashboard at
    `/dashboard`. New `GET /dashboard/overview` aggregation endpoint (overview counts,
    farm summary from each tree's current inventory, survey latest/active/last‑scan,
    current harvest mission, harvested count, newest‑first recent‑activity timeline,
    and chart data) — no business logic, no mutations. Frontend page reuses
    `/dashboard/overview`, `/harvest/missions/{id}/status` (robot state) and
    `/plantation/map`; polls every 5 s. `/plantation/map` now also returns `tree_code`
    (additive) and its per‑tree N+1 count queries were collapsed into two grouped
    aggregates (302 trees: ~170 s → ~3 s). Map popups and dashboard show `tree_code`.
    *(Features 9–12 are implemented and verified; awaiting commit approval — do NOT
    commit per‑feature yet.)*
- **Version 2 (FROZEN v2.0 — architecture only, no code yet):**
  - **Digital Twin Farm Viewer** amendment frozen in `PROJECT_SPECIFICATION.md §V2`.
    A seam-de-emphasised tile mosaic (tiles by grid row/col; YOLO bounding boxes as the
    interactive layer) **replaces** the V1 Leaflet/OSM `/map` — single viewer, no parallel
    maps. GPS demoted to backend metadata; new "farm-pixel" coordinate system.
  - **Central finding it addresses:** the pipeline currently *discards* the data V2 needs —
    `SurveyTile.grid_row/col` exist but are never written (a throwaway `ceil(sqrt(n))` grid
    is used for GPS only), and `Tree` has no tile/pixel/bbox link.
  - **Locked decisions (§V2.12):** (1) seam-de-emphasised mosaic, no orthomosaic/stitching;
    (2) mission-scoped `TreeObservation` model + `Tree.current_observation_id` (not flat on
    `Tree`); (3) representative = highest confidence → closest to tile centre → newest
    mission; (4) persist `SurveyTile.grid_row/col/image_width/image_height` during survey
    processing; (5) twin replaces `/map`.
  - Implementation is now authorised by the freeze but **not started**; no V2 code written.
- **Next:**
  - Implement V2 (`TreeObservation` model + migration, persist tile grid/geometry, bulk
    viewer endpoint, replace `/map` with the twin) — when approved.
  - Commit Features 9–12 (pending approval).
  - Add backend unit tests for task‑generation/ripeness logic
  - Real geotagging of drone images (currently GPS is derived from the box position)
  - Model versioning / distribution strategy (weights are gitignored)
- **Known Issues / Decisions:**
  - Database is **PostgreSQL (Neon)**, not SQLite (documentation previously said SQLite).
  - `requirements.txt` is a placeholder and incomplete.
  - Model weights (`*.pt`) and `.env` are gitignored; they are local‑only.
  - Navigation is rendered inline in `layout.tsx` (the old `Navbar.tsx` component was removed).
    The "Dashboard" nav link now points to `/dashboard`; a "Trees" link exposes the old
    `/trees` page.
