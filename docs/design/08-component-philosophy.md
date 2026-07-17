# 08 — Component Philosophy

> Reusable primitives, designed before implementation. Each has one clear purpose and must
> pass constitution §10 (no forbidden patterns). These are presentation components; business
> logic stays in the backend (constitution §9.1, AGENTS.md). Frozen components
> (FarmViewer/OverlayLayer/TreeDetailsDrawer/RobotLayer) are referenced, not redesigned.

---

## Design rules for every component
- Real icon library (Phosphor/Tabler), one family, standardized strokeWidth (§03 §9).
- One radius scale: cards 12 / inputs 8 / buttons pill (§03 §4).
- Matte `--surface` default; glass only over moving imagery (§03 §6).
- Press feedback `scale(0.97)` 100–160ms ease-out (§04 §6).
- Tabular nums for all data (§03 §1.4).
- `aria-label` on icon-only controls; focus rings visible (§06.5).
- Reduced-motion safe (§04 §12).

---

## Primitives

### GlassPanel
- **Purpose:** floating functional layer over moving imagery (hero video, twin).
- **Anatomy:** `backdrop-filter: blur(20px) saturate(160%)` + `rgba(...,0.6)` + 1px inner
  border + top highlight; solid fallback under `prefers-reduced-transparency`.
- **Not** the default card material. Default cards use `SurfaceCard`.

### SurfaceCard
- **Purpose:** standard content container on dark UI.
- **Anatomy:** `--surface` bg, radius 12, hairline `--border`, tinted shadow (no glow).
  Used only when elevation communicates hierarchy (taste-skill §4.4).

### MetricCard
- **Purpose:** one key number with context (trees detected, ready, active mission).
- **Anatomy:** label (small, muted) + value (display, tabular-nums) + optional delta/
  sublabel. `MetricCounter` animates the value on load. **Not** a hero-metric wall — max 3–4
  per dashboard, calm spacing.

### MetricCounter
- **Purpose:** count a number up to its value on enter; respects reduced-motion (static).
- **Anatomy:** Motion `whileInView`, ease-out, 150–250ms; tabular-nums; real or mock-labeled
  value (taste-skill §4.9).

### DroneStatus
- **Purpose:** show a survey/drone "seeing" state with the scan accent.
- **Anatomy:** small status row (icon + label + progress) using `--accent` cyan only when
  actively scanning. Conveys the machine-vision identity (§03 §10.2).

### MissionCard / MissionRow
- **Purpose:** one harvest run in History (date / trees / yield / duration).
- **Anatomy:** a calm row with dividers (not a bordered table). Yield highlight in leaf/amber.
  Shared-element transition target to detail. Empty state composed.

### MissionTimeline
- **Purpose:** chronological events of a run on `/robot/history/[id]`.
- **Anatomy:** vertical timeline, state-colored dots (frozen `RobotState` semantics),
  tabular timestamps. Reads as "what happened," not a log dump.

### RobotStatus
- **Purpose:** live robot state + battery on `/robot`.
- **Anatomy:** state badge (frozen labels), battery ring (SVG, real lib/primitive — not
  hand-drawn), next-waypoint. Calm transitions between states (no burst).

### TreeCard
- **Purpose:** one tree in the `/trees` grid with *visible CV*.
- **Anatomy:** thumbnail/box (real detection), maturity chips (mature/potential/premature with
  leaf/amber semantics), health indicator. The computer vision is shown, not hidden.

### HeroVideo
- **Purpose:** full-bleed or section documentary clip (one of the 7 shots, §06).
- **Anatomy:** `<video>` autoplay muted loop playsinline, `next/image`-style priority for LCP,
  scrim for text contrast, optional scroll-scrub (reduced-motion = static). Reserved space to
  avoid CLS (ui-ux-pro-max §3).

### RevealSection
- **Purpose:** scroll-reveal wrapper (fade + small rise, staggered children).
- **Anatomy:** Motion `whileInView`, once, amount 0.3, stagger 30–60ms, ease-out. Never blocks
  interaction. Reduced-motion = opacity only.

### SimulationControls
- **Purpose:** start/pause/speed for the robot sim on `/robot`.
- **Anatomy:** pill buttons (start/pause), speed selector; wired to frozen endpoints. Press
  feedback on every control; disabled state clear.

### NavBar
- **Purpose:** single-line desktop nav; specific labels (Survey, Trees, Robot, Dashboard).
- **Anatomy:** leaf-reticle mark + ARECA wordmark left; links right; mobile → bottom nav ≤5
  (ui-ux-pro-max §9); no two-line nav (taste-skill §4.7).

### Toast
- **Purpose:** transient feedback (mission started, error).
- **Anatomy:** Motion, enter/exit same path (apple-design §7), 200–300ms, origin-aware;
  interruptible (emil §Review). Not for persistent status.

---

## Frozen components (referenced, not redesigned)
- `FarmViewer`, `FarmMosaic`, `OverlayLayer`, `TreeDetailsDrawer` — Digital Twin (§07.4).
- `RobotLayer` — live robot marker on the twin (§07.5).
- `DashboardFarmCard` — interactive twin thumbnail (§07.2).
- `DroneUploader`, `CoconutUploader` — real upload entry points (§07.3).
- All backend contracts (`detection.ts`, `computeMosaicLayout`, `data-testid`s) unchanged.

---

## Anti-patterns per component (must avoid)
- ❌ GlassPanel as default card.
- ❌ MetricCard fake-precision (`4.1×`) or hero-metric wall.
- ❌ Hand-drawn SVG icons anywhere (use the lib).
- ❌ Card grids with no rhythm / identical 3-up everywhere.
- ❌ State badges with red-alert neon; use amber/leaf semantics.
- ❌ Spinner-only loading; use shaped skeletons.

---

*Next: `09-asset-generation-strategy.md` — what assets are needed and how each is produced.*
