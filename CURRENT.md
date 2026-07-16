# CURRENT.md

- **Project Version:** 0.2.0
- **Current Sprint:** Sprint 1 – Baseline Integration (hardening)
- **Current Feature:** End‑to‑end tree detection, ripeness analysis, task planning, and robot execution
- **Completed:**
  - Backend API routers (tree, coconut, detection, drone, robot, planner, harvest, map)
  - Next.js pages (upload, dashboard, tree detail, map, robot)
  - YOLOv8 tree + coconut‑ripeness models wired into detection endpoints
  - Task planning (per‑detection + bulk `planner/generate_tasks`) and harvest ordering
  - Robot task flow with stale‑task reclamation
  - Database schema ensured at startup via `init_db` (manual migrations)
  - **Feature 9 — Inventory Builder & Inventory Snapshot:** `InventorySnapshot`
    (`total_coconuts`/`mature_count`/`potential_count`/`premature_count`,
    `inspection_id` nullable for harvest‑origin snapshots); `Tree.current_inventory_id`
    pointer; ripeness → snapshot counts.
  - **Feature 10 — Harvest Planner & Mission Builder:** `HarvestMission` /
    `HarvestMissionItem` (immutable `visit_order` route, nearest‑neighbour ordering);
    `POST /harvest/missions` plans from latest inventory; `GET` endpoints for missions,
    a mission, and its ordered items.
  - **Feature 11 — Robot Mission Execution:** start/pause/resume/cancel/advance
    endpoints + `GET …/status` (coarse `robot_state`); advances the mission/queue
    state machine, writes a new post‑harvest `InventorySnapshot` per completed tree
    (decrementing only the harvested category), repoints `Tree.current_inventory_id`,
    and auto‑completes the mission when the queue is exhausted. Frontend survey page
    drives the flow with live queue progress and zero console errors (verified E2E).
  - **Feature 12 — Final Dashboard & System Overview:** read‑only V1 dashboard at
    `/dashboard`. New `GET /dashboard/overview` aggregation endpoint (overview counts,
    farm summary from each tree's current inventory, survey latest/active/last‑scan,
    current harvest mission, harvested count, newest‑first recent‑activity timeline,
    and chart data) — no business logic, no mutations. Frontend page reuses
    `/dashboard/overview`, `/harvest/missions/{id}/status` (robot state) and
    `/plantation/map`; polls every 5 s. `/plantation/map` now also returns `tree_code`
    (additive) and its per‑tree N+1 count queries were collapsed into two grouped
    aggregates (302 trees: ~170 s → ~3 s). Map popups and dashboard show `tree_code`.
    *(Features 9–12 are implemented and verified; awaiting commit approval — do NOT
    commit per‑feature yet.)*
  - **Version 2 (FROZEN v2.0 — architecture locked; data foundation implemented):**
  - **Digital Twin Farm Viewer** amendment frozen in `PROJECT_SPECIFICATION.md §V2`.
    A seam-de-emphasised tile mosaic (tiles by grid row/col; YOLO bounding boxes as the
    interactive layer) **replaces** the V1 Leaflet/OSM `/map` — single viewer, no parallel
    maps. GPS demoted to backend metadata; new "farm-pixel" coordinate system.
  - **Central finding it addresses:** the pipeline previously *discarded* the data V2 needs —
    `SurveyTile.grid_row/col` existed but were never written (a throwaway `ceil(sqrt(n))` grid
    was used for GPS only), and `Tree` had no tile/pixel/bbox link.
  - **Locked decisions (§V2.12):** (1) seam-de-emphasised mosaic, no orthomosaic/stitching;
    (2) mission-scoped `TreeObservation` model + `Tree.current_observation_id` (not flat on
    `Tree`); (3) representative = highest confidence → closest to tile centre → newest
    mission; (4) persist `SurveyTile.grid_row/col/image_width/image_height` during survey
    processing; (5) twin replaces `/map`.
  - **VERSION 2.1 — Data Foundation (completed; awaiting commit approval):**
    Scope = the V2 data model + persisted `SurveyTile` metadata. No viewer/UI yet.
    - New `tree_observations` table (`TreeObservation`): mission-scoped historical rows
      (`tree_id` RESTRICT FK, `survey_tile_id`, `local_pixel_{x,y}`, `bbox_*`, `confidence`,
      `gps_lat/lon`, `created_at`). `Tree` gained only `current_observation_id` (pointer to
      the §V2.7 representative observation); `Tree` itself stays immutable.
    - `SurveyTile` gained `capture_order`, `grid_row/col`, `center_gps_lat/lon`,
      `image_width/height`, all persisted during survey processing
      (`generate_tiles_for_mission` / `process_tile` / new `project_tile_center_gps`).
    - `match_trees_for_mission` rewritten: deletes only this mission's observations
      (preserves history), writes `TreeObservation`s, and repoints `current_observation_id`
      via `_recompute_representative_observations` using the frozen §V2.7 ordering.
    - **Bulk-write optimization (applied):** the write path is now a handful of batched
      statements instead of per-row ORM round-trips — one `flush` for new Trees (executemany),
      one raw `executemany` UPDATE for existing-Tree metadata refreshes, one
      `bulk_insert_mappings` for observations. The match set uses plain dicts (not live ORM
      objects) and `no_autoflush` guards the writes, eliminating per-tree UPDATE round-trips.
      *Note:* absolute runtime on the remote Neon DB is dominated by round-trip latency
      (a 302-row batched UPDATE is ~80 s on this serverless Postgres), not algorithmic cost;
      the structural win is removing O(rows) ORM round-trips. Verified correct: 302
      observations, 0 representative mismatches vs §V2.7, all tree codes valid.
    - *(VERSION 2.1 code is implemented and verified; awaiting commit approval — do NOT
       commit yet.)*
  - **VERSION 2.2 — Continuous Farm Mosaic Engine (completed; awaiting commit approval):**
    Scope = the *rendering foundation* of the Digital Twin Farm Viewer. Reconstructs the
    surveyed plantation from persisted `SurveyTile` metadata — **no** overlays, bounding
    boxes, tree interaction, inventory, inspection, zoom, pan, fullscreen, or twin controls.
    - **Decision 5 (§V2.11) applied:** the V1 Leaflet/OSM `/map` is reworked into the twin.
      `app/map/page.tsx` now loads the latest mission via `GET /missions` and its tiles via
      `GET /mission/{id}/tiles`, then renders the mosaic. The V1 `MapWrapper`/`MapView`/
      `leafletFix` are **retained only because `/dashboard` still uses the Leaflet GPS map**;
      they are not part of the twin and remain out of V2.2 scope.
    - **Backend (`api/survey_api.py`):** `_serialize_tile` now emits `image_url`
      (`/survey/uploads/{mission_id}/{filename}`, built from the tile's `SurveyImage`),
      eager-loaded in `list_survey_tiles` and `get_survey_tile` (two grouped queries, no
      N+1). This is the single bulk per-mission endpoint the mosaic consumes (§V2.10).
    - **Frontend (`components/FarmMosaic.tsx`):** new client component. Lays tiles out by
      persisted `(grid_row, grid_col)` in a grid-aligned, absolutely-positioned canvas —
      each column takes the widest tile and each row the tallest, so **mixed image sizes**
      sit adjacent with **no overlap**. A **small configurable seam gap** (default 2px,
      slider 0–24) de-emphasises boundaries (Decision 1, §V2.6). No stitching/orthomosaic/
      GIS. The renderer **never recomputes or synthesizes a layout**: the `/map` page gates
      on Version 2 metadata and, when a mission lacks `grid_row`/`grid_col`, shows a clear
      "Digital Twin not available (pre-Version 2)" message instead of a synthetic grid.
      (The legacy sqrt-grid fallback was removed per review — Version 2 supersedes old
      layout logic.)
    - **Verification:** backend import + `tsc --noEmit` + `next build` pass; live endpoint
      returns `image_url`; Playwright E2E confirms `/map` renders the mosaic with tile images
      loading (mission 78: 10 gridded tiles) and zero console errors.
    - *(VERSION 2.2 code is implemented and verified; awaiting commit approval — do NOT
       commit yet.)*
  - **VERSION 2.3 — Digital Twin Viewer (navigation only; completed; awaiting commit
    approval):** transforms the V2.2 mosaic into a proper viewer. Scope is navigation
    and viewing **only** — no tree overlays, bounding boxes, clicks, selection,
    inspection, inventory, harvest, or context menus (interaction rules enforced).
    - **New `components/FarmViewer.tsx`** wraps `FarmMosaic` (V2.2) in a
      transform-based viewport: a stage `<div>` gets `transform:
      translate(tx,ty) scale(s)`; the mosaic is never re-rendered during navigation.
      Browser APIs only — **no map libraries** added.
    - **Controls:** `+` / `–` / `Fit` buttons plus a zoom-% readout (and an
      expand control on the dashboard card only). `Fit` always restores the
      default "entire farm visible" view (never upscaled past 100%, centred);
      there is no separate "100% / origin" Reset action.
      **Input uses Pointer Events** (one code path for mouse, touch, and stylus):
      wheel zoom (cursor-centred, native non-passive `wheel` listener that
      `preventDefault`s page scroll), single-pointer drag to pan, **two-pointer
      pinch to zoom**, double-click → Fit. Zoom keeps the point under the cursor /
      pinch midpoint fixed. *(Amended per clarification: browser Fullscreen API
      removed — the viewer is interactive everywhere and navigation to the full
      view is done via the expand control below, Google-Maps-like.)*
    - **Fit** never upscales past 100% and centres the whole farm; the initial view
      auto-fits so the complete farm is always visible first. Resize / navigation
      deliberately do **not** refit (current zoom is preserved).
    - **Performance:** `FarmMosaic` is memoised; during pan/pinch the transform is
      written straight to the DOM via a ref (no React re-render per frame) and committed
      to state only at gesture end. The stage's transform space is shared, so the future
      overlay layer can render in the same farm-pixel coordinates (§V2.4).
    - **Dashboard embedding (`components/DashboardFarmCard.tsx`):** a small interactive
      Farm Viewer lives on `/dashboard` showing the most recent Version-2 mission's
      persisted tile-grid. It is passed `expandHref="/map"` so an **expand control**
      (`⤢`, title "Open full Digital Twin") appears and **navigates to `/map`** — the
      dedicated full Digital Twin page. On `/map` itself the viewer is rendered without
      `expandHref`, so no expand control is shown there. The viewer stays interactive in
      both places; `touch-action: none` + Pointer Events make it work on desktop and
      mobile. No other parts of the dashboard were redesigned.
    - **Verification:** `tsc --noEmit` + `next build` pass; Playwright (desktop + a
      `hasTouch/isMobile` context) covers: `/map` has no expand button; `+` zoom changes
      scale %; single-pointer pan changes the stage transform; the dashboard card shows
      the expand button and `+` zoom works; clicking expand navigates to `/map`; and a
      two-finger pinch (dispatched Pointer Events) changes the scale % on mobile — zero
      console errors.
    - *(VERSION 2.3 code is implemented and verified; awaiting commit approval — do NOT
       commit yet.)*
  - **VERSION 2.4 — Interactive Tree Overlay (completed; awaiting commit approval):**
    Renders the detected Permanent Trees on top of the existing Farm Mosaic using the
    persisted representative `TreeObservation` (§V2.5/§V2.7). Scope is overlay rendering +
    tree **selection only** — no Tree Details, inventory, inspection, harvest, or side
    panels (interaction rules enforced; those are V2.5).
    - **Architecture (separated responsibilities, §V2.4):** `FarmMosaic` ↓ `OverlayLayer`
      ↓ `InteractionLayer` (future V2.5). `OverlayLayer` is presentational only — it renders
      given data and emits `onSelectTree`; it never recomputes observations or derives boxes
      from YOLO, and carries no business logic. `FarmViewer` owns the selection state and
      renders `OverlayLayer` inside the **same transformed stage** as `FarmMosaic`, so the
      overlay inherits zoom/pan/fit for free (no duplicated transform).
    - **Shared coordinate system:** extracted `computeMosaicLayout(tiles, gap)` into
      `lib/mosaicLayout.ts` (single source of the farm-pixel transform, §V2.4). `FarmMosaic`
      and `OverlayLayer` both use it, so boxes align exactly with their tiles. `FarmMosaic`
      behaviour is byte-identical (only the layout math was relocated). Tiles draw 1:1 at
      persisted `image_width/height`, so `farm = tile.(x,y) + local_pixel/bbox` aligns.
    - **Backend (`api/survey_api.py`):** new bulk `GET /mission/{id}/trees` returns, for the
      mission, the persisted representative observation of every tree whose representative
      tile is in the mission's mosaic (`Tree.current_observation_id` already points at the
      §V2.7 representative — no recompute, no YOLO). **One bulk join selects `tree_code`
      alongside** the observation (a lazy `o.tree.tree_code` N+1 was replaced — it exhausted
      the SQLAlchemy pool and hung; the bulk join is the §V2.10 "no per-tree round-trips"
      requirement).
    - **Rendering / visual design (§V2.8):** each tree is a YOLO bounding box (from persisted
      `bbox_*`) with a centroid marker (persisted `local_pixel_*`) and a `TREE-xxxx` label.
      States: Normal / Hover / Selected (amber, persistent until another tree is picked).
      Border thickness + label font are **counter-scaled by `1/scale`** so they stay a
      constant screen size while the box geometry tracks the canvas (Google-Maps-like,
      readable while zooming). Labels hide below a screen-size threshold (LOD is future).
    - **Rendering approach — RECORDED for the V2.6 optimization strategy (no code change):**
      the overlay is **plain absolutely-positioned HTML `<div>` elements, NOT SVG and NOT
      Canvas** (see `OverlayLayer.tsx`). One outer container `<div>` (`pointerEvents:none`)
      holds **one `<div>` per tree** (`data-tree-id`, `pointerEvents:auto`), each containing
      a centroid marker `<div>` and an optional `<span>` label. So N trees ≈ up to 3·N DOM
      nodes (~900 at 302 trees). Zoom/pan is a free CSS `transform: scale/translate` on the
      stage; the counter-scaling (`borderW = 1/scale`, `fontPx = 12/scale`, `radius = 2/scale`)
      is applied as **inline styles that are recomputed on every `scale` change**, so all
      boxes re-render on each zoom/pan frame (= DOM style/layout/paint cost per frame).
      Selection/hover use native per-box DOM events (the boxes already carry `data-tree-id`,
      so a future single delegated listener on the container is a trivial swap).
      **V2.6 implications (per §V2.8):** this DOM approach is fine at ~300 trees and keeps
      native hit-testing/events, but does not scale to thousands — the two levers are
      (1) **viewport culling** in *farm-pixel* space (compute which boxes intersect the
      inverse-transformed viewport rect, since boxes live inside the scaled stage; an
      overflow-clipped wrapper or an offscreen check avoids rendering off-screen nodes), and
      (2) **LOD** (already partially present: labels hidden below a screen-size threshold;
      extend to drop centroids / simplify boxes / render tree *dots* when far out). If counts
      still exceed a threshold, the spec (§V2.8 line 3642) sanctions replacing the DOM layer
      with **Canvas/WebGL** — which would relocate hit-testing to manual picking (the
      persisted `bbox_*` + `computeMosaicLayout` give exact farm-pixel rects for that). Current
      approach deliberately keeps selection trivial; the V2.6 renderer swap must preserve the
      `onSelectTree` / `selectedTreeId` contract.
    - **Reused everywhere:** `FarmViewer` is unchanged for callers; `/map` and the
      `DashboardFarmCard` both pass `trees` from the new endpoint, so the viewer is
      interactive (overlay + selection) on both pages. `FarmMosaic` rendering engine was not
      modified (only its layout helper was relocated to the shared module).
    - **Verification:** backend import + `tsc --noEmit` + `next build` pass; Playwright
      (desktop) confirms 302 overlay boxes render on `/map` and the dashboard card, **302/302
      boxes align within their tile images**, click selects exactly one (amber), selecting
      another keeps exactly one selected, `Fit` restores the entire-farm view (≤100%) and the
      overlay persists — zero console errors.
    - *(VERSION 2.4 code is implemented and verified; awaiting commit approval — do NOT
       commit yet.)*
  - **VERSION 2.5 — Tree Details Integration (completed; awaiting commit approval):**
    Transforms the Digital Twin into the primary interaction interface: a tree selected
    in V2.4 now opens a **read-only Tree Details panel** (§32 / §33) reusing the existing
    Feature 6–11 data. No new backend business logic; no mutations; architecture unchanged.
    - **Architecture (§V2.8, reused — not redesigned):** `FarmViewer` still owns
      `selectedTreeId`; `OverlayLayer` stays presentation-only and now emits only
      `onTreeSelect(treeId)` (renamed from `onSelectTree` to match the spec contract).
      New **`TreeDetailsPanel`** (presentational, read-only) is rendered by `FarmViewer`
      as a **sibling of the stage**, so the viewer / mosaic / overlay are **never
      recreated** — selecting another tree only swaps the panel's content (the panel stays
      mounted and its data is cached). The selected tree stays highlighted (amber) and the
      panel + overlay stay synchronized through the single `selectedTreeId` source.
    - **Panel behaviour:** desktop = right-side **collapsible** panel; mobile = **bottom
      sheet** (CSS via `matchMedia("(max-width: 768px)")`). A **Close** button clears the
      selection (panel removed, highlight cleared); the viewer remains fully interactive
      while the panel is open (pan / zoom / Fit all work — verified).
    - **Data flow / reuse (no duplicate API requests):** `tree_code`, `gps_lat/gps_lon`,
      and `times_seen` are read straight from the already-loaded `TreeOverlay` — the
      backend `GET /mission/{id}/trees` was extended (additive) to also return
      `gps_lat/gps_lon/times_seen` (single bulk query, §V2.10; **no new endpoint**).
      Current Inventory (`getTreeInventory`), Inventory History
      (`getTreeInventoryHistory`), and Inspection History (`getTreeInspections`) are
      fetched per tree and **cached in a Map**, so re-selecting a tree is instant. The
      latest **completed** inspection's images come from `getInspectionImages`. Harvest
      status is read from the most recent Harvest Mission's items
      (`getHarvestMissions(1)` + `getHarvestMissionItems`), loaded **once** and reused
      across selections. **Harvest eligibility is shown read-only from the current
      inventory counts** (presentation only — the planner's eligibility rule is never
      duplicated).
    - **Scope honoured (read-only):** no editing, no inspection start, no harvest-mission
      generation, no inventory mutation. The existing sparse `/trees/[treeId]` page is
      untouched (could be superseded by the panel later, out of scope).
    - **Files changed:** new `frontend/components/TreeDetailsPanel.tsx`; `FarmViewer.tsx`
      (`enableDetailsPanel` prop + renders panel on selection, Close clears selection);
      `app/map/page.tsx` (passes `enableDetailsPanel`); `OverlayLayer.tsx`
      (`onTreeSelect`); `lib/api/detection.ts` (`TreeOverlay` gains `gps_lat/gps_lon/
      times_seen`); `backend/api/survey_api.py` (additive overlay fields). The dashboard
      card keeps `enableDetailsPanel` off (selection highlights only, no panel).
    - **Verification:** backend import + `tsc --noEmit` + `next build` pass; all dependent
      APIs smoke-tested (inventory/history/inspections/images/harvest — tree 698 returns
      inventory 47/0/10/37, 3 inspections, 4 images, and is in harvest mission 20);
      Playwright (desktop + mobile + dashboard) **15/15, 0 console errors** — overlay
      renders (302), panel shows all sections, selected box amber, populated inventory
      (47) for TREE-0698, reselect updates panel without rebuild, close clears selection,
      viewer interactive after close, mobile bottom sheet, dashboard shows boxes with no
      panel (highlight-only).
    - *(VERSION 2.5 code is implemented and verified; awaiting commit approval — do NOT
       commit yet.)*
   - **VERSION 2.5.1 — Tree Details UX / interaction refinement (completed; awaiting
     commit approval):** a refinement of V2.5 — **no new features, no new data, no backend
     change**. Fixes five issues found after V2.5.
     - **ISSUE 1 (panel scaled with zoom — root cause found):** in V2.5 the
       `TreeDetailsPanel` was rendered **inside the transformed stage `<div ref={stageRef}>`**,
       so it inherited `transform: translate(…) scale(…)` and shrank/grew with zoom. Fix:
       the component is renamed **`TreeDetailsDrawer`** and is now a **sibling of the
       Viewport**, outside the transformed stage — it stays fixed on screen at any zoom
       (verified: drawer width 384px unchanged after zoom-in). New `FarmViewer` layout =
       `Toolbar` (sibling) + `Viewport` (owns pan/zoom; contains **only** the Stage:
       `FarmMosaic` + `OverlayLayer`) + `TreeDetailsDrawer` (sibling of Viewport).
     - **ISSUE 3 (drag-to-pan unreliable — root cause found):** `OverlayLayer` boxes had
       `onPointerDown={(e)=>e.stopPropagation()}` which blocked the Viewport's `onPointerDown`
       (pan) whenever the press started on a box. With ~302 densely-packed boxes covering
       the canvas, pan only worked in the rare gaps. Fix: `OverlayLayer` no longer
       intercepts pointer events and no longer emits selection — it is purely presentational
       (renders `data-tree-id` boxes + hover). Tap-vs-drag detection moved into `FarmViewer`:
       `pointerDownInfo` records the tree under the press + a small movement threshold; on
       pointer-up, a **stationary** press on a box selects it (via `setSelectedTreeId`), a
       drag pans and does **not** select. Pan now works everywhere; 302 boxes no longer block it.
     - **ISSUE 2 (UX redesign):** the debug-panel look is replaced with clean dashboard
       **cards** — Tree Information (code / GPS / times-seen / confidence), Current Inventory
       (Total / Mature / Potential / Premature stats), Inspection History (list), Latest
       Inspection Images (3-col thumbnail grid), Harvest Status. No new data fields.
     - **ISSUE 4 (drawer must not reset the viewer):** the drawer is **always mounted** and
       slides in/out via an `open` prop (transform transition), so opening/closing never
       recreates the viewer / mosaic / overlay. Last-selected tree is retained in a ref so
       content stays visible during slide-out (no flicker). Verified: stage transform
       (zoom+pan) is byte-identical before vs after an open→close cycle.
     - **ISSUE 5 (responsive):** desktop = right-side drawer `min(384px, 92vw)` at `top:52`
       (clears the toolbar), `pointerEvents` disabled when closed; mobile (`matchMedia
       max-width:768px`) = **`position: fixed` bottom sheet**, full width, `height: 70vh`
       (anchored to the viewport bottom, not the FarmViewer container — verified: bottom at
       viewport bottom). Body scrolls; no new data.
     - **Files changed:** `frontend/components/TreeDetailsDrawer.tsx` (new; replaced
       `TreeDetailsPanel.tsx`), `FarmViewer.tsx` (layout split + tap selection),
       `OverlayLayer.tsx` (removed `onTreeSelect` + `stopPropagation`), `app/map/page.tsx`
       (unchanged — still passes `enableDetailsPanel`). Dashboard card unaffected
       (`enableDetailsPanel` default false → drawer never rendered).
     - **Verification:** `tsc --noEmit` + `next build` pass; Playwright harness **11/11, 0
       console errors** — 302 boxes, drawer starts closed, tap opens drawer, drawer width
       unaffected by zoom, drag pans the stage, drag does NOT select, open/close preserves
       zoom+pan, close clears selection, reselect works, mobile bottom sheet anchored to
       viewport bottom; dashboard renders 302 boxes with no drawer, 0 errors.
     - *(VERSION 2.5.1 code is implemented and verified; awaiting commit approval — do NOT
        commit yet.)*
   - **VERSION 2.6 — Renderer Performance (viewport culling + label LOD) (completed;
     awaiting commit approval):** PERFORMANCE ONLY — no new UI features, no component
     redesign, no business-logic changes, no API changes, no backend change. Honours the
     Architecture Freeze (RULE 1): `FarmViewer` still owns all interaction state;
     `FarmMosaic`, `OverlayLayer`, and `TreeDetailsDrawer` stay presentation-only.
     - **Files changed (frontend only):**
       - `frontend/components/OverlayLayer.tsx` — adds viewport culling + zoom LOD;
         centroid marker is now LOD-gated (was always rendered).
       - `frontend/components/FarmViewer.tsx` — tracks `viewportSize` via a
         `ResizeObserver` and passes the current `tx` / `ty` / `viewportWidth` /
         `viewportHeight` to `OverlayLayer`. No other logic changed.
       - `FarmMosaic`, `TreeDetailsDrawer`, `Toolbar`, and the API layer are **untouched**.
       - **No backend change** (culling/LOD are pure frontend transforms).
     - **Rendering architecture (unchanged):** `FarmMosaic` (presentation) is wrapped by
       `FarmViewer`'s transformed **stage**; `OverlayLayer` mounts **inside the stage** and
       inherits the single CSS transform (zoom/pan/fit for free, no duplicated transform).
       `FarmViewer` commits `view` (scale/tx/ty) to React state **only at gesture end**;
       during a gesture it writes the transform straight to the DOM, so navigation never
       re-renders the overlay per frame.
     - **Viewport culling (RULE 2):** the visible rectangle is computed in **farm-pixel
       space** from the current `scale`, `translation (tx,ty)`, and `viewport size` — no GPS
       approximation. `farm = (screen − t) / scale`, so the rect is
       `left = −tx/s`, `top = −ty/s`, `right = (vw − tx)/s`, `bottom = (vh − ty)/s`, padded
       by a ~64-screen-px margin. Boxes outside the rect are **not rendered**. `selected`
       and `hovered` trees are **never culled** (highlight + drawer stay live even when
       panned off-screen). The visible list is `useMemo`'d, so it recomputes only when the
       committed view / data / selection changes — never per animation frame.
     - **Label LOD (RULE 3):** by zoom **percentage** (`scale × 100`):
       - **< 20%** — boxes only; labels **and** centroid markers hidden (selected/hovered
         excepted).
       - **20–40%** — boxes + centroid; **selected / hovered** label shown.
       - **> 40%** — boxes + centroid + **all** labels.
       The **selected tree's label is ALWAYS visible** (overrides the LOD hide). A minimum
       on-screen box size (`w·s > 8 && h·s > 6`) prevents a label on a sub-pixel box.
     - **Avoiding re-renders (RULE 4):** culling/LOD recompute only on committed `view`
       change (gesture end) or resize — pan/zoom gestures do **not** recreate overlay data
       or re-render the layer mid-flight. `FarmMosaic`, `Toolbar`, and `Drawer` are never
       recreated by selection/culling.
     - **DOM rendering preserved (RULE 5):** still plain absolutely-positioned `<div>`s;
       no Canvas / SVG / WebGL migration. Those remain a future fallback only if box counts
       exceed a DOM threshold.
     - **Performance measurements (RULE 6) — before vs after** (dataset: 302 trees;
       "before" derived from the pre-change V2.5.1 source: centroid always rendered, no
       culling, so all 302 boxes were always in the DOM):
       | View | Before DOM nodes | After DOM nodes |
       |---|---|---|
       | Fit (~12%) | 604 (302 box + 302 centroid; labels hidden) | **302** (boxes only — LOD hides centroids) |
       | Zoomed ~72% | 906 (all 302 × box+centroid+label, off-screen ones still in DOM) | **69** (23 visible × 3, culled) |
       - **Rendered boxes:** fit = 302 (all visible, no cull); zoomed ~72% = **23 / 302**
         (off-screen trees removed from the DOM).
       - **Initial render:** unchanged (single `computeMosaicLayout` + memoised cull).
       - **Pan FPS:** ≈ **60** (no React re-render during pan — same as before; the
         transform is written directly to the DOM).
       - **Zoom responsiveness:** wheel commits `view` per tick → cull/LOD recompute; smooth
         at 302 trees.
     - **Verification (RULE 7):** `tsc --noEmit` + `next build` pass; backend unaffected.
       Playwright harness **15/15, 0 console errors** — fit renders all 302 (labels hidden
       at <20%); selected label always visible when zoomed out; zoom-in culls to 23 boxes
       with all labels + centroids (LOD >40%); pan ≈ 60 FPS; drag pans and does not select;
       Fit restores whole-farm view; tap opens drawer; close clears selection; dashboard
       renders 302 boxes with no drawer. Mobile (390×780): 302 boxes at fit, drawer opens as
       bottom sheet anchored to viewport bottom, 0 errors.
     - **Remaining limitations:**
       - Culling recomputes at **gesture end**, not per animation frame: during a long pan,
         trees that scroll off the prior view stay in the DOM until release (they pan
         correctly with the stage, so there is no visual glitch — just extra nodes until
         release). A future enhancement could throttle cull updates via `requestAnimationFrame`
         for progressive reveal during very long pans.
       - The test dataset is only 302 trees and they all fit on screen, so culling's benefit
         is only visible when zoomed in. The implementation targets large plantations
         (thousands of trees) where, at fit, only the visible subset is ever in the DOM.
       - LOD centroid/label thresholds (20% / 40%) are the spec-suggested values; tunable.
    - *(VERSION 2.6 code is implemented and verified; awaiting commit approval — do NOT
        commit yet.)*
    - **VERSION 2.7 — Release Hardening (completed; awaiting commit approval):** the
      final hardening milestone for the frozen Version 2. Architecture locked; scope was
      critical review, dead-code/legacy cleanup, correctness + performance fixes, and
      regression — **no new features, no new APIs, no architecture change**. Two read-only
      review agents (backend + frontend) were run; every reported issue was verified against
      the code before action.
      - **CRITICAL backend fix — new trees never appeared in the twin (root cause found +
        proven):**
        `match_trees_for_mission` added only `None` to `touched_tree_ids` for newly created
        trees (the pre-flush stub dict had `id=None`); the post-flush loop repointed the
        observation dicts and `tree_updates` but **never added the real new-tree ids to
        `touched_tree_ids`**. So `_recompute_representative_observations` (which filters out
        `None`) silently skipped every brand-new tree, leaving `Tree.current_observation_id`
        NULL. The twin endpoint (`GET /mission/{id}/trees`, which joins
        `TreeObservation.id == Tree.current_observation_id`) then returned **zero rows** for a
        first survey — the Digital Twin was empty on a clean database. **Fix:** track new
        trees as `(dict, ORM_Tree)` pairs (`new_tree_pairs`) and, after the batched flush,
        repoint each dict to its real id, add it to `touched_tree_ids`, and write
        `tree_updates`. This also fixes a **related crash**: the old code `zip`ped
        `new_trees` 1:1 with `new_tree_dicts` (observation dicts), so when **two detections
        converged on the same new stub tree** (shared dict) the second observation kept
        `tree_id=None` and the bulk `INSERT` failed. Resolution is now by pair/identity, so
        converging detections correctly become multiple observations of one new tree.
        **Validated** with an isolated DB script: 2 new trees created, both got
        `current_observation_id` set, 3 observations (two converging), twin query returns
        both. *(survey_api.py:566, 684, 726–743, 807.)*
      - **Backend N+1 fix (harvest planner):** `_eligible_trees` did a per-tree
        `db.get(InventorySnapshot, …)` inside the tree loop — an N+1 that becomes hundreds of
        round-trips on Neon. Collapsed into one grouped `IN` query. *(harvest_mission_api.py:
        135–152.)*
      - **Backend N+1 fix (`GET /trees/summary` — this endpoint was HANGING):**
        tree_api.py looped per-tree `Detection.count()` + `Task.count()` (2 queries/tree →
        ~604 round-trips over 302 trees → request hung >20 s). Collapsed into two grouped
        aggregates. **Validated:** endpoint now returns 302 rows in ~3.2 s (was timeout). This
        also unblocks the `/trees` server page and the `/trees/[treeId]` detail lookup, which
        both call `getTreesSummary` and were previously stuck on "Loading…".
        *(tree_api.py:81–110.)*
      - **Legacy V1 Leaflet map removed (Decision 5 violation fixed):** the dashboard rendered
        a **second**, parallel V1 Leaflet/OSM "Farm Map" card alongside the V2 Digital Twin
        (`DashboardFarmCard`) — a direct violation of the frozen "single viewer, no parallel
        maps" rule. Removed `components/MapView.tsx`, `MapWrapper.tsx`, `leafletFix.ts`,
        their only consumer on `/dashboard`, and the now-unused `getMapData` + `MapTree` from
        `lib/api/detection.ts`. Removed `react-leaflet` / `leaflet` / `@types/leaflet` from
        `package.json` and `node_modules`. The V2 twin (`/map` + `DashboardFarmCard`) is now the
        only farm viewer (Decision 5 satisfied).
      - **Frontend correctness fixes:**
        - `/trees/[treeId]`: an unknown `treeId` previously rendered "Loading…" **forever**
          (no not-found state). Now shows "Tree #… not found." *(trees/[treeId]/page.tsx.)*
        - `/robot`: `res.ok` was never checked, so a non-200 from `/robot/next_task` threw on
          `res.json()` and crashed the page. Now shows a graceful message.
        - `/trees/[treeId]` harvest select offered V1 terms `tender`/`both`; the backend
          `HarvestType` is `mature|potential|premature|all`. Options corrected.
        - `TreeDetailsDrawer`: the harvest lookup (`harvestReady` flip) re-triggered the detail
          effect, firing a **duplicate** `getTreeInventory`/`getTreeInventoryHistory`/
          `getTreeInspections` fetch on first selection. Gated the detail fetch on
          `harvestReady` so it runs once. *(TreeDetailsDrawer.tsx:145–203.)*
      - **Minor cleanup:** removed a dangling `//strech` debug comment; de-duplicated the
        `API_BASE_URL` constant in `DroneUploader.tsx` (now imports the canonical export);
        fixed the `/trees` page title ("Farm Dashboard" → "Trees").
      - **V1 endpoints intentionally kept:** `/detect/trees`, `/plantation/map`, `/drone/*`
        etc. are the preserved V1 data/business logic per the freeze and remain mounted
        (not dead code). `DroneUploader` / `CoconutUploader` are the real V2 survey/inspection
        upload entry points and were kept.
      - **Verification:** `tsc --noEmit` + `next build` pass (no Leaflet imports remain);
        backend imports clean; isolated DB script proves the twin fix; live twin endpoint
        returns 302 trees; `/trees/summary` ~3.2 s; Playwright **dashboard** (no Farm Map /
        Leaflet, Overview + Recent Activity present), **tree detail** (valid id → detail,
        bogus id → not found, no infinite Loading), **robot** (no crash) — **0 console errors**;
         V2.6 regression suite **15/15, 0 console errors** (twin viewer intact after Leaflet
        removal + backend fixes).
      - *(VERSION 2.7 code is implemented and verified; awaiting commit approval — do NOT
         commit yet.)*
    - **VERSION 2.8 — Digital Twin Polish & UX Refinement (completed; awaiting commit
      approval):** the final polish milestone before Version 2 is frozen. Polish only — no
      new features, no new APIs, no architecture change, no new business logic. Scope was a
      complete visual + interaction audit of the Digital Twin viewer on both `/map` and the
      `/dashboard` card, plus root-cause fixes for the glitches found. The audit confirmed
      the core is already solid: 302/302 box centres align inside their tile images
      (no drift), 0 broken tile images, 0 console errors, mobile bottom-sheet drawer
      anchored to the viewport bottom, dashboard renders 302 boxes with no drawer, culling
      + LOD working (fit = 302 boxes / labels hidden <20% / selected label always visible;
      zoom-in ~72% = 23 culled boxes with all labels + centroids; pan ≈ 60 FPS).
      - **Fix 1 (root cause found) — mosaic `overflow: auto` (legacy V2.2):** `FarmMosaic`
        was the only scroll container inside the transformed stage, while `FarmViewer`'s
        viewport already clips with `overflow: hidden`. The mosaic should never scroll.
        Changed to `overflow: hidden` (single source — fixes both `/map` and the dashboard
        card, which share `FarmMosaic`).
      - **Fix 2 (root cause found) — scaling frame artifact:** `FarmMosaic`'s root carried a
        `1px solid` border + `8px` border-radius that lived *inside the CSS-transformed
        stage*, so they grew with zoom — a frame around the entire plantation that thickened
        as you zoomed in. The `FarmViewer` viewport already supplies the dark container, so
        the border/radius were removed from the mosaic root. The visible result is a
        seamless farm edge meeting the dark viewport (no scaling frame).
      - **Files changed:** `frontend/components/FarmMosaic.tsx` only (the mosaic rendering
        engine; `FarmViewer`, `OverlayLayer`, `TreeDetailsDrawer`, `DashboardFarmCard`, the
        API layer, and all backend are untouched). No new endpoints, no layout-math change
        (`computeMosaicLayout` unchanged), no extra renders / duplicate requests / N+1 /
        layout thrash introduced — the V2.6 optimizations are preserved.
      - **Out of scope (confirmed not glitches, left as-is):** no page-level scroll; selected
        top-row label not clipped by the viewport; toolbar z-index (7) correctly sits above
        the drawer (6) without overlapping the close button; the gap renders as the intended
        black seam (seam-de-emphasised, §V2.6); hover highlights + shows the label (the
        spec's "lightweight hover popup" was not added — it would be a new feature, outside
        this polish milestone's scope; interaction rules from V2.4–V2.7 stand).
      - **Verification:** `tsc --noEmit` passes (0 errors); `next build` succeeds (all routes
        compile, no unresolved imports); backend unaffected (frontend-only change). Playwright
        regression suite `verify_v26.js` **15/15, 0 console errors**; a V2.8 re-audit
        confirms `overflow: hidden`, border/radius `0px`, 302/302 boxes aligned inside tiles,
        0 broken images, 0 console errors.
      - *(VERSION 2.8 code is implemented and verified; awaiting commit approval — do NOT
         commit yet.)*
    - **Performance TODO (V2.1 write path, not a blocker):** the bulk-write path is now
    structurally correct (O(1) batched statements, no per-row ORM round-trips), but we
    have **not yet proven** the remaining ~80 s / 302-row runtime on the remote Neon DB is
    purely round-trip latency. A hidden per-row cost may still exist (e.g. driver-level
    executemany behaviour, FK/index maintenance, or an overlooked autoflush). **Action:**
     profile a clean run later with SQLAlchemy `echo=True` query logging and/or PostgreSQL
     `EXPLAIN ANALYZE` on the batched `UPDATE`/`INSERT` to confirm whether any per-row work
     remains. Do this before claiming the optimization is fully realised.
    - **VERSION 2.8.2 — Digital Twin Layout Correction & Flight Planner Foundation (completed;
      awaiting commit approval):** fixes the VERSION 2.8.1 root-cause defect — the survey mosaic
      was laid out with `cols = ceil(sqrt(n))`, leaving a **ragged, partially-empty last row**
      (black voids / non-rectangular farm). The renderer and `computeMosaicLayout` were proven
      correct in V2.8.1; the bug was purely in **data generation**.
      - **Simulated Flight Planner (`backend/api/flight_planner.py`):** the new **source of
        truth for tile placement**. `plan_flight(db, mission_id)` lays the mission's images into
        the most rectangular grid that exactly tiles `n` (`_choose_grid_shape`: `cols` = divisor
        of `n` nearest `sqrt(n)`, so `rows*cols == n`, no empty cells; primes fall back to 1×n),
        then assigns `grid_row/col` + `capture_order` in **boustrophedon (lawnmower) flew order**
        (`_boustrophedon_order`) with per-tile centre GPS from
        `gps_projection.project_tile_center_gps`. Returns a `FlightPlan` with `FlightPlacement`s.
      - **`survey_api.generate_tiles_for_mission`** now consumes `plan_flight` and persists
        `grid_row/col`, `capture_order`, `center_gps_lat/lon` onto each `SurveyTile` (backfill
        path heals pre-V2 rows). The dead `ceil(sqrt(n))` `_tile_grid_positions` helper was
        **deleted** (no dead code).
      - **`frontend/lib/mosaicLayout.ts`** now fits only the **occupied bounding box**
        (min/max `grid_row/col` of actual tiles), so Fit frames the real farm rectangle with no
        artificial empty rows/columns. (`FarmViewer`/`FarmMosaic`/`OverlayLayer`/`TreeDetailsDrawer`
        were not modified — Decision 6 + scope rule.)
      - **Migration:** demo missions **78 and 88** re-assigned via the planner to a dense **5×2
        rectangular grid** (was ragged 4×3). Trees stay bound to their original tile content; only
        spatial placement changed. Idempotent.
      - **Decision 6 / 6b (DECISIONS.md):** renderer confirmed React/DOM (no engine change in V2);
        Flight Planner owns tile placement contract; ARCHITECTURE.md updated to record it.
      - **Verification:** backend imports clean; `npx tsc --noEmit` 0 errors; regression suite
        `verify_v26.js` **15/15, 0 console errors**; live `/map` for mission 88 renders a **2×5
        rectangle** (10 tiles, 10 expected cells, uniform 2050px spacing, no overlaps, 0 console
        errors); API confirms both missions dense + `capture_order` 1–10 follows flown order;
        dashboard==`/map` box parity retained. **No rendering-engine change was made.**
       - *(VERSION 2.8.2 code is implemented and verified; awaiting commit approval — do NOT
          commit yet.)*
    - **VERSION 2.8.3 — Flight Planner Configuration (Architecture Refinement; completed;
      awaiting commit approval):** an architecture refinement **before Version 3** so the
      simulator behaves like a real autonomous survey mission. **Not a new feature, not a
      redesign** — the renderer stays frozen (Decision 6).
      - **Problem addressed:** V2.8.2 still *derived* the grid from the image count
        (`_choose_grid_shape` = divisor-nearest-`sqrt(n)`). That removed empty cells but still
        tied mission geometry to how many photos were uploaded — not how a real flight planner
        behaves. The Flight Planner must own the geometry.
      - **New architecture (`backend/api/flight_planner.py`):**
        - **`PlannerConfig`** (frozen dataclass) explicitly defines `rows`, `cols`, `origin`
          (`GridOrigin`: TOP_LEFT/RIGHT/BOTTOM_LEFT/RIGHT), `traversal_pattern`
          (`TraversalPattern`: BOUSTROPHEDON), `row_spacing`, `column_spacing` (degrees,
          default `SPACING_DEG`). Geometry is **never** computed from image count.
        - **`SimulationFlightPlanner`** owns the mission geometry and emits `rows*cols`
          **waypoints** (capture positions) in flown order, then slots the uploaded images into
          the planned positions (by `upload_order`). Centre GPS per position uses the §10
          `project_tile_center_gps` (extended additively with optional `row_spacing_deg`/
          `col_spacing_deg`, defaulting to `SPACING_DEG` — single source preserved).
        - **`DEFAULT_PLANNER_CONFIG` = rows=5, cols=2, TOP_LEFT, BOUSTROPHEDON, standard
          spacing** — deterministic, explicitly configured for the 10-frame demo dataset.
        - **Rules (per approved architecture):** NO `sqrt()`, NO divisor search, NO nearest
          rectangle, NO heuristic factorisation. **Fewer images than planned** → only the
          available positions are populated (rest of the plan unoccupied). **More images than
          planned** → raises `FlightPlannerError` (surfaced as **HTTP 422** by
          `generate_tiles_for_mission`); extra rows/cols are never invented.
        - `_choose_grid_shape` (the sqrt/heuristic helper) was **deleted**; `plan_flight` is
          retained as a backwards-compatible thin wrapper (`SimulationFlightPlanner().plan`).
      - **`api/gps_projection.py`:** `project_tile_center_gps` gained optional
        `row_spacing_deg`/`col_spacing_deg` (default `SPACING_DEG`) so the planner can honour
        configurable spacing while keeping the §10 single source. Existing callers unchanged.
      - **Renderer / components UNCHANGED** (Decision 6 + scope): `FarmViewer`, `FarmMosaic`,
        `OverlayLayer`, `TreeDetailsDrawer` and `mosaicLayout.ts` were not modified. Fit still
        frames the occupied bounding box; the planner now guarantees that bounding box equals
        the configured grid.
      - **Verification:** backend imports clean; **no** `sqrt`/`divisor`/heuristic logic remains
        in the planner; `tsc --noEmit` 0 errors; regression suite `verify_v26.js` **15/15, 0
        console errors**; live `/map` (mission 88) renders the **2×5 rectangle** (10 tiles, 10
        expected cells, uniform 2050px spacing, no overlaps, 0 console errors); API confirms
        both missions 78/88 dense + `capture_order` 1–10 follows flown order; **overflow test**
        (1×1 grid, 10 images) raises `FlightPlannerError` → `HTTPException(422)` with a clear
        message; **fewer-images test** (3 images, 5×2 grid) yields exactly 3 placements at the
        first 3 flown positions. Mission geometry is now planner-defined, not image-inferred.
      - *(VERSION 2.8.3 code is implemented and verified; awaiting commit approval — do NOT
         commit yet.)*
    - **VERSION 3.0 — Robot Simulation Architecture & Specification Freeze (FROZEN;
      architecture & spec only, NO code):** the complete Robot Simulation architecture
      was designed and is now **frozen as the approved baseline for Version 3
      implementation**. No production code, frontend, or backend was written; Version 2
      architecture is untouched and no existing behaviour changes. Frozen at commit
      `eab06e9`, tag **`v2.9-project-stabilization`** (the stabilization release that
      precedes V3.0 work). Implementation begins at **V3.1**.
      - **Scope:** one simulated, time-driven harvesting robot executing a `HarvestMission`
        on the (frozen) Digital Twin. Backend owns all robot behaviour; frontend only
        visualizes (Major Design Principle). All §5 exclusions stand (no ROS/SLAM/
        multi-robot/live-drone-telemetry/physical-autonomous-nav/hardware-control/auth).
      - **Domain model (spec Appendix A.2):** new `Robot`, `DockStation`, `RobotBattery`,
        `RobotTelemetry`, `RobotEvent` tables; `RobotTask` / `RobotMission` are **adapters**
        over the existing immutable `HarvestMissionItem` / `HarvestMission` (no duplicate
        queue — §42/§43). Robot position is in the **same farm-pixel space** as
        `computeMosaicLayout` / `TreeObservation` (single coordinate system, no SLAM).
      - **State machine (A.3):** 7-state `RobotState` (Idle/Moving/Climbing/Scanning/
        Harvesting/Returning/Error, §26/§45.1) + a `DOCKED` battery sub-state; transitions
        backend-only.
      - **Navigation split (A.5):** route planning (Harvest Planner NN, §41, unchanged) ≠
        movement planning (pure `RobotNavigator`, farm-pixel trajectories) ≠ execution
        (`RobotSimulationEngine` pure `step(dt)` + `SimulationClock` `sim = wall ×
        speed_factor` + `RobotTicker` driver).
      - **Telemetry (A.6):** commands over HTTP (existing `HarvestMission` endpoints + new
        `Robot` commands); **live** state/position/battery over **WebSocket `/ws/robot`**
        (event-driven, no polling for live state); append-only `RobotEvent` +
        time-series `RobotTelemetry` persisted for charts/playback.
      - **Frontend (A.7):** additive `RobotLayer` (marker + path + battery ring) shares the
        `FarmViewer` transformed stage; `RobotStatusPanel`, `DashboardRobotCard`; playback
        replays stored telemetry through the same components. Renderer freeze (Decision 6)
        preserved — `FarmMosaic`/`OverlayLayer`/`TreeDetailsDrawer` unchanged.
      - **Milestones (A.8):** V3.1 Domain → V3.2 Navigation → V3.3 State Machine → V3.4
        Telemetry → V3.5 Visualization → V3.6 Autonomous Behaviour (engine) → V3.7
        Playback → V3.8 Production Hardening.
      - **Critical review (A.9):** flagged and mitigated coupling (single farm-pixel
        coord), duplication (`RobotTask`/`RobotMission` as adapters), polling (WebSocket),
        telemetry scaling (retention + `(robot_id,ts)` index + throttled sampling), and
        complexity (pure `step(dt)` shared by live/replay).
      - **Docs:** `PROJECT_SPECIFICATION.md` **Appendix A (FROZEN)**, `ARCHITECTURE.md`
        Version 3 block, `DECISIONS.md` **Decision 7**, plus the companion
        **`ROBOT_ARCHITECTURE.md`** (Robot Core Rule: deterministic execution). **No
        implementation; baseline FROZEN — proceed to V3.1 on approval.**
    - **VERSION 2.9 — Project Stabilization & Version 3 Readiness (completed; awaiting
      commit approval):** a final engineering stabilization pass **before** Version 3
      implementation. **Not a feature, not a refactor, not a redesign** — Version 2
      architecture and behaviour are unchanged. Scope limited to stabilization +
      Version 3 structure prep; no business-logic or user-visible changes.
      - **Dead code removed (provably unused only, per the strict "do not guess" rule):**
        - `api/survey_api.py` — removed the unused `project_tile_center_gps` import
          (the Flight Planner imports it directly) and the dead `base_lat`/`base_lon`
          local assignments + their now-unused `mission` query in
          `generate_tiles_for_mission` (the planner reads `mission.base_gps_*` itself).
        - `api/dashboard_api.py` — removed the unused `SurveyMissionStatus` import.
        - Verified with `pyflakes` (0 issues) and clean backend import. The legacy
          V1 `Task`-based system (`robot_api.py`, `database/tasks.py`, `map_api`/`tree_api`
          `Task` usage, `Task` model) was **deliberately retained** — it is live (mounted
          in `main.py`) and the spec keeps V1 endpoints intentionally; removing it would
          change behaviour and was outside the "provably unused" bar.
      - **Folder organization / Version 3 preparation:** created empty package
        directories (`.gitkeep` placeholders, **no implementation**) —
        `backend/{simulation,navigation,telemetry,websocket}/` and
        `frontend/components/{digitalTwin,dashboard,robot}/` + `frontend/robot/`. Existing
        live files were **not moved** (reorganizing frozen V2 renderer components risks
        build break for no current benefit; the task permits moving only when it improves
        maintainability).
      - **Naming consistency:** reviewed — existing names are consistent
        (`HarvestMission`, `HarvestMissionItem`, `SimulationFlightPlanner`, `PlannerConfig`,
        `FlightPlan`). The V3 proposed names (`RobotSimulationEngine`, `RobotTicker`,
        `RobotLayer`, `TelemetryService`, `SimulationClock`) are forward declarations in
        Appendix A / `ROBOT_ARCHITECTURE.md`; no renames applied (avoid unnecessary
        renaming of not-yet-existing code).
      - **Dependency cleanup:** frontend `package.json` deps are minimal and all used
        (core `next`/`react`/`react-dom` + dev tooling; `leaflet`/`react-leaflet` already
        removed in V2.7; Playwright drives the regression suite). `requirements.txt`
        remains the documented placeholder (CURRENT.md) — left untouched (not a reliable
        manifest; editing would be a guess). No libraries added or version-bumped.
      - **Documentation:** `ROBOT_ARCHITECTURE.md` created (robot subsystem overview,
        domain model, state machine, mission lifecycle, navigation pipeline, telemetry
        pipeline, event flow, milestones, future extension points — architecture only, no
        implementation). CURRENT/ARCHITECTURE/DECISIONS synced to Version 2.8.3 + V3
        PROPOSED; V2 remains fully consistent.
      - **Verification:** backend imports clean; `pyflakes` 0 issues; `npx tsc --noEmit`
        0 errors; `next build` succeeds; Playwright `verify_v26.js` **15/15, 0 console
        errors**; no behaviour or UI/backend regressions; repository structure ready for
        Version 3 (empty packages created, no live files disturbed).
      - *(VERSION 2.9 code is implemented and verified; committed as `eab06e9`,
         tagged `v2.9-project-stabilization`; Version 3.0 frozen as approved baseline
         at `37d8704`.)*
    - **VERSION 3.1 — Robot Domain Foundation (completed; awaiting approval, NOT
      committed):** the backend foundation for the autonomous robot. Robot Domain
      only — **no simulation, no movement, no navigation, no state machine, no
      telemetry/events, no WebSockets, no frontend, no mission execution.** Version
      2 architecture, behaviour, and endpoints are untouched.
      - **New persisted models (`database/models.py`):** `RobotState` (8-value enum:
        IDLE/MOVING/CLIMBING/SCANNING/HARVESTING/RETURNING/ERROR/DOCKED),
        `RobotBatteryStatus` (CHARGING/DISCHARGING/IDLE), and four tables —
        `Robot` (singleton: status, farm-pixel `position_x/y`, `heading_deg`,
        `current_mission_id`, `current_task_id`, `speed`, `battery_id`, `dock_id`),
        `DockStation` (singleton: `farm_x/y`, `label`), `RobotBattery` (one-to-one:
        `pct`, `status`, `last_change_ts`), `RobotConfiguration` (one-to-one:
        `default_speed`, `max_speed`, `battery_low_threshold`,
        `battery_critical_threshold`). All in the **same farm-pixel coordinate space**
        as the Digital Twin (Decision 6) — no SLAM/GPS localiser. `RobotTelemetry` /
        `RobotEvent` are deliberately **not** created (they belong to V3.4; the scope
        says "Do not add telemetry"). `RobotTask`/`RobotMission` remain adapters
        (V3.3+).
      - **New module `api/robot_domain.py` (services + router):** deterministic,
        side-effect-free services — `ensure_robot_domain` (idempotent singleton
        seed), `_reset_robot_to_default`, `_serialize_robot`/`_serialize_state`. The
        live V1 `robot_api.py` endpoints (`/robot/next_task`, `/robot/complete_task`)
        are **untouched**; V3.1 paths do not collide with them.
      - **Endpoints (all mounted, backend-only):** `GET /robot` (full domain
        snapshot: robot + dock + battery + config), `GET /robot/state` (status,
        battery, position, mission/task, speed, `docked` flag), `POST /robot/reset`
        (returns to IDLE / 100% / docked / no mission-or-task / default speed),
        `POST /robot/recharge` (battery → 100%, leaves lifecycle state unchanged),
        `POST /robot/speed` (clamps to `(0, config.max_speed]`; rejects ≤0).
      - **Singleton seeding:** `init_db()` now idempotently calls `ensure_robot_domain`
        after the existing ALTERs, so the robot exists on first boot and survives
        restarts (never overwritten).
      - **Defaults (factory):** `Robot` IDLE at dock `(0,0)`, `heading_deg=0`,
        `speed=1.0`, `current_mission_id=None`, `current_task_id=None`;
        `RobotBattery` `pct=100`, `status=IDLE`. Matches the required "starts in
        IDLE, Battery 100%, Docked, No Mission, No Task".
      - **Verification:** `py_compile` + `pyflakes` clean (0 issues) on all 4 changed
        files; `import main` OK; all 5 routes defined on the router; a standalone
        functional self-check against the live DB passed **every** assertion —
        initializes to defaults, `recharge` restores 100%, `reset` returns to
        defaults after mutation (status/mission/task/position/speed), `speed` applies
        + clamps + rejects negatives, exactly one Robot/Battery/Config/Dock (singleton
        invariant). **Live HTTP serve verified** after the dev servers were restarted
        (backend on :8000, frontend on :3000): all 5 endpoints returned correct
        defaults over HTTP. Frontend untouched → `tsc`/`next build`/`verify_v26.js`
        unaffected (no V2 regression).
      - **Implementation report** delivered; **committed as part of the V3 line once
        approved** — V3.1 was implemented and verified, then the dev servers were
        restarted for live verification. Not yet committed to git.
    - **VERSION 3.2 — Robot Navigation Foundation (completed; awaiting approval, NOT
      committed):** the **navigation layer only** — it computes *where* the robot
      should move, never moves it, never animates, never executes, never mutates
      Robot state. Fully deterministic. Version 2 + V3.1 behaviour/endpoints are
      untouched.
      - **New package `backend/navigation/`** (the V2.9-prepared empty dir is now
        populated): `mosaic_layout.py`, `service.py`, `__init__.py`.
      - **`mosaic_layout.py` — faithful backend port of `computeMosaicLayout`**
        (`frontend/lib/mosaicLayout.ts`, Decision 6 single source of truth). Same
        column/row max-width model, same occupied-bounding-box fit, same `gap`
        handling. Exposes `compute_mosaic_layout`, `tile_placement_map`, and
        `tree_target_pixel` (tile top-left + `TreeObservation.local_pixel_*`), so the
        robot target aligns with the twin's tree boxes on one farm-pixel plane. No
        second coordinate system.
      - **Planning objects (`service.py`):** `NavigationWaypoint` (dock/tree stop with
        `leg_distance`), `NavigationPlan` (ordered waypoints + `total_distance` +
        `next_destination()`/`remaining_destinations()`), `NavigationResult`
        (robot position, dock, mission, plan, `skipped_item_ids`, `deterministic`),
        and `RobotNavigator` — a **pure, stateless, deterministic** planner.
      - **`NavigationService` (`__init__.py`):** the single DB-touching component.
        Read-only. Resolves the target `HarvestMission` (explicit `mission_id` →
        robot's `current_mission_id` → active → latest), loads the V3.1 `Robot`
        position + `DockStation`, places all `SurveyTile`s via the layout port, and
        resolves each `HarvestMissionItem` tree's farm-pixel target through its
        representative `TreeObservation`. Calls `RobotNavigator.compute_plan`. **No
        writes** — navigation never mutates Robot state.
      - **Planning rules (per Appendix A §A.5):** begins at the Dock, visits harvest
        trees in the existing `HarvestMissionItem.visit_order` (the Harvest Planner's
        frozen Nearest-Neighbour order — not re-optimized), returns to the Dock
        (round trip). No A*, no obstacle avoidance, no route optimization, no change
        to Harvest Planner behaviour. `leg_distance` is straight-line Euclidean in
        farm-pixels. Future planners can replace `RobotNavigator` via this clean
        extension point.
      - **API (`api/robot_navigation.py`, mounted as `robot_navigation_router`):**
        `GET /robot/navigation` (next destination, remaining destinations, total
        travel distance, full plan) and `GET /robot/navigation/plan` (ordered
        waypoints only). Both read-only, no execution. V3.1 `/robot/*` endpoints and
        the V1 `robot_api.py` are untouched (no collisions).
      - **Verification:** `py_compile` + `pyflakes` clean (0 issues); `import main`
        OK; both routes live-served and returning correct plans (mission 22: dock →
        Tree 699 → dock, total distance computed); a standalone self-check passed
        **every** assertion — determinism (3 identical builds), **no Robot-state
        mutation**, pure `RobotNavigator` (identical inputs → identical plan),
        plan structure (dock→trees→dock, trees in `visit_order`), correct
        `total_distance` = sum of legs, and skip-handling of unresolvable targets. No
        V3.1 regression (`/robot`, `/robot/reset` 200) and no V2 regression
        (`/dashboard/overview` 200); **frontend untouched** (no frontend files
        changed).
      - **Implementation report** delivered; **NOT committed** — awaiting approval.
    - **VERSION 3.3 — Robot State Machine (completed; awaiting approval, NOT
      committed):** the **state machine only** — it owns every Robot state
      transition, nothing else. It does NOT move the robot, execute missions,
      animate, implement the Simulation Engine, or know about WebSockets. Fully
      deterministic. Version 2 + V3.1 + V3.2 behaviour/endpoints are untouched.
      - **New model `RobotStateTransition`** (`database/models.py`): append-only
        history row — `robot_id`, `previous_state`, `next_state`, `reason`,
        `created_at`. Never mutated; the single source for later telemetry/playback
        (V3.4/V3.7). The state machine stays agnostic of WebSockets/telemetry — it
        only writes these rows. Created by `Base.metadata.create_all` (new table,
        no ALTER needed).
      - **New module `backend/robot/state_machine.py`** (the V2.9-prepared
        `backend/robot/` package is now populated) + `backend/robot/__init__.py`.
        `RobotStateMachine` owns: current state, **transition validation**
        (`LEGAL_TRANSITIONS` frozen edge table), **transition execution**
        (mutates `robot.status`), **transition history** (appends
        `RobotStateTransition`), and **transition timestamps**. Also exposes
        `legal_targets` / `is_legal` / `IllegalTransition`. Pure validator — no
        timing, movement, battery, or telemetry.
       - **Frozen transition rules (explicit edges only):**
         `DOCKED→IDLE`, `IDLE→MOVING`, `MOVING→{CLIMBING,RETURNING}`,
         `CLIMBING→SCANNING`, `SCANNING→HARVESTING`, `HARVESTING→MOVING`,
         `RETURNING→DOCKED`, `ERROR→{RETURNING,IDLE}`. No self-transitions, no
         implicit edges, no hidden mutations. `ERROR` has **no inbound** recovery
         edge (it is only a recovery *source* to RETURNING/IDLE).
      - **API (`api/robot_domain.py`, extended):** `GET /robot/state` now also
        returns `available_transitions`; new `GET /robot/state/history`
        (ordered previous/next/reason/ts) and `POST /robot/state`
        (`{to, reason}` — validates via `RobotStateMachine`, illegal → HTTP 400,
        returns updated state + the recorded transition). V3.1 `/robot/*` and V1
        `robot_api.py` untouched; V3.2 navigation unchanged.
      - **Verification:** `py_compile` + `pyflakes` clean (0 issues); live HTTP
        self-check passed **every** assertion — full legal chain executes and
        updates `robot.status`; exactly 8 history records appended with correct
        edge sequence + timestamps + reasons; all illegal transitions (incl.
        self-transitions and `to:ERROR`) rejected with 400 and **no state
        mutation**; validation deterministic across repeated calls; no V3.1/V3.2
         regression (`/robot`, `/robot/recharge`, `/robot/navigation` 200);
         **frontend untouched**.
       - **Implementation report** delivered; **NOT committed** — awaiting approval.
     - **VERSION 3.3.1 — State Machine Refinement (completed; awaiting approval, NOT
       committed):** a minimal architecture refinement — **no redesign, no new
       features, no other V3 milestone touched.** It only lets operational failures
       fault the robot. `LEGAL_TRANSITIONS` was extended so **every operational
       state may transition into `ERROR`**: `DOCKED→ERROR`, `IDLE→ERROR`,
       `MOVING→ERROR`, `CLIMBING→ERROR`, `SCANNING→ERROR`, `HARVESTING→ERROR`,
       `RETURNING→ERROR`. Recovery is **unchanged**: `ERROR` may transition ONLY to
       `RETURNING` or `IDLE` (no other recovery path); there is still no inbound
       edge *into* a non-ERROR destination from `ERROR`. `RobotStateMachine`
       remains the **only** component permitted to mutate `robot.status`;
       Simulation, Navigation, Telemetry, WebSocket, and the frontend still never
       mutate `Robot.state` directly. Only `backend/robot/state_machine.py`
       (`LEGAL_TRANSITIONS`) was changed; `models.py`, the API, and all other V3
       files are untouched.
       - **Verification:** `pyflakes` clean; live HTTP confirmed `available_transitions`
         now includes `ERROR` from every operational state (e.g. IDLE →
         `['ERROR','MOVING']`); `POST /robot/state` to `ERROR` succeeds from each
         operational state; `ERROR→{RETURNING,IDLE}` still legal while
         `ERROR→{MOVING,CLIMBING,SCANNING,HARVESTING,DOCKED}` still 400 with **no
         state mutation**; all self-transitions (`X→X`) still rejected; history
          schema/shape unchanged; deterministic; no V3.1/V3.2 regression.
          **NOT committed** — awaiting approval.
     - **VERSION 3.4 — Robot Simulation Engine (completed; awaiting approval, NOT
       committed):** brings the robot to life — it **executes** a previously
       generated `NavigationPlan` over simulated time. **No** WebSocket, **no**
       telemetry persistence, **no** frontend, **no** playback, **no** charging
       UI — it only runs the simulation. Architecture discipline upheld: the
       engine never decides navigation, never validates transitions, never emits
       WebSocket frames, never renders UI.
       - **`backend/simulation/clock.py` — `SimulationClock`:** pure, deterministic
         time mapping. `sim_now = sim_offset + (wall − start) × speed_factor`;
         `pause` freezes sim time, `resume` continues with no jump; `speed_factor`
         re-anchors without losing accumulated sim time. No robot state, no DB.
       - **`backend/simulation/context.py` — `SimulationContext` + `SimulationEvent`:**
         the live state bag (waypoints, position, heading, speed, `status`, battery,
         progress, `sim_time`, timers) the pure engine reads/writes, plus the
         **internal** events (`WaypointReached`, `TreeReached`, `HarvestStarted`,
         `HarvestFinished`, `ReturnedToDock`, `MissionCompleted`, `BatteryLow`,
         `StateChanged`, `Moving`). Events are **not** streamed or persisted in V3.4
         (telemetry consumes them in V3.5); they exist so the engine is observable
         and V3.5 needs no redesign.
       - **`backend/simulation/engine.py` — `SimulationEngine` (pure `step(dt)`):**
         advances the context by one fixed `dt` (sim seconds) and never reads a
         clock, never touches the DB, never mutates `robot.status` except through
         the injected `transition_fn`. Movement is **linear interpolation** in
         farm-pixel space (no curves/obstacle-avoidance/physics). State flow per
         tree waypoint: `MOVING → CLIMBING → SCANNING → HARVESTING → MOVING`,
         round-trip ends `RETURNING → DOCKED`. **Battery** drains at a fixed rate
         while active (MOVING/CLIMBING/SCANNING/HARVESTING/RETURNING), clamped to
         `[0,100]`; at the configured low threshold it requests `RETURNING` and
         diverts straight to the dock (skipping remaining trees). `NavigationPlan`
         is consumed immutably.
       - **`backend/simulation/scheduler.py` — `SimulationScheduler` (singleton, the
         only wall-clock/thread driver):** `start` resolves the Harvest Mission,
         builds the immutable `NavigationPlan` via `NavigationService`, creates the
         engine + context, and launches a daemon thread ticking at a fixed real
         interval (each tick advances sim-time by `real_dt × speed_factor` and calls
         `engine.step`). Persists the context back onto `Robot`/`RobotBattery` with a
         fresh DB session per tick. `pause`/`resume`/`stop` control the run; `status`
         reports phase, sim time, progress, and recent events. The engine's
         `transition_fn` is wired to `RobotStateMachine.transition(db, …)`, so the
         state machine remains the **sole** mutator of persisted `robot.status`.
       - **`backend/api/robot_simulation.py` + `main.py`:** new router
         `POST /robot/simulation/start` (`mission_id?`, `speed_factor=1×`),
         `POST /robot/simulation/pause`, `POST /robot/simulation/resume`,
         `POST /robot/simulation/stop`, `GET /robot/simulation` — control + status
         only. Mounted in `main.py`.
       - **Scope guards honoured:** no WebSocket, no `RobotEvent`/`RobotTelemetry`
         persistence (those tables belong to V3.5), no frontend change, no charging
         logic (battery drains and diverts to dock; recharge stays a manual
         `POST /robot/recharge`). Only `backend/simulation/` (new) + the API router
         + `main.py` mount were added; V3.1–V3.3 code is untouched.
       - **Verification:** `pyflakes` clean (0 issues); the pure engine unit-tested
         for **determinism** (two identical runs produce byte-identical position/
         status/battery/event sequences), full-mission execution (both trees
         harvested → returned to dock → `DOCKED`), and **battery-low diversion**
         (harvests the in-progress tree, then routes to dock skipping the rest);
         live HTTP confirmed `start`→`running`, sim-time advances, `pause` freezes
         sim-time (stable), `resume` continues, `stop` cleanly halts; API smoke test
         shows V3.1/V3.2/V3.3 endpoints unchanged (200) and `frontend/` untouched.
          **NOT committed** — awaiting approval.
      - **VERSION 3.5 — Robot Telemetry & WebSocket (completed; awaiting approval, NOT
        committed):** makes the V3.4 simulation **observable** — it transports robot
        state and simulation events to live clients and persists them, **without
        modifying robot behaviour, navigation, or the state machine.** The engine
        stays pure and unchanged; only the scheduler now *publishes* its existing
        `SimulationEvent` objects onto a new `EventBus` after each tick.
        - **New dependency:** `websockets` (16.1) added to the backend venv — required
          by FastAPI/Starlette for the `/ws/robot` endpoint. Installed by extracting
          the `cp314` wheel into `site-packages` (the project's `pip` is broken by a
          `libexpat`/`pyexpat` mismatch in the py3.14 system Python; documented as a
          known environment issue, not a code defect).
        - **`backend/telemetry/event_bus.py` — `EventBus` (singleton `event_bus`):**
          a minimal synchronous pub/sub relay. The scheduler (producer) publishes a
          per-tick payload (`{events, context, robot_id, mission_id}`) on
          `TOPIC_SIM_EVENTS`; any number of consumers subscribe. **Decoupling
          guarantee:** the engine and scheduler never import the consumers; a
          subscriber raising is caught per-subscriber so a bad consumer can never
          stall the simulation tick; subscribers receive events in the exact order
          the engine produced them (deterministic ordering).
        - **`backend/telemetry/service.py` — `TelemetryService` (singleton
          `telemetry_service`):** a **read-side consumer**. Subscribes to the bus
          and, per tick, persists one append-only `RobotTelemetry` snapshot (full
          state at that sim-time) + one `RobotEvent` row per `SimulationEvent`. It
          **never mutates** `Robot`, `NavigationService`, or `RobotStateMachine` —
          it only reads the engine's own event objects and writes telemetry history.
          `start()`/`stop()` scope the subscription to a run; history is retained
          (append-only) across stops.
        - **`backend/telemetry/websocket_gateway.py` — `WebSocketGateway` (singleton
          `robot_ws_gateway`, built in `main.py` with the scheduler's read-only
          `status()`):** live streaming over `WebSocket /ws/robot`. Subscribes to the
          same bus topic; broadcasts a compact JSON frame (robot snapshot + the
          tick's events + run status) to **every** connected client. Multi-client:
          many browsers/dashboards may connect; each gets the same broadcast and an
          immediate late-joiner snapshot. **Observe-only:** it never starts/pauses/
          stops/resumes a run and never mutates state; a dropped client is pruned
          from the fan-out and never affects the simulation or other clients. Bus
          callbacks arrive from the scheduler's daemon thread and are marshalled
          into the asyncio loop via `call_soon_threadsafe`, so streaming is safe.
        - **New models (`database/models.py`):** `RobotTelemetry` (per-tick snapshot:
          `sim_time`, `status`, `battery_pct`, `position_x/y`, `heading_deg`,
          `speed`, `waypoint_index`, `completed_item_count`) and `RobotEvent`
          (per-event: `event_type`, `sim_time`, `detail` JSON) — both append-only,
          `(robot_id, …)` indexed. Created by `Base.metadata.create_all` (new tables,
          no ALTER needed). These are exactly the `RobotTelemetry`/`RobotEvent`
          tables spec'd in Appendix A §A.6. The V3.1 doc comment that deferred them
          to "V3.4 Telemetry" was corrected to V3.5.
        - **`backend/api/robot_telemetry.py` + `main.py`:** new router
          `GET /robot/telemetry` (latest snapshot(s)), `GET /robot/telemetry/events`
          (historical events, newest first) for reconnect/history; the live stream
          is the WebSocket at `/ws/robot` (mounted in `main.py`). All read-only —
          no mutation of robot/navigation/state-machine/simulation.
        - **Scheduler wiring (`backend/simulation/scheduler.py`):** after each
          `engine.step` tick the scheduler now publishes the tick's events + context
          onto the `EventBus` (the engine is untouched). `start()` begins/ends the
          `TelemetryService` subscription scoped to the run. **Bug fixed (exposed by
          V3.5's end-to-end run):** a fresh run now reconciles the *persisted*
          `robot.status` back to `IDLE` before requesting `MOVING`. Prior runs (or a
          `stop` mid-run) can leave the robot in any state; the old code only reset
          the in-memory context to IDLE while the persisted row stayed e.g. `DOCKED`,
          so the first `MOVING` request hit an illegal edge. `_reset_persisted_to_idle`
          walks the frozen legal edges (active → RETURNING → DOCKED → IDLE; ERROR →
          IDLE; DOCKED → IDLE) through `RobotStateMachine` so the start transition is
          always valid. This is a genuine pre-existing bug, not a V3.5 behaviour
          change.
        - **Discipline upheld:** engine/context reference telemetry only in
          docstrings (no import); `TelemetryService` does not import
          `RobotStateMachine`/`NavigationService`; the WebSocket gateway never calls
          any control endpoint. Telemetry adds per-tick DB writes (≈ doubles
          per-tick cost already present in V3.4), so on the remote Neon DB the live
          tick rate is modest (~0.4–3 Hz); every tick is still delivered losslessly
          to both DB and WS (verified 1:1: N telemetry rows == N WS frames for a
          run). Frontend untouched (no frontend files changed).
        - **Verification:** `py_compile` clean on all new/changed files; `import main`
          OK (server boots with WebSocket support). A standalone unit check passed
          **every** assertion — `EventBus` decouples producer from consumers (a
          raising subscriber does not break the producer; ordering preserved),
          `TelemetryService` persists 1 telemetry + 2 event rows from a published
          tick and leaves the robot's authoritative `status` **untouched**, event
          ordering is deterministic. **Live HTTP + WebSocket verified:** started a
          run, connected **two** concurrent WS clients (both received frames),
          confirmed live `telemetry` frames carry the correct `MOVING` state (not the
          earlier battery-drained `DOCKED` artifact), multivated telemetry + event
          rows in the DB; disconnecting a client did **not** stop the run (observe-
          only); late-joining clients receive an immediate snapshot; V3.1/V3.2/V3.3/
          V3.4 endpoints all still 200 (no regression); **frontend untouched**.
           **NOT committed** — awaiting approval.
     - **VERSION 3.5.1 — Simulation Lifecycle Refinement (completed; awaiting approval,
       NOT committed):** a very small hardening of the Robot Simulation lifecycle.
       **No architecture change, no new features, no redesign** — Navigation, the
       Simulation Engine, the State Machine, Telemetry, and the WebSocket architecture
       are all untouched. Only `backend/simulation/scheduler.py` changed (two edits):
       - **(1) Robot state is separate from Simulation status.** `Robot.status`
         always holds a legal `RobotState` value. The scheduler's run phase
         (`running` / `paused` / `stopped` / `finished`) lives only in
         `SimulationScheduler._status` and is **never** written to `robot.status`
         (it never was — `_persist` only copies `ctx.status`, which is always a
         `RobotState`). A **defensive guard** was added in `_persist` so any
         non-`RobotState` value is rejected before reaching `robot.status`. On
         mission completion the engine settles the robot to `DOCKED` (legal
         `RobotState`) while the simulation status becomes `finished`. The two are
         provably independent.
       - **(2) Completed mission context is preserved.** After a mission completes
         (and after a `stop`), `mission_id`, `completed_item_ids`, `waypoint_count`,
         and the final statistics stay queryable via `GET /robot/simulation` until
         the next `POST /robot/simulation/start` or an explicit `POST /robot/reset`.
         Previously `stop()` wiped `self._ctx` / `self._mission_id` /
         `self._robot_id` / `self._events`, discarding the completed run's context
         prematurely. `stop()` now halts only the driver thread + the transient
         event ring; the run context is retained (robot state is left exactly as the
         last tick persisted it).
       - **(3) Battery lifecycle.** Arriving at the dock (`RETURNING → DOCKED`) does
         **not** automatically recharge the battery — the percentage is left
         unchanged. Charging occurs only through `POST /robot/recharge` (or a future
         charging-simulation milestone). No implicit battery reset exists anywhere.
       - **Verification:** `py_compile` + `pyflakes` clean (0 issues) on the changed
         file; `import main` OK. A **live** end-to-end run (mission 22,
         `speed_factor=50`) verified **all 24 checks**: `start` sets
         `simulation.status=running` + `Robot.state=MOVING`; on completion
         `simulation.status=finished` while `Robot.state=DOCKED` (a legal
         `RobotState`, never the sim status); `mission_id` / `completed_item_ids` /
         `waypoint_count` / `finished` all preserved after completion **and** after
         `stop`; battery was **not** auto-recharged at the dock (remained < 100%); an
         explicit `reset` returns `Robot.state=IDLE` + clears `mission_id`. A
         **deterministic pure-engine unit check** (no DB) confirmed the harvest path
         populates `completed_item_ids` and settles `Robot.state=DOCKED` with the
         battery unchanged (no recharge). V3.1–V3.5 endpoints all still return 200
         (no regression); **frontend untouched** (no frontend files changed); **no
         new dependencies**.
       - **NOT committed** — awaiting approval.
      - V2.5 is complete (read-only Tree Details panel). Optional future: a read-only
      "Locate on twin" pan-to-tree action in the panel (still no mutation); eventually
      supersede the sparse legacy `/trees/[treeId]` page with the panel.
     - **V2.6 (overlay performance) — observations recorded during V2.5.1 (no code change):**
       the V2.5.1 interaction fixes surfaced the exact cost drivers, confirming the V2.4
       plan:
       - **DOM count is the dominant cost.** `OverlayLayer` currently mounts **3 DOM nodes
         per tree** (box + centroid marker + label) ≈ **~900 nodes at 302 trees**. Each is a
         positioned `<div>` with inline `counter-scaled` styles (font-size/line-height/border
         recomputed per `scale` change in the render loop). This is fine at ~300 trees but is
         the lever to attack first for larger farms.
       - **Two cheap wins, in order:** (1) **viewport culling** — only render boxes whose
         farm-pixel rect intersects the current viewport rect (cheap math in `mosaicLayout`
         farm-pixel space, no projection); (2) **LOD by zoom** — drop the centroid marker and
         label (the 2 non-essential nodes) below a scale threshold, leaving just the box. Both
         preserve the `data-tree-id` + `selectedTreeId`/`onTreeSelect` contract.
       - **Renderer swap is a last resort:** only move to Canvas/WebGL (§V2.8 line 3642) if box
         counts exceed a DOM threshold (e.g. many thousands) where culling+LOD is insufficient.
         A Canvas renderer must still honor hit-testing (hit `data-tree-id`-equivalent) so
         `FarmViewer`'s tap-selection keeps working unchanged.
       - Pan/zoom are already smooth (rAF transform writes, `will-change: transform`, no React
         re-render during gesture) — V2.6 should not regress this.
     - LOD + viewport culling (§V2.8/§V2.10) for the overlay — current rendering approach and
       the two optimization levers are recorded above. Consider Canvas/WebGL (§V2.8 line 3642)
       only if box counts exceed the DOM threshold; preserve the `onTreeSelect` /
       `selectedTreeId` contract. Overlay currently renders all boxes (fine at ~300 trees).
    - Commit Features 9–12, VERSION 2.1, VERSION 2.2, VERSION 2.3, and VERSION 2.4
      (pending approval).
    - Add backend unit tests for task‑generation/ripeness logic
    - Real geotagging of drone images (currently GPS is derived from the box position)
    - Model versioning / distribution strategy (weights are gitignored)
  - **Known Issues / Decisions:**
  - Database is **PostgreSQL (Neon)**, not SQLite (documentation previously said SQLite).
  - `requirements.txt` is a placeholder and incomplete.
  - Model weights (`*.pt`) and `.env` are gitignored; they are local‑only.
  - Navigation is rendered inline in `layout.tsx` (the old `Navbar.tsx` component was removed).
    The "Dashboard" nav link now points to `/dashboard`; a "Trees" link exposes the old
    `/trees` page.
