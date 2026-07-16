# ROBOT_ARCHITECTURE.md

> **Status: FROZEN — approved baseline specification for Version 3. Architecture locked;
> implemented V3.1–V3.7.3 (not yet committed).**
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

  > **V3.3 status (implemented, not yet committed):** the `RobotStateMachine`
  > (`backend/robot/state_machine.py`) enforces the frozen explicit edge set
  > (`LEGAL_TRANSITIONS`) and rejects everything else with no hidden mutation. It
  > persists every transition to `robot_state_transitions` (previous/next/reason/
  > ts) — the append-only source for later telemetry / Mission History & Analytics.
  > `POST /robot/state`
  > commands a validated transition (illegal → HTTP 400); `GET /robot/state`
  > returns `available_transitions`; `GET /robot/state/history` lists the log. The
  > machine owns no timing, movement, battery, or telemetry.
  >
  > **V3.3.1 refinement (implemented, not yet committed):** every operational
  > state may additionally fault into `ERROR` (`DOCKED`/`IDLE`/`MOVING`/`CLIMBING`/
  > `SCANNING`/`HARVESTING`/`RETURNING` → `ERROR`) so operational failures can
  > transition into error. Recovery is **unchanged**: `ERROR` still resolves ONLY
  > to `RETURNING` or `IDLE` (no other recovery path). `RobotStateMachine` remains
  > the **only** component allowed to mutate `robot.status`; Simulation,
  > Navigation, Telemetry, WebSocket, and the frontend never mutate `Robot.state`
  > directly. See `CURRENT.md` V3.3 / V3.3.1.
  >
  > **V3.4 Robot Simulation Engine (implemented, not yet committed):** the
  > executor is now real. `backend/simulation/` holds the pure `SimulationClock`
  > (deterministic `sim = wall × speed_factor`, pause/resume), the pure
  > `SimulationEngine` (`step(dt)`: linear farm-pixel interpolation, battery drain
  > while active, transitions delegated to `RobotStateMachine` via an injected
  > `transition_fn`, internal `SimulationEvent`s), `SimulationContext` (live state
  > bag), and `SimulationScheduler` (the only wall-clock/thread driver; builds the
  > immutable `NavigationPlan`, ticks the engine, persists to `Robot`/`RobotBattery`).
  > `RobotStateMachine` stays the **sole** mutator of `robot.status`. **Scope
  > guards:** no WebSocket, no telemetry persistence, no frontend, no charging
  > logic (battery drains and diverts to dock on low threshold). Events are
  > internal only (V3.5 telemetry will consume them). `POST/GET /robot/simulation`
  > control the run. See `CURRENT.md` V3.4.
  >
   > *Note on milestone numbering:* this task builds the **Simulation Engine** under
   > the label "V3.4". The frozen `ROBOT_ARCHITECTURE.md` milestone table (§8) had
   > previously placed Telemetry at V3.4 and the engine at V3.6; this delivery
   > realises the engine one milestone early. The table below is updated to match.
   >
   > **V3.5.1 — Simulation Lifecycle Refinement (implemented, not yet committed):**
   > a minimal lifecycle hardening; no architecture change, no new features.
   > Three invariants made explicit (see `CURRENT.md` V3.5.1): (1) **Robot state is
   > separate from simulation status** — `Robot.status` always holds a legal
   > `RobotState` value; the scheduler's run phase (`running`/`paused`/`stopped`/
   > `finished`) lives only in the scheduler and is never written to `robot.status`
   > (a fail-safe guard in `_persist` rejects any non-`RobotState` value); on
   > mission completion the engine settles the robot to `DOCKED` while the
   > simulation status becomes `finished`. (2) **Completed mission context is
   > preserved** — after completion (and after a `stop`), `mission_id`,
   > `completed_item_ids`, `waypoint_count`, and final statistics remain queryable
   > via `GET /robot/simulation` until the next `start` or an explicit `reset`;
   > `stop()` no longer wipes the run context. (3) **Battery is not auto-recharged
   > at the dock** — arriving `DOCKED` leaves the battery percentage unchanged;
   > charging occurs only via `POST /robot/recharge` (or a future charging
   > milestone). `backend/simulation/scheduler.py` is the only changed file.

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
  on arrival+harvest the scheduler run loop calls the shared harvest.execution
    service (complete_item / finalize_mission) so the HarvestMission, Inventory,
    and Trees stay in lock-step with the robot; mission auto-COMPLETED on dock
    return (§43.5). The manual advance endpoint delegates to the same service.
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

    > **V3.4 status (implemented, not yet committed):** the executor is real.
    > `backend/simulation/` holds `SimulationClock` (deterministic sim-time),
    > `SimulationEngine` (pure `step(dt)` — linear movement, battery drain, state
    > transitions delegated to `RobotStateMachine`, internal `SimulationEvent`s),
    > `SimulationContext` (live state bag), and `SimulationScheduler` (the only
    > wall-clock/thread driver; builds the immutable `NavigationPlan` via
    > `NavigationService`, ticks the engine, persists to `Robot`/`RobotBattery`).
    > The engine never reads a clock, never touches the DB, and never mutates
    > `robot.status` except through the injected `transition_fn` →
    > `RobotStateMachine`. No telemetry/WebSocket/frontend/charging in V3.4.

 Why separate: a bug in movement math cannot corrupt the queue or inventory (§20.3);
 navigation is reusable/testable without a running sim; a real robot replaces only the
 execution layer.

