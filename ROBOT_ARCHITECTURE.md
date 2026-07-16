# ROBOT_ARCHITECTURE.md

> **Status: FROZEN — approved baseline specification for Version 3. No production code.**
> Companion to `PROJECT_SPECIFICATION.md` Appendix A (Version 3 Robot Simulation,
> FROZEN). Version 2 (Digital Twin) is frozen and complete. This document records
> the robot subsystem design so Version 3 can be implemented without carrying
> unnecessary technical debt. All frozen exclusions (§5) stand: **no ROS, no SLAM,
> no multi-robot, no live drone telemetry, no physical autonomous navigation, no
> hardware control, no auth.** The robot is a **simulator** satisfying the same
> HTTP/WebSocket contract a real robot would.

---

## 1. Robot Subsystem Overview

One **simulated, time-driven harvesting robot** executes a `HarvestMission` on the
frozen Digital Twin. The **backend owns all robot behaviour** (lifecycle, navigation,
state machine, mission execution, battery, telemetry, events); the frontend only
visualizes backend state. The robot is a simulator — its movement is geometric
interpolation on the farm-pixel plane, not perception-and-control.

The subsystem is composed of:
- a **domain** (persisted robot/dock/battery/telemetry/event entities),
- a **controller** (state machine + command handling),
- a **navigator** (pure movement planning),
- a **simulation engine + clock** (time-based execution),
- a **telemetry pipeline** (WebSocket live stream + persisted history),
- **frontend visualization** (additive overlay on the twin).

## 1.1 Robot Core Rule — Determinism

**Robot execution must be deterministic.**

Given:
- an identical `HarvestMission`,
- an identical `SimulationClock` (same `speed_factor`, same pause/resume sequence),
- an identical Planner configuration,

the Robot must **always** produce the same sequence of:
- `RobotEvent`s,
- `RobotTelemetry` samples,
- `RobotState` transitions,
- harvest completion order.

**No randomness is allowed** unless it is explicitly injected through a dedicated
simulation module (e.g. a `NoiseModule` / `FaultInjector` wired in deliberately for
stress testing). By default the engine is a pure function of its inputs.

### Why this rule matters

Determinism is one of the biggest advantages a *simulator* has over real hardware, and
it should be treated as a first-class invariant, not an accident:

- **Replay bugs.** A failing run can be reproduced exactly by replaying the same
  mission + clock + planner config, then inspected frame-by-frame from the persisted
  `RobotEvent` / `RobotTelemetry` history.
- **Unit test.** The engine is testable without a clock or a database — feed a start
  state + `dt` steps and assert the exact transition/telemetry sequence.
- **Compare executions.** Two planner variants (e.g. NN vs a future MST route) can be
  run on the same mission and diffed objectively on completion order, utilisation, and
  battery draw.
- **Benchmark planners.** Deterministic runs give stable, repeatable metrics instead
  of noisy timings.
- **Swap in a real robot.** Because the *expected* sequence is fully determined by the
  contract (mission + clock + planner config), a real robot's behaviour can be
  validated against the simulator's golden sequence — the simulator becomes the
  reference oracle.

The pure `step(dt)` design (§5) is what makes this possible: the same
`(state, dt)` always yields the same `new_state`, so live, replay, and tests share one
code path with no branching for "live vs recorded".

## 2. Domain Model

Genuinely new persisted entities:

| Entity | Kind | Key fields |
|---|---|---|
| `Robot` | new table (singleton) | `id`, `name`, `status` (RobotState), `position_x`, `position_y` (farm-pixel), `heading_deg`, `current_mission_id`, `current_task_id`, `battery_id`, `dock_id` |
| `DockStation` | new table (singleton) | `id`, `farm_x`, `farm_y`, `label` |
| `RobotBattery` | new table | `robot_id`, `pct`, `status` (CHARGING/DISCHARGING/IDLE), `last_change_ts` |
| `RobotTelemetry` | new table (time-series) | `robot_id`, `ts`, `state`, `pos_x`, `pos_y`, `battery_pct`, `current_task_id`, `speed` |
| `RobotEvent` | new table (append-only) | `robot_id`, `ts`, `type`, `payload_json`, `mission_id`, `task_id` |

