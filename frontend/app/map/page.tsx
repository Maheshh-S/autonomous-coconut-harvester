"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  API_BASE_URL,
  getMissions,
  getMissionTiles,
  getMissionTreeOverlays,
} from "@/lib/api/detection"
import type { TreeOverlay } from "@/lib/api/detection"
import FarmViewer from "@/components/FarmViewer"
import { MosaicTile } from "@/components/FarmMosaic"
import { useRobotSimulation } from "@/lib/useRobotSimulation"
import RobotStatusCard from "@/components/robot/RobotStatusCard"

type MissionSummary = {
  id: number
  status?: string
  source_folder?: string
  created_at?: string
}

// V2.2 — Continuous Farm Mosaic Engine + V3.6.1 Robot overlay. This page is the
// read-only Digital Twin Farm Viewer. Per V3.6.1 it is VISUALIZATION-ONLY: no
// Start/Pause/Resume/Stop/Recharge/Reset controls (those live on /robot). It
// shows the live robot (+ planned path + current target) with viewer toggles and
// a status readout. The mosaic is a SURVEY mission; the robot follows a HARVEST
// mission (different entities — the robot executes a planned harvest while the
// twin shows the surveyed farm).
// V3.6.1 — small visualization toggle (module scope so it is NOT re-created on
// every render; an inline component would remount its subtree each frame, which
// the rAF-driven display loop makes constant).
function Toggle({
  label,
  on,
  set,
}: {
  label: string
  on: boolean
  set: (v: boolean) => void
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  )
}

// V3.7.1 — the page reads `?tree=` via useSearchParams(), which forces a client
// render bailout; wrap in Suspense so the production build can still prerender it.
export default function FarmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading farm…</div>}>
      <FarmPageInner />
    </Suspense>
  )
}

function FarmPageInner() {
  const [missions, setMissions] = useState<MissionSummary[]>([])
  const [missionId, setMissionId] = useState<number | null>(null)
  const [tiles, setTiles] = useState<MosaicTile[]>([])
  const [trees, setTrees] = useState<TreeOverlay[]>([])
  const [gap, setGap] = useState(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // V3.7.1 — optional `?tree=<id>` focuses the twin on that tree (reused by the
  // Mission History "Open Digital Twin" link). Read-only focus; no new lookup.
  const searchParams = useSearchParams()
  const focusTreeId = searchParams.get("tree")
  const initialTreeId = focusTreeId != null ? Number(focusTreeId) : null

  // V3.6.1 — viz toggles (visualization-only viewer).
  const [showRobot, setShowRobot] = useState(true)
  const [showPath, setShowPath] = useState(true)
  const [showTarget, setShowTarget] = useState(true)

  // V3.6 — robot simulation state (single WS connection, owned here). Driven by
  // the current harvest mission the dashboard/scheduler exposes; the hook reads
  // the latest one itself, so we don't need a harvest-mission selector here.
  const sim = useRobotSimulation(null)

  useEffect(() => {
    getMissions()
      .then((d) => {
        const ms: MissionSummary[] = d.missions ?? []
        setMissions(ms)
        if (ms.length > 0) setMissionId(ms[0].id)
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (missionId == null) return
    setLoading(true)
    setError(null)
    setTrees([])
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

  const tilesMissingMeta = useMemo(
    () => tiles.filter((t) => t.grid_row == null || t.grid_col == null).length,
    [tiles]
  )
  const isPreV2 = tiles.length > 0 && tilesMissingMeta > 0
  const v2Tiles = useMemo(
    () => tiles.filter((t) => t.grid_row != null && t.grid_col != null),
    [tiles]
  )

  return (
    <div style={{ padding: 20 }}>
      <h1>Farm Digital Twin — Mosaic</h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <label>
          Mission:{" "}
          <select
            value={missionId ?? ""}
            onChange={(e) => setMissionId(Number(e.target.value))}
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id}
                {m.status ? ` (${m.status})` : ""}
                {m.source_folder ? ` — ${m.source_folder}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          Seam gap: {gap}px{" "}
          <input
            type="range"
            min={0}
            max={24}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
          />
        </label>

        <span style={{ width: 1, height: 22, background: "#e5e7eb" }} />

        {/* V3.6.1 — visualization-only toggles (no robot controls on this page) */}
        <Toggle label="Show Robot" on={showRobot} set={setShowRobot} />
        <Toggle label="Show Planned Path" on={showPath} set={setShowPath} />
        <Toggle label="Show Current Target" on={showTarget} set={setShowTarget} />
      </div>

      {loading && <p>Loading tiles…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && tiles.length === 0 && (
        <p>No tiles found for this mission.</p>
      )}

      {!loading && !error && isPreV2 && (
        <div
          style={{
            border: "1px solid #5a3a1a",
            background: "#2a1c10",
            color: "#e8c89a",
            borderRadius: 8,
            padding: 16,
            maxWidth: 560,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Digital Twin not available</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            This mission was surveyed before <strong>Version 2</strong> and has no
            persisted tile-grid metadata (<code>grid_row</code> /{" "}
            <code>grid_col</code>).
          </p>
        </div>
      )}

      {!loading && !error && !isPreV2 && v2Tiles.length > 0 && (
        <>
          <p style={{ color: "#6b7d6b", fontSize: 13 }}>
            {v2Tiles.length} tiles · grid reconstructed from persisted Version 2
            metadata.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 16, alignItems: "start" }}>
            <FarmViewer
              tiles={v2Tiles}
              gap={gap}
              apiBaseUrl={API_BASE_URL}
              trees={trees}
              enableDetailsPanel
              robot={showRobot ? sim.displayRobot : null}
              plan={sim.plan}
              destinationTreeId={sim.destinationTreeId}
              harvestingTreeId={sim.harvestingTreeId}
              completedTreeIds={sim.completedTreeIds}
              showRobotPath={showPath}
              showRobotTarget={showTarget}
              initialTreeId={initialTreeId}
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
        </>
      )}
    </div>
  )
}
