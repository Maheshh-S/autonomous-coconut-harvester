"""Version 3.7 — Mission History & Analytics (backend-owned analytics).

This module is the **single source of truth** for the Robot Operations Center.
It derives every Operations-Center metric (history cards, mission summary,
timeline, tree activity, robot log, analytics, mission score) from the
append-only ``RobotTelemetry`` / ``RobotEvent`` time-series plus the immutable
``HarvestMission`` / ``HarvestMissionItem`` / ``Tree`` records.

Design rules (AGENTS.md, ROBOT_ARCHITECTURE.md):
- The backend owns ALL business metrics. The frontend only renders them.
- No business logic is duplicated: a single ``compute_run`` builds the
  ``RobotRun`` summary; the history/summary/timeline/tree-activity endpoints all
  read from ``RobotRun`` + the raw telemetry/events, never re-deriving in the UI.
- Deterministic: given the same telemetry/events the same score/timeline results.

The ``RobotRun`` row is written exactly once, when a simulation run terminates
(COMPLETED / ABORTED / FAILED), by ``SimulationScheduler`` via ``record_run``.
"""

from typing import List, Optional

import json

from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import (
    RobotEvent,
    RobotRun,
    RobotTelemetry,
    HarvestMissionItem,
    Tree,
    Inspection,
)

# --- Thresholds (documented, deterministic) ---------------------------------

# A battery rise at least this large between two consecutive telemetry samples is
# treated as an external recharge command (the robot never auto-charges mid-run).
RECHARGE_JUMP_PCT = 25.0


def _parse_detail(raw):
    """RobotEvent.detail is stored as a JSON *string* (see RobotEvent.detail).

    Safely parse it back to a dict; fall back to {} on None / malformed input so
    the analytics never crash on a stray telemetry row.
    """
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


# --- Mission score (deterministic, documented, transparent) -----------------
#
#   completion   = harvested_trees / max(1, total_trees)          # 0..1
#   battery_econ = 1 - battery_used_pct / 100                     # 0..1 (higher better)
#   status_factor: COMPLETED 1.0 | ABORTED 0.5 | FAILED 0.2
#
#   raw          = 100 * completion * (0.5 + 0.5 * battery_econ) * status_factor
#   mission_score = clamp(raw, 0, 100)
#
# Rationale: a fully-completed run that used little battery scores highest; an
# aborted run is penalised (operator stopped it before the route finished); a
# failed run scores lowest. The score is bounded to [0, 100] and never depends on
# wall-clock or randomness — only on the run's own deterministic outcomes. The
# breakdown is returned alongside the final score so the UI can show it without
# ever recomputing it (backend remains the single source of truth).
def _mission_score(harvested: int, total: int, battery_used: float, status: str):
    completion = harvested / max(1, total)
    battery_econ = max(0.0, min(1.0, 1.0 - battery_used / 100.0))
    status_factor = {"COMPLETED": 1.0, "ABORTED": 0.5, "FAILED": 0.2}.get(status, 0.5)
    raw = 100.0 * completion * (0.5 + 0.5 * battery_econ) * status_factor
    final = round(max(0.0, min(100.0, raw)), 1)
    return final, {
        "completion": round(completion, 4),
        "battery_economy": round(battery_econ, 4),
        "status_factor": status_factor,
        "raw": round(raw, 2),
        "final": final,
    }


def _telemetry_for(db: Session, mission_id: Optional[int], robot_id: int):
    q = db.query(RobotTelemetry).filter(RobotTelemetry.robot_id == robot_id)
    if mission_id is not None:
        q = q.filter(RobotTelemetry.mission_id == mission_id)
    return q.order_by(RobotTelemetry.sim_time.asc(), RobotTelemetry.id.asc()).all()


def _events_for(db: Session, mission_id: Optional[int], robot_id: int):
    q = db.query(RobotEvent).filter(RobotEvent.robot_id == robot_id)
    if mission_id is not None:
        q = q.filter(RobotEvent.mission_id == mission_id)
    return q.order_by(RobotEvent.sim_time.asc(), RobotEvent.id.asc()).all()