> **V3.1 status (implemented, not yet committed):** `Robot`, `DockStation`,
> `RobotBattery`, and `RobotConfiguration` are now real tables (singletons). The
> module `api/robot_domain.py` exposes `GET /robot`, `GET /robot/state`,
> `POST /robot/reset`, `POST /robot/recharge`, `POST /robot/speed`. `RobotTelemetry`
> and `RobotEvent` are intentionally deferred to V3.4 (no telemetry in V3.1). The
> robot starts IDLE / 100% / docked / no mission / no task. See `CURRENT.md` V3.1.

Adapters (reuse existing immutable tables — **no duplicate queue**):

| Adapter | Maps to |
|---|---|
| `RobotMission` | `HarvestMission` (§43) — mission header + queue owner |
| `RobotTask` | `HarvestMissionItem` (§42) — one queued unit of robot work |

**Coordinate system:** the robot's `position_x/position_y` are in the **farm-pixel
space** already used by `computeMosaicLayout` (V2, Decision 6) and `TreeObservation`.
Tree targets are derived from the same `TreeObservation.local_pixel_*` +
`SurveyTile.grid_row/col` math the overlay uses, so the robot icon and tree boxes
align on one plane. No new GPS localiser is introduced (SLAM excluded, §5).

## 3. State Machine (textual)

States: `IDLE`, `MOVING`, `CLIMBING`, `SCANNING`, `HARVESTING`, `RETURNING`, `ERROR`,
`DOCKED`.

```
                 task assigned                 arrive at tree
   [*] --> IDLE ---------------> MOVING -----------------> CLIMBING
              ^                      |                        |
              | arrive at dock       | arrive at tree         | at canopy
              | (next pending)        v                        v
              +-- RETURNING <--- HARVESTING <--- SCANNING <---+
                       ^                 |   ^            |
                       | harvest done    |   | scan-only  | eligible + harvest
                       |                 |   +-----------+ (re-scan)
              ERROR <--+-----------------+   |
                ^  |                         |
   recover /     |  +-- safe-abort ----------+
   safe-abort    |
   (any active)--+        battery low
                       IDLE --> DOCKED --> IDLE (charged)
```

- `ERROR` is reachable from any active state and always resolves to `IDLE` (recover)
  or `RETURNING` (safe-abort) — never wedged (§27).
- `DOCKED` is a battery sub-state, **not** an error: entered from `IDLE` (or
  `RETURNING`→`DOCKED` if recharge is needed mid-mission); `CHARGING`→`IDLE` on full.
- Transitions are driven **only by the backend** (`RobotController`); the frontend
  sends *commands*, never a state.

## 4. Mission Lifecycle

```
Harvest Mission (HarvestMission, §43 — already built)
  start() -> RUNNING; claims first RobotTask (HarvestMissionItem PENDING->IN_PROGRESS)
        |
        v
Robot Mission (RobotController owns execution)
  per RobotTask:
        |
        v
Task Queue (ordered HarvestMissionItem list, §42)
  RobotController pulls next pending in visit_order
        |
        v
Execution (RobotSimulationEngine advances time)
  IDLE -> MOVING (interpolate to tree) -> CLIMBING -> SCANNING
       -> HARVESTING (writes post-harvest InventorySnapshot, §44.5) -> RETURNING -> IDLE
  on task complete: advance() claims next; auto-COMPLETED when queue empty (§43.5)
        |
        v
Telemetry + Events (streamed via WebSocket, §6)
```

The robot does **not** invent tasks, eligibility, or order — it consumes the planner's
output exactly as today (§20.3, §38.3). V3 adds only *how the robot physically
traverses and reports* the already-ordered queue.

