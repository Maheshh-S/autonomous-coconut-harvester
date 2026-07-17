# 07 — Page UX Strategy

> Per-page UX for all 7 surfaces. Implements constitution §7 (one question per page) and
> the storyboard (§05). Each page: purpose, user journey, information hierarchy, visual
> hierarchy, key interactions, success criteria. Frozen contracts preserved throughout.

---

## Global UX constraints (apply to every page)
- Frozen: `detection.ts` exports, `computeMosaicLayout`, Playwright `data-testid`s, routes,
  FarmViewer/OverlayLayer/TreeDetailsDrawer separation.
- Single dark tropical-dark theme (§03). One accent (drone-scan cyan) = live/active/scan.
- Nav: single line on desktop (taste-skill §4.7); specific labels (Survey, Trees — apple-design §16).
- Real states: loading skeletons, composed empty, inline error (taste-skill §4.5).
- Motion: per §04; reduced-motion safe.

---

## 1. Landing `/` — "What is ARECA?"

- **Primary purpose:** establish identity in one screen.
- **User journey:** arrive → see plantation + drone → read one line → "Enter the farm".
- **Information hierarchy:** (1) hero clip + headline, (2) single CTA, (3) below-fold proof
  blocks (distinct families, not 4 identical cards).
- **Visual hierarchy:** full-bleed video dominates; text is a lower-third block with scrim;
  leaf-reticle mark + wordmark top-left, minimal nav.
- **Key interactions:** CTA → `/dashboard` (direction-aware). Proof blocks are scroll-reveal
  (staggered, once).
- **Success criteria:** within 3s the user knows this is an autonomous coconut-harvesting
  system; CTA is visible without scroll; hero fits viewport (taste-skill §4.7 hero rules).

---

## 2. Dashboard `/dashboard` — "What is happening on the farm right now?"

- **Primary purpose:** at-a-glance operations state.
- **User journey:** land → read twin thumbnail + 3–4 metrics → pick a surface (twin/trees/
  survey/robot) or read recent activity.
- **Information hierarchy:** (1) interactive twin card (living thumbnail), (2) key metrics
  (trees detected / ready / active mission / last survey), (3) recent activity, (4) ambient
  clip behind twin card only.
- **Visual hierarchy:** twin card is the hero region (it IS the brand); metrics are calm
  `MetricCard`s, not a hero-metric wall; ambient video strictly behind the card with scrim.
- **Key interactions:** twin card "open" → `/map`; metric/surface links; `MetricCounter`
  counts up on load (real or mocked-labeled).
- **Success criteria:** user can answer "what's the farm doing now?" without scrolling; twin
  card is interactive and links to `/map`; 0 console errors; reduced-motion shows static.

---

## 3. Survey `/survey` — "What did the drone discover?"

- **Primary purpose:** show drone survey ingestion + YOLO detection as the act of seeing.
- **User journey:** land → see `survey-drone-flight` clip + uploader → upload drone folder →
  see detected count / tile grid / coverage → "View in twin".
- **Information hierarchy:** (1) clip + `DroneUploader` action, (2) detection results
  (tree count, tiles, coverage), (3) recent survey missions strip (thumbnails, not a table).
- **Visual hierarchy:** uploader is the primary control; cyan = "scanning/seeing" appears on
  active detection; results use real numbers (mock-labeled if demo).
- **Key interactions:** upload → progress (skeleton/real), results feed twin; "View in twin"
  → `/map`; recent missions selectable.
- **Success criteria:** the discovery is visualized (clip + real detection), not described;
  cyan used only for live scan; navigation to twin is obvious.

---

## 4. Digital Twin `/map` — "What does the plantation look like now?"

- **Primary purpose:** the single farm viewer — surveyed mosaic + trees + selection.
- **User journey:** arrive → (first time) `twin-digital-reveal` orientation → live `FarmViewer`
  → zoom/pan/fit → tap tree → drawer → "full tree" → `/trees/[id]`.
