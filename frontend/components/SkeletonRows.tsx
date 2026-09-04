"use client"

type SkeletonRowsProps = {
  rows?: number
  height?: number
}

/**
 * Shared pulsing skeleton block rows, styled with the global @keyframes pulse.
 * Mirrors the loading placeholders used by the dashboard and tree registry.
 */
export default function SkeletonRows({ rows = 8, height = 48 }: SkeletonRowsProps) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
            background: "var(--color-surface-2)",
            opacity: 0.5,
            animation: "pulse 1.4s ease-in-out infinite",
            animationDelay: `${(i % 8) * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}
