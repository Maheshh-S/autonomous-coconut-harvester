"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Lightning } from "@phosphor-icons/react"
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

  // One-shot harvest ripples: diff the completed set against the previous one;
  // a freshly completed tree emits a single expanding ring (self-cleaning).
  const prevCompletedRef = useRef<Set<number>>(new Set())
  const [ripples, setRipples] = useState<{ id: number; key: number }[]>([])
  useEffect(() => {
    const now = new Set(completedTreeIds ?? [])
    const fresh: number[] = []
    for (const id of now) {
      if (!prevCompletedRef.current.has(id)) fresh.push(id)
    }
    prevCompletedRef.current = now
    if (fresh.length === 0) return
    const key = Date.now()
    setRipples((r) => [...r, ...fresh.map((id) => ({ id, key }))])
    const timer = setTimeout(() => {
      setRipples((r) => r.filter((x) => x.key !== key))
    }, 1000)
    return () => clearTimeout(timer)
  }, [completedTreeIds])

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

      {/* Home dock station (V3.8.9): rendered at the nav plan's dock waypoint so
          the operator always sees where "Return to Dock" / "Reset" send the
          robot. Data comes from the plan the backend already provides — no new
          API calls. Pulses while the robot is RETURNING. */}
      {(() => {
        const dock = plan.find((w) => w.kind === "dock")
        if (!dock) return null
        return (
          <div
            style={{
              position: "absolute",
              left: dock.x,
              top: dock.y,
              transform: `translate(-50%, -50%) scale(${inv})`,
              width: 0,
              height: 0,
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            <div style={{ position: "relative", width: 44, height: 44 }}>
              {state === "RETURNING" && (
                <div
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: 14,
                    border: "2px solid #f59e0b",
                    opacity: 0,
                    animation: "twinPulse 1.6s ease-out infinite",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  background: "rgba(14, 20, 14, 0.92)",
                  border: "2px solid #f59e0b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.55)",
                }}
              >
                <Lightning size={18} color="#f59e0b" weight="fill" />
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginTop: 2,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "#f59e0b",
                  background: "rgba(10, 16, 10, 0.72)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  whiteSpace: "nowrap",
                }}
              >
                DOCK
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tree highlights (accent rings on top of the existing OverlayLayer boxes).
          The destination ring gets a soft pulse: the positioning wrapper keeps
          the counter-scale transform, the inner node animates pure scale/opacity
          so the two transforms never fight. Base opacity 0 + reduced-motion
          kill-switch leaves it invisible when animations are off. */}
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
          >
            {h.kind === "dest" && (
              <div
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: "50%",
                  border: `2px solid ${color}`,
                  opacity: 0,
                  animation: "twinPulse 1.6s ease-out infinite",
                }}
              />
            )}
          </div>
        )
      })}

      {/* One-shot ripple when a tree freshly completes its harvest. */}
      {ripples.map((r) => {
        const t = trees.find((x) => x.tree_id === r.id)
        if (!t) return null
        const c = treeCenter(t)
        if (!c) return null
        return (
          <div
            key={r.key}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              transform: `translate(-50%, -50%) scale(${inv})`,
              width: 26,
              height: 26,
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "3px solid #22c55e",
                opacity: 0,
                animation: "twinRipple 0.9s ease-out 1 forwards",
              }}
            />
          </div>
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
