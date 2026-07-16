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

---

# AGENTS.md

The authoritative engineering guide for contributors and AI agents working in this repository.

## 1. Mission

Build an end-to-end **Digital Twin platform for autonomous coconut harvesting** — a system that turns drone surveys into a live, interactive model of a plantation and drives a robot to harvest it.

The platform covers the full pipeline:

- **Drone Survey** — ingest geotagged survey images, tile them into a coverage grid, and run YOLO detection to find tree candidates.
- **Permanent Tree Generation** — convert raw detections into stable, deduplicated permanent `Tree` records via GPS/geometry tree matching.
- **Tree Matching** — reuse nearby existing trees (GPS proximity + bounding-box geometry) or create new ones; idempotent across re-surveys.
- **Ripeness Inspection** — close-up inspection images feed a ripeness model that produces per-coconut `mature` / `potential` / `premature` classification.
- **Inventory Snapshots** — each inspection/harvest writes an immutable `InventorySnapshot` (`total/mature/potential/premature` counts); `Tree.current_inventory_id` points at the latest.
- **Harvest Planning** — the Harvest Planner builds an immutable Harvest Mission from the latest inventory, ordered by a frozen Nearest-Neighbour route.
- **Robot Mission Execution** — start/pause/resume/cancel/advance drive the robot through the queue, writing post-harvest inventory and auto-completing when exhausted.
- **Dashboard** — a read-only system overview (counts, farm summary, survey/harvest state, recent activity, charts).
- **Digital Twin Farm Viewer** — the primary interface: a tile mosaic of the surveyed plantation with a YOLO-bounding-box overlay, zoom/pan, tree selection, and a read-only Tree Details drawer. The single farm viewer for the whole system.

The repository is the single source of truth. All behaviour lives in committed code, not in conversation.

## 2. Read Order

Before making any change, read in this order:

1. `AGENTS.md` (this file)
2. `CURRENT.md` — current status, completed versions, known issues
3. `PROJECT_SPECIFICATION.md` — frozen requirements and feature specs (§V2.x are authoritative for the twin)
4. `DECISIONS.md` — recorded architecture decisions and their rationale
5. `ARCHITECTURE.md` — component/dependency map
6. `ENGINEERING_WORKFLOW.md` — detailed workflow guidance
7. Relevant source code (`backend/`, `frontend/`)
8. `codebase-memory` knowledge graph — for repo-wide architecture/dependency queries when useful

Do not skip steps. If a listed doc does not yet exist, note it and proceed.

## 3. Repository Layout

- `backend/` — FastAPI services, database models, perception modules.
  - `backend/api/` — versioned API routers (survey, detection, inspection, harvest, harvest_mission, tree, dashboard, robot, planner, coconut, drone, map).
  - `backend/database/` — SQLAlchemy models, engine/session, and `init_db` (idempotent manual migrations).
  - `backend/main.py` — app assembly, CORS, router mounting, `init_db()` at startup.
- `frontend/` — React/Next.js UI (App Router).
  - `frontend/app/` — pages: `/` (Drone Uploader), `/dashboard`, `/survey`, `/map` (Digital Twin), `/robot`, `/trees`, `/trees/[treeId]`.
  - `frontend/components/` — `FarmMosaic`, `OverlayLayer`, `FarmViewer`, `TreeDetailsDrawer`, `DashboardFarmCard`, `DroneUploader`, `CoconutUploader`.
  - `frontend/lib/` — `api/detection.ts` (single API client), `mosaicLayout.ts` (shared farm-pixel transform).
- `.engineering/` — governance, specs, templates, workflows, review artefacts.
- `knowledge/` — design decisions, ADRs, external references.
- `development/` — experimental scripts/notebooks not shipped with the product.
- `.codebase-memory/` — local knowledge-graph artifact (team-shareable; not source).

Folders that no longer exist (e.g. the legacy V1 `MapView`/`MapWrapper`/`leafletFix` components) have been removed — do not reference them.

## 4. Engineering Workflow

Follow this sequence for every change. Never skip verification.

```
Understand
   ↓
Plan
   ↓
Review existing implementation   (read the code; reuse before building)
   ↓
Implement
   ↓
Verify                          (typecheck, build, tests, console-error scan)
   ↓
Manual Verification             (exercise the real UI/API; confirm behaviour)
   ↓
Documentation                  (update CURRENT.md and other docs when justified)
   ↓
Update codebase-memory         (record non-obvious findings in the knowledge graph)
   ↓
Wait for approval              (do NOT commit until approved)
   ↓
Commit
```

