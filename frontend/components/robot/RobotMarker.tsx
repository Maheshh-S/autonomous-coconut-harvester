"use client"

import type { V3RobotState } from "@/lib/api/detection"

// V3.6 — Robot Marker (presentation only). Renders the robot as an icon at its
// current farm-pixel position inside the FarmViewer transformed stage. The stage
// already scales the whole layer, so marker *size* would track the canvas on
// zoom; we counter-scale the inner element by 1/scale (Google-Maps-like) so the
// marker stays a constant screen size at any zoom, exactly like the tree labels.
// Heading rotates the icon; a battery ring wraps the marker; the disc colour maps
// to the current RobotState. No movement logic — it only renders `position`.

export const ROBOT_STATE_COLORS: Record<V3RobotState, string> = {
  IDLE: "#9ca3af", // Gray
  MOVING: "#3b82f6", // Blue
  CLIMBING: "#f97316", // Orange
  SCANNING: "#a855f7", // Purple
  HARVESTING: "#22c55e", // Green
  RETURNING: "#f59e0b", // Amber
  ERROR: "#ef4444", // Red
  DOCKED: "#4b5563", // Dark Gray
}

export default function RobotMarker({
  x,
  y,
  headingDeg,
  batteryPct,
  state,
  scale = 1,
}: {
  x: number
  y: number
  headingDeg: number
  batteryPct: number
  state: V3RobotState
  scale?: number
}) {
  const s = Math.max(scale, 0.0001)
  // Counter-scale so the marker is ~constant on screen regardless of zoom.
  const inv = 1 / s
  const color = ROBOT_STATE_COLORS[state] ?? "#6b7280"
  const size = 24 // screen px (before counter-scale)
  const ring = 4 // battery ring thickness in screen px

  // Battery ring as a conic gradient (0..100%), drawn counter-scaled.
  const battery = Math.max(0, Math.min(100, batteryPct))
  const low = battery < 20

  return (
    <div
      data-testid="robot-marker"
      data-robot-marker="true"
      data-robot-state={state}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        data-testid="robot-marker-dot"
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) scale(${inv})`,
          width: size + ring * 2,
          height: size + ring * 2,
          transformOrigin: "center center",
        }}
      >
        {/* Soft halo keyed to the current state colour (visibility at any zoom) */}
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}55 0%, ${color}00 70%)`,
          }}
        />
        {/* Battery ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `conic-gradient(${low ? "#ef4444" : "#22c55e"} ${battery * 3.6}deg, #374151 ${battery * 3.6}deg)`,
            padding: ring,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "#0b0f0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Robot disc with heading pointer */}
            <div
              style={{
                position: "relative",
                width: size,
                height: size,
                borderRadius: "50%",
                background: color,
                border: "2px solid #0b0f0b",
                boxShadow: `0 0 8px ${color}aa, 0 0 0 1px rgba(255,255,255,0.3)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 3,
                  height: size / 2,
                  background: "#0b0f0b",
                  borderRadius: 2,
                  transform: `translate(-50%, -100%) rotate(${headingDeg}deg)`,
                  transformOrigin: "bottom center",
                }}
              />
              {/* Heading tip */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 1,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#0b0f0b",
                  transform: `translate(-50%, -50%) rotate(${headingDeg}deg) translateY(-${size / 2 - 2}px)`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
