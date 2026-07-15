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
  - **Version 2 (FROZEN v2.0 — architecture locked; data foundation implemented):**
  - **Digital Twin Farm Viewer** amendment frozen in `PROJECT_SPECIFICATION.md §V2`.
    A seam-de-emphasised tile mosaic (tiles by grid row/col; YOLO bounding boxes as the
    interactive layer) **replaces** the V1 Leaflet/OSM `/map` — single viewer, no parallel
    maps. GPS demoted to backend metadata; new "farm-pixel" coordinate system.
  - **Central finding it addresses:** the pipeline previously *discarded* the data V2 needs —
    `SurveyTile.grid_row/col` existed but were never written (a throwaway `ceil(sqrt(n))` grid
    was used for GPS only), and `Tree` had no tile/pixel/bbox link.
  - **Locked decisions (§V2.12):** (1) seam-de-emphasised mosaic, no orthomosaic/stitching;
    (2) mission-scoped `TreeObservation` model + `Tree.current_observation_id` (not flat on
    `Tree`); (3) representative = highest confidence → closest to tile centre → newest
    mission; (4) persist `SurveyTile.grid_row/col/image_width/image_height` during survey
    processing; (5) twin replaces `/map`.
  - **VERSION 2.1 — Data Foundation (completed; awaiting commit approval):**
    Scope = the V2 data model + persisted `SurveyTile` metadata. No viewer/UI yet.
    - New `tree_observations` table (`TreeObservation`): mission-scoped historical rows
      (`tree_id` RESTRICT FK, `survey_tile_id`, `local_pixel_{x,y}`, `bbox_*`, `confidence`,
      `gps_lat/lon`, `created_at`). `Tree` gained only `current_observation_id` (pointer to
      the §V2.7 representative observation); `Tree` itself stays immutable.
    - `SurveyTile` gained `capture_order`, `grid_row/col`, `center_gps_lat/lon`,
      `image_width/height`, all persisted during survey processing
      (`generate_tiles_for_mission` / `process_tile` / new `project_tile_center_gps`).
    - `match_trees_for_mission` rewritten: deletes only this mission's observations
      (preserves history), writes `TreeObservation`s, and repoints `current_observation_id`
      via `_recompute_representative_observations` using the frozen §V2.7 ordering.
    - **Bulk-write optimization (applied):** the write path is now a handful of batched
      statements instead of per-row ORM round-trips — one `flush` for new Trees (executemany),
      one raw `executemany` UPDATE for existing-Tree metadata refreshes, one
      `bulk_insert_mappings` for observations. The match set uses plain dicts (not live ORM
      objects) and `no_autoflush` guards the writes, eliminating per-tree UPDATE round-trips.
      *Note:* absolute runtime on the remote Neon DB is dominated by round-trip latency
      (a 302-row batched UPDATE is ~80 s on this serverless Postgres), not algorithmic cost;
      the structural win is removing O(rows) ORM round-trips. Verified correct: 302
      observations, 0 representative mismatches vs §V2.7, all tree codes valid.
    - *(VERSION 2.1 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)*
  - **Performance TODO (V2.1 write path, not a blocker):** the bulk-write path is now
    structurally correct (O(1) batched statements, no per-row ORM round-trips), but we
    have **not yet proven** the remaining ~80 s / 302-row runtime on the remote Neon DB is
    purely round-trip latency. A hidden per-row cost may still exist (e.g. driver-level
    executemany behaviour, FK/index maintenance, or an overlooked autoflush). **Action:**
    profile a clean run later with SQLAlchemy `echo=True` query logging and/or PostgreSQL
    `EXPLAIN ANALYZE` on the batched `UPDATE`/`INSERT` to confirm whether any per-row work
    remains. Do this before claiming the optimization is fully realised.
- **Next:**
  - Implement the V2 Digital Twin Viewer (bulk tile/viewer endpoint, replace `/map` with the
    twin) — out of scope for 2.1, authorised by the freeze.
  - Commit Features 9–12 and VERSION 2.1 (pending approval).
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
