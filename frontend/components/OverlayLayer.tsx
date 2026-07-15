"use client"

import { useMemo, useState } from "react"
import { computeMosaicLayout } from "@/lib/mosaicLayout"
import type { MosaicTile } from "@/components/FarmMosaic"
import type { TreeOverlay } from "@/lib/api/detection"

// V2.4 — Interactive Tree Overlay (PROJECT_SPECIFICATION.md §V2.4–§V2.8).
// Renders the persisted representative `TreeObservation` of each Permanent Tree
// as a YOLO bounding box on top of the Farm Mosaic. Responsibilities are kept
// strictly separated (FarmMosaic ↓ OverlayLayer ↓ InteractionLayer future V2.5):
// this component only *renders* overlays from already-resolved data — it never
// recomputes observations, never derives boxes from YOLO, and carries no
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
export default function OverlayLayer({
  trees,
  tiles,
  gap = 2,
  scale = 1,
  selectedTreeId,
  onSelectTree,
}: {
  trees: TreeOverlay[]
  tiles: MosaicTile[]
  gap?: number
  scale?: number
  selectedTreeId?: number | null
  onSelectTree?: (treeId: number) => void
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
      {trees.map((t) => {
        const place = placedByTile.get(t.survey_tile_id)
        if (!place) return null // representative tile not in this mission's mosaic

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
        const cursor = onSelectTree ? "pointer" : "default"

        // Hide the label when the box is too small on screen (LOD is a future
        // concern, §V2.8); keeps the far-out view clean.
        const showLabel = w * s > 22 && h * s > 12

        return (
          <div
            key={t.tree_id}
            data-tree-id={t.tree_id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onSelectTree?.(t.tree_id)
            }}
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
            <div
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
            {showLabel && t.tree_code && (
              <span
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