def compute_run(db: Session, robot_id: int, mission_id: Optional[int], status: str,
                started_at, finished_at, speed_factor: Optional[float]) -> dict:
    """Derive the full ``RobotRun`` analytics dict from telemetry + events.

    Pure computation (no DB writes). The scheduler persists the returned dict.
    """
    telemetry = _telemetry_for(db, mission_id, robot_id)
    events = _events_for(db, mission_id, robot_id)

    # --- terminal battery + recharge detection -----------------------------
    battery_start = telemetry[0].battery_pct if telemetry else None
    battery_end = telemetry[-1].battery_pct if telemetry else None
    battery_used = 0.0
    if battery_start is not None and battery_end is not None:
        battery_used = max(0.0, battery_start - battery_end)

    recharge_count = 0
    prev_b = None
    for t in telemetry:
        if prev_b is not None and (t.battery_pct - prev_b) >= RECHARGE_JUMP_PCT:
            recharge_count += 1
        prev_b = t.battery_pct

    # --- distance (sum of per-sample position deltas) ----------------------
    distance = 0.0
    prev = None
    for t in telemetry:
        if prev is not None:
            dx = t.position_x - prev.position_x
            dy = t.position_y - prev.position_y
            distance += (dx * dx + dy * dy) ** 0.5
        prev = t

    # --- harvest timing (from HarvestStarted/HarvestFinished pairs) --------
    harvest_durations: List[float] = []
    started = {}
    for ev in events:
        d = _parse_detail(ev.detail)
        if ev.event_type == "HarvestStarted":
            tid = d.get("tree_id")
            started[tid] = ev.sim_time
        elif ev.event_type == "HarvestFinished":
            tid = d.get("tree_id")
            if tid in started:
                harvest_durations.append(ev.sim_time - started.pop(tid))
    avg_harvest = (sum(harvest_durations) / len(harvest_durations)) if harvest_durations else None
    fastest = min(harvest_durations) if harvest_durations else None
    slowest = max(harvest_durations) if harvest_durations else None

    # --- tree counts (from the immutable mission items) --------------------
    total_trees = 0
    harvested_trees = 0
    if mission_id is not None:
        items = (
            db.query(HarvestMissionItem)
            .filter(HarvestMissionItem.mission_id == mission_id)
            .all()
        )
        total_trees = len(items)
        for it in items:
            if it.status == "COMPLETED":
                harvested_trees += 1
    skipped_trees = max(0, total_trees - harvested_trees)

    # --- idle time + avg speed (from telemetry states) ---------------------
    idle_time = 0.0
    speed_sum = 0.0
    speed_n = 0
    prev_sim = None
    prev_status = None
    for t in telemetry:
        if prev_sim is not None:
            gap = t.sim_time - prev_sim
            if prev_status in {"IDLE", "DOCKED", "ERROR"} and t.status == prev_status:
                idle_time += gap
        if t.speed and t.status in {"MOVING", "RETURNING"}:
            speed_sum += t.speed
            speed_n += 1
        prev_sim = t.sim_time
        prev_status = t.status
    avg_speed = (speed_sum / speed_n) if speed_n else None

    # --- efficiency: harvested trees per 100 distance units ----------------
    efficiency = None
    if distance > 0:
        efficiency = round(harvested_trees / distance * 100.0, 4)

    duration_s = None
    if started_at and finished_at:
        duration_s = (finished_at - started_at).total_seconds()

    score, breakdown = _mission_score(harvested_trees, total_trees, battery_used, status)
    # Informational context factors for the transparent breakdown (display only;
    # the numeric formula above is unchanged). safe_return: robot ended at the
    # dock (COMPLETED or operator-recalled ABORTED), not a FAILED run. error_free:
    # the run did not end in FAILED.
    breakdown["safe_return"] = 1.0 if status in ("COMPLETED", "ABORTED") else 0.0
    breakdown["error_free"] = 1.0 if status != "FAILED" else 0.0

    return {
        "robot_id": robot_id,
        "mission_id": mission_id,
        "status": status,
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_s": duration_s,
        "total_trees": total_trees,
        "harvested_trees": harvested_trees,
        "skipped_trees": skipped_trees,
        "distance_travelled": round(distance, 2),
        "battery_start_pct": battery_start,
        "battery_end_pct": battery_end,
        "battery_used_pct": round(battery_used, 2),
        "recharge_count": recharge_count,
        "avg_harvest_time_s": round(avg_harvest, 2) if avg_harvest is not None else None,
        "fastest_harvest_s": round(fastest, 2) if fastest is not None else None,
        "slowest_harvest_s": round(slowest, 2) if slowest is not None else None,
        "avg_speed": round(avg_speed, 2) if avg_speed is not None else None,
        "idle_time_s": round(idle_time, 2),
        "efficiency": efficiency,
        "mission_score": score,
        "score_breakdown": json.dumps(breakdown),
        "speed_factor": speed_factor,
    }