### Simulation Clock

- `sim_now = wall_start + (wall_elapsed × speed_factor)`; `speed_factor` operator-set
  (default 1×). Pause freezes sim time.
- Fixed `dt` steps (e.g. 100 ms sim-time); each tick = one pure `step(dt)`.
- `RobotTicker` drives the clock (background task / simulator loop / WebSocket-ticked —
  driver-agnostic). The engine is **pure**, so it is trivially testable and replayable.
- Determinism: same start + same commands + same `dt` → identical run (enables the
  deterministic analytics in the Mission History & Analytics Operations Center).

## 6. Telemetry Pipeline

| Channel | Mechanism | Contents |
|---|---|---|
| Commands | HTTP (existing) | `start`/`pause`/`resume`/`cancel`/`advance` on `HarvestMission`; new `set_speed`, `recharge`, `reset` on `Robot`. |
| On-demand state | HTTP GET | `GET /harvest/missions/{id}/status` (kept, coarse-compatible) + new `GET /robot/state`, `GET /robot/telemetry?since=`. |
| Live telemetry | **WebSocket `/ws/robot`** | One frame per simulation tick: robot snapshot (position, state, battery, speed, progress) + the tick's `SimulationEvent`s + run status. Observe-only — never starts/pauses/stops the run or mutates state. |

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
        v  (returns SimulationEvent list; engine stays pure, no I/O)
SimulationScheduler._run_loop  --publishes-->  EventBus  TOPIC_SIM_EVENTS
        |                                      (payload: {events, context, robot_id, mission_id})
        +--> TelemetryService (consumer)  --> appends RobotEvent + RobotTelemetry (read-side, no mutation)
        +--> WebSocketGateway  (consumer) --> broadcasts frame to all /ws/robot subscribers
        |
        v
Frontend RobotLayer / RobotStatusPanel  --renders-->  backend state only
        (no business logic in the browser)