Each step feeds the next. "Verify" and "Manual Verification" are mandatory — a change is not done until it is observed working.

## 5. Engineering Principles

- **Reuse before creating.** Search the codebase; extend existing modules before adding new ones.
- **Never duplicate business logic.** One canonical implementation per rule.
- **Backend owns business rules.** All domain logic, eligibility, planning, and state machines live in `backend/`.
- **Frontend owns presentation.** UI components render data and emit intents; they do not compute business results.
- **Keep APIs single-source.** API definitions live once (the backend router + the `detection.ts` client). No duplicated contracts.
- **Preserve architecture.** Respect the frozen Digital Twin design and the `FarmViewer` / `OverlayLayer` / `TreeDetailsDrawer` separation of concerns.
- **Solve root causes, never symptoms.** Trace defects to their origin; do not paper over them.
- **Performance optimizations must preserve correctness.** Never trade correctness for speed.
- **Do not redesign frozen architecture without evidence.** Propose, don't silently rebuild.
- **Remove obsolete code** instead of accumulating technical debt. Dead code is a bug.
- **Prefer simplicity over cleverness.** The laziest correct solution that actually works wins.

## 6. Verification Policy

Verification is mandatory and never optional. If it cannot be completed, state explicitly why (e.g. environment limitation) — never fabricate it.

- **Backend:** `venv/bin/python -m py_compile` on changed modules; import the app; exercise endpoints against the running server (or an isolated DB script). Confirm no regressions in dependent endpoints.
- **Frontend (TypeScript):** `npx tsc --noEmit` must pass with zero errors.
- **Production build:** `npx next build` must succeed; no unresolved imports (including removed dependencies like Leaflet).
- **Playwright:** after any UI change, run the relevant harness (`verify_v26.js`, etc.) and confirm the expected passes with **0 console errors**.
- **Manual verification:** click through the affected flow in a real browser (dashboard, twin viewer, tree detail, robot). Confirm the actual rendered behaviour, not just that it compiles.
- **Regression review:** re-run the prior version's Playwright suite to prove the change did not break existing behaviour.
- **Console errors:** zero console errors is the acceptance bar for UI changes.

## 7. Documentation Policy

Whenever architecture or behaviour changes, decide whether these need updating — and update only when justified:

- `CURRENT.md` — always update for completed work / version status.
- `PROJECT_SPECIFICATION.md` — update when a frozen requirement or feature scope changes.
- `ARCHITECTURE.md` — update on component/dependency changes.
- `DECISIONS.md` — record new architecture decisions or reversals.
- `README.md` — update when the quickstart, setup, or high-level description drifts from reality.

The repository stays the single source of truth: docs describe the code, not intentions.

## 8. Skill Usage

Project work automatically follows the globally configured **Automatic Skill Discovery & Routing** behaviour: the agent selects the most relevant installed skill for the task at hand (brainstorming, feature-dev, code-review, frontend-design, senior-* specialisms, etc.) and applies it without being re-prompted. This policy is not duplicated here; the global routing governs skill selection.

## 9. Version Policy

- **Major versions** introduce genuinely new capabilities or architecture shifts.
- **Minor versions** refine architecture, UX, performance, or stability within the frozen design.
- **Hardening releases** focus only on quality: critical review, correctness/performance fixes, dead-code/legacy cleanup, documentation sync, and regression. **No new features** belong in a hardening milestone.

Version 2 is **FROZEN** at `v2.0` (architecture locked). V2.1–V2.7 are implemented and verified but **not yet committed** — commit only after explicit approval.

## 10. Golden Rules

- **Read before changing.** Understand the code and docs first.
- **Preserve architecture.** Respect the frozen Digital Twin design.
- **Verify before claiming completion.** Observed working, or say it isn't.
- **Never fabricate verification.** If you could not verify, say so.
- **Remove dead code.** Don't accumulate technical debt.
- **Prefer root-cause fixes.** Symptoms lie; origins don't.
- **Wait for approval before committing.** Implementation ≠ committed.
- **Keep the repository cleaner after every change.** Leave it better than you found it.
