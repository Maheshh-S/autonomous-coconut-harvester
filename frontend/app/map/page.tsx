"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useTranslations } from "next-intl"
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
import PageHero from "@/components/PageHero"
import SkeletonRows from "@/components/SkeletonRows"
import ToggleSwitch from "@/components/ToggleSwitch"

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
// V3.6.1 — small visualization toggles (the pill switch itself now lives in
// components/ToggleSwitch, shared with /robot).

// V3.7.1 — the page reads `?tree=` via useSearchParams(), which forces a client
// render bailout; wrap in Suspense so the production build can still prerender it.
export default function FarmPage() {
  return (
    <Suspense fallback={<FarmSuspenseFallback />}>
      <FarmPageInner />
    </Suspense>
  )
}

// V5.0: the Suspense fallback is a client boundary so it can translate.
function FarmSuspenseFallback() {
  const t = useTranslations("twin")
  return (
    <div style={{ padding: 24, color: "var(--color-text-dim)" }}>{t("loadingFarm")}</div>
  )
}

function FarmPageInner() {
  // V5.0: twin chrome comes from the twin dictionary.
  const t = useTranslations("twin")
  const [missions, setMissions] = useState<MissionSummary[]>([])
  const [missionId, setMissionId] = useState<number | null>(null)
  const [tiles, setTiles] = useState<MosaicTile[]>([])
  const [trees, setTrees] = useState<TreeOverlay[]>([])
  const [gap, setGap] = useState(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missionsLoaded, setMissionsLoaded] = useState(false)

  // V3.7.1 — optional `?tree=<id>` focuses the twin on that tree (reused by the
  // Mission History "Open Digital Twin" link). Read-only focus; no new lookup.
  const searchParams = useSearchParams()
  const focusTreeId = searchParams.get("tree")
  const initialTreeId = focusTreeId != null ? Number(focusTreeId) : null

  // V3.6.1 — viz toggles (visualization-only viewer).
  const [showRobot, setShowRobot] = useState(true)
  const [showPath, setShowPath] = useState(true)
  const [showTarget, setShowTarget] = useState(true)
  // V2 (twin overhaul) — follow-camera: keep the live robot centered while the
  // simulation runs. Any manual pan/zoom suspends it (FarmViewer calls back).
  const [followRobot, setFollowRobot] = useState(false)

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
      .finally(() => setMissionsLoaded(true))
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
    ? treeCodeById.get(sim.harvestingTreeId) ?? t("treeCode", { id: sim.harvestingTreeId })
    : null
  const nextTreeCode = sim.nextTreeId
    ? treeCodeById.get(sim.nextTreeId) ?? t("treeCode", { id: sim.nextTreeId })
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
      <PageHero
        kicker={t("heroKicker")}
        title={t("heroTitle")}
        accent={t("heroAccent")}
        sub={t("heroSub")}
        clip="/clips/4.mp4"
        once
      />

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
            {t("missionLabel")}
          </span>
          {!missionsLoaded ? (
            <div style={{ height: 38, width: "100%", borderRadius: 8, background: "var(--color-surface-2)", opacity: 0.5, animation: "pulse 1.4s ease-in-out infinite" }} />
          ) : (
            <select
              value={missionId ?? ""}
              onChange={(e) => setMissionId(Number(e.target.value))}
              className="select"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id}
                  {m.status ? ` (${m.status})` : ""}
                  {m.source_folder ? ` — ${m.source_folder}` : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        <label style={{ display: "inline-flex", flexDirection: "column", gap: 5, minWidth: 200 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
            {t("seamGap", { gap })}
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
        <ToggleSwitch label={t("tglRobot")} on={showRobot} set={setShowRobot} />
        <ToggleSwitch label={t("tglPath")} on={showPath} set={setShowPath} />
        <ToggleSwitch label={t("tglTarget")} on={showTarget} set={setShowTarget} />
        <ToggleSwitch
          label={t("tglFollow")}
          on={followRobot}
          set={setFollowRobot}
        />
      </div>

      {loading && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <SkeletonRows rows={8} height={64} />
        </div>
      )}
      {error && <p style={{ color: "var(--color-crit)" }}>{error}</p>}
      {!loading && !error && tiles.length === 0 && (
        <div className="panel-2" style={{ padding: 24, color: "var(--color-text-dim)" }}>
          {t("noTiles")}
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
            {t("preV2Title")}
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--color-text-dim)" }}>
            {t("preV2BodyA")} <strong>Version 2</strong> {t("preV2BodyB")}<code>grid_row</code> /{" "}
            <code>grid_col</code>{t("preV2BodyC")}
          </p>
        </div>
      )}

      {!loading && !error && !isPreV2 && v2Tiles.length > 0 && (
        <>
          <p style={{ color: "var(--color-text-faint)", fontSize: 13, margin: "0 0 12px" }}>
            {t("tilesMeta", { count: v2Tiles.length })}
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
                followPoint={
                  followRobot && showRobot && sim.displayRobot
                    ? sim.displayRobot.position
                    : null
                }
                onFollowInterrupt={() => setFollowRobot(false)}
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
