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
// V2 (interaction overhaul) — gesture engine:
//   - One rAF pipeline drives every animated view change (wheel zoom, toolbar
//     buttons, Fit, follow-camera). `viewRef` holds the live view (written
//     straight to the DOM each frame); `targetRef` holds where we are heading.
//     New input retargets mid-flight, so everything is interruptible.
//   - Trackpad-aware wheel: continuous deltas (|deltaY| < 40) zoom
//     proportionally (exp curve — no runaway); discrete notches / large deltas
//     (mouse wheels, synthetic test events) step exactly WHEEL_STEP per event.
//   - Momentum pan with friction after release; pan is clamped so the farm can
//     never be dragged into the void (content smaller than the viewport pins
//     centered; larger content keeps a visible margin).
//   - No React re-render per gesture event: the zoom % readout is written via
//     ref each frame; React state is committed only when an animation settles
//     or a gesture ends (so OverlayLayer's culling/LOD recompute on settle).
//   - Render style reads `viewRef.current`, so unrelated re-renders (selection,
//     resize) can never snap the stage back to a stale committed view.
//
// Input uses Pointer Events so a single code path serves mouse, touch, and
// stylus: one pointer pans, two pointers pinch-zoom. `touch-action: none` stops
// the browser from hijacking the gestures, so the viewer works on mobile too.
const MIN_SCALE = 0.02
const MAX_SCALE = 20
const FIT_MAX_SCALE = 1 // Fit never upscales past 100% (avoids blurry blow-up)
const WHEEL_STEP = 1.12 // per discrete wheel notch / synthetic event
const BUTTON_STEP = 1.25
const FIT_PADDING = 24 // screen px around the farm in the fit view
const PAN_MARGIN = 80 // screen px of content kept on-screen when clamping
const ANIM_RATE = 16 // 1/s — exponential approach rate toward the target view
const MOMENTUM_FRICTION = 6 // 1/s — velocity decay after release
const MOMENTUM_START_SPEED = 240 // px/s at release needed to start momentum
const MOMENTUM_MIN_SPEED = 40 // px/s below which momentum stops
const TRACKPAD_DELTA = 40 // |deltaY| below this is a continuous trackpad delta
const TRACKPAD_GAIN = 0.0032 // exp(-deltaY * GAIN) per continuous wheel event
const DBLTAP_MS = 300
const DBLTAP_DIST = 30

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

