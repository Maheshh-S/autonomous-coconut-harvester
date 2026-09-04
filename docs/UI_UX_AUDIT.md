# UI/UX Audit — Veraxis Frontend

> **Date:** 4 Sept 2026 · **Scope:** frontend presentation layer only (no backend changes)
> **Method:** live screenshot sweep (49 captures — every route at 1024×768 + 390×844, full-page +
> hero, key states: tree drawer, mobile More sheet, run-detail tabs, deep links) reviewed page by
> page against the impeccable product-register rubric (Nielsen 10 heuristics, cognitive load,
> personas, anti-slop bans) **plus** a deterministic evidence pass (anti-pattern detector, WCAG
> contrast math, pattern greps). Snapshots: `frontend/shots/audit/`. Sweep script:
> `frontend/audit_shots.js`.
> **Frozen contracts respected throughout:** backend, `detection.ts`, `computeMosaicLayout`,
> `useRobotSimulation` contracts, Playwright `data-testid`s, routes/user flows.

---

## 1. Executive summary

The app is **calm, consistent, and functionally honest** — real loading/empty/error states, a
coherent token system, one icon family, working IST localization, and **0 console errors across
all 49 captures**. The craft foundations are genuinely good.

The problems fall into four buckets:

1. **Six concrete defects** — a chromeless robot command, a clipped tree drawer, an invisible
   landing hero, a double-active nav state, overflowing GPS values, and an unformatted raw float
   in a data table.
2. **Systemic contrast failures** — `--color-text-faint` fails WCAG AA **everywhere it is used**
   (it carries 11px kickers, tile labels, timestamps), and `--color-warn` on white fails for
   small text.
3. **Consistency debt** — 116 hardcoded hexes, a neon chart palette that fights the muted token
   palette, three page-header patterns, status encoded as pills in some places and plain text in
   others, and a legacy unstyled `CoconutUploader`.
4. **UX gaps** — no tree search in a 32-page registry, muddy command hierarchy in the robot
   control bar, robot status rendered three times on the dashboard, and hero headline contrast
   breaking on 4 of 7 video headers.

**Design Health: 28/40 (band: Good-leaning-Acceptable — solid foundation, weak spots worth a
focused pass).**

| Surface | Score | One-line verdict |
|---|---|---|
| AppShell (nav chrome) | 31/40 | Strong pattern; double-active bug + cramped mobile labels |
| Landing `/` | 29/40 | Great story; hero invisible at rest; capability grid is flat |
| Dashboard `/dashboard` | 29/40 | Calm and legible; robot info ×3; off-token chart colors |
| Survey `/survey` | 25/40 | Complete pipeline UI; long, monotone; raw file input; chip walls |
| Digital Twin `/map` | 29/40 | Best page; drawer clips at 1024; hero contrast |
| Robot `/robot` | 25/40 | Muddy command hierarchy; broken "Return to Dock"; legacy queue |
| Mission History `/robot/history` | 29/40 | Clean table; ragged date wrapping; weak sort affordance |
| Run Detail `/robot/history/7` | 30/40 | Timeline is the best-designed screen in the app; raw floats |
| Trees `/trees` | 29/40 | Good table; no search across 32 pages |
| Tree Detail `/trees/126` | 26/40 | GPS overflow; legacy uploader outlier; sparse |

---

