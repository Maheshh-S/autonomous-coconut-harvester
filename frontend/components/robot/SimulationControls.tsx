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
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  }
  if (kind === "primary") return { ...base, background: "#16a34a", color: "#fff", borderColor: "#16a34a" }
  if (kind === "danger") return { ...base, background: "#ef4444", color: "#fff", borderColor: "#ef4444" }
  if (kind === "warn") return { ...base, background: "#f59e0b", color: "#111827", borderColor: "#f59e0b" }
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
        gap: 8,
        alignItems: "center",
        padding: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
        width: "100%",
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

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginLeft: 4 }}>
        Speed
        <input
          type="number"
          min={0.1}
          max={500}
          step={0.5}
          value={localSpeed}
          data-testid="input-speed"
          style={{ width: 64, padding: "4px 6px", borderRadius: 6, border: "1px solid #d1d5db" }}
          onChange={(e) => {
            const v = Math.max(0.1, Number(e.target.value) || defaultSpeedFactor)
            setLocalSpeed(v)
            if (running || paused) onSpeedChange(v)
          }}
        />
        ×
      </label>

      {error && (
        <span data-testid="controls-error" style={{ color: "#ef4444", fontSize: 12 }}>
          {error}
        </span>
      )}
    </div>
  )
}