def record_run(db: Session, robot_id: int, mission_id: Optional[int], status: str,
               started_at, finished_at, speed_factor: Optional[float]) -> RobotRun:
    """Compute and persist a ``RobotRun`` row for a terminated run."""
    data = compute_run(db, robot_id, mission_id, status, started_at, finished_at, speed_factor)
    run = RobotRun(**data)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def list_runs(db: Session, limit: int = 100) -> List[RobotRun]:
    """All runs, newest first (by finished_at, then id)."""
    return (
        db.query(RobotRun)
        .order_by(RobotRun.finished_at.desc().nullslast(), RobotRun.id.desc())
        .limit(limit)
        .all()
    )


def get_run(db: Session, run_id: int) -> Optional[RobotRun]:
    return db.query(RobotRun).filter(RobotRun.id == run_id).first()


def build_timeline(db: Session, robot_id: int, mission_id: Optional[int]) -> List[dict]:
    """Chronological, visual timeline of a run (backend-built, ordered by sim_time).

    Synthesises the higher-level milestones the engine does not emit explicitly
    (Mission Started, Recharged, Returning To Dock) from the raw telemetry/events
    so the Operations Center shows a clean, scannable timeline without the UI
    re-deriving anything.

    V3.7.1 — travel grouping: continuous movement between trees is collapsed into a
    single "Travelled X m" segment instead of a long run of repetitive "Moving"
    events. The distance is summed from the telemetry position samples over the
    gap between one tree's harvest-finish and the next tree's arrival.
    """
    telemetry = _telemetry_for(db, mission_id, robot_id)
    events = _events_for(db, mission_id, robot_id)
    entries: List[dict] = []

    # Per-tree visit timing, used to group travel between consecutive trees.
    reach_time: dict = {}
    done_time: dict = {}
    order_seen: List[int] = []

    if telemetry:
        entries.append({
            "key": "mission_started",
            "icon": "play",
            "color": "#22c55e",
            "title": "Mission Started",
            "sim_time": telemetry[0].sim_time,
            "timestamp": telemetry[0].recorded_at.isoformat() if telemetry[0].recorded_at else None,
            "description": "Robot left the dock and began executing the route.",
        })

    for ev in events:
        d = _parse_detail(ev.detail)
        if ev.event_type == "TreeReached":
            tid = d.get("tree_id")
            if tid is None:
                continue
            reach_time[tid] = ev.sim_time
            if tid not in order_seen:
                order_seen.append(tid)
            entries.append({
                "key": f"tree_reached_{tid}",
                "icon": "tree",
                "color": "#3b82f6",
                "title": "Reached Tree",
                "sim_time": ev.sim_time,
                "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
                "description": f"Arrived at tree #{tid}.",
                "tree_id": tid,
            })
        elif ev.event_type == "HarvestStarted":
            tid = d.get("tree_id")
            if tid is None:
                continue
            entries.append({
                "key": f"harvest_start_{tid}",
                "icon": "climb",
                "color": "#a855f7",
                "title": "Climbing Started",
                "sim_time": ev.sim_time,
                "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
                "description": f"Climbing + scanning tree #{tid} for harvest.",
                "tree_id": tid,
            })
        elif ev.event_type == "HarvestFinished":
            tid = d.get("tree_id")
            if tid is None:
                continue
            done_time[tid] = ev.sim_time
            entries.append({
                "key": f"harvest_done_{tid}",
                "icon": "check",
                "color": "#22c55e",
                "title": "Harvest Completed",
                "sim_time": ev.sim_time,
                "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
                "description": f"Harvest finished for tree #{tid}.",
                "tree_id": tid,
            })
        elif ev.event_type == "BatteryLow":
            entries.append({
                "key": f"battery_low_{ev.sim_time}",
                "icon": "battery",
                "color": "#ef4444",
                "title": "Battery Low",
                "sim_time": ev.sim_time,
                "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
                "description": "Battery reached the low threshold — diverting to dock.",
            })
        elif ev.event_type == "ReturnedToDock":
            entries.append({
                "key": "returned_to_dock",
                "icon": "home",
                "color": "#f59e0b",
                "title": "Returning To Dock",
                "sim_time": ev.sim_time,
                "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
                "description": "Robot returned to the home dock.",
            })
        elif ev.event_type == "MissionCompleted":
            entries.append({
                "key": "mission_completed",
                "icon": "flag",
                "color": "#22c55e",
                "title": "Mission Completed",
                "sim_time": ev.sim_time,
                "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
                "description": "All reachable trees harvested; mission complete.",
            })

    # Recharge detection from telemetry battery jumps.
    prev = None
    for t in telemetry:
        if prev is not None and (t.battery_pct - prev) >= RECHARGE_JUMP_PCT:
            entries.append({
                "key": f"recharged_{t.sim_time}",
                "icon": "bolt",
                "color": "#06b6d4",
                "title": "Charging",
                "sim_time": t.sim_time,
                "timestamp": t.recorded_at.isoformat() if t.recorded_at else None,
                "description": f"Battery recharged to {round(t.battery_pct, 1)}%.",
            })
        prev = t.battery_pct

    # --- V3.7.1: group travel between consecutive trees into one segment ------
    if telemetry and len(order_seen) >= 2:
        def distance_between(t0: float, t1: float) -> float:
            dist = 0.0
            prev_p = None
            for t in telemetry:
                if t.sim_time < t0:
                    continue
                if t.sim_time > t1:
                    break
                if prev_p is not None:
                    dx = t.position_x - prev_p[0]
                    dy = t.position_y - prev_p[1]
                    dist += (dx * dx + dy * dy) ** 0.5
                prev_p = (t.position_x, t.position_y)
            return round(dist, 2)

        for i in range(len(order_seen) - 1):
            cur = order_seen[i]
            nxt = order_seen[i + 1]
            seg_start = done_time.get(cur, reach_time.get(cur))
            seg_end = reach_time.get(nxt)
            if seg_start is None or seg_end is None or seg_end <= seg_start:
                continue
            trav = distance_between(seg_start, seg_end)
            if trav <= 0:
                continue
            entries.append({
                "key": f"travelled_{cur}_to_{nxt}",
                "icon": "route",
                "color": "#64748b",
                "title": "Travelled",
                "sim_time": seg_end,
                "timestamp": None,
                "description": f"Travelled {trav} m to tree #{nxt}.",
                "tree_id": nxt,
                "distance_m": trav,
            })

    entries.sort(key=lambda e: (e["sim_time"], e["title"]))
    return entries