## 5. Navigation Pipeline

Three separated concerns (explicit requirement — route ≠ movement ≠ execution):

1. **Route planning** — Harvest Planner Nearest-Neighbour (§41). Output: ordered
   `HarvestMissionItem` list (`visit_order`). **Unchanged in V3.** Lives in
   `harvest_mission` / `harvest_planner.py`.
2. **Movement planning** — `RobotNavigator` (pure function/service, no business-state
   writes). Given current farm-pixel position, the next tree's farm-pixel target, and
   the depot position, it produces a **trajectory**: a sequence of `(x, y, t)` waypoints
   at constant ground speed (linear interp, optional smooth turn at the tree), plus the
   return-to-dock leg. Reads positions; does not move anything. Pure & unit-testable.

   > **V3.2 status (implemented, not yet committed):** the navigation layer is now
   > real and deterministic. `backend/navigation/mosaic_layout.py` is a faithful
   > backend port of `computeMosaicLayout` (single farm-pixel source of truth);
   > `service.py` holds the planning objects (`NavigationWaypoint` / `NavigationPlan` /
   > `NavigationResult`) and the pure `RobotNavigator`; `navigation/__init__.py`
   > (`NavigationService`) resolves targets read-only from `HarvestMission` /
   > `TreeObservation` / `SurveyTile` / the V3.1 `Robot`+`DockStation`. `GET
   > /robot/navigation` and `GET /robot/navigation/plan` are read-only. No movement,
   > no execution, no Robot-state mutation. See `CURRENT.md` V3.2.
3. **Execution** — `RobotSimulationEngine` + `RobotController`. Consumes `RobotNavigator`
   trajectories and, driven by the Simulation Clock, writes the robot's live
   `position_x/position_y/heading`, advances the state machine, drains battery, and
   emits telemetry/events. The only component that mutates live robot state.

Why separate: a bug in movement math cannot corrupt the queue or inventory (§20.3);
navigation is reusable/testable without a running sim; a real robot replaces only the
execution layer.

### Simulation Clock

- `sim_now = wall_start + (wall_elapsed × speed_factor)`; `speed_factor` operator-set
  (default 1×). Pause freezes sim time.
- Fixed `dt` steps (e.g. 100 ms sim-time); each tick = one pure `step(dt)`.
- `RobotTicker` drives the clock (background task / simulator loop / WebSocket-ticked —
  driver-agnostic). The engine is **pure**, so it is trivially testable and replayable.
- Determinism: same start + same commands + same `dt` → identical run (enables playback).

## 6. Telemetry Pipeline

| Channel | Mechanism | Contents |
|---|---|---|
| Commands | HTTP (existing) | `start`/`pause`/`resume`/`cancel`/`advance` on `HarvestMission`; new `set_speed`, `recharge`, `reset` on `Robot`. |
| On-demand state | HTTP GET | `GET /harvest/missions/{id}/status` (kept, coarse-compatible) + new `GET /robot/state`, `GET /robot/telemetry?since=`. |
| Live telemetry | **WebSocket `/ws/robot`** | `RobotEvent` stream + throttled `RobotTelemetry` samples (position, state, battery, speed, current task). |

Why WebSocket for live, HTTP for commands: live position/state changes many times per
second during movement — polling (the V1 §36 approach) wastes requests and lags.
WebSocket pushes deltas as they happen (event-driven). Commands stay HTTP (rare,
idempotency-sensitive, request/response semantics). A light HTTP poll is retained only
as a fallback/reconnect seed.

**Event catalogue (streamed):** `MISSION_STARTED`, `TASK_CLAIMED`, `STATE_CHANGED`
(from→to), `POSITION_SAMPLE` (high-rate, throttled), `BATTERY_CHANGED`,
`TASK_COMPLETED`, `HARVEST_WRITTEN`, `MISSION_COMPLETED`, `ERROR_RAISED`,
`DOCKED`/`RECHARGED`, `PAUSED`/`RESU�MED`→`PAUSED`/`RESUMED`/`CANCELLED`. Each event =
one `RobotEvent` row (append-only, §18) + one WebSocket frame. `POSITION_SAMPLE` is the
only high-frequency frame.