type View = { scale: number; tx: number; ty: number }

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
  // V2 (interaction overhaul) — follow-camera. When `followPoint` (farm-pixel
  // coords) is supplied, the viewport gently keeps that point centered (used
  // with the live robot position). Any manual pan/zoom calls
  // `onFollowInterrupt` so the parent can switch the toggle back off; follow
  // stays off until the user re-enables it. Off by default (no prop = no
  // behaviour change for the dashboard card).
  followPoint,
  onFollowInterrupt,
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
  followPoint?: { x: number; y: number } | null
  onFollowInterrupt?: () => void
}) {
  const router = useRouter()
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)

  // Live view (authoritative — written straight to the DOM) + committed view
  // (React state, drives OverlayLayer culling/LOD and the readout's initial
  // render). Commits happen on animation settle / gesture end only.
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 })
  const targetRef = useRef<View | null>(null)
  const momentumRef = useRef<{ vx: number; vy: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)

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
  // Per-gesture caches (avoid per-move getBoundingClientRect / layout reads).
  const vpRectRef = useRef<DOMRect | null>(null)
  // Recent pointer samples for release-velocity (momentum).
  const moveHistory = useRef<{ x: number; y: number; t: number }[]>([])
  // Double-tap detection (touch only; desktop keeps double-click = Fit).
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null)
  const lastTouchDblTapRef = useRef(0)

  // Latest follow props via refs so the native wheel listener never needs
  // rebinding as the robot emits frames.
  const followRef = useRef({ followPoint, onFollowInterrupt })
  followRef.current = { followPoint, onFollowInterrupt }

  // Write the view straight to the DOM (stage transform + live zoom % readout).
  // Called every animation frame / gesture move — never triggers a React render.
  const setStageStyle = useCallback((v: View) => {
    const stage = stageRef.current
    if (stage) {
      stage.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`
    }
    if (readoutRef.current) {
      readoutRef.current.textContent = `${Math.round(v.scale * 100)}%`
    }
  }, [])

  const commit = useCallback(() => {
    setView(viewRef.current)
  }, [])

  // Coalesced commit of the LATEST animation target: children (OverlayLayer
  // culling/LOD, readout's initial render) see the view immediately — at most
  // one React render per frame, aligned with the animation — while the DOM
  // keeps chasing the target. The exact value is committed again on settle.
  const commitScheduledRef = useRef(false)
  const scheduleCommit = useCallback(() => {
    if (commitScheduledRef.current) return
    commitScheduledRef.current = true
    requestAnimationFrame(() => {
      commitScheduledRef.current = false
      setView(targetRef.current ?? viewRef.current)
    })
  }, [])

  // Keep the farm reachable: content smaller than the viewport stays centered;
  // larger content always keeps at least PAN_MARGIN px visible on each axis.
  const clampView = useCallback((v: View): View => {
    const vp = viewportRef.current
    const stage = stageRef.current
    if (!vp || !stage) return v
    const fw = stage.offsetWidth
    const fh = stage.offsetHeight
    if (!fw || !fh) return v
    const Vw = vp.clientWidth
    const Vh = vp.clientHeight
    const cw = fw * v.scale
    const ch = fh * v.scale
    let tx: number
    let ty: number
    if (cw <= Vw - 2 * PAN_MARGIN) tx = (Vw - cw) / 2
    else tx = clamp(v.tx, Vw - cw - PAN_MARGIN, PAN_MARGIN)
    if (ch <= Vh - 2 * PAN_MARGIN) ty = (Vh - ch) / 2
    else ty = clamp(v.ty, Vh - ch - PAN_MARGIN, PAN_MARGIN)
    return { scale: v.scale, tx, ty }
  }, [])

  // The single rAF loop: chases `targetRef` (exponential, interruptible) and/or
  // applies momentum decay; stops itself when nothing is left to do.
  const tick = useCallback(
    (now: number) => {
      rafRef.current = null
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05)
      lastFrameRef.current = now
      let again = false
      const cur = viewRef.current

      const target = targetRef.current
      if (target) {
        const f = 1 - Math.exp(-ANIM_RATE * dt)
        // Scale interpolates geometrically (constant perceived zoom speed);
        // translation linearly.
        const ns = cur.scale * Math.pow(target.scale / cur.scale, f)
        const ntx = cur.tx + (target.tx - cur.tx) * f
        const nty = cur.ty + (target.ty - cur.ty) * f
        const settled =
          Math.abs(Math.log(target.scale / ns)) < 0.002 &&
          Math.abs(target.tx - ntx) < 0.5 &&
          Math.abs(target.ty - nty) < 0.5
        if (settled) {
          viewRef.current = target
          targetRef.current = null
          setStageStyle(target)
          commit()
        } else {
          viewRef.current = { scale: ns, tx: ntx, ty: nty }
          setStageStyle(viewRef.current)
          again = true
        }
      } else if (momentumRef.current) {
        const m = momentumRef.current
        const decay = Math.exp(-MOMENTUM_FRICTION * dt)
        const vx = m.vx * decay
        const vy = m.vy * decay
        const raw: View = {
          scale: cur.scale,
          tx: cur.tx + vx * dt,
          ty: cur.ty + vy * dt,
        }
        const c = clampView(raw)
        if (c.tx !== raw.tx) m.vx = 0
        if (c.ty !== raw.ty) m.vy = 0
        viewRef.current = c
        setStageStyle(c)
        if (Math.hypot(m.vx, m.vy) < MOMENTUM_MIN_SPEED) {
          momentumRef.current = null
          commit()
        } else {
          again = true
        }
      }

      if (again) {
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [clampView, commit, setStageStyle]
  )

  const startRaf = useCallback(() => {
    if (rafRef.current == null) {
      lastFrameRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        // Null the handle: StrictMode's simulated unmount runs this cleanup
        // while a frame is pending — a stale non-null id would make every
        // later startRaf() believe the loop is still alive.
        rafRef.current = null
      }
    }
  }, [])

  // Retarget the animation toward `v` (clamped). Manual call sites: fit,
  // toolbar zoom, follow-camera, settle-back after over-drag.
  const animateTo = useCallback(
    (v: View) => {
      momentumRef.current = null
      targetRef.current = clampView(v)
      scheduleCommit()
      startRaf()
    },
    [clampView, scheduleCommit, startRaf]
  )

  // Anchored zoom applied to a view (no side effects).
  const zoomedView = useCallback(
    (from: View, factor: number, clientX: number, clientY: number): View => {
      const rect =
        vpRectRef.current ?? viewportRef.current?.getBoundingClientRect() ?? null
      if (!rect) return from
      const cx = clientX - rect.left
      const cy = clientY - rect.top
      const ns = clamp(from.scale * factor, MIN_SCALE, MAX_SCALE)
      const f = ns / from.scale
      return {
        scale: ns,
        tx: cx - (cx - from.tx) * f,
        ty: cy - (cy - from.ty) * f,
      }
    },
    []
  )

  // Wheel / toolbar zoom: retarget (interruptible), no per-event React render —
  // children get the latest view via the coalesced per-frame commit.
  const zoomTarget = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const base = targetRef.current ?? viewRef.current
      targetRef.current = clampView(zoomedView(base, factor, clientX, clientY))
      scheduleCommit()
      startRaf()
    },
    [clampView, scheduleCommit, startRaf, zoomedView]
  )

  const zoomCenter = useCallback(
    (factor: number) => {
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      zoomTarget(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
    },
    [zoomTarget]
  )

  // Follow-camera suspension: any manual gesture hands control back to the user.
  const interruptFollow = useCallback(() => {
    if (followRef.current.followPoint) {
      followRef.current.onFollowInterrupt?.()
    }
  }, [])

  // Fit the complete farm inside the viewport (centred, padded, never
  // upscaled). Deterministic — re-fitting always restores the exact same view.
  const fit = useCallback(() => {
    const stage = stageRef.current
    const vp = viewportRef.current
    if (!stage || !vp) return
    const fw = stage.offsetWidth
    const fh = stage.offsetHeight
    if (fw === 0 || fh === 0) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    const scale = clamp(
      Math.min((vw - 2 * FIT_PADDING) / fw, (vh - 2 * FIT_PADDING) / fh),
      MIN_SCALE,
      FIT_MAX_SCALE
    )
    animateTo({
      scale,
      tx: (vw - fw * scale) / 2,
      ty: (vh - fh * scale) / 2,
    })
  }, [animateTo])

  // Native non-passive wheel listener so preventDefault (page scroll) works.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      interruptFollow()
      momentumRef.current = null
      const dy = e.deltaY
      // Discrete notch (mouse wheel / synthetic events) vs continuous trackpad
      // delta: notches step WHEEL_STEP; trackpad deltas scale proportionally
      // so a two-finger gesture never "runs away".
      const factor =
        e.deltaMode !== 0 || Math.abs(dy) >= TRACKPAD_DELTA
          ? dy < 0
            ? WHEEL_STEP
            : 1 / WHEEL_STEP
          : Math.exp(-dy * TRACKPAD_GAIN)
      zoomTarget(factor, e.clientX, e.clientY)
    }
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [interruptFollow, zoomTarget])

  // Initial fit and refit when the mission/tiles change, so the complete farm is
  // always visible first. Deliberately NOT triggered on resize, so the current
  // zoom is preserved when the card is resized / navigates.
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles])

  // Follow-camera: retarget toward the point whenever it moves (each robot
  // frame). The rAF chase makes the camera glide rather than snap.
  useEffect(() => {
    if (!followPoint) return
    const vp = viewportRef.current
    if (!vp) return
    const cur = viewRef.current
    animateTo({
      scale: cur.scale,
      tx: vp.clientWidth / 2 - followPoint.x * cur.scale,
      ty: vp.clientHeight / 2 - followPoint.y * cur.scale,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followPoint?.x, followPoint?.y])

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
    interruptFollow()
    // Any manual gesture takes over: stop animations and momentum.
    targetRef.current = null
    momentumRef.current = null
    vpRectRef.current = vp.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: viewRef.current.tx,
        ty: viewRef.current.ty,
      }
      moveHistory.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
      setDragging(true)
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
        // Pinch is immediate (direct write); the animation target is dropped so
        // the gesture always wins.
        viewRef.current = zoomedView(viewRef.current, factor, midX, midY)
        setStageStyle(viewRef.current)
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
      setStageStyle(v)
      // Velocity samples (for release momentum).
      const hist = moveHistory.current
      hist.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (hist.length > 6) hist.shift()
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchPrevDist.current = null
    if (pointers.current.size === 0) {
      dragRef.current = null
      setDragging(false)
      vpRectRef.current = null

      // V2.5.1 (ISSUE 3) — a stationary press that began on a tree box is a tap:
      // select it. A drag (pan) or a press on empty space selects nothing.
      const info = pointerDownInfo.current
      pointerDownInfo.current = null
      const wasTap = !!info && !info.moved
      if (wasTap && info!.treeId != null) {
        setSelectedTreeId(info!.treeId)
      }

      // Double-tap zoom (touch only — desktop double-click stays Fit).
      const isTouch = e.pointerType === "touch"
      if (isTouch && wasTap) {
        const now = performance.now()
        const lt = lastTapRef.current
        if (
          lt &&
          now - lt.t < DBLTAP_MS &&
          Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < DBLTAP_DIST
        ) {
          lastTapRef.current = null
          lastTouchDblTapRef.current = Date.now()
          zoomTarget(2, e.clientX, e.clientY)
          return
        }
        lastTapRef.current = { t: now, x: e.clientX, y: e.clientY }
      }

      // Momentum / settle-back: clamp first; if the gesture ended out of bounds
      // we animate back, otherwise a fast release carries momentum.
      const clamped = clampView(viewRef.current)
      const hist = moveHistory.current
      let vx = 0
      let vy = 0
      if (hist.length >= 2) {
        const first = hist[0]
        const last = hist[hist.length - 1]
        const dt = (last.t - first.t) / 1000
        if (dt > 0.005) {
          vx = (last.x - first.x) / dt
          vy = (last.y - first.y) / dt
        }
      }
      moveHistory.current = []
      if (
        clamped.tx !== viewRef.current.tx ||
        clamped.ty !== viewRef.current.ty
      ) {
        animateTo(clamped) // settle back from an over-drag
      } else if (Math.hypot(vx, vy) >= MOMENTUM_START_SPEED) {
        momentumRef.current = { vx, vy }
        startRaf()
      } else {
        commit()
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
      moveHistory.current = [{ x: remaining.x, y: remaining.y, t: performance.now() }]
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
        onDoubleClick={() => {
          // Touch double-taps are handled in the pointer path; don't also Fit.
          if (Date.now() - lastTouchDblTapRef.current < 800) return
          fit()
        }}
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
            // Reads the LIVE view, not the committed state — an unrelated
            // re-render (selection, resize) can never snap the stage back.
            transform: `translate(${viewRef.current.tx}px, ${viewRef.current.ty}px) scale(${viewRef.current.scale})`,
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
          ref={readoutRef}
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
