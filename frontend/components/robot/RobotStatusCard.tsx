"use client"

import type { RobotSnapshot, SimulationStatus, V3RobotState } from "@/lib/api/detection"

export const ROBOT_STATE_COLORS: Record<V3RobotState, string> = {
  IDLE: "#9ca3af",
  MOVING: "#3b82f6",
  CLIMBING: "#f97316",
  SCANNING: "#a855f7",
  HARVESTING: "#22c55e",
  RETURNING: "#f59e0b",
  ERROR: "#ef4444",
  DOCKED: "#4b5563",
}

// V3.6 — Robot Status Card (presentation only). Shows the latest backend
// snapshot: state, battery, mission, current/next tree, remaining distance,
// sim time, and speed factor. Pure readout — no buttons (those live in
// SimulationControls). Responsive: stacks on narrow viewports, grid on wide.

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  )
}

export default function RobotStatusCard({
  robot,
  sim,
  currentTreeCode,
  nextTreeCode,
  distanceRemaining,
  connection,
}: {
  robot: RobotSnapshot | null
  sim: SimulationStatus | null
  currentTreeCode: string | null
  nextTreeCode: string | null
  distanceRemaining: number | null
  connection: "connecting" | "open" | "closed"
}) {
  const state: V3RobotState = robot?.state ?? "IDLE"
  const color = ROBOT_STATE_COLORS[state] ?? "#6b7280"
  const battery = robot?.battery_pct ?? 0

  return (
    <div
      data-testid="robot-status-card"
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Robot Status</span>
        <span
          data-testid="robot-state-badge"
          style={{
            background: color,
            color: "#fff",
            borderRadius: 12,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {state}
        </span>
      </div>

      {/* Battery bar */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: "#e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            data-testid="robot-battery-bar"
            style={{
              width: `${battery}%`,
              height: "100%",
              background: battery < 20 ? "#ef4444" : "#22c55e",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Battery {battery.toFixed(1)}%
        </div>
      </div>

      <Row label="Mission" value={sim?.mission_id != null ? `#${sim.mission_id}` : "—"} />
      <Row
        label="Current Tree"
        value={robot?.state === "HARVESTING" && currentTreeCode ? currentTreeCode : currentTreeCode ?? "—"}
      />
      <Row label="Next Tree" value={nextTreeCode ?? "—"} />
      <Row
        label="Distance Remaining"
        value={distanceRemaining != null ? `${distanceRemaining.toFixed(0)} px` : "—"}
      />
      <Row
        label="Simulation Time"
        value={sim ? `${sim.sim_time.toFixed(1)} s` : "—"}
      />
      <Row label="Speed Factor" value={sim ? `${sim.speed_factor}×` : "—"} />
      <Row
        label="WS"
        value={
          <span style={{ color: connection === "open" ? "#22c55e" : "#9ca3af" }}>
            {connection}
          </span>
        }
      />
    </div>
  )
}
