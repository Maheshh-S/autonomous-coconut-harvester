"use client"

import { useEffect, useState } from "react"

// V3.6 — Simulation Controls (presentation only). These buttons call the
// existing backend Simulation / Robot REST APIs. There is NO business logic in
// the component — it only forwards intents and reports errors. Start takes an
// optional mission id + speed factor; speed is debounced to the API on change.
//
// V3.8.9 — command-bar redesign (presentation only): token-based button kinds
// (the old "warn" kind referenced an undefined `--color-amber` token, which left
// "Return to Dock" with no button chrome at all), a clear operator hierarchy
// (primary run controls → utilities → separated destructive group), and the
// previously-missing Stop command (backend `POST /robot/simulation/stop` +
// hook `onStop` existed; the UI never exposed it). Reset semantics live in the
// page (stop the active run, then factory-reset: docked + IDLE + 100% battery).

type Kind = "primary" | "default" | "ghost" | "warn" | "stop" | "danger"

const btn = (kind: Kind): React.CSSProperties => {
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
    transition: "background 120ms var(--ease-out), transform 120ms var(--ease-out)",
  }
  switch (kind) {
    case "primary":
      return { ...base, background: "var(--color-accent)", color: "#fff", borderColor: "transparent" }
    case "ghost":
      return { ...base, background: "transparent", color: "var(--color-text-dim)" }
    case "warn":
      // Attention, not danger: gold tint surface + gold-dim text (AA on light).
      return {
        ...base,
        background: "rgba(201, 138, 46, 0.12)",
        color: "var(--color-gold-dim)",
        borderColor: "rgba(201, 138, 46, 0.45)",
      }
    case "stop":
      // Destructive-outline: halts the run without hiding that it is not a routine action.
      return {
        ...base,
        background: "rgba(192, 73, 47, 0.08)",
        color: "var(--color-crit)",
        borderColor: "rgba(192, 73, 47, 0.45)",
      }
    case "danger":
      return { ...base, background: "var(--color-crit)", color: "#fff", borderColor: "transparent" }
    default:
      return base
  }
}

const Divider = () => (
  <span
    aria-hidden
    style={{ width: 1, height: 26, background: "var(--color-line-strong)", margin: "0 2px" }}
  />
)

export default function SimulationControls({
  simStatus,
  missionId,
  speedFactor,
  defaultSpeedFactor,
  onStart,
  onPause,
  onResume,
  onStop,
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
  onStop: () => void
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
      {/* Run lifecycle */}
      <button
        type="button"
        data-testid="btn-start"
        disabled={running || busy}
        style={{ ...btn("primary"), opacity: running || busy ? 0.5 : 1, cursor: running || busy ? "default" : "pointer" }}
        onClick={() => onStart(missionId, localSpeed)}
        title={running ? "Simulation is already running" : "Start the harvest simulation"}
      >
        Start
      </button>
      <button
        type="button"
        data-testid="btn-pause"
        disabled={!running || busy}
        style={{ ...btn("default"), opacity: !running || busy ? 0.5 : 1, cursor: !running || busy ? "default" : "pointer" }}
        onClick={onPause}
        title={running ? "Pause the simulation" : "Nothing is running"}
      >
        Pause
      </button>
      <button
        type="button"
        data-testid="btn-resume"
        disabled={!paused || busy}
        style={{ ...btn("default"), opacity: !paused || busy ? 0.5 : 1, cursor: !paused || busy ? "default" : "pointer" }}
        onClick={onResume}
        title={paused ? "Resume the paused simulation" : "Nothing is paused"}
      >
        Resume
      </button>

      {/* Utilities */}
      <button
        type="button"
        data-testid="btn-return-to-dock"
        disabled={!active || busy}
        style={{ ...btn("warn"), opacity: !active || busy ? 0.5 : 1, cursor: !active || busy ? "default" : "pointer" }}
        onClick={onReturnToDock}
        title="Recall the robot to its home dock (preserves mission progress)"
      >
        Return to Dock
      </button>
      <button
        type="button"
        data-testid="btn-recharge"
        disabled={busy}
        style={{ ...btn("default"), opacity: busy ? 0.5 : 1 }}
        onClick={onRecharge}
        title="Restore the battery to 100%"
      >
        Recharge
      </button>

      <Divider />

      {/* Destructive group — visually separated */}
      <button
        type="button"
        data-testid="btn-stop"
        disabled={!active || busy}
        style={{ ...btn("stop"), opacity: !active || busy ? 0.5 : 1, cursor: !active || busy ? "default" : "pointer" }}
        onClick={onStop}
        title={active ? "Stop the run entirely (robot stays where it is)" : "Nothing is running"}
      >
        Stop
      </button>
      <button
        type="button"
        data-testid="btn-reset"
        disabled={busy}
        style={{ ...btn("danger"), opacity: busy ? 0.5 : 1 }}
        onClick={onReset}
        title="Factory reset: halts any run and returns the robot to the dock, fully charged"
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
