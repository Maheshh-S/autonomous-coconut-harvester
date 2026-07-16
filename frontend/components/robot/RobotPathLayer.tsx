"use client"

import { useMemo } from "react"
import type { RobotPlanWaypoint, V3RobotState } from "@/lib/api/detection"

// V3.6 — Robot Path Layer (presentation only, visual-only).
// Draws the mission path from the read-only navigation plan the backend
// provides. Three visual segments:
//   - visited:  waypoints already harvested (green, solid)
//   - remaining: waypoints not yet reached (blue, dashed)
//   - current destination: the next waypoint the robot is heading to
// The path is NEVER computed in the frontend — we render the backend's
// farm-pixel waypoints as SVG polylines inside the transformed stage, so it
// inherits zoom/pan/fit for free (single transform, no duplication).

export default function RobotPathLayer({
  plan,
  waypointIndex,
  completedItemIds,
  state,
  scale = 1,
}: {
  plan: RobotPlanWaypoint[]
  waypointIndex: number
  completedItemIds: number[]
  state: V3RobotState
  scale?: number
}) {
  const s = Math.max(scale, 0.0001)
  const inv = 1 / s

  // Build SVG points from the plan waypoints (single farm-pixel polyline).
  const points = useMemo(
    () => plan.map((w) => ({ x: w.x, y: w.y, kind: w.kind, itemId: w.mission_item_id })),
    [plan]
  )

  if (points.length < 2) return null

  const fullPoly = points.map((p) => `${p.x},${p.y}`).join(" ")
  // Traveled segment: dock → through the current waypoint (inclusive).
  const traveledPoly = points
    .slice(0, Math.max(waypointIndex + 1, 2))
    .map((p) => `${p.x},${p.y}`)
    .join(" ")
  // Remaining segment: current waypoint → dock (the rest of the route).
  const remainingPoly = points
    .slice(Math.max(waypointIndex, 1))
    .map((p) => `${p.x},${p.y}`)
    .join(" ")

  return (
    <div
      data-testid="robot-path-layer"
      data-robot-path="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      <svg
        style={{
          position: "absolute",
          overflow: "visible",
          transform: `scale(${inv})`,
          transformOrigin: "0 0",
        }}
        width={1}
        height={1}
      >
        {/* Full planned route (faint, always visible) */}
        <polyline
          points={fullPoly}
          fill="none"
          stroke="#9ca3af"
          strokeWidth={1.5}
          opacity={0.35}
        />
        {/* Remaining path (dashed blue) */}
        {remainingPoly && (
          <polyline
            points={remainingPoly}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 6"
            opacity={0.8}
          />
        )}
        {/* Traveled path (solid green) */}
        {traveledPoly && (
          <polyline
            points={traveledPoly}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2.5}
            opacity={0.9}
          />
        )}
      </svg>

      {/* Waypoint dots: completed vs pending, plus the current destination ring */}
      {points.map((p, i) => {
        const isCompleted =
          p.kind === "tree" &&
          p.itemId != null &&
          completedItemIds.includes(p.itemId)
        const isDestination = i === waypointIndex
        const color = isCompleted ? "#22c55e" : p.kind === "dock" ? "#9ca3af" : "#3b82f6"
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              transform: `translate(-50%, -50%) scale(${inv})`,
              width: isDestination ? 14 : 9,
              height: isDestination ? 14 : 9,
              borderRadius: "50%",
              background: color,
              border: isDestination
                ? "2px solid #facc15"
                : "2px solid #0b0f0b",
              boxSizing: "border-box",
            }}
          />
        )
      })}
    </div>
  )
}
