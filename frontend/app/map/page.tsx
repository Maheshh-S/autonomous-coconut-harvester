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

type MissionSummary = {
  id: number
  status?: string
  source_folder?: string
  created_at?: string
}

// V2.2 — Continuous Farm Mosaic Engine (PROJECT_SPECIFICATION.md §V2.11, Decision 5:
// the twin replaces /map). This page is the rendering foundation of the Digital
// Twin Farm Viewer: it reconstructs the surveyed plantation from persisted
// SurveyTile metadata. No overlays, no interaction, no controls beyond choosing
// the mission and tuning the seam gap.
export default function FarmPage() {
  const [missions, setMissions] = useState<MissionSummary[]>([])
  const [missionId, setMissionId] = useState<number | null>(null)
  const [tiles, setTiles] = useState<MosaicTile[]>([])
  const [trees, setTrees] = useState<TreeOverlay[]>([])
  const [gap, setGap] = useState(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    // V2.4 — persisted representative tree overlays for this mission (one bulk
    // call; no per-tree round-trips, §V2.10).
    getMissionTreeOverlays(missionId)
      .then((d) => setTrees(d.trees ?? []))
      .catch(() => setTrees([]))
  }, [missionId])

  // Version 2 freezes layout persistence: the mosaic requires every tile to carry
  // persisted grid metadata (grid_row/grid_col, §V2.4–§V2.5). A mission that
  // lacks it was surveyed before Version 2 and cannot be rendered as a twin — we
  // show an unsupported message rather than synthesizing a layout.
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
            <code>grid_col</code>). The Farm Twin mosaic requires Version 2 survey
            processing, which freezes the layout in the database. The renderer does
            not recompute or synthesize a grid from capture order.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 0 }}>
            Re-survey the plantation (or re-run tile generation) to enable the
            Digital Twin for this mission.
          </p>
        </div>
      )}

      {!loading && !error && !isPreV2 && v2Tiles.length > 0 && (
        <>
          <p style={{ color: "#6b7d6b", fontSize: 13 }}>
            {v2Tiles.length} tiles · grid reconstructed from persisted Version 2
            metadata.
          </p>
          <FarmViewer
            tiles={v2Tiles}
            gap={gap}
            apiBaseUrl={API_BASE_URL}
            trees={trees}
            enableDetailsPanel
          />
        </>
      )}
    </div>
  )
}