def build_tree_activity(db: Session, robot_id: int, mission_id: Optional[int]) -> List[dict]:
    """Per-tree activity for a run, joined to Tree / HarvestMissionItem / Inspection.

    One card per tree the mission visited. Each card carries the visit time,
    harvest duration, harvest result, battery at visit, inventory collected, and a
    link to the tree's latest inspection — all resolved in the backend.
    """
    events = _events_for(db, mission_id, robot_id)
    telemetry = _telemetry_for(db, mission_id, robot_id)

    reached = {}
    harvest_start = {}
    harvest_end = {}
    for ev in events:
        d = _parse_detail(ev.detail)
        tid = d.get("tree_id")
        if tid is None:
            continue
        if ev.event_type == "TreeReached":
            reached[tid] = ev.sim_time
        elif ev.event_type == "HarvestStarted":
            harvest_start[tid] = ev.sim_time
        elif ev.event_type == "HarvestFinished":
            harvest_end[tid] = ev.sim_time

    tree_ids = sorted(set(list(reached) + list(harvest_start) + list(harvest_end)))
    if not tree_ids and mission_id is not None:
        tree_ids = [
            it.tree_id
            for it in db.query(HarvestMissionItem)
            .filter(HarvestMissionItem.mission_id == mission_id)
            .order_by(HarvestMissionItem.visit_order)
            .all()
        ]

    # Bulk-load supporting rows in a few round-trips (no per-tree N+1).
    trees = (
        {t.id: t for t in db.query(Tree).filter(Tree.id.in_(tree_ids)).all()}
        if tree_ids else {}
    )
    items = (
        {
            it.tree_id: it
            for it in db.query(HarvestMissionItem)
            .filter(
                HarvestMissionItem.mission_id == mission_id,
                HarvestMissionItem.tree_id.in_(tree_ids),
            )
            .all()
        }
        if (mission_id is not None and tree_ids)
        else {}
    )
    latest_insp = {}
    if tree_ids:
        sub = (
            db.query(func.max(Inspection.id).label("mid"), Inspection.tree_id)
            .filter(Inspection.tree_id.in_(tree_ids))
            .group_by(Inspection.tree_id)
            .subquery()
        )
        for insp in db.query(Inspection).join(sub, Inspection.id == sub.c.mid).all():
            latest_insp[insp.tree_id] = insp

    def battery_at(sim_t: Optional[float]) -> Optional[float]:
        if sim_t is None or not telemetry:
            return None
        best = None
        for t in telemetry:
            if t.sim_time <= sim_t:
                best = t.battery_pct
            else:
                break
        return best

    cards = []
    for tid in tree_ids:
        tree = trees.get(tid)
        item = items.get(tid)
        result = "skipped"
        if tid in harvest_end:
            result = "harvested"
        elif item is not None and item.status == "COMPLETED":
            result = "harvested"
        dur = None
        if tid in harvest_start and tid in harvest_end:
            dur = round(harvest_end[tid] - harvest_start[tid], 2)
        insp = latest_insp.get(tid)
        cards.append({
            "tree_id": tid,
            "tree_code": tree.tree_code if tree else None,
            "visit_time": reached.get(tid),
            "harvest_duration_s": dur,
            "harvest_result": result,
            "battery_at_visit": battery_at(reached.get(tid)),
            "inventory_collected": item.harvested if item and item.harvested is not None
            else item.expected_coconuts if item else None,
            "inspection_id": insp.id if insp else None,
        })
    # Order by visit time (trees visited first appear first); unvisited last.
    cards.sort(key=lambda c: (c["visit_time"] is None, c["visit_time"] if c["visit_time"] is not None else 0))
    return cards


