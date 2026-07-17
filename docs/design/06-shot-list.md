# 06 — Shot List

> Every video shot, fully specified, BEFORE any prompt is written (per DESIGN REVIEW 2).
> Prompts are derived in `10-google-flow-guidelines.md` + the improved `assets/prompts/`.
> No generation happens in this phase.

Each shot maps to a page from `05-storyboard.md` and obeys the single documentary film
defined in `02-brand-strategy.md §4` and `10-google-flow-guidelines.md`.

Conventions:
- **Loop point:** where the clip seamlessly restarts (for ambient backdrops).
- **Duration:** target length for Google Flow / Veo.
- **Filename:** exact output path in `assets/clips/`.
- **Forbidden:** things that would break the brand world (cyberpunk, humans-as-subject,
  neon, humanoid robots, warehouse/factory settings).

---

## S1 — brand-hero-aerial-survey
- **Page:** `/` (Landing hero)
- **Scene purpose:** Establish the whole ARECA world in one breath — plantation + drone.
- **Camera movement:** slow aerial push-in following the drone down a palm row toward horizon.
- **Lens:** wide (24–35mm equiv), steady gimbal.
- **Lighting:** golden hour, warm key, soft fill.
- **Time of day:** late afternoon. **Weather:** clear, light breeze. **Environment:** coastal
  tropical plantation, rows of mature coconuts.
- **Mood:** serene, premium, documentary.
- **Required:** drone (4-rotor, small, realistic), fronds swaying, dappled light, soil/grass.
- **Forbidden:** humans, UI/HUD, text, neon, cyberpunk, warehouse.
- **Duration:** 8s. **Loop point:** n/a (hero, plays once / holds). **Transition:** settles as
  user navigates to `/dashboard`.
- **Filename:** `assets/clips/brand-hero-aerial-survey.mp4`

## S2 — dashboard-farm-overview
- **Page:** `/dashboard` (ambient backdrop behind twin card only)
- **Scene purpose:** quiet living context of the farm right now.
- **Camera movement:** slow continuous pan, low orbit drone, very gentle.
- **Lens:** wide. **Lighting:** early-soft-morning. **Time:** dawn. **Weather:** calm, mist
  lifting. **Environment:** plantation rows, a few fallen green coconuts.
- **Mood:** calm, ambient, unobtrusive.
- **Required:** palms, ground, slow motion feel. **Forbidden:** text/UI, people, neon.
- **Duration:** 6s. **Loop point:** end matches start (seamless pan loop). **Transition:** fades
  under twin card.
- **Filename:** `assets/clips/dashboard-farm-overview.mp4`

## S3 — survey-drone-flight
- **Page:** `/survey` (hero + uploader context)
- **Scene purpose:** the drone performing the survey — scanning/mapping, not just hovering.
- **Camera movement:** close third-person tracking, side-follow of the drone flying low
  between rows, downward gimbal implied.
- **Lens:** 35–50mm. **Lighting:** sun-dappled midday, natural. **Time:** morning.
  **Weather:** light breeze. **Environment:** palm rows, ground grid implied.
- **Mood:** precise, purposeful, discovery.
- **Required:** quadcopter, rotor blur, row-following flight, ground below. **Forbidden:**
  humans, HUD, neon, cyberpunk.
- **Duration:** 7s. **Loop point:** flight continues seamlessly (drone exits frame right as
  if re-entering left). **Transition:** into twin on "View in twin".
- **Filename:** `assets/clips/survey-drone-flight.mp4`

## S4 — twin-digital-reveal
- **Page:** `/map` (orientation, plays once on first entry)
- **Scene purpose:** real plantation morphs into the digital twin — the product's thesis shot.
- **Camera movement:** hold + slow push; the morph carries the motion.
- **Lens:** wide aerial. **Lighting:** consistent with S1 (golden). **Time:** afternoon.
  **Weather:** clear. **Environment:** same plantation as S1.
- **Mood:** elegant, revealing, "this is the twin."
- **Required:** real aerial → clean twin (tree points as markers, grid lines, soft topographic
  surface). Muted technical cyan-green on dark. **Forbidden:** sci-fi neon, glow, HUD clutter,
  humans.
- **Duration:** 7s. **Loop point:** n/a (orientation, then hands to live viewer).
  **Transition:** cross-dissolve into the live `FarmViewer`.
- **Filename:** `assets/clips/twin-digital-reveal.mp4`

## S5 — robot-climb-harvest
- **Page:** `/robot` (hero product moment)
- **Scene purpose:** the tree-climbing harvester doing the work — the proof of the product.
- **Camera movement:** side tracking, steady; slight slow push as it climbs.
- **Lens:** 35–50mm. **Lighting:** natural daylight. **Time:** morning. **Weather:** calm.
  **Environment:** a single tall palm, ground, collection basket at base.
- **Mood:** capable, believable, engineered.
- **Required:** ring-climbing robot mechanism gripping trunk, ascending, cutting arm detaching
  a mature coconut into basket. Real bark texture. **Forbidden:** humanoid robot, generic
  robot arm on a pedestal, warehouse/factory, humans, neon.
- **Duration:** 8s. **Loop point:** n/a (product hero; can hold last frame). **Transition:**
  into live `RobotLayer` view.
- **Filename:** `assets/clips/robot-climb-harvest.mp4`

## S6 — history-harvest-recap
- **Page:** `/robot/history` (ambient backdrop)
- **Scene purpose:** warm retrospective of a completed mission.
- **Camera movement:** gentle slow-motion montage feel; slow orbit / drift.
- **Lens:** wide–mid. **Lighting:** warm golden, "mission completed." **Time:** late
  afternoon. **Weather:** calm. **Environment:** robot between several palms, baskets filling,
  drone above.
- **Mood:** resolved, settled, proud-but-quiet.
- **Required:** harvester, filled baskets, drone logging. **Forbidden:** text/UI, people, neon.
- **Duration:** 6s. **Loop point:** seamless warm loop. **Transition:** fades behind list.
- **Filename:** `assets/clips/history-harvest-recap.mp4`

## S7 — trees-health-detail
- **Page:** `/trees` (hero + tree cards context)
- **Scene purpose:** intimate look at one healthy palm and coconut maturity staging.
- **Camera movement:** slow orbit around a single palm.
- **Lens:** 50–85mm, close. **Lighting:** natural daylight. **Time:** morning. **Weather:**
  calm. **Environment:** one tall palm, trunk texture, fronds, coconut clusters.
- **Mood:** careful, close-to-nature, informative.
- **Required:** trunk ring-scars, fronds, coconuts at different maturity (young small → full
  mature); a subtle CV highlight passing over a mature coconut (machine seeing). **Forbidden:**
  humans, HUD, neon, cyberpunk.
- **Duration:** 6s. **Loop point:** orbit completes seamlessly. **Transition:** into tree grid.
- **Filename:** `assets/clips/trees-health-detail.mp4`

---

## Coverage check

| Page | Shot(s) |
|---|---|
| `/` | S1 |
| `/dashboard` | S2 |
| `/survey` | S3 |
| `/map` | S4 |
| `/robot` | S5 |
| `/robot/history` | S6 |
| `/trees` | S7 |

All 7 pages covered. Each shot is a distinct beat in one documentary film. No shot repeats
another's composition. Forbidden list is consistent across all (cyberpunk / neon / humanoid /
warehouse / humans-as-subject / UI text).

---

*Next: `07-page-ux-strategy.md` — per-page purpose, journey, hierarchy, interactions,
success criteria.*
