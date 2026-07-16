"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  RobotWebSocketClient,
  getSimulationStatus,
  getRobotNavPlan,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  returnRobotToDock,
  rechargeRobot,
  resetRobot,
  type RobotFrame,
  type RobotSnapshot,
  type SimulationStatus,
  type RobotPlanWaypoint,
} from "@/lib/api/detection"

// V3.6.1 — smooth movement. The backend is authoritative; snapshots arrive at a
// fixed tick (~10 Hz). Between ticks the marker would otherwise teleport. We
// interpolate a *display* robot toward the latest snapshot using a rAF-driven
// spring (critically-damped), so the marker glides continuously. This is purely
// presentation: the spring never feeds back into state, position, or battery —
// it only eases what is already rendered. We use a tiny self-contained spring
// integrator (no external dependency) so the V3.6.1 polish needs no new package
// and stays framework-native (React 19).
type SpringVec = { x: number; y: number; heading: number }

function lerpAngle(a: number, b: number, t: number) {
  // Shortest-path angular interpolation (degrees).
  let d = ((b - a + 540) % 360) - 180
  return a + d * t
}

// V3.6.1 — shared robot-simulation hook (presentation orchestration only).
// Owns the single WebSocket connection, the latest snapshot, the run status,
// and the (read-only) navigation plan. It issues commands via the existing
// backend APIs and renders nothing. Both the /map and /robot pages reuse it so
// there is exactly one WS connection and one source of truth for the robot view.
export function useRobotSimulation(missionId: number | null) {
  const [frame, setFrame] = useState<RobotFrame | null>(null)
  const [sim, setSim] = useState<SimulationStatus | null>(null)
  const [plan, setPlan] = useState<RobotPlanWaypoint[]>([])
  const [connection, setConnection] = useState<"connecting" | "open" | "closed">("closed")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<RobotWebSocketClient | null>(null)
  const robot: RobotSnapshot | null = frame?.robot ?? null

  // V3.6.1 — smooth display robot. A spring target tracks the latest backend
  // snapshot; a rAF loop eases the *rendered* values toward that target every
  // animation frame so the marker glides instead of teleporting between ticks.
  // The spring is display-only — `robot` (authoritative) is always what we feed
  // downstream state; only the marker/status readout use `displayRobot`.
  const [displayRobot, setDisplayRobot] = useState<RobotSnapshot | null>(null)
    const targetRef = useRef<SpringVec | null>(null)
    const curRef = useRef<SpringVec | null>(null)
    // Battery is a status readout taken straight from the authoritative snapshot
    // (see the snapshot effect). A ref so the rAF loop can render it without
    // re-subscribing on every robot change.
    const batteryRef = useRef<number>(0)

  useEffect(() => {
    if (!robot) {
      targetRef.current = null
      curRef.current = null
      setDisplayRobot(null)
      return
    }
    targetRef.current = {
      x: robot.position.x,
      y: robot.position.y,
      heading: robot.heading_deg,
    }
    if (!curRef.current) {
      // Snap on first sighting / after a reset so we don't slide in from 0,0.
      curRef.current = { ...targetRef.current }
    }
    batteryRef.current = robot.battery_pct
    // Always reflect the authoritative snapshot's non-position fields immediately
    // (state, battery, waypoint index, completed ids) so a state change shows up
    // even when the spring is already settled; the rAF loop only refines x/y/
    // heading between snapshots. Battery is a status readout and must never lag
    // behind reality, so it is taken straight from the authoritative snapshot
    // (no spring smoothing) — only position/heading glide.
    setDisplayRobot({
      ...robot,
      position: { x: curRef.current.x, y: curRef.current.y },
      heading_deg: curRef.current.heading,
      battery_pct: robot.battery_pct,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robot])

  useEffect(() => {
    if (typeof window === "undefined") return
    let raf = 0
    let last = performance.now()
    // Critically-damped spring constants (per-second), framework-native easing.
    const STIFF = 12
    const DAMP = 2 * Math.sqrt(STIFF)
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const tgt = targetRef.current
      const cur = curRef.current
      if (tgt && cur && robot) {
        const k = Math.exp(-DAMP * dt)
        const f = 1 - k
        cur.x += (tgt.x - cur.x) * f
        cur.y += (tgt.y - cur.y) * f
        cur.heading = lerpAngle(cur.heading, tgt.heading, f)
        // Only push a render when the spring actually moved (avoids a 60fps
        // re-render storm when the robot is stationary or already settled).
        const settled =
          Math.abs(tgt.x - cur.x) < 0.05 &&
          Math.abs(tgt.y - cur.y) < 0.05 &&
          Math.abs(tgt.heading - cur.heading) < 0.05
        if (!settled) {
          setDisplayRobot({
            ...robot,
            position: { x: cur.x, y: cur.y },
            heading_deg: cur.heading,
            battery_pct: batteryRef.current,
          })
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robot])
  useEffect(() => {
    const client = new RobotWebSocketClient()
    client.onFrame((f) => {
      setFrame(f)
      // The WS frame carries `sim_time` at the top level and a subset of the
      // full status in `f.run` (status/finished/error). Merge only the run
      // fields so we don't clobber sim_time/waypoint_index/etc that live at
      // the frame level or were set by the REST poll.
      setSim((prev) => {
        const base: SimulationStatus = prev ?? {
          status: f.status ?? "stopped",
          mission_id: f.mission_id,
          sim_time: f.sim_time ?? 0,
          speed_factor: 1,
          waypoint_index: 0,
          waypoint_count: 0,
          completed_item_ids: [],
          finished: false,
          error: null,
          recent_events: [],
        }
        return {
          ...base,
          status: f.run?.status ?? f.status ?? base.status,
          sim_time: f.sim_time ?? base.sim_time,
          mission_id: f.mission_id ?? base.mission_id,
          finished: f.run?.finished ?? base.finished,
          error: f.run?.error ?? base.error,
        }
      })
    })
    client.onStatus(setConnection)
    client.connect()
    clientRef.current = client
    return () => client.close()
  }, [])

  // Brief REST poll so controls/status stay correct even before the first WS
  // frame and after reconnects. Cheap (no payload beyond status + plan).
  const refreshStatus = useCallback(async () => {
    try {
      const s = await getSimulationStatus()
      setSim(s)
    } catch {
      /* backend may be down; WS still delivers when available */
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [refreshStatus])

  // Load the navigation plan whenever the mission changes (read-only path).
  useEffect(() => {
    let cancelled = false
    getRobotNavPlan(missionId ?? undefined)
      .then((p) => {
        if (!cancelled) setPlan(p.waypoints ?? [])
      })
      .catch(() => {
        if (!cancelled) setPlan([])
      })
    return () => {
      cancelled = true
    }
  }, [missionId])

  // --- Command wrappers (no business logic; forward to backend) -----------
  const guard = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed")
    } finally {
      setBusy(false)
    }
  }

  const onStart = useCallback(
    (mid: number | null, speed: number) => guard(() => startSimulation(mid ?? undefined, speed)),
    [guard, refreshStatus]
  )
  const onPause = useCallback(() => guard(() => pauseSimulation()), [guard, refreshStatus])
  const onResume = useCallback(() => guard(() => resumeSimulation()), [guard, refreshStatus])
  const onStop = useCallback(() => guard(() => stopSimulation()), [guard, refreshStatus])
  const onReturnToDock = useCallback(
    () => guard(() => returnRobotToDock()),
    [guard, refreshStatus]
  )
  const onRecharge = useCallback(() => guard(() => rechargeRobot()), [guard, refreshStatus])
  const onReset = useCallback(() => guard(() => resetRobot()), [guard, refreshStatus])
  const onSpeedChange = useCallback(
    (v: number) => guard(() => startSimulation(missionId ?? undefined, v)),
    [guard, missionId, refreshStatus]
  )

  // Resolve tree ids of interest from the plan + snapshot (presentation only).
  const { destinationTreeId, harvestingTreeId, completedTreeIds, nextTreeId } = useMemo(() => {
    const completed = robot?.completed_item_ids ?? []
    // Map mission_item_id -> tree_id from the plan.
    const itemToTree = new Map<number, number>()
    for (const w of plan) if (w.mission_item_id != null && w.tree_id != null) itemToTree.set(w.mission_item_id, w.tree_id)
    const completedTrees = completed.map((id) => itemToTree.get(id)).filter((x): x is number => x != null)

    const wpIndex = robot?.waypoint_index ?? 0
    const destWp = plan[wpIndex]
    const destinationTreeId = destWp?.kind === "tree" ? destWp.tree_id : null
    const harvestingTreeId = robot?.state === "HARVESTING" ? destinationTreeId : null
    // Next tree after the current destination.
    const nextWp = plan[wpIndex + 1]
    const nextTreeId = nextWp?.kind === "tree" ? nextWp.tree_id : null

    return { destinationTreeId, harvestingTreeId, completedTreeIds: completedTrees, nextTreeId }
  }, [robot, plan])

  return {
    robot,
    displayRobot: displayRobot ?? robot,
    sim,
    plan,
    connection,
    busy,
    error,
    destinationTreeId,
    harvestingTreeId,
    completedTreeIds,
    nextTreeId,
    onStart,
    onPause,
    onResume,
    onStop,
    onReturnToDock,
    onRecharge,
    onReset,
    onSpeedChange,
    refreshStatus,
  }
}
