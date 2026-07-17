"use client";

// Ambient background clip — restrained, looping, muted. Used behind lead
// surfaces (never behind body text without a scrim). Presentation only.
// Respects prefers-reduced-motion by still showing the first frame (poster),
// and pauses when offscreen via IntersectionObserver to save cycles.
import { useEffect, useRef } from "react";

export default function AmbientClip({
  src,
  className,
  opacity = 0.16,
  once = false,
}: {
  src: string
  className?: string
  opacity?: number
  /** Play a single time on mount (no loop, no scroll-pause). For one-shot intros. */
  once?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (once) {
      v.play().catch(() => {})
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.05 }
    )
    io.observe(v)
    return () => io.disconnect()
  }, [once])

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      autoPlay
      muted
      loop={!once}
      playsInline
      preload="metadata"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  )
}
