# Design Specification – Full Pipeline Integration

**Date:** 2026-07-08 (last updated 2026-07-14 to reflect the implemented pipeline)

---

## 1. Overview

This document records the design of the end‑to‑end harvest pipeline as it is
**actually implemented** in the repository:

```
drone imagery ─▶ ML inference (YOLO) ─▶ backend APIs ─▶ PostgreSQL (Neon) ─▶ UI / robot
```

The pipeline is intentionally additive and low‑risk: detection, planning, and
robot execution are separate FastAPI routers that share a single de‑duplication
rule (`create_task_if_needed`) so the same tree/coconut never produces two
`Task` rows.

---

## 2. Components

### 2.1 Perception (`perception/`)
- `perception/drone_scan.py` – orchestrates a coverage flight. For each captured
  image it runs tree detection, `POST`s each detected tree to
  `http://127.0.0.1:8000/drone/tree_detected`, then runs coconut detection and
  `POST`s each coconut to `http://127.0.0.1:8000/drone/detection`.
- `perception/detect_coconut.py` – standalone script that runs the coconut model
  on a single image and posts detections to `/drone/detection`.

### 2.2 Backend routers (`backend/api/`)
| Router | Key endpoints | Responsibility |
|--------|--------------|---------------|
| `tree_api` | `POST /detect/trees`, `GET /trees/summary` | YOLO tree detection; tree list/summary |
| `drone_api` | `POST/GET /drone/tree_detected` | Register a tree from a GPS box, de‑duped within 4 m |
| `coconut_api` | `POST /detect/coconuts` | YOLO coconut‑ripeness detection |
| `detection_api` | `POST /drone/detection` | Store a `Detection` (ripeness lowercased, `harvest_type` persisted) and create a `Task` if needed |
| `planner_api` | `POST /planner/generate_tasks` | Bulk‑generate tasks from mature detections (idempotent) |
| `harvest_planner` | `GET /planner/harvest_order` | Ordered harvest plan grouped by ripeness |
| `robot_api` | `GET /robot/next_task`, `POST /robot/complete_task` | Robot task polling/completion with stale‑task reclamation |
| `map_api` | `GET /plantation/map` | Geo data for the map view |

### 2.3 Shared task de‑duplication (`backend/database/tasks.py`)
`create_task_if_needed(db, tree_id, coconut_id)` returns a new `Task` id only if
no `Task` for that `(tree_id, coconut_id)` exists, else `None`. It is the single
source of the de‑duplication rule, called by both `detection_api` and
`planner_api`.

### 2.4 Schema (`backend/database/`)
- `models.py`: `Tree` (gps + `detected_time`), `Detection` (`tree_id`,
  `coconut_id`, `ripeness`, `confidence`, `harvest_type`), `Task`
  (`tree_id`, `coconut_id`, `status`, `priority`, `created_at`, `claimed_at`).
- `init_db.py`: idempotent `create_all` + `ALTER … IF NOT EXISTS`, run at backend
  startup (`backend/main.py`). **No Alembic.**

### 2.5 Simulation (`simulation/robot_simulator.py`)
Polls `GET /robot/next_task` and reports completion via
`POST /robot/complete_task` to exercise the robot flow without hardware.

---

## 3. End‑to‑end flow

1. Drone image uploaded via UI → `tree_api` runs YOLO → bounding boxes returned.
2. User (or `drone_scan.py`) selects a box → `drone_api` registers GPS
   (de‑duped within 4 m) → creates/reuses a `Tree`.
3. Coconut image uploaded → `coconut_api` → `detection_api` stores a `Detection`
   (ripeness lowercased) and may create a `Task` via `create_task_if_needed`
   based on `harvest_type`.
4. `planner_api` / `harvest_planner` can bulk‑generate tasks from mature
   detections (`POST /planner/generate_tasks`) and return an ordered plan
   (`GET /planner/harvest_order`).
5. Robot UI / `robot_simulator` polls `robot/next_task` (claims `in_progress` +
   `claimed_at`, reclaims tasks stuck >5 min) → executes → `complete_task`.

---

## 4. Key invariants / gotchas

- **Ripeness normalisation** – the model returns capitalised labels
  (`Mature`/`Premature`/`Potential`); these are stored lowercased and queries use
  `func.lower(...)`.
- **`harvest_type`** – accepted by `detection_api` and persisted on `Detection`;
  it drives whether a `Task` is created (`mature`/`tender`/`both`).
- **Idempotency** – both the per‑detection path and the bulk planner use
  `create_task_if_needed`, so repeated calls never create duplicate tasks.
- **Stale reclamation** – `GET /robot/next_task` reclaims `in_progress` tasks
  older than 5 minutes (`STUCK_TASK_THRESHOLD`).

---

## 5. Notes

- This spec supersedes the earlier `/plan/from‑trees` design (which proposed a
  separate `plan_from_trees` router and an auth dependency that were never built).
  The same goal — turning detections into de‑duplicated tasks — is achieved by the
  shared `create_task_if_needed` helper used across the existing routers.
- Database is **PostgreSQL (Neon)** via `DATABASE_URL`; model weights (`*.pt`) and
  `.env` are gitignored and local‑only.

---

*Source of truth: the repository. If code and this document diverge, update the
document.*
