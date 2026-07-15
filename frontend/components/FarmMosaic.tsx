"use client"

import { memo, useMemo } from "react"
import { computeMosaicLayout } from "@/lib/mosaicLayout"

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

// V2.2 — Continuous Farm Mosaic Engine (PROJECT_SPECIFICATION.md §V2.4–§V2.6).
// Reconstructs the plantation as a grid of independent, un-warped tile images
// placed strictly by their persisted (grid_row, grid_col). No stitching, no
// orthomosaic, no GIS, and — critically — no layout recomputation: the caller
// (the /map page) guarantees every tile carries Version 2 grid metadata and
// shows an unsupported message otherwise. Mixed image sizes are honoured: each
// column takes the widest tile and each row the tallest, so frames stay
// grid-aligned with no overlap. A small, configurable gap de-emphasises the
// seams (Decision 1, §V2.6). The layout math lives in `computeMosaicLayout`
// (lib/mosaicLayout.ts) so the tree overlay shares the exact same coordinate
// space (§V2.4) without duplicating it.
function FarmMosaic({
  tiles,
  gap = 2,
  apiBaseUrl,
}: {
  tiles: MosaicTile[]
  gap?: number
  apiBaseUrl?: string
}) {
  const placed = useMemo<PlacedTile[]>(
    () => computeMosaicLayout(tiles, gap),
    [tiles, gap]
  )

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