```

The `EventBus` is the **single decoupling point** (V3.5): the engine and scheduler
never import the consumers; a subscriber raising is isolated per-subscriber so it
cannot stall the producer; events are delivered in engine-production order. The
`WebSocketGateway` is strictly observe-only — it never calls any control endpoint
and never mutates `Robot`/`Navigation`/`RobotStateMachine`; a dropped client is
 pruned and never affects the run. Persistence feeds the backend-owned Mission
 History & Analytics (V3.7): each terminated run is summarised into a `RobotRun` row
 from its stored `RobotTelemetry`/`RobotEvent` (§8).

## 8. Version 3 Milestones

| Milestone | Scope | Key deliverables |
|---|---|---|
| **V3.1 Robot Domain** | Persisted entities + adapters | `Robot`, `DockStation`, `RobotBattery`, `RobotTelemetry`, `RobotEvent`; `RobotTask`/`RobotMission` adapters over `HarvestMissionItem`/`HarvestMission`; idempotent migration. **(implemented, not committed)** |
| **V3.2 Navigation** | Movement planning only | `RobotNavigator` (pure trajectory generator) + `NavigationService`; `backend/navigation/` package; `GET /robot/navigation` + `GET /robot/navigation/plan`; deterministic, read-only, no live mutation. **(implemented, not committed)** |
| **V3.3 State Machine** | RobotState + transitions | `RobotStateMachine` enforcing §3 (frozen `LEGAL_TRANSITIONS`); append-only `robot_state_transitions` history; `GET /robot/state/history` + `POST /robot/state`; no timing/movement/battery/telemetry. **(implemented, not committed)** |
| **V3.3.1 State Machine Refinement** | allow faults into ERROR | Every operational state may transition → `ERROR` (operational failure can fault the robot); recovery unchanged (`ERROR`→`{RETURNING,IDLE}` only); `RobotStateMachine` stays the sole `robot.status` mutator. Minimal change to `LEGAL_TRANSITIONS` only. **(implemented, not committed)** |
| **V3.4 Robot Simulation Engine** | Execute the plan over time | `backend/simulation/`: pure `SimulationClock` + `SimulationEngine` (`step(dt)`, linear movement, battery drain, transitions via `RobotStateMachine`, internal `SimulationEvent`s) + `SimulationScheduler` (thread driver, builds immutable `NavigationPlan`, persists to `Robot`/`RobotBattery`); `POST/GET /robot/simulation`. No WebSocket/telemetry/frontend/charging. **(implemented, not committed)** |
| **V3.5 Telemetry & WebSocket** | Event + sample capture + live stream | `EventBus` (pub/sub decoupling); `TelemetryService` (append-only `RobotEvent`/`RobotTelemetry` writers — read-side, no mutation); `WebSocketGateway` (observe-only `/ws/robot` multi-client broadcast); `GET /robot/telemetry`, `GET /robot/telemetry/events`. Scheduler publishes engine events onto the bus each tick. **(implemented, not committed)** |
| **V3.6 Visualization** | Frontend robot on twin | `RobotLayer` (marker + path + battery ring) inside `FarmViewer`'s transformed stage; `RobotMarker`/`RobotPathLayer` (counter-scaled); `RobotStatusCard`; `SimulationControls`; `useRobotSimulation` hook + `RobotWebSocketClient` (single WS, observe-only); `/map` + `/robot` + dashboard wire-in. **(implemented, not committed)** |
| **V3.7 Mission History & Analytics** | Operations Center over finished runs | Backend-owned analytics (`analytics/mission_history.py`): one `RobotRun` row per terminated run written by `SimulationScheduler`; `GET /robot/runs` (+ `/{id}`, `/{id}/timeline`, `/{id}/tree-activity`, `/{id}/robot-log`); frontend `/robot/history` + detail page are **presentation-only** (no replay — read-only derived analytics). Supersedes the earlier "Playback" concept (Playback deferred to V4 — see `PROJECT_SPECIFICATION.md` §V3.7 Amendment). **(implemented, not committed)** |
| **V3.7.1 Mission History Refinement** | Transparent analytics + twin wiring | No new architecture/features. `score_breakdown` (Text) on `RobotRun` + `_mission_score` `(final, breakdown)` exposing `completion`/`battery_economy`/`status_factor`/`safe_return`/`error_free`; `build_timeline` grouped **"Travelled X m"** segments; `build_robot_log` severity (INFO/WARNING/ERROR); tree-activity → **Open Tree** (`/trees/[id]`) + **Open Digital Twin** (`/map?tree=[id]`) via `FarmViewer.initialTreeId`. Frontend renders only. **(implemented, not committed)** |
| **V3.7.2 Workflow Integration** | One synchronized workflow, no manual steps | Hardening/integration, no new features. `POST /harvest/missions/{id}/start` auto-starts the robot sim (`scheduler.start`); execution mutations factored into `backend/harvest/execution.py` (single source of truth) consumed by **both** the manual advance endpoint and the scheduler run loop — the robot now completes `HarvestMissionItem`s and writes post-harvest `InventorySnapshot`s as it harvests, and finalizes the mission on dock return; `get_permanent_trees` server-side paginated. **(implemented, not committed)** |
| **V3.7.3 Speed & Battery Calibration** | Realistic defaults, no new features | Refinement only. `DEFAULT_SIMULATION_SPEED = 60` in `backend/simulation/config.py` (single source; was 3× hardcoded `1.0`); `GET /robot/simulation/config` exposes it, frontend auto-initialises; `BATTERY_DRAIN_PER_S = 1/DEFAULT_SIMULATION_SPEED` (%/sim-s) so ~1%/real-s at 60× — derived from simulated elapsed time, deterministic, recharge/return-to-dock unchanged. **(implemented, not committed)** |
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

Simulation Rule

SimulationEngine never creates events manually for consumers.

Simulation emits only SimulationEvent.

Every external subsystem observes those events.

Simulation never knows who is listening.

Consumers include:

Telemetry

Replay

WebSocket

Logging

Analytics

Testing
*End of ROBOT_ARCHITECTURE.md — architecture only, no implementation.*
