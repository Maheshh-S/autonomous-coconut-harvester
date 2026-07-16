"use client"

import { useEffect, useMemo, useState } from "react"
import {
  API_BASE_URL,
  getMissions,
  getHarvestMissions,
  getMissionTiles,
  getMissionTreeOverlays,
  getSimulationConfig,
} from "@/lib/api/detection"
import type { TreeOverlay } from "@/lib/api/detection"
import { MosaicTile } from "@/components/FarmMosaic"
import FarmViewer from "@/components/FarmViewer"
import { useRobotSimulation } from "@/lib/useRobotSimulation"
import SimulationControls from "@/components/robot/SimulationControls"
import RobotStatusCard from "@/components/robot/RobotStatusCard"

// --- Legacy V1 Task-based robot service (LIVE, kept per AGENTS.md) ----------
type Task = {
  task_id: number
  tree_id: number
  coconut_id: number
  status: string
}

// V3.6 — Robot Control Centre. The /robot page hosts the simulation control
// panel (commands, status card) plus the legacy task interface (still live).
// The mosaic is a SURVEY mission; the robot simulation is a HARVEST mission.
export default function RobotPage() {
  const [missions, setMissions] = useState<number[]>([])
  const [missionId, setMissionId] = useState<number | null>(null)
  const [harvestMissions, setHarvestMissions] = useState<
    { id: number; mission_code: string | null; status: string }[]
  >([])
  const [harvestMissionId, setHarvestMissionId] = useState<number | null>(null)
  const [tiles, setTiles] = useState<MosaicTile[]>([])
  const [trees, setTrees] = useState<TreeOverlay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // V3.7.3 — the default simulation speed is backend-owned; initialise the
  // control to it so the value lives in one place (not duplicated on the client).
  const [defaultSpeedFactor, setDefaultSpeedFactor] = useState(1)

  useEffect(() => {
    getSimulationConfig()
      .then((c) => setDefaultSpeedFactor(c.default_speed_factor))
      .catch(() => setDefaultSpeedFactor(1))
  }, [])

  const sim = useRobotSimulation(harvestMissionId)

  // Legacy task state
  const [task, setTask] = useState<Task | null>(null)
  const [taskMessage, setTaskMessage] = useState("")
 

   useEffect(() => {
    getMissions()
      .then((d) => {
        const ids = (d.missions ?? []).map((m: { id: number }) => m.id)
        setMissions(ids)
        if (ids.length > 0) setMissionId(ids[0])
      })
      .catch((e) => setError(String(e)))

    getHarvestMissions()
      .then((d) => {
        const hs = d.missions ?? []
        setHarvestMissions(hs)
        const active = hs.find(
          (m: { status: string }) =>
            m.status === "CREATED" || m.status === "RUNNING" || m.status === "PAUSED"
        )
        if (active) setHarvestMissionId(active.id)
        else if (hs.length > 0) setHarvestMissionId(hs[0].id)
      })
      .catch(() => setHarvestMissions([]))
  }, [])

  useEffect(() => {
    if (missionId == null) return
    setLoading(true)
    setError(null)
    getMissionTiles(missionId)
      .then((d) => {
        setTiles(
          (d.tiles ?? []).map((t: Record<string, unknown>) => ({
            id: t.id as number,
            grid_row: (t.grid_row as number) ?? null,
            grid_col: (t.grid_col as number) ?? null,
            image_url: (t.image_url as string) ?? null,
            image_width: (t.image_width as number) ?? null,
            image_height: (t.image_height as number) ?? null,
            capture_order: (t.capture_order as number) ?? null,
          }))
        )
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))

    getMissionTreeOverlays(missionId)
      .then((d) => setTrees(d.trees ?? []))
      .catch(() => setTrees([]))
  }, [missionId])

  // Legacy task loader
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/robot/next_task`, { cache: "no-store" })
        if (!res.ok) {
          if (active) setTaskMessage(`Could not reach the robot service (${res.status}).`)
          return
        }
        const data = await res.json()
        if (active) {
          if (data.message) {
            setTaskMessage(data.message)
            setTask(null)
          } else {
            setTask(data)
            setTaskMessage("")
          }
        }
      } catch {
        if (active) setTaskMessage("Could not reach the robot service.")
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function completeTask() {
    if (!task) return
    await fetch(`${API_BASE_URL}/robot/complete_task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.task_id }),
    })
    setTask(null)
    setTaskMessage("Task completed. No further tasks.")
  }

  const treeCodeById = useMemo(() => {
    const m = new Map<number, string>()
    for (const t of trees) if (t.tree_code) m.set(t.tree_id, t.tree_code)
    return m
  }, [trees])

  const currentTreeCode = sim.harvestingTreeId
    ? treeCodeById.get(sim.harvestingTreeId) ?? `Tree ${sim.harvestingTreeId}`
    : null
  const nextTreeCode = sim.nextTreeId
    ? treeCodeById.get(sim.nextTreeId) ?? `Tree ${sim.nextTreeId}`
    : null

  const v2Tiles = useMemo(
    () => tiles.filter((t) => t.grid_row != null && t.grid_col != null),
    [tiles]
  )

  return (
    <div style={{ padding: 20 }}>
      <h1>Robot Control</h1>

      {/* V3.6 — Simulation Control Centre */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
          background: "#fafafa",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Simulation Control Centre (V3.6)</h2>

        <label style={{ display: "inline-block", marginBottom: 12 }}>
          Harvest Mission:{" "}
          <select
            value={harvestMissionId ?? ""}
            onChange={(e) => setHarvestMissionId(Number(e.target.value))}
          >
            {harvestMissions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.mission_code ?? `#${m.id}`} ({m.status})
              </option>
            ))}
          </select>
        </label>

        <SimulationControls
          simStatus={sim.sim?.status ?? "stopped"}
          missionId={harvestMissionId}
          speedFactor={sim.sim?.speed_factor ?? defaultSpeedFactor}
          defaultSpeedFactor={defaultSpeedFactor}
          onStart={sim.onStart}
          onPause={sim.onPause}
          onResume={sim.onResume}
          onReturnToDock={sim.onReturnToDock}
          onRecharge={sim.onRecharge}
          onReset={sim.onReset}
          onSpeedChange={sim.onSpeedChange}
          busy={sim.busy}
          error={sim.error}
        />

        {loading && <p>Loading twin…</p>}
        {error && <p style={{ color: "crimson" }}>{error}</p>}

        {!loading && !error && v2Tiles.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 320px",
              gap: 16,
              alignItems: "start",
              marginTop: 16,
            }}
          >
            <FarmViewer
              tiles={v2Tiles}
              gap={2}
              apiBaseUrl={API_BASE_URL}
              trees={trees}
              robot={sim.displayRobot}
              plan={sim.plan}
              destinationTreeId={sim.destinationTreeId}
              harvestingTreeId={sim.harvestingTreeId}
              completedTreeIds={sim.completedTreeIds}
            />
            <RobotStatusCard
              robot={sim.displayRobot}
              sim={sim.sim}
              currentTreeCode={currentTreeCode}
              nextTreeCode={nextTreeCode}
              distanceRemaining={null}
              connection={sim.connection}
            />
          </div>
        )}
      </div>

      {/* Legacy V1 Task interface (still live) */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Legacy Task Queue</h2>
        {taskMessage && <p>{taskMessage}</p>}
        {task && (
          <div>
            <p>Task ID: {task.task_id}</p>
            <p>Tree ID: {task.tree_id}</p>
            <p>Coconut ID: {task.coconut_id}</p>
            <p>Status: {task.status}</p>
            <button
              onClick={completeTask}
              style={{ marginTop: 10, padding: 10, background: "green", color: "white" }}
            >
              Complete Task
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
