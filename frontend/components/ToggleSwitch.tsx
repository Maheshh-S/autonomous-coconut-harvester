"use client"

// Shared pill toggle switch (extracted from the /map control bar so /robot can
// use the identical control). Module-level component on purpose: pages re-render
// frequently (the robot's rAF display loop), and an inline component would
// remount its subtree each frame.
export default function ToggleSwitch({
  label,
  on,
  set,
}: {
  label: string
  on: boolean
  set: (v: boolean) => void
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "var(--color-text-dim)",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        onClick={(e) => {
          e.preventDefault()
          set(!on)
        }}
        style={{
          position: "relative",
          width: 36,
          height: 20,
          borderRadius: 99,
          background: on ? "var(--color-accent-dim)" : "var(--color-surface-3)",
          border: "1px solid var(--color-line-strong)",
          transition: "background 0.2s var(--ease-out)",
          flex: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: on ? 15 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: on ? "var(--color-accent-bright)" : "var(--color-text-faint)",
            transition: "left 0.2s var(--ease-out), background 0.2s",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      {label}
    </label>
  )
}
