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
import AmbientClip from "@/components/AmbientClip"

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
    <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1500, margin: "0 auto" }}>
      <header
        style={{
          position: "relative",
          marginBottom: 22,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--color-line)",
          padding: "34px clamp(20px,3vw,40px)",
        }}
      >
        <AmbientClip src="/clips/5.mp4" opacity={0.22} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(14,18,13,0.82), rgba(14,18,13,0.4) 55%, transparent), radial-gradient(120% 140% at 0% 0%, rgba(14,18,13,0.5), transparent)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="kicker">Telemetry · Control</div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.03em" }}
          >
            Robot <span className="lede-accent">Control Centre</span>
          </h1>
          <p style={{ color: "var(--color-text-dim)", margin: 0, maxWidth: 640 }}>
            Command the harvester simulation, watch live telemetry, and trace its
            route across the twin. Mission logic is owned by the backend.
          </p>
        </div>
      </header>

      {/* V3.6 — Simulation Control Centre */}
      <section className="panel" style={{ padding: 22, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h2 className="font-display" style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>
            Simulation Control Centre
          </h2>
          <label style={{ display: "inline-flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
              Harvest Mission
            </span>
            <select
              value={harvestMissionId ?? ""}
              onChange={(e) => setHarvestMissionId(Number(e.target.value))}
              style={selectStyle}
            >
              {harvestMissions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.mission_code ?? `#${m.id}`} ({m.status})
                </option>
              ))}
            </select>
          </label>
        </div>

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

        {loading && <p style={{ color: "var(--color-text-dim)", marginTop: 16 }}>Loading twin…</p>}
        {error && <p style={{ color: "var(--color-crit)", marginTop: 16 }}>{error}</p>}

        {!loading && !error && v2Tiles.length > 0 && (
          <div className="robot-map-layout">
            <div className="panel-2" style={{ padding: 10, overflow: "hidden" }}>
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
            </div>
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
      </section>

      {/* Legacy V1 Task interface (still live) */}
      <section className="panel-2" style={{ padding: 22 }}>
        <h2 className="font-display" style={{ fontSize: 18, margin: "0 0 12px", fontWeight: 600 }}>
          Legacy Task Queue
        </h2>
        {taskMessage && <p style={{ color: "var(--color-text-dim)" }}>{taskMessage}</p>}
        {task && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <Field label="Task ID" value={task.task_id} />
            <Field label="Tree ID" value={task.tree_id} />
            <Field label="Coconut ID" value={task.coconut_id} />
            <Field label="Status" value={task.status} />
            <button
              type="button"
              onClick={completeTask}
              className="btn btn-primary"
              style={{ height: 42 }}
            >
              Complete Task
            </button>
          </div>
        )}
      </section>

      <style jsx>{`
        .robot-map-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: start;
          margin-top: 18px;
        }
        @media (max-width: 900px) {
          .robot-map-layout {
            grid-template-columns: 1fr;
            gap: 14px;
            margin-top: 16px;
          }
        }
      `}</style>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  border: "1px solid var(--color-line-strong)",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
  minWidth: 220,
  cursor: "pointer",
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-text-faint)", fontFamily: "var(--font-mono)", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  )
}