# --- Robot log severity (V3.7.1, deterministic, no business-logic duplication) -
# Maps each engine event type to a display severity. ERROR events and fault
# transitions are ERROR; battery/divert warnings are WARNING; everything else INFO.
# Kept as a pure mapping so the frontend never re-derives severity.
_ERROR_EVENTS = {"Error", "MissionFailed", "EngineError"}
_WARNING_EVENTS = {"BatteryLow", "StateChanged", "ReturnedToDock"}


def _event_severity(event_type: str, detail: dict) -> str:
    if event_type in _ERROR_EVENTS:
        return "ERROR"
    if event_type in _WARNING_EVENTS:
        # A StateChanged into ERROR is an error, not just a warning.
        if event_type == "StateChanged" and (detail or {}).get("to") == "ERROR":
            return "ERROR"
        return "WARNING"
    return "INFO"


def build_robot_log(db: Session, robot_id: int, mission_id: Optional[int], limit: int = 500) -> List[dict]:
    """Chronological event log (raw events) with a derived severity per entry."""
    events = _events_for(db, mission_id, robot_id)[-limit:]
    log = []
    for ev in events:
        detail = _parse_detail(ev.detail)
        log.append({
            "id": ev.id,
            "timestamp": ev.recorded_at.isoformat() if ev.recorded_at else None,
            "sim_time": ev.sim_time,
            "event_type": ev.event_type,
            "detail": detail,
            "severity": _event_severity(ev.event_type, detail),
            "mission_id": ev.mission_id,
        })
    log.sort(key=lambda e: (e["sim_time"], e["id"]))
    return log
