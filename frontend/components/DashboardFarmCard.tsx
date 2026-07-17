"use client"

import { useEffect, useMemo, useState } from "react"
import {
  API_BASE_URL,
  getMissions,
  getMissionTiles,
  getMissionTreeOverlays,
} from "@/lib/api/detection"
import type { TreeOverlay } from "@/lib/api/detection"
import FarmViewer from "@/components/FarmViewer"
import { MosaicTile } from "@/components/FarmMosaic"

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: 12,
  padding: 16,
  border: "1px solid var(--color-line)",
  boxShadow: "none",
}

// Small interactive Farm Viewer for the dashboard. Mirrors the /map fetch logic
// (most recent Version 2 mission with persisted tile-grid metadata) and embeds
// the viewer with an "expand" control that navigates to the full /map page
// (Google-Maps-like: small preview → expand → dedicated Digital Twin view).
export default function DashboardFarmCard() {
  const [missions, setMissions] = useState<{ id: number; name?: string }[]>([])
  const [missionId, setMissionId] = useState<number | null>(null)
  const [tiles, setTiles] = useState<MosaicTile[]>([])
  const [trees, setTrees] = useState<TreeOverlay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMissions()
      .then((d) => {
        const ms = d.missions ?? []
        setMissions(ms)
        if (ms[0]) setMissionId(ms[0].id)
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (missionId == null) return
    setLoading(true)
    setError(null)
    setTrees([])
    getMissionTiles(missionId)
      .then((d) =>
        setTiles(
          (d.tiles ?? []).map((t: any) => ({
            id: t.id,
            grid_row: t.grid_row ?? null,
            grid_col: t.grid_col ?? null,
            image_url: t.image_url ?? null,
            image_width: t.image_width ?? null,
            image_height: t.image_height ?? null,
            capture_order: t.capture_order ?? null,
          }))
        )
      )
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))

    // V2.4 — persisted representative tree overlays for this mission.
    getMissionTreeOverlays(missionId)
      .then((d) => setTrees(d.trees ?? []))
      .catch(() => setTrees([]))
  }, [missionId])

  const v2Tiles = useMemo(
    () => tiles.filter((t) => t.grid_row != null && t.grid_col != null),
    [tiles]
  )
  const isPreV2 =
    tiles.length > 0 && tiles.some((t) => t.grid_row == null || t.grid_col == null)

  return (
    <div style={card}>
      <div
        style={{
          fontWeight: 600,
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          color: "var(--color-text)",
        }}
      >
        <span>Digital Twin — Farm Mosaic</span>
        {missions.length > 1 && (
          <select
            value={missionId ?? ""}
            onChange={(e) => setMissionId(Number(e.target.value))}
            style={{
              fontSize: 13,
              padding: "4px 6px",
              borderRadius: 6,
              background: "var(--color-surface-2)",
              color: "var(--color-text)",
              border: "1px solid var(--color-line-strong)",
            }}
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? `Mission ${m.id}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <p style={{ color: "var(--color-text-faint)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--color-crit)" }}>{error}</p>}
      {!loading && !error && tiles.length === 0 && (
        <p style={{ color: "var(--color-text-faint)" }}>No tiles found.</p>
      )}
      {!loading && !error && isPreV2 && (
        <p style={{ color: "var(--color-husk)" }}>
          This mission was surveyed before Version 2 and has no persisted
          tile-grid metadata. Re-survey to enable the Digital Twin.
        </p>
      )}
      {!loading && !error && !isPreV2 && v2Tiles.length > 0 && (
        <FarmViewer
          tiles={v2Tiles}
          gap={2}
          apiBaseUrl={API_BASE_URL}
          height={360}
          minHeight={280}
          expandHref="/map"
          trees={trees}
        />
      )}
    </div>
  )
}
