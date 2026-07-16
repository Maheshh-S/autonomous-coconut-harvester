"use client"

import { useMemo, useState } from "react"
import { computeMosaicLayout } from "@/lib/mosaicLayout"
import type { MosaicTile } from "@/components/FarmMosaic"
import type { TreeOverlay } from "@/lib/api/detection"

// V2.4 + V2.6 — Interactive Tree Overlay (PROJECT_SPECIFICATION.md §V2.4–§V2.8,
// §V2.10). Renders the persisted representative `TreeObservation` of each
// Permanent Tree as a YOLO bounding box on top of the Farm Mosaic. Responsibilities
// are kept strictly separated (FarmMosaic ↓ OverlayLayer ↓ InteractionLayer future
// V2.5): this component only *renders* overlays from already-resolved data — it
// never recomputes observations, never derives boxes from YOLO, and carries no
// business logic.
//
// Coordinate alignment: every box is placed in the *same* farm-pixel space the
// mosaic uses, via the shared `computeMosaicLayout` (no duplicated transform).
// The layer is mounted inside FarmViewer's transformed stage, so it inherits
// zoom / pan / fit for free and never re-implements the transform.
//
// Readability while zooming: the stage scales the whole layer, so box *size*
// tracks the canvas (zoom in → box grows), while border thickness and label
// font are counter-scaled by 1/scale so they stay a constant screen size
// (Google-Maps-like) instead of becoming hairline-thin or huge.
//
// V2.6 performance (§V2.10 / VERSION 2.6 prompt):
//   - Viewport culling: only boxes intersecting the visible farm-pixel rectangle
//     are rendered. The rect is derived from the current scale / translation /
//     viewport size in farm-pixel space (no GPS approximation).
//   - Label LOD: zoom < 20% hides labels (boxes only); 20–40% shows the selected /
//     hovered label; > 40% shows all labels. The selected tree's label is ALWAYS
//     visible.
//   - Both recompute only when the view (committed at gesture end) or data
//     changes — pan/zoom write the transform directly in FarmViewer, so this
//     layer is never re-rendered mid-gesture.
export default function OverlayLayer({
  trees,
  tiles,
  gap = 2,
  scale = 1,
  // V2.6 — current transform + viewport size, used for viewport culling.
  tx = 0,
  ty = 0,
  viewportWidth = 0,
  viewportHeight = 0,
  selectedTreeId,
}: {
  trees: TreeOverlay[]
  tiles: MosaicTile[]
  gap?: number
  scale?: number
  // V2.6 — current transform + viewport size for viewport culling (farm-pixel rect).
  tx?: number
  ty?: number
  viewportWidth?: number
  viewportHeight?: number
  selectedTreeId?: number | null
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  // tile id -> top-left farm-pixel position (single source: shared layout).
  const placedByTile = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    for (const p of computeMosaicLayout(tiles, gap)) map.set(p.id, { x: p.x, y: p.y })
    return map
  }, [tiles, gap])

  const s = Math.max(scale, 0.0001)
  const borderW = 1 / s
  const fontPx = 12 / s
  const radius = 2 / s

  // V2.6 — Level-of-Detail by zoom percentage (§V2.8 / prompt RULE 3).
  //   < 20% : boxes only; labels + centroid hidden (selected/hovered excepted).
  //   20–40%: boxes + selected/hovered label (+ centroid).
  //   > 40% : boxes + all labels (+ centroid).
  // The selected tree's label is ALWAYS visible (prompt requirement).
  const percent = scale * 100
  const lodLabelsAll = percent >= 40
  const lodLabelsSelectedOnly = percent >= 20

  // V2.6 — visible farm-pixel rectangle from the current scale / translation /
  // viewport size. A small screen-space margin (~64px) avoids edge popping.
  // When the viewport size is still unknown (pre-mount) we return null and the
  // caller renders everything, so there is no flash of empty overlay.
  const cullRect = useMemo(() => {
    if (viewportWidth <= 0 || viewportHeight <= 0) return null
    const margin = 64 / s // ~64 screen px buffer, in farm-pixel units
    return {
      left: -tx / s - margin,
      top: -ty / s - margin,
      right: (viewportWidth - tx) / s + margin,
      bottom: (viewportHeight - ty) / s + margin,
    }
  }, [tx, ty, s, viewportWidth, viewportHeight])

  // V2.6 — culled + visible tree list. Memoised so it only recomputes when the
  // view, trees, or selection actually change — never per animation frame.
  // Selected / hovered trees are never culled so the highlight + drawer stay live
  // even when panned off-screen.
  const visible = useMemo(() => {
    const out: TreeOverlay[] = []
    for (const t of trees) {
      const place = placedByTile.get(t.survey_tile_id)
      if (!place) continue // representative tile not in this mission's mosaic
      const isActive = t.tree_id === selectedTreeId || t.tree_id === hoveredId
      if (!isActive && cullRect) {
        const left = place.x + t.bbox_x1
        const top = place.y + t.bbox_y1
        const w = Math.max(t.bbox_x2 - t.bbox_x1, 1)
        const h = Math.max(t.bbox_y2 - t.bbox_y1, 1)
        if (
          left > cullRect.right ||
          left + w < cullRect.left ||
          top > cullRect.bottom ||
          top + h < cullRect.top
        ) {
          continue // off-screen
        }
      }
      out.push(t)
    }
    return out
  }, [trees, placedByTile, cullRect, selectedTreeId, hoveredId])

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {visible.map((t) => {
        const place = placedByTile.get(t.survey_tile_id)
        if (!place) return null

        const left = place.x + t.bbox_x1
        const top = place.y + t.bbox_y1
        const w = Math.max(t.bbox_x2 - t.bbox_x1, 1)
        const h = Math.max(t.bbox_y2 - t.bbox_y1, 1)

        const selected = t.tree_id === selectedTreeId
        const hovered = t.tree_id === hoveredId
        const active = selected || hovered

        const borderColor = selected ? "#facc15" : hovered ? "#d6ffd6" : "rgba(120,220,140,0.85)"
        const fill = selected
          ? "rgba(250,204,21,0.18)"
          : hovered
          ? "rgba(180,255,180,0.12)"
          : "rgba(120,220,140,0.05)"
        const cursor = "pointer"

        // V2.6 LOD — centroid marker is a label-like detail: hidden far out,
        // shown once zoomed in (or when the tree is selected / hovered).
        const showCentroid = active || percent >= 20
        // Selected label is always visible; otherwise gated by the LOD band and a
        // minimum on-screen box size so a label never renders on a sub-pixel box.
        const showLabel =
          (selected || lodLabelsAll || (lodLabelsSelectedOnly && hovered)) &&
          w * s > 8 &&
          h * s > 6

        return (
          <div
            key={t.tree_id}
            data-tree-id={t.tree_id}
            onMouseEnter={() => setHoveredId(t.tree_id)}
            onMouseLeave={() => setHoveredId((id) => (id === t.tree_id ? null : id))}
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              boxSizing: "border-box",
              border: `${borderW}px solid ${borderColor}`,
              background: fill,
              borderRadius: radius,
              pointerEvents: "auto",
              cursor,
            }}
          >
            {/* centroid marker from the persisted local_pixel_* */}
            {showCentroid && (
              <div
                data-tree-centroid={t.tree_id}
                style={{
                  position: "absolute",
                  left: t.local_pixel_x - (3 / s),
                  top: t.local_pixel_y - (3 / s),
                  width: 6 / s,
                  height: 6 / s,
                  borderRadius: "50%",
                  background: borderColor,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              />
            )}
            {showLabel && t.tree_code && (
              <span
                data-tree-label={t.tree_id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `translateY(-100%)`,
                  fontSize: fontPx,
                  lineHeight: 1.1,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontWeight: 600,
                  color: selected ? "#1a1205" : "#dce8dc",
                  background: selected ? "#facc15" : "rgba(10,16,10,0.72)",
                  padding: `${1 / s}px ${3 / s}px`,
                  borderRadius: radius,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {t.tree_code}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