- **Information hierarchy:** (1) mosaic (dominant), (2) toolbar (zoom/fit), (3) selected-tree
  amber halo + `TreeDetailsDrawer`, (4) optional live `RobotLayer`.
- **Visual hierarchy:** the farm fills the view; chrome is recessive; selected tree = amber,
  not cyan (cyan is reserved for live robot/scan). Overlay boxes counter-scale to stay legible
  (frozen behaviour preserved).
- **Key interactions:** pointer-nav (frozen: pan/pinch/fit), tap-select (tap vs drag threshold
  frozen), drawer slide (spring, interruptible), robot marker live via WS.
- **Success criteria:** 302/302 boxes align (frozen); selected label always visible (LOD);
  viewer interactive during drawer; 0 console errors; reduced-motion disables parallax only.

---

## 5. Robot `/robot` — "What is the robot doing?"

- **Primary purpose:** visualize the simulated climbing harvester on a mission.
- **User journey:** land → `robot-climb-harvest` clip → live robot view (marker on twin route,
  `RobotStatusCard`, `SimulationControls`) → start/pause/adjust speed → watch states.
- **Information hierarchy:** (1) clip + live robot on twin, (2) `RobotStatusCard` (state machine
  readout), (3) `SimulationControls` (start/pause/speed), (4) battery ring + next waypoint.
- **Visual hierarchy:** the robot *working* is the hero (clip + live marker); controls are
  recessed; state uses the frozen `RobotState` labels (Moving/Climbing/Scanning/Harvesting/
  Returning/Error/Docked).
- **Key interactions:** SimulationControls (frozen endpoints), live WS position, state badge
  transitions (calm, no burst), "History" → `/robot/history`.
- **Success criteria:** user sees the robot progress along the route in real time; state is
  legible; controls respond on press (§04); 0 console errors.

---

## 6. History `/robot/history` — "What happened previously?"

- **Primary purpose:** list completed harvest runs (Mission History & Analytics).
- **User journey:** land → `history-harvest-recap` ambient + run list → select run →
  `/robot/history/[id]`.
- **Information hierarchy:** (1) ambient clip (behind, scrimmed), (2) run list (date / trees
  harvested / yield / duration) with dividers — NOT a 30-row bordered table (taste-skill §4.9),
  (3) yield highlight in leaf/amber semantics.
- **Visual hierarchy:** list is calm and scannable; one run per row; selected run uses shared-
  element transition to detail.
- **Key interactions:** select run → detail route; empty state composed ("No missions yet").
- **Success criteria:** user can read what was harvested and when at a glance; no data-dump
  table; shared-element transition to detail.

---

## 7. Trees `/trees` — "What is the condition of every tree?"

- **Primary purpose:** per-tree inventory / health surface.
- **User journey:** land → `trees-health-detail` clip + tree grid (each `TreeCard` shows real
  detection/maturity/health) → filter → select tree → `/trees/[treeId]`.
- **Information hierarchy:** (1) clip + tree grid, (2) `TreeCard`s with visible CV (box /
  maturity / health), (3) filters (maturity / health), (4) detail route reuse.
- **Visual hierarchy:** grid where the computer vision is *visible* — not abstract stats; each
  card shows a real tree's state; maturity uses leaf(positive)/amber(attention) semantics.
- **Key interactions:** filter, select → `/trees/[treeId]` (shared-element); "back to twin" →
  `/map`.
- **Success criteria:** every tree reads as known/monitored; CV visible per card; no generic
  stat grid; 0 console errors.

---

## Cross-page consistency
- Same dark theme, same type, same accent rules on all 7.
- Every page leads with the answer to its one question (§05).
- Navigation is consistent; back is always slide-left (§04/§05).
- Frozen contracts untouched on every page.

---

*Next: `08-component-philosophy.md` — the reusable primitives, each with a clear purpose.*
