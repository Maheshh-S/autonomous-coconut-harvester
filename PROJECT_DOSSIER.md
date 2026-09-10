# Veraxis — Autonomous Coconut Harvesting Platform

**Definitive Engineering Handbook** — Version 3.8.7

> This document is the single comprehensive reference for the Veraxis project. A new engineer should be able to read ONLY this document and fully understand the project from start to finish without opening any other documentation.
>
> **Project:** Major Project — Digital Twin for Autonomous Coconut Harvesting
> **Repository:** `autonomous-coconut-harvester`
> **Current Version:** V3.8.7 (Version 3 line; all work verified, not yet committed)
> **Architecture:** Frozen at V2.0 (Digital Twin); V3 baseline frozen at V3.0

---

## Table of Contents

| Part | Section | Title |
|------|---------|-------|
| **I** | [1](#1-executive-summary) | Executive Summary |
| | [2](#2-project-timeline) | Project Timeline |
| | [3](#3-complete-feature-inventory) | Complete Feature Inventory |
| **II** | [4](#4-system-architecture) | System Architecture |
| | [5](#5-technology-stack) | Technology Stack |
| **III** | [6](#6-artificial-intelligence) | Artificial Intelligence |
| | [7](#7-drone-system) | Drone System |
| | [8](#8-robot-system) | Robot System |
| **IV** | [9](#9-digital-twin) | Digital Twin |
| | [10](#10-frontend) | Frontend |
| | [11](#11-backend) | Backend |
| **V** | [12](#12-database) | Database |
| | [13](#13-project-structure) | Project Structure |
| **VI** | [14](#14-engineering-workflow) | Engineering Workflow |
| | [15](#15-design-system) | Design System |
| **VII** | [16](#16-assets) | Assets |
| | [17](#17-testing) | Testing |
| | [18](#18-performance) | Performance |
| | [19](#19-security) | Security |
| **VIII** | [20](#20-current-status) | Current Status |
| | [21](#21-future-roadmap) | Future Roadmap |
| | [22](#22-lessons-learned) | Lessons Learned |
| **Appendix** | [A](#a-glossary) | Glossary |
| | [B](#b-folder-reference) | Folder Reference |
| | [C](#c-route-reference) | Route Reference |
| | [D](#d-api-reference) | API Reference |
| | [E](#e-component-reference) | Component Reference |
| | [F](#f-model-reference) | Model Reference |
| | [G](#g-documentation-index) | Documentation Index |
| | [H](#h-design-document-index) | Design Document Index |

---

## Document Map

| Part | Sections | Covers |
|------|----------|--------|
| **Part I: What & Why** | 1–3 | Purpose, timeline, complete feature inventory |
| **Part II: How It Fits Together** | 4–5 | Architecture layers, technology choices |
| **Part III: The Physical World** | 6–8 | AI models, drone sensing, robot execution |
| **Part IV: The Digital World** | 9–11 | Twin viewer, frontend UI, backend API |
| **Part V: Data & Structure** | 12–13 | Database schema, project folder layout |
| **Part VI: How We Build** | 14–15 | Workflow, design system |
| **Part VII: Quality & Operations** | 16–19 | Assets, testing, performance, security |
| **Part VIII: Status & Future** | 20–22 | Release status, roadmap, lessons learned |
| **Appendix** | A–H | Glossary, references, indices |

---

# Part I: What and Why

## 1. Executive Summary

### 1.1 What Veraxis Is

Veraxis is a full-stack precision agriculture system that transforms a coconut plantation into a structured, queryable, and actionable digital asset. The platform ingests drone imagery, detects coconut trees and the ripeness of their fruit, assigns permanent identities to every tree, plans harvest work, and coordinates a climbing robot to collect the fruit — all supervised from a single dashboard.

> See also: [Section 9 Digital Twin](#9-digital-twin), [Section 8 Robot System](#8-robot-system), [Section 6 Artificial Intelligence](#6-artificial-intelligence).

### 1.2 Why It Exists

**Manual coconut harvesting is dangerous.** The dominant method worldwide is a human climber carrying a sickle or knife, ascending an unprotected trunk 15–25 metres. Falls from height are the leading cause of injury and death in coconut cultivation.

**Labour shortage is structural.** Younger workers are unwilling to take up tree-climbing as a livelihood. Seasonal labour is increasingly unreliable and expensive.

**Locating harvest-ready trees is hard.** A plantation may hold hundreds or thousands of trees. Not every tree is ready at the same time. Without a survey, the farmer either over-sends labour or under-harvests.

**There is no digital inventory.** Farms run on paper, memory, or nothing. There is no canonical list of trees, no GPS for each, no count of fruit per tree, and no record of past harvests.

### 1.3 Core Architectural Decision: Two Robots, Two Sensing Payloads

The system is deliberately split into two robotic actors with fundamentally different sensing roles:

| Actor | Sensing Role | Payload |
|-------|--------------|---------|
| **Drone** | Detection at scale — "which pixels contain a tree" | Wide-area, top-down camera; YOLOv8 tree detector (`tree_detector.pt`) |
| **Climbing Robot** | Precision inspection — "is this coconut mature?" | Close-up canopy camera; YOLOv8 coconut ripeness detector (`coconut_detector.pt`) |

This separation matches the physics of the problem: coarse sensing from altitude is cheap and covers the whole farm; fine sensing is expensive per tree but is the only way to get trustworthy ripeness data.

### 1.4 Project Vision

A farmer opens the dashboard, sees the plantation rendered as a digital twin, triggers a drone survey, watches trees appear as permanent markers, requests a harvest, and lets the system plan the robot's route and execute it — all while a complete, never-deleted audit history records every mission, every detection, and every harvest. The robot is simulated today; the same API contract is designed to be driven by real hardware tomorrow.

### 1.5 Scope

| Included | Out of Scope |
|----------|--------------|
| Drone survey ingestion (folder upload, tile grid, YOLO detection) | Real drone hardware integration |
| Permanent tree generation (GPS/geometry deduplication) | Multi-farm / multi-robot coordination |
| Digital Twin farm viewer (tile mosaic + YOLO overlay) | SLAM / GPS localisation for robot |
| Ripeness inspection (close-up → YOLO → InventorySnapshot) | ROS / hardware control |
| Harvest planning (Nearest-Neighbour immutable mission) | Authentication / authorization (V1) |
| Robot simulation (deterministic time-driven executor) | Orchard crops other than coconut |
| Mission History & Analytics (backend-owned operations center) | Cloud deployment / managed services |

---

## 2. Project Timeline

### 2.1 Version 1 — Baseline Integration (Completed)

- YOLOv8 tree + coconut-ripeness detection
- GPS tree-matching into permanent `Tree` records (4 m threshold)
- V1 `Task`/`Detection` model
- V1 robot task polling/completion (`/robot/next_task`, `/robot/complete_task`)
- Dashboard, tree-detail, map (Leaflet/OSM), robot pages

### 2.2 Version 2 — Digital Twin (FROZEN v2.0, Architecture Locked)

**Core Achievement:** Replaced V1 Leaflet/OSM `/map` with a purpose-built tile-mosaic canvas.

**Locked Decisions (see [DECISIONS.md](DECISIONS.md)):**
1. Seam-de-emphasised continuous farm mosaic — **no orthomosaic, no stitching**
2. Mission-scoped `TreeObservation` model + `Tree.current_observation_id` pointer
3. Representative observation = highest confidence → closest to tile centre → newest mission
4. Persist `SurveyTile.grid_row/col/image_width/image_height` during survey processing
5. Twin **replaces** `/map` — single viewer, no parallel Leaflet map

**V2.1 — Data Foundation:** New `tree_observations` table; `SurveyTile` gained `capture_order`, `grid_row/col`, `center_gps_lat/lon`, `image_width/height`. Bulk-write optimization.

**V2.2 — Continuous Farm Mosaic Engine:** `FarmMosaic.tsx` lays tiles by persisted `(grid_row, grid_col)`. 2px configurable seam gap.

**V2.3 — Digital Twin Viewer (Navigation Only):** `FarmViewer.tsx` wraps `FarmMosaic` in transform-based viewport. Pointer Events: wheel zoom, drag pan, pinch zoom, double-click → Fit.

**V2.4 — Interactive Tree Overlay:** `OverlayLayer` is presentation-only; `FarmViewer` owns selection state. Shared `computeMosaicLayout`. Bulk `GET /mission/{id}/trees`.

**V2.5 — Tree Details Integration:** Read-only `TreeDetailsDrawer`.

**V2.6–V2.7 — Optimisation & Stabilisation:** Viewport culling + zoom-LOD prototyped; Flight Planner owns mission geometry.

### 2.3 Version 3 — Robot Simulation (V3.1–V3.8.7)

**Core Architecture:** One simulated, time-driven harvesting robot executes a `HarvestMission`. **Backend owns all robot behaviour**; frontend only visualizes backend state.

| Milestone | Scope | Status |
|-----------|-------|--------|
| V3.1 Robot Domain | `Robot`, `DockStation`, `RobotBattery`, `RobotConfiguration` tables | Implemented |
| V3.2 Navigation | `RobotNavigator` (pure trajectory), `NavigationService` | Implemented |
| V3.3 State Machine | `RobotStateMachine` enforcing frozen `LEGAL_TRANSITIONS` | Implemented |
| V3.3.1 Refinement | Every operational state may fault → `ERROR` | Implemented |
| V3.4 Simulation Engine | `SimulationClock` + `SimulationEngine` (`step(dt)`) + `SimulationScheduler` | Implemented |
| V3.5 Telemetry & WS | `EventBus`, `TelemetryService`, `WebSocketGateway` (`/ws/robot`) | Implemented |
| V3.6 Visualization | `RobotLayer` (marker + path + battery ring) inside `FarmViewer` | Implemented |
| V3.7 Mission History | `analytics/mission_history.py`; `RobotRun`; `/robot/runs` endpoints | Implemented |
| V3.7.1 Refinement | Transparent `score_breakdown`; tree-activity deep links | Implemented |
| V3.7.2 Workflow Integration | `POST /harvest/missions/{id}/start` auto-starts sim | Implemented |
| V3.7.3 Speed & Battery | `DEFAULT_SIMULATION_SPEED = 60` | Implemented |
| V3.8.1 Navigation Redesign | `AppShell` (desktop rail + mobile bottom nav) | Implemented |
| V3.8.2 Timeline Tab Redesign | Vertical rail, Phosphor icons, tabular timestamps | Implemented |
| V3.8.3 Robot Log Tab Redesign | Terminal frame, WCAG severity tokens | Implemented |
| V3.8.4 Home Page Redesign | 7 GSAP chapters, Lenis, Apple Liquid Glass CTAs | Implemented |
| V3.8.5–V3.8.7 Hardening | Review, N+1/perf, WS reconnect, dead-code removal, docs sync | Implemented |

**Current State (V3.8.7):** All V1–V3 work verified (Playwright 0 console errors, `tsc --noEmit` / `next build` clean) but **not yet committed**.

### 2.4 Key Engineering Decisions (from [DECISIONS.md](DECISIONS.md))

| Decision | Summary |
|----------|---------|
| Backend Framework | FastAPI — async support, easy ML integration |
| Frontend Framework | Next.js (React) — SSR, routing, familiar stack |
| Data Storage | PostgreSQL (Neon) via SQLAlchemy; manual migrations via `init_db.py` |
| ML Inference | YOLOv8 models under `models/` (gitignored) |
| Simulation | Software robot simulator; deterministic `step(dt)` |
| Rendering Foundation (D6) | React + DOM/CSS-transform retained; Canvas/Konva only if DOM bottleneck |
| Flight Planner Owns Geometry (D6b) | Explicit `PlannerConfig`; no heuristics |
| Robot V3 Architecture (D7) | Single farm-pixel coordinate system; WS telemetry; renderer freeze |
| Premium Navigation (D9) | `AppShell` replaces inline nav |
| Home Page Redesign (D10) | 7 GSAP chapters; Lenis; Apple Liquid Glass; zero em-dashes |

---

## 3. Complete Feature Inventory

### 3.1 Drone Survey Subsystem

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| Survey Mission Creation | Ingest drone folder | Folder of images | `SurveyMission`, `SurveyImage` rows | `survey_api.py` |
| Tile Generation | Split into grid, persist geometry | `SurveyMission`, images | `SurveyTile` with `grid_row/col` | `flight_planner.py`, `gps_projection.py` |
| Tree Detection (YOLO) | Detect tree candidates | Tile images | Bounding boxes, confidences | `tree_detector.pt` |
| Tree Matching | GPS/geometry deduplication | Detections + geometry | `Tree` records, `TreeObservation` | `match_trees_for_mission` |

### 3.2 Digital Twin Subsystem

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| Farm Mosaic Rendering | Lay out tiles by grid | `SurveyTile[]` | Visual mosaic | `FarmMosaic.tsx`, `computeMosaicLayout` |
| Viewport Navigation | Pan/zoom/fit | User input | Stage `transform` | `FarmViewer.tsx` |
| Tree Overlay | Render YOLO boxes | `TreeObservation[]` | Counter-scaled boxes | `OverlayLayer.tsx` |
| Tree Selection | Tap tree → details | Click/tap | `selectedTreeId` | `FarmViewer` state |
| Tree Details Drawer | Read-only tree info | `selectedTreeId` | Drawer with inventory | `TreeDetailsDrawer.tsx` |

### 3.3 Ripeness Inspection & Inventory

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| Inspection Session | Robot visit to one tree | `tree_id` | `Inspection` lifecycle | `inspection_api.py` |
| Image Upload | Close-up images | Files | `InspectionImage` rows | `CoconutUploader.tsx` |
| Ripeness Detection | Classify each coconut | Inspection images | `CoconutDetection` | `coconut_detector.pt` |
| Inventory Snapshot | Immutable per-tree counts | Aggregated detections | `InventorySnapshot` | Inspection completion |

### 3.4 Harvest Planning

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| Eligible Tree Selection | Filter by inventory | `InventorySnapshot` | Tree list | `harvest_mission_api.py` |
| Nearest-Neighbour Route | Frozen route planner | GPS/farm-pixel positions | `visit_order` | `harvest_mission_api.py` |
| Harvest Mission Build | Immutable mission | Eligible trees + route | `HarvestMission` + items | `harvest_mission_api.py` |

### 3.5 Robot Mission Execution

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| Mission Start | Flip to RUNNING | `HarvestMission.id` | `Robot` RUNNING, sim started | `harvest_mission_api.py` |
| Manual Advance | Complete current item | `POST /advance` | Post-harvest snapshot | `harvest/execution.py` |
| Pause/Resume/Cancel | Operator control | HTTP commands | State transitions | `robot_simulation.py` |
| Auto-Complete | Dock return → done | Simulation end | Final snapshot, `RobotRun` | `scheduler` |

### 3.6 Robot Simulation (Deterministic)

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| Simulation Clock | `sim = wall × speed_factor` | `speed_factor` | Sim-time | `SimulationClock` |
| Simulation Engine | Pure `step(dt)` | `dt`, state | New state + events | `SimulationEngine` |
| Scheduler | Wall-clock driver | `HarvestMission`, `Robot` | Persisted state, telemetry | `SimulationScheduler` |
| State Machine | Enforces transitions | Commands | Validated state changes | `RobotStateMachine` |

### 3.7 Telemetry & Mission History

| Feature | Purpose | Inputs | Outputs | Dependencies |
|---------|---------|--------|---------|--------------|
| WebSocket `/ws/robot` | Live state stream | Sim events per tick | Frame broadcast | `WebSocketGateway` |
| Telemetry Persistence | Append-only rows | Engine events | Time-series | `TelemetryService` |
| Mission History | Analytics per run | Telemetry/events | `RobotRun` | `analytics/mission_history.py` |
| History Pages | `/robot/history` | API reads | Timeline, tree-activity, robot-log | `robot_history.py` |

### 3.8 Dashboard & Frontend Features

| Feature | Purpose | Route | Components |
|---------|---------|-------|------------|
| Home / Landing | Brand identity | `/` | 7 GSAP chapters |
| Dashboard | Overview | `/dashboard` | `DashboardFarmCard`, metrics |
| Survey | Ingestion + detection | `/survey` | `DroneUploader`, tile grid |
| Digital Twin | Farm viewer | `/map` | `FarmViewer`, `OverlayLayer`, `TreeDetailsDrawer` |
| Robot Ops | Simulation control | `/robot` | `RobotLayer`, `SimulationControls` |
| Mission History | Completed runs | `/robot/history` | Run list |
| Run Detail | Per-run analytics | `/robot/history/[id]` | Timeline, tree-activity, robot-log |
| Tree Registry | All trees | `/trees` | Tree grid, filters |
| Tree Detail | Per-tree info | `/trees/[treeId]` | `CoconutUploader`, inspections |

---

# Part II: How It Fits Together

## 4. System Architecture

### 4.1 Pipeline Overview

The end-to-end pipeline flows through six stages, from raw drone imagery to completed harvest:

```
DRONE SURVEY          DIGITAL TWIN         RIPENESS INSPECTION
  Folder upload         Tile mosaic +        Close-up images +
  YOLO detection        YOLO overlay         YOLO classification
  Permanent Trees       Tree selection       InventorySnapshot

        |                      |                      |
        v                      v                      v

HARVEST PLANNING       ROBOT EXECUTION      MISSION HISTORY
  Eligible trees +       Simulated robot +     Analytics per run
  Nearest-Neighbour      step(dt) execution    Score, timeline,
  Immutable mission                            tree activity, log
```

### 4.2 High-Level Layered Architecture

```
+-----------------------------------------------------------------+
|                        FRONTEND (Next.js)                       |
|  +-------------+  +-------------+  +-------------+             |
|  |   Pages     |  |  Components |  |    lib/     |             |
|  |  (Routes)   |  |  (UI Only)  |  |  API Client |             |
|  +------+------+  +------+------+  +------+------+             |
+---------+----------------+----------------+---------------------+
          |                |                |
          |   HTTP + WS    |                |
          v                v                v
+-----------------------------------------------------------------+
|                        BACKEND (FastAPI)                        |
|  +--------------+  +--------------+  +--------------+           |
|  |   Routers    |  |  Services    |  |    Models    |           |
|  | (API Layer)  |  | (Biz Logic)  |  |  (SQLAlchemy)|           |
|  +------+-------+  +------+-------+  +------+-------+           |
+---------+----------------+----------------+---------------------+
          |                |                |
          |   SQLAlchemy   |                |
          v                v                v
+-----------------------------------------------------------------+
|                     POSTGRESQL (Neon)                           |
+-----------------------------------------------------------------+
```

### 4.3 Component Dependency Map

See [Appendix B: Folder Reference](#b-folder-reference) for detailed folder paths, and [Appendix E: Component Reference](#e-component-reference) for the full component list.

### 4.4 Data Flow (End-to-End Pipeline)

```
1. DRONE SURVEY
   Folder upload -> survey_api.create_mission
   -> extract images -> SurveyTile (grid_row/col persisted)
   -> YOLO tree detection -> match_trees_for_mission
   -> permanent Tree + TreeObservation (mission-scoped)

2. DIGITAL TWIN
   GET /mission/{id}/tiles -> FarmMosaic renders mosaic
   GET /mission/{id}/trees -> OverlayLayer renders boxes
   User selects tree -> TreeDetailsDrawer shows inventory

3. RIPENESS INSPECTION
   CoconutUploader -> Inspection + InspectionImage
   -> YOLO coconut detection -> CoconutDetection
   -> aggregate -> InventorySnapshot (immutable)
   -> Tree.current_inventory_id repointed

4. HARVEST PLANNING
   HarvestMission build -> eligible trees from latest InventorySnapshot
   -> Nearest-Neighbour visit_order -> HarvestMissionItem[]
   -> Mission immutable (CREATED status)

5. ROBOT EXECUTION
   POST /harvest/missions/{id}/start -> RUNNING + scheduler.start
   SimulationScheduler -> builds NavigationPlan
   -> SimulationEngine.step(dt) + SimulationClock
   -> RobotStateMachine transitions (only status mutator)
   -> WebSocket /ws/robot broadcasts frame
   -> On harvest: harvest/execution.py writes post-harvest snapshot
   -> On dock return: mission COMPLETED, RobotRun written

6. MISSION HISTORY & ANALYTICS
   analytics/mission_history.py computes all metrics server-side
   GET /robot/runs -> frontend renders presentation-only
```

---

## 5. Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Frontend Framework** | Next.js | 16 (App Router) | SSR, routing, React 19 |
| **UI Library** | React | 19 | Component model, hooks |
| **Language** | TypeScript | 5.x | Type safety across API boundary |
| **Styling** | Tailwind CSS | 4 (CSS-first) | Utility-first, `@theme` tokens |
| **Animation** | GSAP + Lenis | Latest | Scroll-driven, smooth scroll |
| **Component Animation** | Framer Motion | Latest | Springs, drawers, press feedback |
| **Icons** | Phosphor Icons | Latest | One family, standardized strokeWidth |
| **Fonts** | Geist + Geist Mono | via `next/font` | Self-hosted, tabular-nums |
| **Backend Framework** | FastAPI | Latest | Async, auto OpenAPI, Pydantic |
| **Language** | Python | 3.11+ | ML ecosystem, async support |
| **ORM** | SQLAlchemy | 2.x | Core + ORM, manual migrations |
| **Database** | PostgreSQL | Neon (serverless) | Free tier, Postgres compat |
| **ML Framework** | Ultralytics YOLOv8 | Latest | Fast inference, Python API |
| **Models** | `tree_detector.pt`, `coconut_detector.pt` | gitignored | Local-only |
| **WebSocket** | `uvicorn[standard]` | Built-in | Native WS for `/ws/robot` |
| **Testing (E2E)** | Playwright | Latest | Real browser, 0 console errors |
| **Type Checking** | `tsc --noEmit` | Built-in | Mandatory pass |

**Not Used:** Leaflet/OSM, Alembic, ROS/SLAM, PixiJS/WebGL/Three.js, Inter font, gradient text, neon glow, hand-rolled SVG.

---

# Part III: The Physical World

## 6. Artificial Intelligence

### 6.1 Models

| Model | File | Task | Input | Output | Classes |
|-------|------|------|-------|--------|---------|
| Tree Detector | `models/tree_model/tree_detector.pt` | Object detection | Drone survey tile (top-down) | Bounding boxes + confidence | `tree` |
| Coconut Detector | `models/coconut_model/coconut_detector.pt` | Object detection | Close-up canopy image | Bounding boxes + confidence + class | `Mature`, `Potential`, `Premature` |

### 6.2 Detection Pipeline

**Tree Detection (Survey):**
```
Drone image -> YOLOv8 tree_detector.pt
-> boxes (xyxy, conf) -> match_trees_for_mission
-> GPS proximity (4 m) + geometry (IoU) -> permanent Tree
-> TreeObservation persisted (mission-scoped)
```

**Coconut Ripeness Detection (Inspection):**
```
InspectionImage -> YOLOv8 coconut_detector.pt
-> boxes (xyxy, conf, class) -> CoconutDetection (ripeness lowercased)
-> aggregate per Inspection -> InventorySnapshot
-> counts: total, mature, potential, premature
-> Tree.current_inventory_id repointed (replace-on-scan)
```

### 6.3 Inference Characteristics

| Aspect | Detail |
|--------|--------|
| **Runtime** | Local CPU/GPU inference (no external API) |
| **Batch Processing** | Single image per call (survey tiles sequential) |
| **Confidence Threshold** | Configured per model (not exposed in API) |
| **Ripeness Normalisation** | Capitalised from model, stored lowercased; queries use `func.lower(...)` |
| **Idempotency** | `CoconutDetection` per `InspectionImage`; `InventorySnapshot` unique per `Inspection` |
| **Model Versioning** | Gitignored, local only |

### 6.4 Decision Making

| Decision | Logic |
|----------|-------|
| **Tree Matching** | GPS distance <= 4 m -> existing Tree; else new Tree. IoU tiebreaker. |
| **Representative Observation** | Highest confidence -> closest to tile centre -> newest mission |
| **Harvest Eligibility** | Latest `InventorySnapshot` filtered by `harvest_type` |
| **Route Planning** | Frozen Nearest-Neighbour (no MST, no TSP) |
| **Robot Task Assignment** | `RobotMission`/`RobotTask` are adapters over `HarvestMission`/`HarvestMissionItem` (no duplicate queue) |

### 6.5 Fallback Behaviour

| Scenario | Behaviour |
|----------|-----------|
| Model file missing | Endpoint returns 500 |
| Low confidence detection | Still persisted; confidence stored for filtering |
| Inspection image failure | `InspectionImage.status = FAILED`; no snapshot created |
| Robot simulation error | `RobotStateMachine` -> `ERROR`; recovery to `IDLE` or `RETURNING` |

---

## 7. Drone System

### 7.1 Mission Planning (Simulated Flight Planner)

The **Flight Planner** (`backend/api/flight_planner.py`) is the **source of truth for survey-mission geometry**. It is simulated because drone/camera hardware is not yet integrated; the geometry contract is the deliverable.

**PlannerConfig (Frozen Default):**
```python
DEFAULT_PLANNER_CONFIG = PlannerConfig(
    rows=5, cols=2,
    origin=TOP_LEFT,
    traversal_pattern=BOUSTROPHEDON,
    row_spacing=standard, column_spacing=standard
)
```

**Outputs:**
- `rows x cols` waypoints in boustrophedon (lawnmower) order
- Uploaded images slotted by `upload_order` into planned positions
- Fewer images than planned -> only available positions populated
- More images than planned -> HTTP 422 validation error
- Centre GPS per position via `gps_projection.project_tile_center_gps`

**Persisted on SurveyTile:** `grid_row`, `grid_col`, `capture_order`, `center_gps_lat/lon`, `image_width`, `image_height`

### 7.2 Survey Ingestion

| Step | API | Description |
|------|-----|-------------|
| 1. Folder Upload | `POST /mission/create` | Creates `SurveyMission`, stores images |
| 2. Tile Generation | `generate_tiles_for_mission` | Runs Flight Planner, persists geometry |
| 3. Tree Detection | `POST /detect/trees` (per tile) | Runs YOLO, creates `Tree` + `TreeObservation` |
| 4. Tile Access | `GET /mission/{id}/tiles` | Returns `image_url` for mosaic |

### 7.3 GPS & Coordinate Systems

| System | Description |
|--------|-------------|
| **GPS (WGS84)** | Backend-only metadata. Never used for frontend rendering. |
| **Farm-Pixel** | Primary spatial truth. Shared by Twin, Overlay, Robot, Navigation. |
| **Tile Pixel** | Local to each `SurveyTile` image. |

**GPS Generation:** `gps_projection.py` projects tile centers from mission origin. No real GPS hardware.

### 7.4 Tree Identification

| Identifier | Scope | Persistence |
|------------|-------|-------------|
| `tree_code` (TREE-0001) | Global, permanent | Write-once, never changes |
| `Tree.id` | Database PK | Auto-increment |
| `TreeObservation.id` | Mission-scoped | Historical, never overwritten |
| `current_observation_id` | Pointer to representative | Repointed on each re-survey |

---

## 8. Robot System

### 8.1 Domain Model (Persisted Entities)

| Entity | Kind | Key Fields |
|--------|------|------------|
| `Robot` | Singleton | `id`, `name`, `status`, `position_x/y`, `heading_deg`, `current_mission_id`, `battery_id`, `dock_id`, `speed` |
| `DockStation` | Singleton | `id`, `farm_x`, `farm_y`, `label` |
| `RobotBattery` | 1:1 with Robot | `robot_id`, `pct`, `status` (CHARGING/DISCHARGING/IDLE) |
| `RobotConfiguration` | 1:1 with Robot | `default_speed`, `max_speed`, battery thresholds |

### 8.2 State Machine (FROZEN)

**States (8 + 1 sub-state):**
```
IDLE -> MOVING -> CLIMBING -> SCANNING -> HARVESTING -> RETURNING -> IDLE
  ^                                                           |
  +------------------------ ERROR ---------------------------+
                              |
                          DOCKED -> (recharge) -> IDLE
```

**Transitions (enforced by `RobotStateMachine` only):**
- Only `RobotStateMachine` mutates `robot.status`
- `POST /robot/state` commands validated transition (illegal -> 400)
- `GET /robot/state` returns `available_transitions`
- Every operational state may fault -> `ERROR`; recovery to `IDLE` or `RETURNING`

### 8.3 Navigation Pipeline (Three Separated Concerns)

| Layer | Component | Responsibility | Mutation |
|-------|-----------|----------------|----------|
| **Route Planning** | Harvest Planner | Ordered `HarvestMissionItem` list | None (frozen) |
| **Movement Planning** | `RobotNavigator` | Farm-pixel trajectory: `(x, y, t)` waypoints | None (read-only) |
| **Execution** | `SimulationEngine` + `Scheduler` | Drives position, state machine, battery | Only component mutating live state |

**Coordinate System:** Single farm-pixel space shared with `computeMosaicLayout` and `TreeObservation`.

### 8.4 Simulation Engine (Deterministic)

| Component | Description |
|-----------|-------------|
| `SimulationClock` | `sim_now = wall_start + (wall_elapsed x speed_factor)` |
| `SimulationEngine` | Pure `step(dt)`: linear interpolation, battery drain, state transitions |
| `SimulationScheduler` | Wall-clock thread driver; builds `NavigationPlan`; ticks engine |
| **Determinism** | Same inputs -> identical event/telemetry/transition/harvest sequence |

### 8.5 Speed & Battery (V3.7.3 Calibration)

| Parameter | Value | Source |
|-----------|-------|--------|
| `DEFAULT_SIMULATION_SPEED` | 60 (sim-seconds per real-second) | `simulation/config.py` |
| `BATTERY_DRAIN_PER_S` | `1 / DEFAULT_SIMULATION_SPEED` | Derived; ~1% per real-second at 60x |
| Battery drain | While active (not IDLE/DOCKED/CHARGING) | Deterministic |
| Recharge | Only via `POST /robot/recharge` | V3.5.1 invariant |

### 8.6 Telemetry & WebSocket

| Channel | Mechanism | Contents |
|---------|-----------|----------|
| Commands | HTTP | start/pause/resume/cancel/advance on mission; set_speed/recharge/reset on robot |
| On-demand State | HTTP GET | `GET /harvest/missions/{id}/status`, `GET /robot/state` |
| Live Telemetry | **WebSocket `/ws/robot`** | One frame per sim tick. **Observe-only.** |

**Event Catalogue:** MISSION_STARTED, TASK_CLAIMED, STATE_CHANGED, POSITION_SAMPLE, BATTERY_CHANGED, TASK_COMPLETED, HARVEST_WRITTEN, MISSION_COMPLETED, ERROR_RAISED, DOCKED/RECHARGED, PAUSED/RESUMED/CANCELLED.

**Event Flow:**
```
RobotController (HTTP) -> SimulationEngine.step(dt) -> Scheduler._run_loop
    -> EventBus (TOPIC_SIM_EVENTS)
        -> TelemetryService (appends events, read-only)
        -> WebSocketGateway (broadcasts to /ws/robot)
        -> Frontend RobotLayer (renders backend state only)
```

### 8.7 Mission History & Analytics (V3.7)

**Backend-owned Operations Center:**
- One `RobotRun` row per terminated run
- Metrics computed server-side from append-only telemetry/events
- **Frontend is presentation-only**

**Exposed Endpoints:**
- `GET /robot/runs` — list with summary
- `GET /robot/runs/{id}` — run detail (score breakdown, duration)
- `GET /robot/runs/{id}/timeline` — grouped travel segments
- `GET /robot/runs/{id}/tree-activity` — per-tree harvest activity
- `GET /robot/runs/{id}/robot-log` — severity tokens (INFO/WARNING/ERROR)

### 8.8 Real Robot Swap Contract

The **WebSocket telemetry frame + HTTP command set** is the contract boundary. A real robot replaces only `RobotSimulationEngine`. All other components remain unchanged.

---

# Part IV: The Digital World

## 9. Digital Twin

### 9.1 Architecture

```
+----------------------------------------------------------------+
|                     FarmViewer (Stage)                          |
|  transform: translate(tx,ty) scale(s)                           |
|  +---------------------+  +-----------------------------+      |
|  |    FarmMosaic       |  |     OverlayLayer            |      |
|  |  (Tile Canvas)      |  |  (Tree Boxes + Labels)      |      |
|  |  - Grid layout by   |  |  - Counter-scaled borders   |      |
|  |    grid_row/col     |  |    (1/scale)                |      |
|  |  - Seam gap (2px)   |  |  - Centroid markers         |      |
|  |  - No re-render on  |  |  - Labels hide at LOD       |      |
|  |    pan/zoom         |  |  - Pointer Events (native)  |      |
|  +---------------------+  +-----------------------------+      |
|                                                                 |
|  +---------------------------------------------------------+   |
|  |              RobotLayer (Additive)                       |   |
|  |  RobotMarker + RobotPathLayer + Battery Ring            |   |
|  |  Counter-scaled; shares same farm-pixel transform       |   |
|  +---------------------------------------------------------+   |
+----------------------------------------------------------------+
                              |
                              v
                    TreeDetailsDrawer (Right Drawer)
                    - Read-only tree info
                    - InventorySnapshot
                    - Inspection history
                    - "Open on Twin" deep link
```

### 9.2 Rendering Pipeline

| Stage | Component | Key Technique |
|-------|-----------|---------------|
| **Layout** | `computeMosaicLayout(tiles, gap)` | Single source (shared frontend + backend) |
| **Mosaic** | `FarmMosaic` | Absolutely-positioned `<img>` per tile. Memoized. |
| **Viewport** | `FarmViewer` | `transform: translate(tx,ty) scale(s)` via ref. Pointer Events. |
| **Overlay** | `OverlayLayer` | Counter-scaling: `borderW = 1/scale`, `fontPx = 12/scale` |
| **Selection** | `FarmViewer` state | `selectedTreeId` -> amber halo + `TreeDetailsDrawer` |

### 9.3 Interaction Model

| Interaction | Implementation | Constraints |
|-------------|----------------|-------------|
| **Pan** | Single-pointer drag | `touch-action: none` |
| **Zoom** | Wheel + two-pointer pinch | `preventDefault` on wheel |
| **Fit** | `+` / `-` / `Fit` buttons | Never upscales past 100% |
| **Tree Select** | Tap tree box (`data-tree-id`) | Tap vs drag threshold frozen |
| **Drawer** | Spring animation | Origin-aware; `prefers-reduced-motion` = opacity only |
| **Robot Marker** | `RobotLayer` in same stage | Live via WS; counter-scaled |

### 9.4 Performance Strategy (V2.6+)

| Technique | Status | Trigger |
|-----------|--------|---------|
| **DOM Approach** | Current (302 trees, 60 FPS) | Native hit-testing |
| **Viewport Culling** | Prototyped | Farm-pixel inverse transform viewport rect |
| **Zoom LOD** | Partial (labels hide) | Extend: centroids -> dots |
| **Canvas/WebGL Swap** | Sanctioned by spec | If box counts exceed DOM threshold |

### 9.5 Embedding

- **`/map`** — Full viewer
- **`/dashboard`** — `DashboardFarmCard` with expand to `/map`
- Both share same `FarmViewer` component

---

## 10. Frontend

### 10.1 Routes (9 Pages)

| Route | File | Purpose | Key Components |
|-------|------|---------|----------------|
| `/` | `app/page.tsx` | Brand landing (7 GSAP chapters) | `SmoothScroll`, `AppShell`, GSAP, Lenis |
| `/dashboard` | `app/dashboard/page.tsx` | Overview | `DashboardFarmCard`, metrics |
| `/survey` | `app/survey/page.tsx` | Ingestion + detection | `DroneUploader`, tile grid |
| `/map` | `app/map/page.tsx` | Digital Twin | `FarmViewer` + `OverlayLayer` + `TreeDetailsDrawer` |
| `/robot` | `app/robot/page.tsx` | Robot control | `RobotLayer`, `SimulationControls` |
| `/robot/history` | `app/robot/history/page.tsx` | Completed runs | Run list |
| `/robot/history/[id]` | `app/robot/history/[id]/page.tsx` | Run detail (3 tabs) | Timeline, tree-activity, robot-log |
| `/trees` | `app/trees/page.tsx` | Tree registry | Tree grid, filters |
| `/trees/[treeId]` | `app/trees/[treeId]/page.tsx` | Per-tree detail | `CoconutUploader`, inspections |

### 10.2 Navigation (`AppShell`)

| Platform | Implementation |
|----------|----------------|
| **Desktop** | Left-side icon rail (7 items). Brand "Veraxis / Harvest Intelligence". |
| **Mobile** | Bottom tab bar (5 primary) + "More" sheet for overflow. |
| **Icons** | Phosphor Icons, `strokeWidth=1.5`, `fill` for active |
| **Active State** | `data-active="true"` + `aria-current="page"` |

### 10.3 Motion & Scroll System

| Library | Purpose |
|---------|---------|
| **Lenis** | Smooth scroll (`lerp ~0.1`) |
| **GSAP ScrollTrigger** | Scroll-driven animations |
| **Framer Motion** | Component enter/exit, drawers, press feedback |

**Animation Rules (from the archived [design-v1 motion language](docs/archive/design-v1/04-motion-language.md) — historical):**
- UI durations <= 300ms; feedback 100-160ms (`scale(0.97)` on `:active`)
- Custom easings: `--ease-out`, `--ease-in-out`, `--ease-drawer`
- Never `ease-in` on UI; never animate `width/height/top/left`
- `prefers-reduced-motion` -> opacity cross-fades / static
- `prefers-reduced-transparency` -> solid surfaces, no blur
- No `window.addEventListener("scroll")` — Lenis + ScrollTrigger only

### 10.4 Video Integration

| Asset | Source | Usage |
|-------|--------|-------|
| **A1-A7** (7 clips) | Google Flow (Veo) | Hero/ambient per page (see the archived [design-v1 shot list](docs/archive/design-v1/06-shot-list.md)) |
| **Survey Tiles** | Backend | Mosaic images — real drone photos |
| **Inspection Images** | Backend | Tree Details, `/trees` — real close-ups |

**Video Treatment:** Documentary, golden-hour, natural grain. Scrim for AA contrast. Ambient loop seamless; hero play once/hold.

### 10.5 Component Hierarchy

```
RootLayout (layout.tsx)
+-- <html> (Geist + Geist Mono)
+-- <body>
    +-- <SmoothScroll> (Lenis)
        +-- <AppShell>
            +-- {children}
                +-- / -> Landing (7 GSAP chapters)
                +-- /dashboard -> DashboardFarmCard + metrics
                +-- /survey -> DroneUploader + results
                +-- /map -> FarmViewer -> FarmMosaic + OverlayLayer + TreeDetailsDrawer + RobotLayer
                +-- /robot -> RobotLayer + RobotStatusCard + SimulationControls
                +-- /robot/history -> Run list + ambient clip
                +-- /robot/history/[id] -> Timeline / TreeActivity / RobotLog
                +-- /trees -> Tree grid + filters
                +-- /trees/[treeId] -> Detail + CoconutUploader
```

### 10.6 Key Frontend Modules (`frontend/lib/`)

| Module | Purpose |
|--------|---------|
| `api/detection.ts` | **Single typed API client** — all backend calls route here |
| `mosaicLayout.ts` | **Shared farm-pixel transform** — `computeMosaicLayout(tiles, gap)` |
| `useRobotSimulation.ts` | WS hook + `RobotWebSocketClient` (single WS, observe-only) |
| `useReveal.ts` | IntersectionObserver-based scroll reveal |
| `usePagination.ts` | **Client-side list pagination** — `usePagination(items, pageSize = 8)`; auto-hides when ≤ 8 items |
| `formatTime.ts` | **Shared IST formatters** — `fmtIST` / `fmtISTTimeOnly` / `fmtISTDateOnly` render naive-UTC back-end timestamps as `Asia/Kolkata` wall-clock |

### 10.6b Shared Frontend Components (`frontend/components/`)

| Component | Purpose |
|-----------|---------|
| `PageHero` | **Shared page header** — strengthened scrim + single light-ink headline + kicker/sub over one ambient clip; used by `/map`, `/robot`, `/robot/history`, `/trees` |
| `ToggleSwitch` | **Shared pill toggle** — extracted from the map control bar; shared with `/robot` (e.g. Follow Robot) |
| `Pager` | Prev/Next + "Page X of Y" list pager (pairs with `usePagination`) |
| `SkeletonRows` | Pulsing skeleton rows for loading states |

### 10.7 Desktop vs Mobile Behaviour

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| **Navigation** | Left rail (7 items) | Bottom bar (5) + More sheet |
| **Viewport** | Mouse wheel + drag | Touch pinch + drag |
| **Tree Details** | Right drawer (spring) | Full-width bottom sheet |
| **Timeline/Log** | Full table/terminal | Collapsed rows / horizontal scroll |

---

## 11. Backend

### 11.1 Folder Structure

```
backend/
+-- api/                    # 18 FastAPI routers
|   +-- survey_api.py       # Mission, tiles, tree matching
|   +-- inspection_api.py   # Sessions, images, ripeness
|   +-- harvest_mission_api.py  # Planner + mission build
|   +-- robot_domain.py     # Robot CRUD, state, speed, recharge
|   +-- robot_navigation.py # Movement planning (read-only)
|   +-- robot_simulation.py # Simulation control
|   +-- robot_telemetry.py  # Telemetry HTTP endpoints
|   +-- robot_history.py    # Mission History & Analytics
|   +-- dashboard_api.py    # Overview aggregation
|   +-- tree_api.py         # Tree summary + YOLO detection
|   +-- coconut_api.py      # Coconut YOLO detection
|   +-- flight_planner.py   # PlannerConfig + waypoints
|   +-- gps_projection.py   # Tile center GPS
|   +-- legacy: robot_api.py, drone_api.py, detection_api.py (V1)
+-- database/
|   +-- db.py               # Engine + session
|   +-- models.py           # All SQLAlchemy models
|   +-- init_db.py          # create_all + idempotent ALTER IF NOT EXISTS
|   +-- tasks.py            # create_task_if_needed (V1)
+-- harvest/
|   +-- execution.py        # Single source: complete_item, advance_mission, finalize_mission
+-- navigation/
|   +-- mosaic_layout.py    # Backend port of computeMosaicLayout
|   +-- service.py          # RobotNavigator, NavigationService, NavigationPlan
+-- robot/
|   +-- state_machine.py    # RobotStateMachine, LEGAL_TRANSITIONS
+-- simulation/
|   +-- clock.py            # SimulationClock
|   +-- engine.py           # SimulationEngine (step(dt))
|   +-- scheduler.py        # SimulationScheduler
|   +-- config.py           # DEFAULT_SIMULATION_SPEED, BATTERY_DRAIN_PER_S
+-- telemetry/
|   +-- event_bus.py        # EventBus pub/sub
|   +-- service.py          # TelemetryService (append-only)
|   +-- websocket_gateway.py # WebSocketGateway (observe-only)
+-- analytics/
|   +-- mission_history.py  # Mission History & Analytics
+-- main.py                 # App assembly, CORS, router mounting, init_db()
+-- reset_runtime.py        # Utility
```

### 11.2 API Architecture

| Principle | Implementation |
|-----------|----------------|
| **Single API Client** | `frontend/lib/api/detection.ts` |
| **Router per Domain** | 18 routers; business logic in services |
| **No Duplicated Contracts** | API definitions live once |
| **Manual Migrations** | `init_db.py` runs at startup |
| **Legacy V1 Retained** | `Task`/`Detection` tables kept |

### 11.3 Key Business Logic Modules

| Module | Responsibility | Consumers |
|--------|----------------|-----------|
| `harvest/execution.py` | Single source of truth for harvest execution | Manual advance + SimulationScheduler |
| `navigation/service.py` | Pure movement planning | Scheduler, `GET /robot/navigation` |
| `robot/state_machine.py` | Only component mutating `robot.status` | SimulationEngine, `POST /robot/state` |
| `simulation/` | Pure deterministic executor | `POST/GET /robot/simulation` |
| `telemetry/` | EventBus, append-only writes, observe-only broadcast | Scheduler -> EventBus -> services |
| `analytics/mission_history.py` | Backend-owned analytics | `GET /robot/runs` + detail endpoints |

### 11.4 Data Processing Pipeline

See [Section 4.4 Data Flow](#44-data-flow-end-to-end-pipeline) for the complete end-to-end pipeline.

---

# Part V: Data and Structure

## 12. Database

### 12.1 Schema Overview (PostgreSQL via Neon)

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `survey_missions` | Drone survey missions | `is_active` = single ACTIVE mission |
| `survey_images` | Uploaded survey images | `mission_id` (plain int, no FK) |
| `survey_tiles` | Tile grid + metadata | `grid_row`, `grid_col`, `image_width`, `image_height`, `center_gps_lat/lon` |
| `trees` | Permanent tree records | `tree_code` (unique, write-once), `current_inventory_id`, `current_observation_id` |
| `tree_observations` | Mission-scoped observations | `tree_id` (RESTRICT FK), `survey_tile_id`, `local_pixel_{x,y}`, `bbox_*`, `confidence` |
| `inspections` | Robot visit sessions | `inspection_code` (unique), `tree_id` (RESTRICT FK) |
| `inspection_images` | Close-up coconut images | `inspection_id` (CASCADE FK) |
| `coconut_detections` | Ripeness detections | `inspection_image_id` (CASCADE FK), `detected_class` (lowercased) |
| `inventory_snapshots` | Immutable per-tree counts | `inspection_id` UNIQUE (nullable for post-harvest), `tree_id` (RESTRICT FK) |
| `harvest_missions` | Immutable harvest missions | `mission_code` (unique), `harvest_type`, `status` |
| `harvest_mission_items` | Ordered stops | `mission_id` + `tree_id` UNIQUE, `visit_order` |
| `robots` | Singleton robot | `status` (RobotState), `position_x/y` (farm-pixel) |
| `dock_stations` | Singleton dock | `farm_x`, `farm_y` |
| `robot_batteries` | 1:1 with Robot | `robot_id` (CASCADE FK, unique) |
| `robot_configurations` | 1:1 with Robot | `robot_id` (CASCADE FK, unique) |
| `robot_state_transitions` | Append-only history | `previous_state`, `next_state`, `reason`, `created_at` |
| `robot_telemetry` | Append-only per-tick | `robot_id`, `mission_id`, `sim_time`, `status`, `position_x/y`, `battery_pct` |
| `robot_events` | Append-only per-event | `event_type`, `detail` (JSON), `sim_time` |
| `robot_runs` | Derived summary | `mission_id`, `status`, analytics columns |

**Legacy V1 (Retained):** `detections`, `tasks`

### 12.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No FK on `Tree.current_inventory_id` / `current_observation_id` | Avoids circular FK at creation |
| `inspection_id` UNIQUE on `inventory_snapshots` | One snapshot per inspection (idempotent) |
| `harvest_mission_items` UNIQUE(mission_id, tree_id) | A tree never appears twice in one mission |
| `robot_state_transitions` append-only | Source for telemetry/playback/analytics |
| `robot_telemetry` / `robot_events` read-only | Never mutates authoritative `Robot` state |
| Manual migrations via `init_db.py` | `create_all` + idempotent `ALTER IF NOT EXISTS` |

### 12.3 Indexes & Performance

| Table | Indexes |
|-------|---------|
| `trees` | `tree_code` (unique), `current_inventory_id`, `current_observation_id` |
| `tree_observations` | `tree_id`, `survey_tile_id` |
| `inspections` | `tree_id`, `inspection_code` |
| `inventory_snapshots` | `tree_id`, `inspection_id` (unique) |
| `harvest_mission_items` | `mission_id`, `tree_id` (unique), `visit_order` |
| `robot_telemetry` | `robot_id`, `mission_id`, `sim_time` |
| `robot_events` | `robot_id`, `mission_id`, `event_type` |
| `robot_runs` | `robot_id`, `mission_id`, `status` |

---

## 13. Project Structure

### 13.1 Root Level

```
autonomous-coconut-harvester/
+-- AGENTS.md                 # Authoritative engineering guide
+-- ARCHITECTURE.md           # Component/dependency map
+-- CLAUDE.md                 # Claude-specific working notes
+-- CURRENT.md                # Version status, completed work
+-- DECISIONS.md              # Append-only architecture decisions
+-- ENGINEERING_WORKFLOW.md   # Implementation workflow
+-- PROJECT_SPECIFICATION.md  # Frozen specification (v1.0 Draft)
+-- PROJECT_DOSSIER.md        # This document
+-- README.md                 # Project overview, setup
+-- ROBOT_ARCHITECTURE.md     # Robot subsystem design (FROZEN)
+-- requirements.txt          # Python dependencies
+-- backend/                  # FastAPI service
+-- frontend/                 # Next.js UI
+-- models/                   # YOLO weights (gitignored)
+-- docs/archive/design-v1/   # Archived v1 design docs (OUTDATED — superseded)
+-- .engineering/             # Empty scaffolding
+-- assets/                   # Clips (gitignored) + prompts
+-- uploads/                  # Survey + inspection images (gitignored)
+-- venv/                     # Python virtual environment
```

### 13.2 Frontend (`frontend/`)

```
frontend/
+-- app/                      # Next.js App Router pages
|   +-- layout.tsx            # Root: fonts, SmoothScroll, AppShell
|   +-- page.tsx              # Landing (7 GSAP chapters)
|   +-- globals.css           # Tailwind v4 @theme tokens
|   +-- dashboard/            # Operational overview
|   +-- survey/               # Ingestion + detection
|   +-- map/                  # Digital Twin
|   +-- robot/                # Simulation control + history
|   |   +-- page.tsx          # Live robot
|   |   +-- history/          # Mission History
|   |       +-- page.tsx      # Run list
|   |       +-- [id]/page.tsx # Run detail (3 tabs)
|   +-- trees/                # Tree registry
|       +-- page.tsx          # Grid + filters
|       +-- [treeId]/page.tsx # Detail + coconut upload
+-- components/               # Reusable UI
|   +-- AppShell.tsx          # Navigation shell
|   +-- FarmMosaic.tsx        # Tile canvas
|   +-- FarmViewer.tsx        # Viewport stage
|   +-- OverlayLayer.tsx      # Tree boxes (presentation-only)
|   +-- TreeDetailsDrawer.tsx # Read-only tree panel
|   +-- DashboardFarmCard.tsx # Embedded twin thumbnail
|   +-- CoconutUploader.tsx   # Inspection image upload
|   +-- SmoothScroll.tsx      # Lenis provider
|   +-- AmbientClip.tsx       # Video backdrop
|   +-- robot/                # RobotLayer, RobotMarker, RobotPathLayer, RobotStatusCard, SimulationControls
+-- lib/
|   +-- api/detection.ts      # Single API client
|   +-- mosaicLayout.ts       # computeMosaicLayout (SHARED)
|   +-- useRobotSimulation.ts # WS hook
|   +-- usePagination.ts      # Client-side list pagination helper
|   +-- formatTime.ts         # IST (Asia/Kolkata) time formatters
+-- public/                   # Static assets
+-- package.json              # Next.js 16, React 19, Tailwind 4, GSAP, Lenis, Motion, Phosphor
```

### 13.3 Backend (`backend/`)

```
backend/
+-- api/                      # 18 FastAPI routers
+-- database/                 # SQLAlchemy models, engine, init_db
+-- harvest/execution.py      # Single source: complete_item, advance_mission, finalize_mission
+-- navigation/               # mosaic_layout.py + service.py
+-- robot/state_machine.py    # RobotStateMachine
+-- simulation/               # clock.py, engine.py, scheduler.py, config.py
+-- telemetry/                # event_bus.py, service.py, websocket_gateway.py
+-- analytics/mission_history.py # Mission History & Analytics
+-- main.py                   # App assembly
+-- requirements.txt
```

### 13.4 Design Documentation (`docs/archive/design-v1/` — ARCHIVED)

> **ARCHIVED / OUTDATED (July 2025).** The original design docs describe the
> tropical-dark direction and were never kept in sync with the implementation.
> Superseded — retained for history only; see `docs/archive/design-v1/README.md`.
> The current design source of truth is the implemented code (`frontend/app/globals.css`
> tokens + live pages/components).

| File | Purpose |
|------|---------|
| `01-design-constitution.md` | Product identity, philosophy, hard constraints |
| `02-brand-strategy.md` | Naming (Veraxis), voice, logo, brand world |
| `03-visual-style-guide.md` | Typography, grid, color, depth, glass, icons |
| `04-motion-language.md` | Timing, easing, scroll rhythm, micro-interactions |
| `05-storyboard.md` | Narrative arc: "See -> Know -> Watch -> Stand -> Watch -> Review -> Care" |
| `06-shot-list.md` | 7 video shots (S1-S7) with full spec |
| `07-page-ux-strategy.md` | Per-page purpose, journey, hierarchy, interactions |
| `08-component-philosophy.md` | 14 primitives + frozen components + anti-patterns |
| `09-asset-generation-strategy.md` | Asset inventory, medium decisions, never-AI list |
| `10-google-flow-guidelines.md` | Master prompt spec for all 7 clips |

---

# Part VI: How We Build

## 14. Engineering Workflow

### 14.1 Implementation Process (from [ENGINEERING_WORKFLOW.md](ENGINEERING_WORKFLOW.md))

```
1. Understand the requested feature and its intent
2. Read only relevant sections of PROJECT_SPECIFICATION.md
3. Inspect existing implementation before writing code
4. Identify affected files
5. Produce implementation plan (non-trivial scope)
6. Implement only approved scope
7. Review against plan + specification
8. Verify functionality before reporting completion
9. Update codebase-memory after success
10. Wait for commit approval
```

### 14.2 Design-First Workflow (Frontend)

```
 1. Design Constitution       -> Product identity, philosophy
 2. Brand Strategy            -> Naming, voice, logo, brand world
 3. Visual Style Guide        -> Typography, grid, color, depth
 4. Motion Language           -> Timing, easing, scroll rhythm
 5. Storyboard                -> Page-to-page emotional arc
 6. Shot List                 -> Every video shot fully specified
 7. Page UX Strategy          -> Per-page purpose, journey, hierarchy
 8. Component Philosophy      -> Reusable primitives, anti-patterns
 9. Asset Generation Strategy -> What assets needed, how produced
10. Google Flow Guidelines    -> Master prompt spec for all clips
11. Design Review             -> Pre-flight: taste-skill + emil + apple-design
12. Implementation            -> Build to spec
13. Playwright Validation     -> Run harness, confirm 0 console errors
14. Visual QA                 -> Inspect at 1024 + 390; reduced-motion
15. Iteration                 -> Refine until parity with design intent
16. TypeScript Verification   -> npx tsc --noEmit (0 errors)
17. Production Build          -> npx next build succeeds
18. Completion                -> Await commit approval
```

### 14.3 Core Principles

- Architecture frozen unless explicitly revised
- Prefer extending existing code over creating unnecessary abstractions
- Keep changes cohesive and minimal
- Preserve backwards compatibility
- Keep commits small and focused
- Explain engineering decisions when introducing new behaviour

### 14.4 Tool Usage Policy

| Tool | When to Use |
|------|-------------|
| `codebase-memory` | Module dependencies, affected files |
| `Context7` | Framework/library/SDK/API docs only |
| `Playwright` | User-visible behaviour changes |
| Installed Skills | Only relevant to task |

### 14.5 Quality Gates (Definition of Done)

A feature is complete only if:
- Implementation matches `PROJECT_SPECIFICATION.md`
- Existing functionality still works
- No duplicated logic introduced
- Relevant tests pass
- Manual verification completed
- Playwright verification completed (if UI changed)
- `codebase-memory` updated
- Summary produced

---

## 15. Design System

### 15.1 Typography

| Role | Font | Usage |
|------|------|-------|
| Display / UI Sans | **Geist** (self-hosted) | Headlines, UI text, buttons |
| Data / Code / Coordinates | **Geist Mono** | Tree codes, GPS, battery %, counts |
| Tabular Figures | `font-variant-numeric: tabular-nums` | All metrics (mandatory) |

**Scale:**
- Base: 16px, line-height 1.5
- Display: `clamp(2rem, 5vw, 3.5rem)`, line-height 1.05, letter-spacing -0.02em
- Min body: 12px; never gray-on-gray

### 15.2 Spacing & Grid

| Property | Value |
|----------|-------|
| Container | `max-w-[1400px] mx-auto`, `px-4` mobile -> `px-8` desktop |
| Breakpoints | `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536` |
| Layout Engine | CSS Grid (never flex-percentage math) |
| Spacing Scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 |
| Min-height | Heroes use `min-h-[100dvh]` (never `h-screen`) |

### 15.3 Color Palette (Tropical-Dark)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0e120d` | Page background (canopy near-black) |
| `--surface` | `#161b16` | Cards / panels |
| `--surface-raised` | `#1d241d` | Popovers, raised chips |
| `--surface-sunken` | `#10140f` | Insets, code blocks |
| `--border` | `#2a322a` | Hairline dividers |
| `--text` | `#E8EDE6` | Primary text (warm off-white) |
| `--text-muted` | `#9aa89a` | Secondary (>=4.5:1 on `--surface`) |
| `--accent` | `#3FB8B0` | Drone-scan cyan-teal (live/active/scan/primary action ONLY) |
| `--accent-weak` | `#1d3b39` | Accent tint backgrounds |
| `--leaf` | `#6F9A4D` | Leaf green (health/positive/mature) |
| `--husk` | `#C9B78A` | Coconut-husk cream (warmth) |
| `--warn` | `#D8A24A` | Amber (selected tree, attention) |
| `--danger` | `#C25B4E` | Error/destructive only (rare) |

**Rules:** One accent per page. No glow. Single dark theme.

### 15.4 Corner Radius (Locked)

| Element | Radius |
|---------|--------|
| Cards / Panels | 12px |
| Inputs / Chips | 8px |
| Buttons (Primary) | Full pill (`9999px`) |
| Icon Buttons / FABs | Full circle |

### 15.5 Depth & Elevation

- No pure-black shadows (tinted to background hue)
- Elevation via layered near-black values
- Shadow: `0 1px 0 rgba(255,255,255,0.04) inset` + `0 8px 24px rgba(0,0,0,0.35)` tinted

### 15.6 Glass Usage (Restrained)

- Allowed **only** as floating functional layer over moving imagery
- `backdrop-filter: blur(20px) saturate(160%)` + `rgba(...,0.6)`
- Solid fallback under `prefers-reduced-transparency`
- **Never** default card material

### 15.7 Motion System

| Tier | Frequency | Treatment |
|------|-----------|-----------|
| Ambient (hero, twin) | Always | Real footage; loops seamlessly |
| Entry / Reveal | On scroll, once | Subtle fade + 8-16px rise, staggered 30-60ms |
| Feedback (press, hover) | Tens x / day | 100-160ms scale/color, ease-out |
| State Change (drawer, modal) | Occasional | 200-300ms, origin-aware (spring: damping 1.0, response 0.3) |
| Story (mission progress) | Rare | Scroll-driven / continuous |
| Keyboard Actions | 100 x / day | **NO animation** |

**Easings:**
- `--ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)` — UI feedback
- `--ease-in-out`: `cubic-bezier(0.77, 0, 0.175, 1)` — on-screen movement
- `--ease-drawer`: `cubic-bezier(0.32, 0.72, 0, 1)` — iOS-like sheet

**Press Feedback:** `scale(0.97)` on `:active`, `transition: transform 100-160ms ease-out`

### 15.8 Navigation

- **Desktop:** Left rail (7 items), specific labels
- **Mobile:** Bottom tab bar (5 primary) + "More" overflow
- **Icons:** Phosphor Icons, `strokeWidth=1.5`
- **Transition:** Direction-aware (forward = slide right, back = slide left), 250-300ms

### 15.9 Accessibility

| Requirement | Standard |
|-------------|----------|
| Text Contrast | >=4.5:1 (AA), large display >=3:1 |
| Motion | `prefers-reduced-motion` mandatory |
| Transparency | `prefers-reduced-transparency` -> solid surfaces |
| Keyboard | Focus rings visible; `aria-label` on icon-only controls |
| Type | Base 16px, line-height 1.5; semantic color tokens |

---

# Part VII: Quality and Operations

## 16. Assets

### 16.1 Video Clips (Google Flow / Veo)

| ID | Asset | Page | Medium | Spec |
|----|-------|------|--------|------|
| A1 | `brand-hero-aerial-survey` | `/` hero | Google Flow (S1) | 8s, play-once, slow push-in, golden hour |
| A2 | `dashboard-farm-overview` | `/dashboard` backdrop | Google Flow (S2) | 6s, seamless loop, dawn, mist lifting |
| A3 | `survey-drone-flight` | `/survey` hero | Google Flow (S3) | 7s, seamless loop, side-track drone |
| A4 | `twin-digital-reveal` | `/map` orientation | Google Flow (S4) | 7s, play-once, real->twin morph |
| A5 | `robot-climb-harvest` | `/robot` hero | Google Flow (S5) | 8s, play-once, ring-climber ascending |
| A6 | `history-harvest-recap` | `/robot/history` backdrop | Google Flow (S6) | 6s, seamless loop, warm golden |
| A7 | `trees-health-detail` | `/trees` hero | Google Flow (S7) | 6s, seamless loop, intimate palm |

**Filenames:** `assets/clips/<shot>.mp4` (16:9, >=1080p)
**Prompts:** `assets/prompts/<NN>-<shot>.md` (standardized per the archived [design-v1 Google Flow guidelines](docs/archive/design-v1/10-google-flow-guidelines.md))

### 16.2 Real Photography (Backend-Served)

| Asset | Source | Usage |
|-------|--------|-------|
| Survey tile images | Backend (`/survey/uploads/...`) | Mosaic, dashboard, survey |
| Inspection images | Backend (`/inspection/uploads/...`) | Tree Details, `/trees` |

### 16.3 Constructed / SVG

| Asset | Method |
|-------|--------|
| Leaf-reticle logo | Constructed SVG (only hand-built mark allowed) |
| Wordmark | Type (Geist), no gradient |
| Route / state-machine diagrams | SVG primitives / chart lib |
| Battery ring, status dots | SVG primitive |

### 16.4 Icons

| Library | Family | Standardization |
|---------|--------|-----------------|
| Phosphor Icons | `@phosphor-icons/react` | `strokeWidth=1.5` globally |
| Tabler | Alternate | If missing glyph |

### 16.5 Fonts

| Font | Method | Purpose |
|------|--------|---------|
| Geist | `next/font` (self-hosted) | Display / UI sans |
| Geist Mono | `next/font` (self-hosted) | Data / code / coordinates |

### 16.6 Assets That Must NEVER Be AI-Generated

- Leaf-reticle logo (constructed)
- Survey tile + inspection imagery (real backend)
- Icons (library)
- Diagrams (SVG primitives)
- Any UI chrome, buttons, cards (components)
- Fake screenshots / div-based mockups

---

## 17. Testing

### 17.1 Verification Policy (from [AGENTS.md](AGENTS.md))

| Layer | Command | Acceptance |
|-------|---------|------------|
| **Backend** | `venv/bin/python -m py_compile` on changed modules | No regressions |
| **Frontend TypeScript** | `npx tsc --noEmit` | **0 errors** |
| **Production Build** | `npx next build` | **Succeeds** |
| **Playwright** | `verify_v26.js`, `verify_v361.js`, etc. | **Expected passes + 0 console errors** |
| **Manual Verification** | Click through affected flow | Actual rendered behaviour confirmed |

### 17.2 Playwright Test Harnesses

| Script | Purpose |
|--------|---------|
| `verify_console.js` | Generic console error check |
| `verify_v251.js` | V2.5.1 regression |
| `verify_v26.js` | Digital Twin regression |
| `verify_v36.js` | Robot visualization |
| `verify_v361.js` | Robot visualization (updated) |
| `verify_v371.js` | Mission History & Analytics |

### 17.3 Testing Strategy

| Type | Approach |
|------|----------|
| **Backend** | API verification, database verification, unit tests where appropriate |
| **Frontend** | Manual verification + Playwright for user workflows |
| **Automated Tests** | Do not generate unnecessary automated tests |
| **Regression** | Re-run prior version's Playwright suite |

### 17.4 Visual QA Checklist

- [ ] 0 console errors at 1024px + 390px
- [ ] `prefers-reduced-motion` -> static/cross-fade
- [ ] `prefers-reduced-transparency` -> solid surfaces
- [ ] `prefers-contrast: more` -> defined borders
- [ ] Focus rings visible on all interactive elements
- [ ] `aria-label` on icon-only controls
- [ ] Tabular numbers on all metrics
- [ ] No horizontal overflow at any breakpoint

---

## 18. Performance

### 18.1 Frontend Optimizations

| Technique | Implementation |
|-----------|----------------|
| **FarmMosaic Memoization** | `React.memo`; no re-render during pan/zoom |
| **Stage Transform** | Single `transform` on stage `<div>` via ref |
| **Counter-Scaling** | Inline styles recomputed on scale change |
| **Viewport Culling** | Prototyped; farm-pixel inverse transform |
| **Zoom LOD** | Labels hide below threshold |
| **Code Splitting** | Next.js App Router automatic splitting |
| **Font Optimization** | `next/font` self-hosted with `display: swap` |
| **Video** | `<video autoplay muted loop playsinline>` with priority for LCP |

### 18.2 Backend Optimizations

| Technique | Implementation |
|-----------|----------------|
| **Bulk Write (V2.1)** | `executemany` + `bulk_insert_mappings` |
| **N+1 Elimination** | Bulk join `tree_code` in `GET /mission/{id}/trees` |
| **Eager Loading** | Grouped queries for tiles |
| **Deterministic Simulation** | Pure `step(dt)` enables replay without DB |
| **Append-Only Telemetry** | Never mutated; read-side only |
| **Server-Side Analytics** | All metrics from raw telemetry/events |
| **Relationship Eager Loading (perf)** | `HarvestMissionItem.tree` is `lazy="selectin"` (was one lazy SELECT per item across list/detail/status + every command response) |
| **SQL LIMIT Pushdown (perf)** | `build_robot_log` fetches only the newest `limit` events in the DB, not the whole `robot_events` time-series sliced in Python |
| **SQL Pagination + Aggregates (perf)** | `/mission/{id}/permanent-trees` pages `LIMIT/OFFSET` and computes `total`/`newly_created`/`matched_existing`/`avg_conf` via `COUNT`/`AVG` instead of materialising the full `.all()` |
| **Single-Pass Timing (perf)** | `build_timeline` travel distance and `build_tree_activity.battery_at` moved from O(N·T) per-tree/per-segment full-telemetry rescans to a single forward pass / bisect (O(N)/O(log N)) |
| **Column Projection (perf)** | `/trees/summary` projects only the id/GPS columns the payload needs instead of whole ORM rows |
| **Collapsed Aggregates (perf)** | Dashboard overview card counts fold 5 sequential queries into one labeled query |
| **Hot-Path Indexes (perf)** | Idempotent `CREATE INDEX IF NOT EXISTS` on `trees(last_seen_mission_id)`, `trees(first_seen_mission_id)`, `trees(current_observation_id)`, `survey_missions(created_at)`, `robot_runs(finished_at)`, and composite `robot_telemetry(robot_id, mission_id, sim_time)` / `robot_events(robot_id, mission_id, sim_time)` |

**Root cause of hot-read latency:** the floor is Neon serverless Postgres round-trips (~2 s warm, higher on cold scale-to-zero) — a network-layer cost no query rewrite removes. Above that floor the read paths compounded it: N+1 relationship loads, unbounded time-series/row loads sliced in Python, O(N·T) telemetry rescans, and missing indexes on hot filter/order/join columns. The fixes cut both round-trip count and per-query CPU while keeping response shapes, routes, and the frontend contract byte-identical.

### 18.3 Known Performance Characteristics

| Metric | Value |
|--------|-------|
| Tree Count (Demo) | 302 |
| Mosaic Render | 60 FPS (DOM approach) |
| 302-row Batched UPDATE | ~80s on Neon (round-trip dominated) |
| Overlay DOM Nodes | ~900 (3 per tree) at 302 trees |
| Simulation Speed | 60x |
| Battery Drain | ~1% per real-second at 60x |

### 18.4 Scaling Strategy (V2.6+)

| Trigger | Response |
|---------|----------|
| Box counts exceed DOM threshold | Canvas/WebGL swap |
| Viewport culling needed | Farm-pixel inverse transform |
| LOD needed | Labels -> centroids -> dots |
| Real robot integration | Replace `RobotSimulationEngine` only |

---

## 19. Security

### 19.1 Current State (V1 Security)

| Aspect | Status |
|--------|--------|
| **Authentication** | None (V1) |
| **Authorization** | None |
| **Input Validation** | Pydantic models on all endpoints |
| **Secrets Management** | `.env` (gitignored) |
| **Model Weights** | Gitignored, local only |
| **CORS** | Configured via `CORS_ORIGINS` |
| **WebSocket** | Observe-only `/ws/robot` |

### 19.2 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL/Neon connection string |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `NEXT_PUBLIC_API_BASE_URL` | No | Frontend -> backend URL (default: `http://localhost:8000`) |

### 19.3 Security Considerations (Future)

| Area | Planned |
|------|---------|
| Authentication | Not in current scope |
| API Rate Limiting | Not implemented |
| Input Sanitization | Pydantic validates all request bodies |
| File Upload | Stored on disk under `uploads/` |
| Database | Neon managed PostgreSQL |

---

# Part VIII: Status and Future

## 20. Current Status

### 20.1 Release Summary: V3.8.7

**Veraxis V3.8.7** represents the culmination of the Version 3 development line. All subsystems from drone survey ingestion through digital twin rendering, ripeness inspection, harvest planning, robot simulation, mission history, and premium UI redesign are implemented and verified.

| Dimension | Status |
|-----------|--------|
| **Version** | V3.8.7 (Project Version 3.8.7) |
| **Architecture** | Frozen at V2.0 (Digital Twin); V3 baseline frozen at V3.0 |
| **All Code Verified** | Playwright 0 console errors, `tsc --noEmit` / `next build` clean |
| **Commit Status** | **Not yet committed** — awaiting explicit approval per workflow |
| **Known Regressions** | None |
| **Breaking Changes** | None |

### 20.2 Subsystem Status

| Subsystem | Version | Status | Notes |
|-----------|---------|--------|-------|
| Drone Survey + Tree Matching | V1 | Complete | GPS/geometry deduplication, permanent trees |
| Digital Twin Farm Viewer | V2.0 (FROZEN) | Complete | V2.1-V2.7 all implemented |
| Inventory Snapshot Builder | Feature 9 | Complete | Immutable per-tree counts |
| Harvest Planner + Mission | Feature 10 | Complete | Nearest-Neighbour, immutable |
| Robot Mission Execution | Feature 11 | Complete | Full lifecycle |
| Dashboard & Overview | Feature 12 | Complete | Operational overview |
| Robot Domain | V3.1 | Complete | Domain model, CRUD |
| Navigation | V3.2 | Complete | Pure movement planning |
| State Machine | V3.3/V3.3.1 | Complete | Frozen transitions, error handling |
| Simulation Engine | V3.4 | Complete | Deterministic step(dt) |
| Telemetry & WebSocket | V3.5/V3.5.1 | Complete | EventBus, WS gateway |
| Live Robot Visualization | V3.6/V3.6.1 | Complete | RobotLayer, counter-scaled |
| Mission History & Analytics | V3.7/V3.7.1 | Complete | Backend-owned operations center |
| Workflow Integration | V3.7.2 | Complete | Auto-start, execution.py |
| Speed & Battery Calibration | V3.7.3 | Complete | 60x default, 1%/sec drain |
| Premium Navigation | V3.8.1 | Complete | AppShell (desktop rail + mobile bottom nav) |
| Timeline Tab Redesign | V3.8.2 | Complete | Vertical rail, Phosphor, tabular |
| Robot Log Tab Redesign | V3.8.3 | Complete | Terminal frame, WCAG severity |
| Home Page Redesign | V3.8.4 | Complete | 7 GSAP chapters, Lenis, Apple Liquid Glass |
| Production Hardening | V3.8.5-V3.8.7 | Complete | Review, N+1, WS, dead-code, docs sync |

### 20.3 Stable Modules

- **Backend:** All API routers, `harvest/execution.py`, `navigation/service.py`, `robot/state_machine.py`, `simulation/`, `telemetry/`, `analytics/mission_history.py`
- **Frontend:** All 9 routes, `AppShell`, `FarmViewer`/`FarmMosaic`/`OverlayLayer`/`TreeDetailsDrawer`, `RobotLayer`, `SmoothScroll`, `AmbientClip`
- **Database:** All V2/V3 tables, `init_db.py` migrations
- **ML:** Both YOLOv8 models (local, gitignored)

### 20.4 Experimental / In-Progress

- **Viewport Culling + Zoom LOD** — Prototyped for V2.6; not yet enabled
- **Canvas/WebGL Renderer Swap** — Sanctioned by spec; not yet needed
- **Real Drone Flight Planner** — Future: mission-scoped on `SurveyMission`

### 20.5 Known Limitations

| Limitation | Context |
|------------|---------|
| No authentication | All endpoints open (V1) |
| Single robot / single farm | Singleton `Robot`/`DockStation` |
| No real GPS hardware | GPS derived from Flight Planner geometry |
| Model weights gitignored | No versioning/distribution strategy |
| Legacy V1 `Task`/`Detection` retained | Mounted in `main.py` |
| DOM overlay at ~300 trees | 60 FPS now; won't scale without culling/Canvas |
| Neon DB latency | Batched UPDATE ~80s for 302 rows |

### 20.6 Known Issues

| Issue | Status |
|-------|--------|
| `requirements.txt` complete backend manifest | Fixed in V3.8.4 |
| `.gitignore` hardened | Fixed in V3.8.5 |
| Lightning CSS v4 `backdrop-filter` bug | Workaround: `@supports` guard in globals.css |
| Em-dashes in landing copy | Removed in V3.8.7 (zero em-dashes enforced) |

---

## 21. Future Roadmap

*Based solely on existing repository documentation (PROJECT_SPECIFICATION.md, DECISIONS.md, ROBOT_ARCHITECTURE.md)*

### 21.1 Near-Term (Documented)

| Item | Source | Details |
|------|--------|---------|
| **Mission-Scoped PlannerConfig** | DECISIONS.md | Store `PlannerConfig` on `SurveyMission` |
| **Viewport Culling + Zoom LOD** | PROJECT_SPECIFICATION.md | For farms with thousands of trees |
| **Backend Unit Tests** | CURRENT.md | Task-generation / ripeness logic |
| **Real Geotagging** | CURRENT.md | Currently GPS derived from box position |
| **Model Versioning / Distribution** | CURRENT.md | Weights are gitignored; no strategy yet |
| **"Locate on Twin" Pan-to-Tree** | CURRENT.md | Read-only action in Tree Details Drawer |

### 21.2 Medium-Term (Specified in Spec)

| Item | Source | Details |
|------|--------|---------|
| **Verification Scans** | PROJECT_SPECIFICATION.md | Post-harvest re-inspection |
| **Multiple Farms** | ROBOT_ARCHITECTURE.md | Singleton guard makes this additive |
| **Advanced Routing** | ROBOT_ARCHITECTURE.md | MST / TSP variants |
| **Predictive Analytics** | ROBOT_ARCHITECTURE.md | Yield forecasting, battery health |

### 21.3 Long-Term (Architecture Permits)

| Item | Source | Details |
|------|--------|---------|
| **Real Robot Swap** | ROBOT_ARCHITECTURE.md | Replace only `RobotSimulationEngine` |
| **Multi-Robot** | ROBOT_ARCHITECTURE.md | Additive (singleton guard) |
| **Multi-Farm** | ROBOT_ARCHITECTURE.md | Additive |
| **SLAM / GPS Localiser** | ROBOT_ARCHITECTURE.md | Currently excluded; would require revision |

### 21.4 Explicitly NOT in Roadmap (Frozen Exclusions)

Per PROJECT_SPECIFICATION.md and ROBOT_ARCHITECTURE.md:
- ROS integration
- SLAM
- Multi-robot (currently)
- Live drone telemetry
- Physical autonomous navigation
- Hardware control
- Authentication / Authorization

---

## 22. Lessons Learned

### 22.1 Major Architectural Choices

| Decision | Trade-off | Why It Worked |
|----------|-----------|---------------|
| **Two Robots (Drone + Climber)** | More complex system | Matches physics: coarse+cheap vs fine+expensive |
| **Farm-Pixel Coordinate System** | Custom transform logic | Single spatial truth for Twin, Overlay, Robot, Navigation |
| **Immutable Harvest Mission** | No re-planning mid-mission | Audit trail; adapters (no duplicate queue) |
| **Append-Only Telemetry** | Storage growth | Enables replay, benchmarking, deterministic analytics |
| **Renderer Freeze (Decision 6)** | DOM performance ceiling | 302 trees, 60 FPS validates current approach |
| **Flight Planner Owns Geometry** | Simulated planner | Deterministic; real autopilot slots behind same interface |

### 22.2 Design Evolution

| Phase | Problem | Resolution |
|-------|---------|------------|
| **V1 UI Rejection (3/10)** | Generic AI dashboard: interchangeable cards, purple glow | Design Constitution + 5 premium design skills |
| **V2 Mosaic Ragged Edge** | `ceil(sqrt(n))` grid -> black voids | Flight Planner owns geometry; explicit `PlannerConfig` |
| **N+1 Query in Tree Overlay** | Lazy `o.tree.tree_code` exhausted pool | Bulk join in `GET /mission/{id}/trees` |
| **Lightning CSS `backdrop-filter` Bug** | Unprefixed property collapsed | `@supports` guard; solid fallbacks |
| **Home Page Animation Conflict** | Dual `data-reveal` + GSAP scrub fought | Single motivated GSAP reveal |

### 22.3 Key Engineering Practices Established

1. **Backend owns logic, frontend owns craft** — `computeMosaicLayout`, `detection.ts`, Playwright `data-testid`s frozen
2. **Design-first workflow** — 10 design docs before implementation; pre-flight review
3. **Browser-first verification** — Playwright + manual inspection at 1024+390; 0 console errors = acceptance bar
4. **Documentation as code** — `CURRENT.md` = version status; `DECISIONS.md` = append-only; `PROJECT_SPECIFICATION.md` = frozen
5. **Single source of truth** — `harvest/execution.py` shared by manual + simulation; `computeMosaicLayout` shared by frontend + backend

---

# Appendix

## A. Glossary

| Term | Definition |
|------|------------|
| **Veraxis** | Autonomous Coconut Harvesting Platform (product name) |
| **Farm-Pixel** | Primary coordinate system (shared by Twin, Overlay, Robot, Navigation) |
| **SurveyMission** | Drone survey ingestion batch (tiles, images, detections) |
| **SurveyTile** | One gridded image from survey (persisted `grid_row/col`) |
| **Tree** | Permanent tree record (global `tree_code`, GPS, lifecycle) |
| **TreeObservation** | Mission-scoped representative detection |
| **Inspection** | Climbing robot visit to one tree (session lifecycle) |
| **InspectionImage** | Close-up coconut image for an inspection |
| **CoconutDetection** | Temporary ripeness detection (Mature/Potential/Premature) |
| **InventorySnapshot** | Immutable per-tree coconut counts (replace-on-scan) |
| **HarvestMission** | Immutable harvest plan (header + ordered items) |
| **HarvestMissionItem** | One ordered stop (one tree, `visit_order`) |
| **Robot** | Singleton simulated harvester |
| **DockStation** | Singleton home/charging point |
| **SimulationClock** | Deterministic sim-time (`sim = wall x speed_factor`) |
| **SimulationEngine** | Pure `step(dt)` executor |
| **SimulationScheduler** | Wall-clock thread driver |
| **RobotTelemetry** | Append-only per-tick state snapshot |
| **RobotEvent** | Append-only per-simulation-event log |
| **RobotRun** | Derived summary per terminated run |
| **AppShell** | Navigation shell (desktop rail + mobile bottom nav) |
| **FarmViewer** | Viewport component (transform stage) |
| **FarmMosaic** | Tile canvas (absolutely-positioned images) |
| **OverlayLayer** | Tree boxes (presentation-only, counter-scaled) |
| **TreeDetailsDrawer** | Read-only tree panel |
| **RobotLayer** | Additive robot visualization |

## B. Folder Reference

| Path | Purpose |
|------|---------|
| `backend/api/` | 18 FastAPI routers |
| `backend/database/` | SQLAlchemy models, engine, `init_db.py` |
| `backend/harvest/` | `execution.py` (single source of truth) |
| `backend/navigation/` | `mosaic_layout.py`, `service.py` |
| `backend/robot/` | `state_machine.py` |
| `backend/simulation/` | `clock.py`, `engine.py`, `scheduler.py`, `config.py` |
| `backend/telemetry/` | `event_bus.py`, `service.py`, `websocket_gateway.py` |
| `backend/analytics/` | `mission_history.py` |
| `frontend/app/` | 9 routes (Next.js App Router) |
| `frontend/components/` | Reusable UI components |
| `frontend/lib/` | `api/detection.ts`, `mosaicLayout.ts`, `useRobotSimulation.ts`, `usePagination.ts`, `formatTime.ts` |
| `docs/archive/design-v1/` | Archived v1 design docs (OUTDATED — superseded) |
| `models/` | YOLO weights (gitignored) |
| `uploads/` | Survey + inspection images (gitignored) |

## C. Route Reference

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing (7 GSAP chapters) |
| `/dashboard` | `app/dashboard/page.tsx` | Operational overview |
| `/survey` | `app/survey/page.tsx` | Survey ingestion + detection |
| `/map` | `app/map/page.tsx` | Digital Twin (single farm viewer) |
| `/robot` | `app/robot/page.tsx` | Robot simulation control |
| `/robot/history` | `app/robot/history/page.tsx` | Mission History list |
| `/robot/history/[id]` | `app/robot/history/[id]/page.tsx` | Run detail (3 tabs) |
| `/trees` | `app/trees/page.tsx` | Tree registry grid |
| `/trees/[treeId]` | `app/trees/[treeId]/page.tsx` | Single-tree detail + upload |

## D. API Reference

| Router | Key Endpoints |
|--------|---------------|
| `survey_api` | `POST /mission/create`, `GET /missions`, `GET /mission/{id}/tiles`, `GET /mission/{id}/trees`, `POST /detect/trees` |
| `inspection_api` | `POST /inspection/...`, `POST /inspection/{id}/images`, `GET /inspection/{id}` |
| `harvest_mission_api` | `POST /harvest/missions`, `GET /harvest/missions`, `POST /harvest/missions/{id}/start/advance/pause/resume/cancel` |
| `robot_domain` | `GET /robot`, `GET /robot/state`, `POST /robot/reset/recharge/speed` |
| `robot_navigation` | `GET /robot/navigation`, `GET /robot/navigation/plan` |
| `robot_simulation` | `POST /robot/simulation`, `GET /robot/simulation`, `GET /robot/simulation/config` |
| `robot_telemetry` | `GET /robot/telemetry`, `GET /robot/telemetry/events` |
| `robot_history` | `GET /robot/runs`, `GET /robot/runs/{id}`, `GET /robot/runs/{id}/timeline`, `GET /robot/runs/{id}/tree-activity`, `GET /robot/runs/{id}/robot-log` |
| `dashboard_api` | `GET /dashboard/overview` |
| `tree_api` | `GET /trees/summary`, `POST /detect/trees` |
| `coconut_api` | `POST /detect/coconuts` |
| `flight_planner` | `PlannerConfig`, waypoint generation |
| `gps_projection` | `project_tile_center_gps` |

## E. Component Reference

| Component | Purpose | Key Props/State |
|-----------|---------|-----------------|
| `AppShell` | Navigation shell | `children`, `pathname`, `moreOpen` |
| `FarmMosaic` | Tile canvas | `tiles`, `gap` |
| `FarmViewer` | Viewport stage | `children`, `initialScale`, `initialTreeId`, `expandHref` |
| `OverlayLayer` | Tree boxes | `trees`, `onTreeSelect`, `selectedTreeId`, `scale` |
| `TreeDetailsDrawer` | Read-only panel | `treeId`, `onClose` |
| `DashboardFarmCard` | Embedded twin | `expandHref="/map"` |
| `CoconutUploader` | Image upload | `onUpload`, `inspectionId` |
| `SmoothScroll` | Lenis provider | `children` |
| `AmbientClip` | Video backdrop | `src`, `loop`, `muted` |
| `RobotLayer` | Robot visualization | `robot`, `mission`, `navigationPlan` |
| `RobotMarker` | Robot icon | `position`, `heading`, `scale` |
| `RobotPathLayer` | Planned path | `waypoints`, `currentIndex`, `scale` |
| `RobotStatusCard` | State + battery | `robot`, `battery` |
| `SimulationControls` | Start/pause/speed | `onStart`, `onPause`, `onSpeedChange` |

## F. Model Reference

| Model | File | Task | Classes |
|-------|------|------|---------|
| Tree Detector | `models/tree_model/tree_detector.pt` | Object detection (top-down) | `tree` |
| Coconut Detector | `models/coconut_model/coconut_detector.pt` | Object detection (close-up) | `Mature`, `Potential`, `Premature` |

## G. Documentation Index

| File | Type | Description |
|------|------|-------------|
| `AGENTS.md` | Living | Authoritative engineering guide |
| `CLAUDE.md` | Living | Claude-specific working notes |
| `CURRENT.md` | Living | Version status, completed work |
| `DECISIONS.md` | Append-only | Architecture decisions (never delete) |
| `ENGINEERING_WORKFLOW.md` | Workflow | Implementation process, quality gates |
| `README.md` | Living | Project overview, setup |
| `ARCHITECTURE.md` | Architecture Contract | Component/dependency map |
| `PROJECT_SPECIFICATION.md` | Specification | Frozen spec (v1.0 Draft) |
| `ROBOT_ARCHITECTURE.md` | Architecture Contract | Robot subsystem design (FROZEN) |
| `PROJECT_DOSSIER.md` | This Document | Definitive engineering handbook |
| `frontend/README.md` | Living | Frontend-specific overview |

## H. Design Document Index

| Doc | Title | Purpose |
|-----|-------|---------|
| `01` | Design Constitution | Product identity, philosophy, hard constraints |
| `02` | Brand Strategy | Naming (Veraxis), voice, logo, brand world |
| `03` | Visual Style Guide | Typography, grid, color, depth, glass, icons |
| `04` | Motion Language | Timing, easing, scroll rhythm, transitions |
| `05` | Storyboard | Page-to-page emotional arc |
| `06` | Shot List | 7 video shots (S1-S7) |
| `07` | Page UX Strategy | Per-page purpose, journey, interactions |
| `08` | Component Philosophy | 14 primitives + frozen components |
| `09` | Asset Generation Strategy | Asset inventory, medium decisions |
| `10` | Google Flow Guidelines | Master prompt spec for all 7 clips |

---

*End of PROJECT_DOSSIER.md — The definitive engineering handbook for the Veraxis Autonomous Coconut Harvesting Platform.*
