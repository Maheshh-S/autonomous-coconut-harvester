"use client"

import { useEffect, useState } from "react"

// V3.6 — Simulation Controls (presentation only). These buttons call the
// existing backend Simulation / Robot REST APIs. There is NO business logic in
// the component — it only forwards intents and reports errors. Start takes an
// optional mission id + speed factor; speed is debounced to the API on change.

const btn = (
  label: string,
  kind: "primary" | "default" | "danger" | "warn"
): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid var(--color-line-strong)",
    background: "var(--color-surface-2)",
    color: "var(--color-text)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    minHeight: 44,
  }
  if (kind === "primary") return { ...base, background: "var(--color-accent)", color: "#06201e", borderColor: "transparent" }
  if (kind === "danger") return { ...base, background: "var(--color-crit)", color: "#fff", borderColor: "transparent" }
  if (kind === "warn") return { ...base, background: "var(--color-amber)", color: "#231a07", borderColor: "transparent" }
  return base
}

export default function SimulationControls({
  simStatus,
  missionId,
  speedFactor,
  defaultSpeedFactor,
  onStart,
  onPause,
  onResume,
  onReturnToDock,
  onRecharge,
  onReset,
  onSpeedChange,
  busy,
  error,
}: {
  simStatus: "stopped" | "running" | "paused" | "finished"
  missionId: number | null
  speedFactor: number
  defaultSpeedFactor: number
  onStart: (missionId: number | null, speedFactor: number) => void
  onPause: () => void
  onResume: () => void
  onReturnToDock: () => void
  onRecharge: () => void
  onReset: () => void
  onSpeedChange: (v: number) => void
  busy: boolean
  error: string | null
}) {
  const [localSpeed, setLocalSpeed] = useState(speedFactor)

  const running = simStatus === "running"
  const paused = simStatus === "paused"
  const active = running || paused

  // V3.7.3 — when the simulation is not running, keep the input synced to the
  // backend-owned default (which may load after first mount). While a run is
  // active the operator's chosen speed is authoritative.
  useEffect(() => {
    if (!active) setLocalSpeed(defaultSpeedFactor)
  }, [active, defaultSpeedFactor])

  return (
    <div
      data-testid="simulation-controls"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        padding: 14,
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        background: "var(--color-surface)",
        width: "100%",
        boxShadow: "0 1px 2px rgba(28, 38, 27, 0.04)",
      }}
    >
      <button
        type="button"
        data-testid="btn-start"
        disabled={running || busy}
        style={{ ...btn("Start", "primary"), opacity: running ? 0.5 : 1 }}
        onClick={() => onStart(missionId, localSpeed)}
      >
        Start
      </button>
      <button
        type="button"
        data-testid="btn-pause"
        disabled={!running || busy}
        style={{ ...btn("Pause", "default"), opacity: !running ? 0.5 : 1 }}
        onClick={onPause}
      >
        Pause
      </button>
      <button
        type="button"
        data-testid="btn-resume"
        disabled={!paused || busy}
        style={{ ...btn("Resume", "default"), opacity: !paused ? 0.5 : 1 }}
        onClick={onResume}
      >
        Resume
      </button>
      <button
        type="button"
        data-testid="btn-return-to-dock"
        disabled={!active || busy}
        style={{ ...btn("Return to Dock", "warn"), opacity: !active ? 0.5 : 1 }}
        onClick={onReturnToDock}
        title="Recall the robot to its home dock (preserves mission progress)"
      >
        Return to Dock
      </button>
      <button
        type="button"
        data-testid="btn-recharge"
        disabled={busy}
        style={btn("Recharge", "default")}
        onClick={onRecharge}
      >
        Recharge
      </button>
      <button
        type="button"
        data-testid="btn-reset"
        disabled={busy}
        style={{ ...btn("Reset", "danger") }}
        onClick={onReset}
      >
        Reset
      </button>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginLeft: 4, color: "var(--color-text-dim)" }}>
        Speed
        <input
          type="number"
          min={0.1}
          max={500}
          step={0.5}
          value={localSpeed}
          data-testid="input-speed"
          style={{ width: 64, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--color-line-strong)", background: "var(--color-surface-2)", color: "var(--color-text)" }}
          onChange={(e) => {
            const v = Math.max(0.1, Number(e.target.value) || defaultSpeedFactor)
            setLocalSpeed(v)
            if (running || paused) onSpeedChange(v)
          }}
        />
        ×
      </label>

      {error && (
        <span data-testid="controls-error" style={{ color: "var(--color-crit)", fontSize: 12 }}>
          {error}
        </span>
      )}
    </div>
  )
}
