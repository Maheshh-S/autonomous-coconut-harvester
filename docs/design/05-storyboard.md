# 05 — Storyboard

> The narrative arc of ARECA, page by page. Implements the "one question per page" axiom
> (constitution §7.1) and the brand world (§4). Explains what the user feels, why each page
> exists, and how it flows to the next. No code.

---

## The arc in one line

> **See the system → know the farm → watch the drone → stand inside the twin → watch the
> robot work → review what was done → care for every tree.**

A calm descent from "what is this?" to "every tree is known." Each page is a room in one
coherent building — same dark plantation world, same accent, same type voice.

---

## 1. Landing `/` — "What is ARECA?"

- **Feels:** "A real, serious autonomous farming system — and it's beautiful."
- **Exists to:** establish identity in 1 screen. No login wall, no feature-grid-first.
- **Lead:** full-bleed aerial plantation clip (`brand-hero-aerial-survey`) with a lower-third
  headline + one line + a single primary CTA ("Enter the farm" → `/dashboard`). The leaf-
  reticle mark + wordmark top-left.
- **Supporting, below the fold (not in hero):** 3–4 quiet proof blocks (drone survey, digital
  twin, climbing robot, maturity CV) — each a short headline + one line + a small clip, using
  **distinct layout families** (taste-skill §4.7), not 4 identical cards.
- **Transition out:** CTA → `/dashboard` (direction-aware slide right). The hero clip can
  scrub/settle as you leave.

---

## 2. Dashboard `/dashboard` — "What is happening on the farm right now?"

- **Feels:** calm situational awareness. "I know the state of the farm this minute."
- **Exists to:** be the at-a-glance operations surface. Composed, not crammed.
- **Lead:** the small interactive **Digital Twin card** (existing `DashboardFarmCard`) as a
  living thumbnail of the farm, plus 3–4 real metrics (trees detected, ready-to-harvest,
  active mission, last survey). Metrics use `MetricCounter` (real or mocked-labeled).
- **Supporting:** recent activity (mission started, survey completed), a quiet "open twin"
  affordance. Ambient `dashboard-farm-overview` clip as a restrained backdrop *behind* the
  twin card only — never behind text without scrim.
- **Transition out:** twin card "open" → `/map`; "Trees" → `/trees`; "Survey" → `/survey`;
  "Robot" → `/robot`. Each a direction-aware nav.

---

## 3. Survey `/survey` — "What did the drone discover?"

- **Feels:** discovery. "The drone is seeing the plantation for me."
- **Exists to:** show survey ingestion + YOLO detection results as the act of seeing.
- **Lead:** the `survey-drone-flight` clip (drone scanning rows) + the survey uploader
  (`DroneUploader`) as the primary action. Show detected-tree count, tile grid, coverage.
- **Supporting:** a strip of recent survey missions (thumbnail tiles, not a table); the
  detection results feed the twin. Drone-scan cyan appears here as "the machine is seeing."
- **Transition out:** "View in twin" → `/map` (the discovered plantation becomes the twin).

---

## 4. Digital Twin `/map` — "What does the plantation look like right now?"

- **Feels:** recognition. "That's my farm, exactly as captured."
- **Exists to:** be the single farm viewer (frozen architecture). The surveyed mosaic +
  tree overlay + selection + read-only Tree Details drawer.
- **Lead:** the `twin-digital-reveal` clip can play once on first entry (real→twin morph) as
  a gentle orientation, then the live `FarmViewer` takes over. The mosaic IS the brand.
- **Supporting:** zoom/pan/fit (frozen), selected-tree amber halo + drawer, optional live
  robot marker (`RobotLayer`). Drone-scan cyan = selected/active tree.
- **Transition out:** tap a tree → drawer (in-page, not a route change) → "full tree" →
  `/trees/[treeId]`; "Robot" → `/robot`.

---

## 5. Robot `/robot` — "What is the robot doing?"

- **Feels:** confidence. "The machine is doing the work, correctly."
- **Exists to:** visualize the simulated climbing harvester executing a mission on the twin.
- **Lead:** the `robot-climb-harvest` clip (the hero product moment) + the live robot view:
  `RobotLayer` marker moving along the NN route on the twin, `RobotStatusCard` (state:
  Moving/Climbing/Harvesting/Returning), `SimulationControls` (start/pause/speed).
- **Supporting:** current state machine readout, battery ring, next-waypoint. The robot is
  *shown working* — proof of the product.
- **Transition out:** "History" → `/robot/history` (what it did before); mission complete →
  a calm "mission finished" state that links to its history record.

---

## 6. History `/robot/history` — "What happened previously?"

- **Feels:** closure. "The work is done; here's the proof."
- **Exists to:** list completed harvest runs (Mission History & Analytics).
- **Lead:** the `history-harvest-recap` clip as a warm ambient backdrop + a clean list of
  runs (date, trees harvested, yield, duration) — **not** a 30-row bordered table
  (taste-skill §4.9). Use a calm list with dividers + a yield highlight.
- **Supporting:** selecting a run → `/robot/history/[id]` (timeline, tree-activity, robot
  log). Amber/leaf semantics for yield, not red alerts.
- **Transition out:** run → detail route (shared-element transition on the run card).

---

## 7. Trees `/trees` — "What is the condition of every tree?"

- **Feels:** care. "Each tree is known, monitored, healthy."
- **Exists to:** the per-tree inventory/health surface.
- **Lead:** the `trees-health-detail` clip (intimate palm, maturity staging) + a tree grid
  where each `TreeCard` shows real detection box / maturity / health — the CV is visible.
- **Supporting:** filter by maturity/health; selecting a tree → `/trees/[treeId]` detail
  (inventory history, inspections, harvest status) — reuses the twin's data story.
- **Transition out:** tree → detail (shared-element); "back to twin" → `/map`.

---

## 8. Transition logic (summary)

| From | To | Device | Why |
|---|---|---|---|
| `/` | `/dashboard` | slide right | entering the system |
| `/dashboard` | `/map` `/trees` `/survey` `/robot` | slide right | drill into a surface |
| `/survey` | `/map` | slide right | discovery becomes the twin |
| `/map` | `/trees/[id]` | shared-element | tree box → tree detail |
| `/robot` | `/robot/history` | slide right | live → past |
| `/robot/history` | `/robot/history/[id]` | shared-element | run card → run detail |
| `/trees` | `/trees/[id]` | shared-element | tree card → tree detail |
| any | back | slide left | spatial consistency (apple-design §7) |

All transitions direction-aware, 250–300ms ease-out, reduced-motion = cross-fade (§04).

---

*Next: `06-shot-list.md` — every video shot fully specified before any prompt is written.*
