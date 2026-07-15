"use client"

import { memo, useMemo } from "react"

export type MosaicTile = {
  id: number
  grid_row: number | null
  grid_col: number | null
  image_url: string | null
  image_width: number | null
  image_height: number | null
  capture_order?: number | null
}

type PlacedTile = MosaicTile & {
  row: number
  col: number
  x: number
  y: number
  w: number
  h: number
}

// Defensive zero-guard for a tile's pixel dimensions only — never a layout
// fallback. Version 2 persists image_width/height (§V2.5), so a genuine mission
// always supplies them; this merely stops a degenerate 0 from collapsing the
// canvas. The renderer never recomputes or synthesizes a grid position.
const MIN_TILE = 1

// V2.2 — Continuous Farm Mosaic Engine (PROJECT_SPECIFICATION.md §V2.4–§V2.6).
// Reconstructs the plantation as a grid of independent, un-warped tile images
// placed strictly by their persisted (grid_row, grid_col). No stitching, no
// orthomosaic, no GIS, and — critically — no layout recomputation: the caller
// (the /map page) guarantees every tile carries Version 2 grid metadata and
// shows an unsupported message otherwise. Mixed image sizes are honoured: each
// column takes the widest tile and each row the tallest, so frames stay
// grid-aligned with no overlap. A small, configurable gap de-emphasises the
// seams (Decision 1, §V2.6).
function FarmMosaic({
  tiles,
  gap = 2,
  apiBaseUrl,
}: {
  tiles: MosaicTile[]
  gap?: number
  apiBaseUrl?: string
}) {
  const placed = useMemo<PlacedTile[]>(() => {
    if (tiles.length === 0) return []

    // Invariant: every tile has persisted grid_row/grid_col (Version 2
    // metadata). The /map page enforces this and never passes a pre-V2 tile, so
    // no synthetic grid is ever built here.
    const colW = new Map<number, number>()
    const rowH = new Map<number, number>()
    for (const t of tiles) {
      const row = t.grid_row as number
      const col = t.grid_col as number
      const w = Math.max(t.image_width ?? 0, MIN_TILE)
      const h = Math.max(t.image_height ?? 0, MIN_TILE)
      colW.set(col, Math.max(colW.get(col) ?? 0, w))
      rowH.set(row, Math.max(rowH.get(row) ?? 0, h))
    }

    const maxCol = Math.max(...tiles.map((t) => t.grid_col as number))
    const maxRow = Math.max(...tiles.map((t) => t.grid_row as number))

    // Cumulative x offsets per column and y offsets per row (gap on both sides).
    const colX = new Array<number>(maxCol + 1)
    let x = gap
    for (let c = 0; c <= maxCol; c++) {
      colX[c] = x
      x += (colW.get(c) ?? MIN_TILE) + gap
    }
    const rowY = new Array<number>(maxRow + 1)
    let y = gap
    for (let r = 0; r <= maxRow; r++) {
      rowY[r] = y
      y += (rowH.get(r) ?? MIN_TILE) + gap
    }

    return tiles.map((t) => ({
      ...t,
      row: t.grid_row as number,
      col: t.grid_col as number,
      x: colX[t.grid_col as number],
      y: rowY[t.grid_row as number],
      w: Math.max(t.image_width ?? 0, MIN_TILE),
      h: Math.max(t.image_height ?? 0, MIN_TILE),
    }))
  }, [tiles, gap])

  const { width, height } = useMemo(() => {
    if (placed.length === 0) return { width: 0, height: 0 }
    let w = 0
    let h = 0
    for (const p of placed) {
      w = Math.max(w, p.x + p.w + gap)
      h = Math.max(h, p.y + p.h + gap)
    }
    return { width: w, height: h }
  }, [placed, gap])

  if (placed.length === 0) return null

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: "#0b0f0b",
        overflow: "auto",
        border: "1px solid #2c3a2c",
        borderRadius: 8,
      }}
    >
      {placed.map((p) =>
        p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`${apiBaseUrl ?? ""}${p.image_url}`}
            alt={`tile ${p.id}`}
            width={p.w}
            height={p.h}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              display: "block",
            }}
          />
        ) : (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              background: "#1a241a",
              color: "#6b7d6b",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            tile {p.id}
          </div>
        )
      )}
    </div>
  )
}

// Memoised so the Digital Twin Viewer can pan/zoom (transform on a wrapper)
// without re-rendering the mosaic layout on every frame (V2.3 performance:
// avoid unnecessary re-renders, keep FarmMosaic rendering single-source).
export default memo(FarmMosaic)
