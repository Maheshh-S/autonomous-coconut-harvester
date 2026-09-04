"use client"

import AmbientClip from "@/components/AmbientClip"

// V4.0.3 — shared page hero. One component for the ambient-clip page headers:
// a strengthened scrim (the per-page hand-rolled versions let the first word of
// the two-tone headline fall dark-on-dark, and washed out the subcopy over busy
// clips) and a single light-ink title that passes AA over any frame. The accent
// word uses the light accent-dim tint, which holds contrast on the dark scrim.
export default function PageHero({
  kicker,
  title,
  accent,
  sub,
  clip,
  clipOpacity,
  once,
}: {
  kicker: string
  /** Lead words, rendered in light ink. */
  title: string
  /** Accent words rendered in the light accent tint. */
  accent?: string
  sub?: string
  clip: string
  clipOpacity?: number
  once?: boolean
}) {
  return (
    <header
      style={{
        position: "relative",
        marginBottom: 22,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--color-line)",
        padding: "30px clamp(20px,3vw,40px)",
      }}
    >
      <AmbientClip src={clip} opacity={clipOpacity ?? 0.22} once={once} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(14,18,13,0.94), rgba(14,18,13,0.74) 55%, rgba(14,18,13,0.52)), radial-gradient(120% 140% at 0% 0%, rgba(14,18,13,0.55), transparent)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 2 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            fontFamily: "var(--font-mono)",
            color: "rgba(226, 235, 219, 0.82)",
          }}
        >
          {kicker}
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            margin: "8px 0 4px",
            letterSpacing: "-0.03em",
            color: "#f2f6ee",
            textShadow: "0 1px 12px rgba(10, 14, 10, 0.45)",
          }}
        >
          {title}
          {accent ? (
            <span style={{ color: "var(--color-accent-dim)" }}> {accent}</span>
          ) : null}
        </h1>
        {sub && (
          <p
            style={{
              color: "rgba(232, 240, 224, 0.92)",
              margin: 0,
              maxWidth: 640,
              textShadow: "0 1px 8px rgba(10, 14, 10, 0.5)",
            }}
          >
            {sub}
          </p>
        )}
      </div>
    </header>
  )
}
