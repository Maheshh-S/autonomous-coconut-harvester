import { MosaicTile } from "@/components/FarmMosaic"

// V2.4 — shared Farm-Mosaic layout (PROJECT_SPECIFICATION.md §V2.4–§V2.6).
// Both `FarmMosaic` (the rendering engine) and `OverlayLayer` (the tree overlay)
// must place geometry in the *same* farm-pixel coordinate space, otherwise tree
// boxes drift from their tiles. This single pure function is the one source of
// the transform; it is deliberately framework-free so it can be reused by the
// overlay without duplicating layout math or touching the rendering engine.
//
// Tile images are drawn 1:1 at their persisted `image_width/height`; column/row
// offsets are cumulative widths so mixed-size tiles stay grid-aligned (no
// overlap). A persisted tree detection's `local_pixel_*` / `bbox_*` are in that
// same tile-pixel space, so `farm = tile.(x,y) + local` aligns exactly.
export type PlacedTile = MosaicTile & {
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
// canvas. The layout is never recomputed or synthesized.
const MIN_TILE = 1

export function computeMosaicLayout(
  tiles: MosaicTile[],
  gap = 2
): PlacedTile[] {
  if (tiles.length === 0) return []

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
}