**Payload example:**
```json
{ "type": "STATE_CHANGED", "ts": "2026-07-16T09:12:03.000Z",
  "robot_id": 1, "mission_id": 88, "task_id": 12,
  "from": "MOVING", "to": "CLIMBING", "pos": {"x": 4120, "y": 2050}, "battery_pct": 87.3 }
```

## 7. Event Flow

```
RobotController (command)  --HTTP-->  backend validates, transitions state
        |
        v
RobotSimulationEngine.step(dt)  --advances-->  Robot state + battery + position
        |
        +--> writes RobotEvent (append-only)      --> WebSocket frame to subscribers
        +--> samples RobotTelemetry (throttled)   --> WebSocket frame + persisted
        |
        v
Frontend RobotLayer / RobotStatusPanel  --renders-->  backend state only
        (no business logic in the browser)
```

Persistence enables playback: a past mission is replayed by streaming its stored
`RobotTelemetry`/`RobotEvent` through the same components (§8).

## 8. Version 3 Milestones

| Milestone | Scope | Key deliverables |
|---|---|---|
| **V3.1 Robot Domain** | Persisted entities + adapters | `Robot`, `DockStation`, `RobotBattery`, `RobotTelemetry`, `RobotEvent`; `RobotTask`/`RobotMission` adapters over `HarvestMissionItem`/`HarvestMission`; idempotent migration. **(implemented, not committed)** |
| **V3.2 Navigation** | Movement planning only | `RobotNavigator` (pure trajectory generator) + `NavigationService`; `backend/navigation/` package; `GET /robot/navigation` + `GET /robot/navigation/plan`; deterministic, read-only, no live mutation. **(implemented, not committed)** |
| **V3.3 State Machine** | RobotState + transitions | `RobotController` enforcing §3; `DOCKED` battery routing; error/safe-abort; coarse↔fine mapping for V1 compat. |
| **V3.4 Telemetry** | Event + sample capture | `RobotEvent`/`RobotTelemetry` writers; `GET /robot/state`, `GET /robot/telemetry`. |
| **V3.5 Visualization** | Frontend robot on twin | `RobotLayer` (marker + path + battery ring), `RobotStatusPanel`, `DashboardRobotCard`; WebSocket client. |
| **V3.6 Autonomous Behaviour** | Simulation engine | `SimulationClock` + `RobotSimulationEngine` (pure `step(dt)`), `RobotTicker`; smooth time-based states; battery drain/recharge; live telemetry. |
| **V3.7 Playback** | Replay past missions | Feed stored telemetry through same components in `playback` mode; no second renderer. |
| **V3.8 Production Hardening** | Critical review + cleanup | Two-agent review; N+1/perf on telemetry; WebSocket reconnect/backpressure; dead-code removal; regression suite; docs sync. |

## 9. Future Extension Points

- **Real robot swap:** the contract boundary is the WebSocket telemetry frame + HTTP
  command set. Keep that frame stable; `RobotSimulationEngine` is the only component a
  real robot replaces.
- **Multiple robots / multi-farm / advanced routing / predictive analytics** — already
  listed as future considerations (§5, §41.4, §58); the singleton `Robot`/`DockStation`
  and `ACTIVE_HARVEST_MISSION_STATUSES` single-live-mission guard make these additive.
- **Telemetry scaling:** retention policy + `(robot_id, ts)` index + throttled (≈10 Hz)
  sampling; `RobotEvent` stays append-only and small.
- **Renderer freeze (Decision 6):** `RobotLayer` is additive and shares the transformed
  stage; it does not change `FarmMosaic`/`OverlayLayer`/`TreeDetailsDrawer`.

*End of ROBOT_ARCHITECTURE.md — architecture only, no implementation.*
