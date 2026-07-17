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
import AmbientClip from "@/components/AmbientClip"

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
        gap: 8,
        fontSize: 13,
        color: "var(--color-text-dim)",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        onClick={(e) => {
          e.preventDefault()
          set(!on)
        }}
        style={{
          position: "relative",
          width: 36,
          height: 20,
          borderRadius: 99,
          background: on ? "var(--color-accent-dim)" : "var(--color-surface-3)",
          border: "1px solid var(--color-line-strong)",
          transition: "background 0.2s var(--ease-out)",
          flex: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: on ? 15 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: on ? "var(--color-accent-bright)" : "var(--color-text-faint)",
            transition: "left 0.2s var(--ease-out), background 0.2s",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      {label}
    </label>
  )
}

// V3.7.1 — the page reads `?tree=` via useSearchParams(), which forces a client
// render bailout; wrap in Suspense so the production build can still prerender it.
export default function FarmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--color-text-dim)" }}>Loading farm…</div>}>
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
    <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1500, margin: "0 auto" }}>
      <header
        style={{
          position: "relative",
          marginBottom: 22,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--color-line)",
          padding: "30px clamp(20px,3vw,40px)",
        }}
      >
        <AmbientClip src="/clips/4.mp4" opacity={0.22} once />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(14,18,13,0.84), rgba(14,18,13,0.45) 55%, transparent), radial-gradient(120% 140% at 0% 0%, rgba(14,18,13,0.5), transparent)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="kicker">Digital Twin · Mosaic</div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.03em" }}
          >
            Farm <span className="lede-accent">Digital Twin</span>
          </h1>
          <p style={{ color: "var(--color-text-dim)", margin: 0, maxWidth: 640 }}>
            A living reconstruction of the surveyed plantation — tile mosaic, tree
            detections, and the live robot overlaid in one shared coordinate space.
          </p>
        </div>
      </header>

      <div
        className="panel-2"
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          padding: "14px 18px",
        }}
      >
        <label style={{ display: "inline-flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
            Mission
          </span>
          <select
            value={missionId ?? ""}
            onChange={(e) => setMissionId(Number(e.target.value))}
            style={selectStyle}
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

        <label style={{ display: "inline-flex", flexDirection: "column", gap: 5, minWidth: 200 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
            Seam gap · {gap}px
          </span>
          <input
            type="range"
            min={0}
            max={24}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            style={{ accentColor: "var(--color-accent)", width: "100%" }}
          />
        </label>

        <span style={{ width: 1, height: 30, background: "var(--color-line)" }} />

        {/* V3.6.1 — visualization-only toggles (no robot controls on this page) */}
        <Toggle label="Show Robot" on={showRobot} set={setShowRobot} />
        <Toggle label="Show Planned Path" on={showPath} set={setShowPath} />
        <Toggle label="Show Current Target" on={showTarget} set={setShowTarget} />
      </div>

      {loading && <p style={{ color: "var(--color-text-dim)" }}>Loading tiles…</p>}
      {error && <p style={{ color: "var(--color-crit)" }}>{error}</p>}
      {!loading && !error && tiles.length === 0 && (
        <div className="panel-2" style={{ padding: 24, color: "var(--color-text-dim)" }}>
          No tiles found for this mission.
        </div>
      )}

      {!loading && !error && isPreV2 && (
        <div
          style={{
            border: "1px solid var(--color-gold-dim)",
            background: "rgba(245, 196, 81, 0.07)",
            color: "var(--color-gold)",
            borderRadius: 14,
            padding: 18,
            maxWidth: 560,
          }}
        >
          <h2 className="font-display" style={{ marginTop: 0, fontSize: 18 }}>
            Digital Twin not available
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--color-text-dim)" }}>
            This mission was surveyed before <strong>Version 2</strong> and has no
            persisted tile-grid metadata (<code>grid_row</code> /{" "}
            <code>grid_col</code>).
          </p>
        </div>
      )}

      {!loading && !error && !isPreV2 && v2Tiles.length > 0 && (
        <>
          <p style={{ color: "var(--color-text-faint)", fontSize: 13, margin: "0 0 12px" }}>
            {v2Tiles.length} tiles · grid reconstructed from persisted Version 2
            metadata.
          </p>
          <div className="map-layout">
            <div className="panel" style={{ padding: 10, overflow: "hidden" }}>
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
        </>
      )}

      <style jsx>{`
        .map-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .map-layout {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .map-layout :global(.panel) {
            order: 0;
          }
          .map-layout > :global(div:last-child) {
            order: 1;
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
