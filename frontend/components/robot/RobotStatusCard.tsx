"use client"

import { useTranslations } from "next-intl"
import type { RobotSnapshot, SimulationStatus, V3RobotState } from "@/lib/api/detection"

export const ROBOT_STATE_COLORS: Record<V3RobotState, string> = {
  IDLE: "var(--color-text-faint)",
  MOVING: "var(--color-accent)",
  CLIMBING: "var(--color-husk)",
  SCANNING: "var(--color-accent)",
  HARVESTING: "var(--color-leaf)",
  RETURNING: "var(--color-gold)",
  ERROR: "var(--color-crit)",
  DOCKED: "var(--color-text-faint)",
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
      <span style={{ color: "var(--color-text-faint)" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right", color: "var(--color-text)" }}>{value}</span>
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
  // V5.0: labels come from the robot/status dictionaries. Unknown backend
  // states render raw so a missing key can never crash the card.
  const t = useTranslations("robot")
  const ts = useTranslations("status")
  const state: V3RobotState = robot?.state ?? "IDLE"
  const color = ROBOT_STATE_COLORS[state] ?? "#6b7280"
  const battery = robot?.battery_pct ?? 0
  // The snapshot sometimes carries the lowercase sim status (stopped/running/
  // paused/finished) when no run is active — a pre-existing backend quirk.
  // Both vocabularies translate; true unknowns still render raw.
  const stateLabel =
    state in ROBOT_STATE_COLORS || ["stopped", "running", "paused", "finished"].includes(state)
      ? ts(state)
      : state
  const connectionLabel =
    connection === "open" ? t("wsOpen") : connection === "connecting" ? t("wsConnecting") : t("wsClosed")

  return (
    <div
      data-testid="robot-status-card"
      style={{
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: 14,
        background: "var(--color-surface)",
        boxShadow: "none",
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
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{t("cardTitle")}</span>
        <span
          data-testid="robot-state-badge"
          style={{
            background: "color-mix(in srgb, " + color + " 22%, transparent)",
            color: color,
            borderRadius: 12,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid color-mix(in srgb, " + color + " 40%, transparent)",
          }}
        >
          {stateLabel}
        </span>
      </div>

      {/* Battery bar */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: "var(--color-surface-3)",
            overflow: "hidden",
          }}
        >
          <div
            data-testid="robot-battery-bar"
            style={{
              width: `${battery}%`,
              height: "100%",
              background: battery < 20 ? "var(--color-crit)" : "var(--color-leaf)",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>
          {t("batteryPct", { pct: battery.toFixed(1) })}
        </div>
      </div>

      <Row label={t("rMission")} value={sim?.mission_id != null ? `#${sim.mission_id}` : "—"} />
      <Row
        label={t("rCurrentTree")}
        value={robot?.state === "HARVESTING" && currentTreeCode ? currentTreeCode : currentTreeCode ?? "—"}
      />
      <Row label={t("rNextTree")} value={nextTreeCode ?? "—"} />
      <Row
        label={t("rDistance")}
        value={distanceRemaining != null ? `${distanceRemaining.toFixed(0)} px` : "—"}
      />
      <Row
        label={t("rSimTime")}
        value={sim ? `${sim.sim_time.toFixed(1)} s` : "—"}
      />
      <Row label={t("rSpeed")} value={sim ? `${sim.speed_factor}×` : "—"} />
      <Row
        label={t("rWs")}
        value={
          <span style={{ color: connection === "open" ? "var(--color-leaf)" : "var(--color-text-faint)" }}>
            {connectionLabel}
          </span>
        }
      />
    </div>
  )
}