## 2. Global findings (design-system level)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| G1 | **P1** | `--color-text-faint` (#8b9383) fails WCAG AA on every surface (2.79–3.18:1) — and it is used for **11px** kicker labels, tile labels, feed timestamps, placeholders. Large-text exemption does not apply. | Contrast math; `.kicker`, `.tile-label`, `.feed-ts` in globals.css |
| G2 | **P1** | `var(--color-amber)` is used but never defined → "Return to Dock" button renders with **no background/border at all** (reads as plain text), and the warn badge in SimulationControls is unstyled. | `RobotStatusCard.tsx:11`, `SimulationControls.tsx:27`; visible in d-robot-hero.png |
| G3 | **P1** | Two-tone page-hero headings break on video headers: the first word is rendered in dark ink over a dark scrim — "Farm", "Robot", "Mission", "Permanent" are near-invisible on `/map`, `/robot`, `/robot/history`, `/trees`. Subcopy is also washed out on busier clips. | d-map-hero, d-robot-hero, d-history-hero, d-trees-hero |
| G4 | **P1** | Tree drawer (fixed 384px) is **wider than the viewer panel at 1024px** → header text clips ("TREE-0071" → "E-0071") and collides with the zoom toolbar. | d-map-drawer.png |
| G5 | **P1** | Nav active state uses `pathname.startsWith(href)` → on `/robot/history/*` **both** "Robot Ops" and "Mission History" highlight active. Orientation bug on every run-detail page. | `AppShell.tsx:38-39`; d-run-detail-hero.png |
| G6 | **P1** | Raw backend floats reach the UI unformatted: Tree Activity battery shows `26.3999999999963%`; run summary shows `EFFICIENCY 0.1592` (unitless, unexplained); tree detail GPS shows full float precision (15+ digits) while the registry and drawer correctly show 6dp. | d-run-tree-activity.png, d-run-detail-hero.png, d-tree-detail-hero.png |
| G7 | **P2** | Chart/semantic color split-brain: dashboard bars and history pills use a bright neon family (`#4fe39a`, `#f5c451`, `#ff6b5e`) while the token palette is muted (`--color-leaf` #5a9e3f, `--color-gold` #c98a2e, `--color-crit` #c0492f). Two competing vocabularies. | d-dashboard-full.png, d-run-detail-hero.png |
| G8 | **P2** | 116 hardcoded hexes across 15 .tsx files (worst: dashboard 23, TreeDetailsDrawer 20, RobotMarker 14). Dark-island colors exist only as literals (`#0b0f0b`, `#0d130d`, `#243024`…) — no `--twin-*` tokens. | grep evidence |
| G9 | **P2** | `--color-warn` on white = 2.93:1 (fails AA small text); white on `--color-accent-bright` = 3.48:1 (`.btn-primary:hover` uses it with 14px white text). | contrast math |
| G10 | **P2** | Status encoding is inconsistent: harvest mission card shows a COMPLETED pill, but the 6 mission list rows below it render status as plain dot-joined text; "Completed" pills are mint on history while run states elsewhere are `COMPLETED` uppercase gray. | d-survey-step4.png, d-history-hero.png |
| G11 | **P2** | Three header patterns coexist (styled-jsx page-hero w/ video; inline hand-rolled headers; plain headings). Buttons/panels/chips are otherwise consistent — headers are the outlier. | cross-page shots |
| G12 | **P3** | Detector hits: `border-left: 3px solid var(--rl-color)` (timeline rail — defensible as a severity spine, but the only side-stripe in the app), `transition: width` (survey progress bar — animating a layout property). One stray `console.log` in `CoconutUploader.tsx:85`. | detect.mjs + greps |
| G13 | **P3** | Kicker system is over-applied: every dashboard section carries a mono uppercase eyebrow; "SURVEY TILE GENERATION" uses `tracking-mega` (0.42em) which reads as styled spacing, not information. | d-dashboard-full.png, d-survey-queue.png |

---

## 3. Page-by-page

### 3.1 AppShell (nav chrome) — 31/40
**Works:** rail density, active treatment (accent-weak bg + left pill), one icon family, static
status dot (rightly no always-on motion), glassy mobile bar with safe-area, More sheet with
`--ease-drawer`.
**Issues**
- **[P1]** Double-active bug (G5) — fix with longest-prefix match (`/robot/history` before `/robot`).
- **[P2]** Mobile labels truncate/abbreviate: "Control" (Mission Control?) reads ambiguous at
  390px with 6 items; consider shorter nav vocabulary or 4 primary + More.
- **[P3]** "All systems online" is static decoration — it never reflects the actual WS state the
  app already knows.

### 3.2 Landing `/` — 29/40
**Works:** the 7-chapter story has real typographic quality (alternating alignment, confident
scale, restrained palette); count-up stats verified live (243 / 100% / 3 / ∞); manifesto and
closing CTA are strong; zero gradient text; reduced-motion path is complete.
**Issues**
- **[P1]** **Hero is invisible at rest.** `.film-cap-inner` starts at `opacity: 0, y: 26` inside a
  **scrubbed** timeline (`page.tsx:69-70`) — at scrollY=0 the headline/CTAs stay hidden until the
  user scrolls (verified: still absent after 6s). Violates "reveal must enhance an already-visible
  default." Fix: caption visible at rest; animate *out* or parallax on scroll.
- **[P2]** Capability grid = 8 identical cards (2×4), the one flat section in an otherwise
  well-rhythmed page.
- **[P2]** Mobile bottom-nav label "Control" ambiguity (see AppShell).
- **[P3]** Numbered kickers on all 7 chapters + sections — it *is* a real sequence, so defensible,
  but the rhythm is uniform; one variation would add depth.

### 3.3 Dashboard `/dashboard` — 29/40
**Works:** honest "Connecting…/Live" state, skeleton matches final shape, 5s poll, clean
label/value field rows, paginated activity feed with type dots, IST timestamps, tabular-feel
numbers.
**Issues**
- **[P2]** Robot state appears **three times** (Overview "ROBOT STATUS" tile, Robot panel, Robot
  Status card) — consolidate to one live card + one link.
- **[P2]** Neon chart palette vs tokens (G7); "MATURE 0" while premature=76 is data the UI could
  contextualize (inspection coverage is 6/249 — the ripeness story is thin but the UI presents it
  as settled).
- **[P2]** 4.3s to first data (backend aggregation + Neon) behind skeletons — consider rendering
  the hero/chrome immediately and streaming tiles, or stale-while-revalidate.
- **[P3]** Identical tile grids (6+6) with no hierarchy between Overview and Farm Summary;
  kicker-on-every-section (G13); hero kicker "LIVE OPERATIONS" is low-contrast over video.

### 3.4 Survey `/survey` — 25/40
**Works:** real numbered pipeline (01–04 is a genuine sequence), progress bar with counters,
expandable tree cards with inspection history, harvest mission card + ordered queue with
status styling, robot exec grid, pagination.
**Issues**
- **[P2]** Raw native file input ("Choose Files No file chosen") sits unstyled inside an otherwise
  finished card (step 02).
- **[P2]** Wall of repeated primary CTAs: "Start Inspection" is a full green primary on *every*
  tree card (12+ visible) — no hierarchy; consider ghost/compact per-row actions.
- **[P2]** Robot Status 6-chip grid reads as disabled inputs; heavy gray boxes compete with real
  content.
- **[P2]** Page is very long with no progress/stepper affordance — a step rail (01→04) would aid
  wayfinding.
- **[P3]** Mission list rows: plain-text status (G10); "1 tree(s)" phrasing ×6; "Match 0.955" is
  jargon to a first-timer; "SURVEY TILE GENERATION" mega-tracking kicker (G13).
- **[P3]** `transition: width` on the progress bar (G12) — animate transform/scale instead.

### 3.5 Digital Twin `/map` — 29/40
**Works:** the strongest page. Control bar (mission select, seam-gap slider, three toggles) is
clean; LOD + viewport culling + counter-scaled overlays; drawer as desktop rail / mobile bottom
sheet; deep-link `?tree=`; honest loading/empty states; pre-V2 metadata warning.
**Issues**
- **[P1]** Drawer clipping at 1024 (G4) — make drawer width `min(384px, 100%)` or anchor-viewport.
- **[P1]** Hero contrast (G3) — "Farm" is unreadable over the video.
- **[P2]** Mobile: bottom nav overlaps the drawer's last section ("HARVEST STATUS" half-hidden) —
  add safe-area/bottom padding inside the sheet.
- **[P2]** At Fit zoom the viewport is mostly empty black around a small mosaic — the initial fit
  could crop-to-content.
- **[P3]** Toolbar buttons are icon-only (+/−/Fit/expand) — have aria-labels (good) but no
  tooltips; double-click-to-fit is undiscoverable.

### 3.6 Robot `/robot` — 25/40
**Works:** live WS state badge + battery bar, twin with robot/path layers, mission picker,
backend-owned speed default.
**Issues**
- **[P1]** "Return to Dock" is chromeless (G2) — an operator cannot tell it's a button. This is
  the worst single defect in the app.
- **[P1/P2]** Command hierarchy: Start (green) → Reset (red) are the two loudest controls;
  destructive Reset sits directly beside Recharge with no separation, and neither Reset nor
  Stop asks for confirmation. Reorder: primary left, utilities middle, destructive far-right
  (visually separated), + confirm destructive.
- **[P2]** "Legacy Task Queue" panel is orphaned page-bottom noise for operators; collapse it or
  fold it into a subdued card.
- **[P3]** State badge casing inconsistency ("stopped" lowercase vs "COMPLETED" uppercase
  elsewhere); Speed "60 ×" suffix reads oddly.

### 3.7 Mission History `/robot/history` — 29/40
**Works:** sortable columns with honest empty/loading states, status pills, ID links, clean
table chrome.
**Issues**
- **[P2]** FINISHED column wraps to 3–4 lines (desktop) — widen or shorten format (e.g. "5 Aug,
  16:23").
- **[P2]** Sort affordance is weak (arrows only after interaction; not visible in captures).
- **[P3]** Hero contrast (G3); horizontal-scroll columns on mobile with no fade/hint that more
  columns exist.

### 3.8 Run Detail `/robot/history/7` — 30/40
**Works:** the **timeline tab is the best-designed screen in the app** (icon nodes, semantic
colors, dual clocks, legend). Score block + factor bars are clear; tab pills are fine; metric
grid is scannable; robot-log terminal panel is excellent.
**Issues**
- **[P1]** Raw float `26.3999999999963%` in Tree Activity (G6) — format all percentages to 1dp.
- **[P2]** `EFFICIENCY 0.1592` unitless/unexplained; `AVG SPEED 1` unitless.
- **[P3]** Timeline descriptions echo their titles ("Reached Tree #25" → "Arrived at tree #25.");
  "FASTEST/SLOWEST 24s / 24s" duplicates AVG on single-tree runs (could hide zero-information
  tiles); bright-mint bars off-token (G7).

### 3.9 Trees `/trees` — 29/40
**Works:** clean registry table, mono GPS at 6dp, task pills, pagination, good empty state.
**Issues**
- **[P1→P2]** **No search/filter** across "Page 1 of 32" — finding one tree means clicking Next
  up to 31 times. This is the biggest functional UX gap in the app (presentation-level: client-
  side filter over the already-fetched summary).
- **[P3]** Numeric columns centered (right-align numerics); "Clear" pill on every row is noise
  when all rows share the same state.

### 3.10 Tree Detail `/trees/126` — 26/40
**Issues**
- **[P2]** GPS chips overflow mid-digit (G6) — use 6dp like everywhere else; also fixes the
  "COCONUTS DETECTED" two-line label making uneven tiles.
- **[P2]** `CoconutUploader` is the app's craft outlier: raw file input, `console.log`, hardcoded
  bright green (#0a0-ish) button that matches nothing in the token system.
- **[P3]** Page is sparse below the fold; the "not found" red card is fine but rarely reachable.

---

## 4. Deterministic evidence summary

- **Contrast failures:** `--color-text-faint` (all surfaces, 11px usage), `--color-warn` on
  white (2.93), white-on-`--color-accent-bright` (3.48, hover state), zoom chip #6b7d6b on
  #0b0f0b (4.39, misses by 0.11). All other token pairs pass comfortably (text 12.6–15.6:1).
- **Undefined tokens:** `--color-amber` (2 uses, meant `--color-gold`/`--color-warn`).
- **Detector:** 2 warnings (side-tab border, width transition); no errors; no gradient text;
  no unused CSS classes in globals.css.
- **Pattern counts:** 116 hardcoded hexes / 15 files; 259 inline `style={{}}` blocks (heaviest:
  run detail 49, map 27, robot 23); 1 `window.confirm` (survey delete), 1 stray `console.log`.
- **Console errors:** 0 across all 49 captures (including mobile + interactive states).

## 5. Data-flow map & unused-data opportunities (read-only)

| Page | Fetches (via `detection.ts`) | Surfaced | Available but under-used in UI |
|---|---|---|---|
| Dashboard | `getDashboardOverview`, `getRobotStatus`, `getRobotRuns(1)` + WS | counts, farm summary, 4 panels, 3 minibars, activity | run-history **trends** (battery/duration/efficiency over runs) would give Analytics real depth; `score` of latest run shown but not trended |
| Survey | ~28 fns (missions, upload, tiles, trees, inspections, inventory, harvest, robot) | full pipeline | tile-generation progress is text-only — could be a progress bar; inspection coverage per tree |
| Map | `getMissions`, `getMissionTiles`, `getMissionTreeOverlays` + WS | mosaic, boxes, robot/path, drawer | `TreeOverlay.confidence`/`times_seen` could drive a heatmap/LOD tint; no jump-to-tree search |
| Robot | sim config/missions/tiles/overlays + WS + legacy task fetch | controls, twin, status card, legacy queue | nav plan waypoint ETA; battery trend over sim time |
| History | `getRobotRuns(200)` | sortable table | no filters (status/date/mission); no score column visibility check needed |
| Run detail | run + timeline + tree-activity + log | score, 11 metrics, timeline, table, log | score_breakdown could visualize weights; log severity filter |
| Trees | `getTreesSummary()` | table + pagination | **no search/filter** (top gap); could show inspection-status chips |
| Tree detail | `getTreesSummary()` then find | 4 chips + uploader | full inventory/inspection data the drawer already renders — this page duplicates a subset; consider deep-linking the drawer data or enriching |

## 6. Proposed design direction (evolved light system)

Keep the light "fresh agriculture" identity — it is working. Evolve it along five axes:

1. **Token integrity (foundation):** darken `--color-text-faint` to AA (~#6d7566) or restrict it
   to decorative-only; alias/replace `--color-amber` → `--color-gold`; introduce a semantic
   chart ramp (`--chart-leaf/gold/crit/info`) from the existing tokens and retire the neon
   `#4fe39a` family; tokenize the dark island (`--twin-bg/-surface/-line/-text`).
2. **One header component:** a single `PageHero` (video, scrim tuned per clip, **single-ink
   headline that passes on video**, subcopy, optional actions) replaces the three current
   patterns and fixes G3 in one place.
3. **Component vocabulary:** one `StatusPill` (capitalized, token-mapped), one `StatChip`
   (right-aligned tabular numbers, fixed label height), one `CommandBar` (primary / utility /
   destructive zones), one `EmptyState` (icon + line + next action), one skeleton set. Kill the
   6-chip "wall" in favor of a two-column label/value readout.
4. **Numbers:** `font-variant-numeric: tabular-nums` utility on every metric, GPS (6dp
   everywhere), battery, timestamp; format all percentages to 1dp; never render raw floats.
5. **Motion (product register):** 150–250ms state motion only; drawer/sheet get the existing
   `--ease-drawer`; landing keeps its GSAP story but the hero caption becomes visible at rest;
   replace `transition: width` with transform.

## 7. Recommended roadmap

**Batch A — quick wins, cross-cutting (low risk, high polish):**
G2 (`--color-amber`), G5 (nav active), G6 (float formatting + GPS 6dp), G1 (text-faint), G9
(warn/accent-bright contrast), G10 (status pills), G12 (width transition, stray console.log).

**Batch B — hero system:** one `PageHero` component applied to all 7 video headers (fixes G3
everywhere) + landing hero visible-at-rest fix.

**Then page passes in suggested order** (your call):
1. `/robot` — command bar hierarchy + destructive confirm + legacy queue fold (biggest functional
   clarity win)
2. `/map` — drawer clipping + toolbar/drawer coexistence + mobile sheet padding
3. `/dashboard` — robot-info consolidation + chart token ramp + tile rhythm
4. `/survey` — styled dropzone, step rail, per-row action hierarchy, chip readout
5. `/trees` + `/trees/[id]` — search/filter, GPS chips, `CoconutUploader` restyle
6. `/robot/history` + run detail — column widths, sort affordance, filters, score polish
7. Landing — capability-grid rhythm + final polish pass

## 8. Appendix — evidence

- 49 snapshots: `frontend/shots/audit/` (`d-*` desktop, `m-*` mobile, `-full` full-page
  reduced-motion, `-hero` resting viewport, plus `d-landing-hero-late/-stats`, drawer/sheet/tab
  states).
- Sweep script: `frontend/audit_shots.js` (rerunnable; 0 console errors bar).
- Deterministic scan: impeccable `detect.mjs`; WCAG math over `globals.css` tokens; pattern
  greps (hexes, undefined vars, greps, inline-style counts).
