"use client"

import { useMemo } from "react"
import { computeMosaicLayout } from "@/lib/mosaicLayout"
import { MosaicTile } from "@/components/FarmMosaic"
import type { TreeOverlay, V3RobotState, RobotPlanWaypoint, RobotSnapshot } from "@/lib/api/detection"
import RobotMarker from "./RobotMarker"
import RobotPathLayer from "./RobotPathLayer"

// V3.6 — Robot Layer (presentation only). Mounted INSIDE FarmViewer's
// transformed stage, so it inherits the exact same zoom/pan/fit transform as the
// mosaic and tree overlay (single transform, no second coordinate system).
//
// Responsibilities (all read-only):
//   - draw the robot marker at the latest backend snapshot position,
//   - draw the mission path (visual only) from the backend navigation plan,
//   - highlight the destination / harvesting / completed trees.
//
// Tree highlighting reuses the SAME farm-pixel coordinates the existing
// OverlayLayer uses (`computeMosaicLayout` + `TreeOverlay.bbox_*`), so the boxes
// are never duplicated — we only paint accent rings on top of the existing
// boxes. Frontend never interpolates or predicts position: it renders exactly
// the latest snapshot the WebSocket delivered.

export default function RobotLayer({
  robot,
  plan,
  trees,
  tiles,
  gap = 2,
  scale = 1,
  // Visualization toggles (V3.6.1): let the viewer hide layers without
  // unmounting the layer entirely.
  showPath = true,
  showTarget = true,
  // Tree ids of interest (resolved by the parent from the snapshot/plan).
  destinationTreeId,
  harvestingTreeId,
  completedTreeIds,
}: {
  robot: RobotSnapshot | null
  plan: RobotPlanWaypoint[]
  trees: TreeOverlay[]
  tiles: MosaicTile[]
  gap?: number
  scale?: number
  showPath?: boolean
  showTarget?: boolean
  destinationTreeId?: number | null
  harvestingTreeId?: number | null
  completedTreeIds?: number[]
}) {
  // tile id -> top-left farm-pixel (single source, same as OverlayLayer).
  const placedByTile = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    for (const p of computeMosaicLayout(tiles, gap)) map.set(p.id, { x: p.x, y: p.y })
    return map
  }, [tiles, gap])

  // Resolve the center of a tree's bounding box in farm-pixel space.
  const treeCenter = (t: TreeOverlay) => {
    const place = placedByTile.get(t.survey_tile_id)
    if (!place) return null
    const cx = place.x + (t.bbox_x1 + t.bbox_x2) / 2
    const cy = place.y + (t.bbox_y1 + t.bbox_y2) / 2
    return { x: cx, y: cy }
  }

  const s = Math.max(scale, 0.0001)
  const inv = 1 / s

  const completedSet = useMemo(
    () => new Set(completedTreeIds ?? []),
    [completedTreeIds]
  )

  // Build the highlight markers from existing tree overlays.
  const highlights = useMemo(() => {
    const out: { x: number; y: number; kind: "dest" | "harvest" | "done" }[] = []
    for (const t of trees) {
      const c = treeCenter(t)
      if (!c) continue
      if (t.tree_id === harvestingTreeId)
        out.push({ ...c, kind: "harvest" })
      else if (showTarget && t.tree_id === destinationTreeId)
        out.push({ ...c, kind: "dest" })
      else if (completedSet.has(t.tree_id))
        out.push({ ...c, kind: "done" })
    }
    return out
  }, [trees, placedByTile, destinationTreeId, harvestingTreeId, completedSet])

  const state: V3RobotState = robot?.state ?? "IDLE"

  return (
    <div data-testid="robot-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Path is drawn beneath the marker. */}
      {showPath && (
        <RobotPathLayer
          plan={plan}
          waypointIndex={robot?.waypoint_index ?? 0}
          completedItemIds={robot?.completed_item_ids ?? []}
          state={state}
          scale={scale}
        />
      )}

      {/* Tree highlights (accent rings on top of the existing OverlayLayer boxes) */}
      {highlights.map((h, i) => {
        const color =
          h.kind === "dest" ? "#facc15" : h.kind === "harvest" ? "#22c55e" : "#15803d"
        const size = h.kind === "dest" ? 18 : 14
        return (
          <div
            key={i}
            data-robot-tree-highlight={h.kind}
            style={{
              position: "absolute",
              left: h.x,
              top: h.y,
              transform: `translate(-50%, -50%) scale(${inv})`,
              width: size,
              height: size,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              boxSizing: "border-box",
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        )
      })}

      {/* The robot itself. */}
      {robot && (
        <RobotMarker
          x={robot.position.x}
          y={robot.position.y}
          headingDeg={robot.heading_deg}
          batteryPct={robot.battery_pct}
          state={state}
          scale={scale}
        />
      )}
    </div>
  )
}
