"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import FarmMosaic, { MosaicTile } from "@/components/FarmMosaic"

// V2.3 — Digital Twin Viewer (PROJECT_SPECIFICATION.md §V2.8 navigation only).
// Wraps the existing FarmMosaic (§V2.2) in a transform-based viewport that adds
// zoom / pan without touching the mosaic rendering or introducing any overlay.
// Zoom/pan are pure CSS transforms on a wrapper stage, so the mosaic is never
// re-rendered during navigation and the future overlay layer can later share the
// same stage coordinate space. No map libraries; browser APIs only.
//
// Input uses Pointer Events so a single code path serves mouse, touch, and
// stylus: one pointer pans, two pointers pinch-zoom. `touch-action: none` stops
// the browser from hijacking the gestures, so the viewer works on mobile too.
const MIN_SCALE = 0.02
const MAX_SCALE = 20
const FIT_MAX_SCALE = 1 // Fit never upscales past 100% (avoids blurry blow-up)
const WHEEL_STEP = 1.12
const BUTTON_STEP = 1.25

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

type View = { scale: number; tx: number; ty: number }

// Write the transform straight to the DOM during a gesture (pan/pinch) so we
// never re-render React per pointer event — this keeps navigation smooth and
// avoids the per-frame re-render storm the spec warns against. React state is
// only committed at gesture end (for the zoom % readout and so the stage's
// inline transform stays the source of truth on the next render).
function applyTransform(ref: React.RefObject<HTMLDivElement | null>, v: View) {
  const stage = ref.current
  if (stage) {
    stage.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`
  }
}

export default function FarmViewer({
  tiles,
  gap = 2,
  apiBaseUrl,
  height = "80vh",
  minHeight = 420,
  expandHref,
}: {
  tiles: MosaicTile[]
  gap?: number
  apiBaseUrl?: string
  height?: string | number
  minHeight?: number
  // When provided, an "expand" control is shown that navigates to this route
  // (used by the smaller dashboard card → the full /map experience). Omitted on
  // /map itself, where the viewer is already the full view.
  expandHref?: string
}) {
  const router = useRouter()
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [smooth, setSmooth] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Active pointers (id -> last position) for unified pan / pinch handling.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchPrevDist = useRef<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  )

  // Zoom keeping the point under (clientX, clientY) fixed in the viewport.
  // Writes the DOM directly (no React re-render) and updates viewRef; the caller
  // decides whether to also commit to state.
  const applyZoom = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      const cx = clientX - rect.left
      const cy = clientY - rect.top
      const v = viewRef.current
      const newScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      const f = newScale / v.scale
      const nv: View = {
        scale: newScale,
        tx: cx - (cx - v.tx) * f,
        ty: cy - (cy - v.ty) * f,
      }
      viewRef.current = nv
      applyTransform(stageRef, nv)
    },
    []
  )

  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number, smooth: boolean) => {
      applyZoom(factor, clientX, clientY)
      setSmooth(smooth)
      setView(viewRef.current) // commit (buttons / wheel)
    },
    [applyZoom]
  )

  const zoomCenter = useCallback(
    (factor: number) => {
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2, true)
    },
    [zoomAt]
  )

  // Fit the complete farm inside the viewport (centred, never upscaled).
  const fit = useCallback(() => {
    const stage = stageRef.current
    const vp = viewportRef.current
    if (!stage || !vp) return
    const fw = stage.offsetWidth
    const fh = stage.offsetHeight
    if (fw === 0 || fh === 0) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    const scale = clamp(Math.min(vw / fw, vh / fh), MIN_SCALE, FIT_MAX_SCALE)
    setView({ scale, tx: (vw - fw * scale) / 2, ty: (vh - fh * scale) / 2 })
    setSmooth(true)
  }, [])

  // Native non-passive wheel listener so preventDefault (page scroll) works.
  // Cursor-centred; smooth off for responsiveness.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, e.clientX, e.clientY, false)
    }
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [zoomAt])

  // Initial fit and refit when the mission/tiles change, so the complete farm is
  // always visible first. Deliberately NOT triggered on resize, so the current
  // zoom is preserved when the card is resized / navigates.
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles])

  const pointerDistance = () => {
    const pts = [...pointers.current.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const vp = viewportRef.current
    if (!vp) return
    try {
      vp.setPointerCapture(e.pointerId)
    } catch {
      // Non-trusted/synthetic pointers may not be capturable — ignore.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: viewRef.current.tx,
        ty: viewRef.current.ty,
      }
      setDragging(true)
      setSmooth(false)
    } else if (pointers.current.size === 2) {
      // Second finger: switch from pan to pinch.
      dragRef.current = null
      setDragging(false)
      pinchPrevDist.current = pointerDistance()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const dist = pointerDistance()
      if (pinchPrevDist.current && dist > 0) {
        const factor = dist / pinchPrevDist.current
        const pts = [...pointers.current.values()]
        const midX = (pts[0].x + pts[1].x) / 2
        const midY = (pts[0].y + pts[1].y) / 2
        applyZoom(factor, midX, midY)
        setSmooth(false)
      }
      pinchPrevDist.current = dist
    } else if (dragRef.current) {
      const d = dragRef.current
      const v: View = {
        scale: viewRef.current.scale,
        tx: d.tx + (e.clientX - d.x),
        ty: d.ty + (e.clientY - d.y),
      }
      viewRef.current = v
      applyTransform(stageRef, v)
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchPrevDist.current = null
    if (pointers.current.size === 0) {
      dragRef.current = null
      setDragging(false)
      setView(viewRef.current) // commit final gesture to state (zoom % readout)
    } else if (pointers.current.size === 1) {
      // Lifted one finger of a pinch — resume panning with the remaining one.
      const [p] = [...pointers.current.entries()]
      const remaining = p[1]
      dragRef.current = {
        x: remaining.x,
        y: remaining.y,
        tx: viewRef.current.tx,
        ty: viewRef.current.ty,
      }
    }
  }

  return (
    <div
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={fit}
      style={{
        position: "relative",
        width: "100%",
        height,
        minHeight,
        overflow: "hidden",
        background: "#0b0f0b",
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        ref={stageRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "0 0",
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: smooth ? "transform 0.12s ease-out" : "none",
          willChange: "transform",
        }}
      >
        <FarmMosaic tiles={tiles} gap={gap} apiBaseUrl={apiBaseUrl} />
      </div>

      {/* Controls overlay — stop propagation so taps don't start a pan/pinch. */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          gap: 6,
          zIndex: 5,
        }}
      >
        <ViewerButton
          label="+"
          title="Zoom in"
          onClick={() => zoomCenter(BUTTON_STEP)}
        />
        <ViewerButton
          label="–"
          title="Zoom out"
          onClick={() => zoomCenter(1 / BUTTON_STEP)}
        />
        <ViewerButton label="Fit" title="Fit to screen (double-click)" onClick={fit} />
        {expandHref && (
          <ViewerButton
            label="⤢"
            title="Open full Digital Twin"
            onClick={() => router.push(expandHref)}
          />
        )}
      </div>

      <div
        data-testid="zoom-readout"
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          color: "#6b7d6b",
          fontSize: 12,
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        {Math.round(view.scale * 100)}%
      </div>
    </div>
  )
}

function ViewerButton({
  label,
  title,
  onClick,
}: {
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        fontSize: 16,
        fontWeight: 600,
        color: "#dce8dc",
        background: "rgba(20,28,20,0.85)",
        border: "1px solid #2c3a2c",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}
