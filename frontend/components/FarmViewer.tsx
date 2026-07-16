"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import FarmMosaic, { MosaicTile } from "@/components/FarmMosaic"
import OverlayLayer from "@/components/OverlayLayer"
import TreeDetailsDrawer from "@/components/TreeDetailsDrawer"
import RobotLayer from "@/components/robot/RobotLayer"
import type { TreeOverlay, RobotSnapshot, RobotPlanWaypoint } from "@/lib/api/detection"

// V2.3 / V2.4 — Digital Twin Viewer (PROJECT_SPECIFICATION.md §V2.8 navigation
// only; overlay added in §V2.4). Wraps the existing FarmMosaic (§V2.2) in a
// transform-based viewport that adds zoom / pan without touching the mosaic
// rendering. Zoom/pan are pure CSS transforms on a wrapper stage, so the mosaic
// is never re-rendered during navigation and the overlay layer shares the same
// stage coordinate space (single transform, no duplication). No map libraries;
// browser APIs only.
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
  trees,
  // V2.5 — when true, selecting a tree opens the read-only Tree Details panel
  // (§32) inside the viewer. Off on the small dashboard card, where selection
  // only highlights the box.
  enableDetailsPanel,
  // V3.6 — optional robot simulation overlay (presentation only).
  robot,
  plan,
  destinationTreeId,
  harvestingTreeId,
  completedTreeIds,
  showRobotPath = true,
  showRobotTarget = true,
  // V3.7.1 — when set, the viewer opens focused on this tree (read-only twin
  // focus, e.g. from the Mission History tree-activity "Open Digital Twin" link).
  // Reuses the existing selection + details-panel machinery; no new lookup logic.
  initialTreeId,
}: {
  tiles: MosaicTile[]
  gap?: number
  apiBaseUrl?: string
  height?: string | number
  minHeight?: number
  expandHref?: string
  trees?: TreeOverlay[]
  enableDetailsPanel?: boolean
  robot?: RobotSnapshot | null
  plan?: RobotPlanWaypoint[]
  destinationTreeId?: number | null
  harvestingTreeId?: number | null
  completedTreeIds?: number[]
  showRobotPath?: boolean
  showRobotTarget?: boolean
  initialTreeId?: number | null
}) {
  const router = useRouter()
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const [smooth, setSmooth] = useState(false)
  const [dragging, setDragging] = useState(false)
  // V2.6 — tracked viewport size so OverlayLayer can compute the visible
  // farm-pixel rectangle for viewport culling. Updates only on resize (never
  // during a pan/zoom gesture), so it never triggers per-frame re-renders.
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  // V2.4 — currently selected tree (selection only; no details panel yet).
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null)
  // Reset selection when the mission/tiles change.
  useEffect(() => {
    setSelectedTreeId(null)
  }, [tiles])

  // V3.7.1 — focus the twin on a tree requested via `initialTreeId` (e.g. from the
  // Mission History "Open Digital Twin" link). Seed the selection once the overlay
  // metadata for that tree has arrived so the details panel can resolve it.
  useEffect(() => {
    if (initialTreeId == null) return
    if (trees?.some((t) => t.tree_id === initialTreeId)) {
      setSelectedTreeId(initialTreeId)
    }
  }, [initialTreeId, trees])

  // V2.5 — the overlay metadata for the currently selected tree, so the Tree
  // Details panel can read tree_code / gps / times_seen without a refetch
  // (those fields already arrived in the bulk overlay response).
  const selectedOverlay = useMemo(
    () => trees?.find((t) => t.tree_id === selectedTreeId) ?? null,
    [trees, selectedTreeId]
  )

  // Active pointers (id -> last position) for unified pan / pinch handling.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchPrevDist = useRef<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  )

  // V2.5.1 (ISSUE 3) — hit-testing for tap-vs-drag. OverlayLayer no longer
  // intercepts pointer events, so a press can start on a tree box and still pan.
  // We remember which tree (if any) the press began on and whether the pointer
  // moved; on release, a stationary press on a box selects that tree.
  const pointerDownInfo = useRef<{
    treeId: number | null
    x: number
    y: number
    moved: boolean
  } | null>(null)

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

  // V2.6 — keep the viewport size in state (ResizeObserver) so OverlayLayer's
  // culling rect stays correct after layout changes. Fires on mount + resize.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const update = () => setViewportSize({ w: vp.clientWidth, h: vp.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(vp)
    return () => ro.disconnect()
  }, [])

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

    // V2.5.1 (ISSUE 3) — record the tree under the press for tap-to-select.
    const hit = (e.target as HTMLElement)?.closest?.("[data-tree-id]")
    pointerDownInfo.current = {
      treeId: hit ? Number(hit.getAttribute("data-tree-id")) : null,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // V2.5.1 (ISSUE 3) — mark the press as a drag once it moves past a small
    // threshold, so a real pan does not also count as a tap-select.
    const info = pointerDownInfo.current
    if (info && !info.moved) {
      const dx = e.clientX - info.x
      const dy = e.clientY - info.y
      if (dx * dx + dy * dy > 25) info.moved = true
    }

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

      // V2.5.1 (ISSUE 3) — a stationary press that began on a tree box is a tap:
      // select it. A drag (pan) or a press on empty space selects nothing.
      const info = pointerDownInfo.current
      pointerDownInfo.current = null
      if (info && !info.moved && info.treeId != null) {
        setSelectedTreeId(info.treeId)
      }
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
      style={{
        position: "relative",
        width: "100%",
        height,
        minHeight,
        overflow: "hidden",
      }}
    >
      {/* Toolbar — sibling of the Viewport, never transformed. */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          gap: 6,
          zIndex: 7,
        }}
      >
        <ViewerButton label="+" title="Zoom in" onClick={() => zoomCenter(BUTTON_STEP)} />
        <ViewerButton label="–" title="Zoom out" onClick={() => zoomCenter(1 / BUTTON_STEP)} />
        <ViewerButton label="Fit" title="Fit to screen (double-click)" onClick={fit} />
        {expandHref && (
          <ViewerButton
            label="⤢"
            title="Open full Digital Twin"
            onClick={() => router.push(expandHref)}
          />
        )}
      </div>

      {/* Viewport — owns pan/zoom pointer handling. Contains ONLY the scaled
          stage (mosaic + overlay). The Tree Details drawer is a sibling of this
          viewport, NOT inside the transformed stage, so it never scales. */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={fit}
        style={{
          position: "absolute",
          inset: 0,
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
          {trees && trees.length > 0 && (
            <OverlayLayer
              trees={trees}
              tiles={tiles}
              gap={gap}
              scale={view.scale}
              tx={view.tx}
              ty={view.ty}
              viewportWidth={viewportSize.w}
              viewportHeight={viewportSize.h}
              selectedTreeId={selectedTreeId}
            />
          )}

          {/* V3.6 — Robot Layer shares the transformed stage (single transform,
              no duplication of zoom/pan/fit). Rendered only when a live robot
              snapshot is supplied by the parent. */}
          {robot && (
            <RobotLayer
              robot={robot}
              plan={plan ?? []}
              trees={trees ?? []}
              tiles={tiles}
              gap={gap}
              scale={view.scale}
              destinationTreeId={destinationTreeId}
              harvestingTreeId={harvestingTreeId}
              completedTreeIds={completedTreeIds}
              showPath={showRobotPath}
              showTarget={showRobotTarget}
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

      {/* V2.5.1 (ISSUE 1) — Tree Details drawer lives OUTSIDE the transformed
          stage, as a sibling of the Viewport, so it stays fixed on screen at any
          zoom. Always mounted; it slides in/out so opening/closing never
          recreates the viewer. */} 
      {enableDetailsPanel && (
        <TreeDetailsDrawer
          open={selectedTreeId != null}
          tree={selectedOverlay}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setSelectedTreeId(null)}
        />
      )}
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
