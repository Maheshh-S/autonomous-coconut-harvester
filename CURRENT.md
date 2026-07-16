# CURRENT.md

- **Project Version:** 3.8.5 (Version 3 line; V3.8 Production Hardening in progress)
- **Current Status:** Version 3 pipeline complete through V3.7.3 (Survey → Twin → Inspection → Inventory → Harvest Mission → Robot Simulation → Mission History & Analytics). All V1–V3 work is implemented and verified but **not yet committed** — awaiting explicit approval.
- **Completed (chronological summary — full detail in the version history below):**
  - **V1 — Baseline integration:** YOLOv8 tree + coconut‑ripeness detection, GPS
    tree-matching into permanent `Tree` records, V1 `Task`/`Detection` model, V1 robot
    task polling/completion, dashboard/tree-detail/map/robot pages.
  - **V2 — Digital Twin (FROZEN v2.0):** survey-mission data model (`SurveyMission` /
    `SurveyImage` / `SurveyTile`), `TreeObservation` representative overlay, Flight
    Planner tile geometry, tile-mosaic Farm Viewer with zoom/pan/fit, interactive tree
    overlay + read-only Tree Details drawer, viewport culling + zoom LOD, legacy V1
    Leaflet map removed.
  - **V2.x features:** Inventory Snapshot builder (Feature 9), Harvest Planner &
    immutable `HarvestMission` / `HarvestMissionItem` (Feature 10), Robot Mission
    Execution (Feature 11), read-only Dashboard & System Overview (Feature 12).
  - **V3 — Robot Simulation (FROZEN baseline at V3.0):** Robot Domain (V3.1),
    Navigation (V3.2), State Machine (V3.3 / V3.3.1), Simulation Engine (V3.4),
    Telemetry & WebSocket (V3.5 / V3.5.1), Live Robot Visualization (V3.6 / V3.6.1),
    Mission History & Analytics (V3.7 / V3.7.1), Workflow Integration (V3.7.2),
    Speed & Battery Calibration (V3.7.3).
  - **Current state:** all V1–V3 work is implemented and verified (Playwright 0 console
    errors, `tsc --noEmit` / `next build` clean) but **not yet committed** — awaiting
    explicit approval. Do NOT commit until approved.
  - **Version 2 (FROZEN v2.0 — architecture locked; data foundation implemented):**
  - **Digital Twin Farm Viewer** amendment frozen in `PROJECT_SPECIFICATION.md §V2`.
    A seam-de-emphasised tile mosaic (tiles by grid row/col; YOLO bounding boxes as the
    interactive layer) **replaces** the V1 Leaflet/OSM `/map` — single viewer, no parallel
    maps. GPS demoted to backend metadata; new "farm-pixel" coordinate system.
  - **Central finding it addresses:** the pipeline previously _discarded_ the data V2 needs —
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
      _Note:_ absolute runtime on the remote Neon DB is dominated by round-trip latency
      (a 302-row batched UPDATE is ~80 s on this serverless Postgres), not algorithmic cost;
      the structural win is removing O(rows) ORM round-trips. Verified correct: 302
      observations, 0 representative mismatches vs §V2.7, all tree codes valid.
    - _(VERSION 2.1 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
  - **VERSION 2.2 — Continuous Farm Mosaic Engine (completed; awaiting commit approval):**
    Scope = the _rendering foundation_ of the Digital Twin Farm Viewer. Reconstructs the
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
    - _(VERSION 2.2 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
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
      pinch midpoint fixed. _(Amended per clarification: browser Fullscreen API
      removed — the viewer is interactive everywhere and navigation to the full
      view is done via the expand control below, Google-Maps-like.)_
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
    - _(VERSION 2.3 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
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
      (1) **viewport culling** in _farm-pixel_ space (compute which boxes intersect the
      inverse-transformed viewport rect, since boxes live inside the scaled stage; an
      overflow-clipped wrapper or an offscreen check avoids rendering off-screen nodes), and
      (2) **LOD** (already partially present: labels hidden below a screen-size threshold;
      extend to drop centroids / simplify boxes / render tree _dots_ when far out). If counts
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
    - _(VERSION 2.4 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
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
    - _(VERSION 2.5 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
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
    - _(VERSION 2.5.1 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
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
  - _(VERSION 2.6 code is implemented and verified; awaiting commit approval — do NOT
    commit yet.)_
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
      both. _(survey_api.py:566, 684, 726–743, 807.)_
    - **Backend N+1 fix (harvest planner):** `_eligible_trees` did a per-tree
      `db.get(InventorySnapshot, …)` inside the tree loop — an N+1 that becomes hundreds of
      round-trips on Neon. Collapsed into one grouped `IN` query. _(harvest_mission_api.py:
      135–152.)_
    - **Backend N+1 fix (`GET /trees/summary` — this endpoint was HANGING):**
      tree_api.py looped per-tree `Detection.count()` + `Task.count()` (2 queries/tree →
      ~604 round-trips over 302 trees → request hung >20 s). Collapsed into two grouped
      aggregates. **Validated:** endpoint now returns 302 rows in ~3.2 s (was timeout). This
      also unblocks the `/trees` server page and the `/trees/[treeId]` detail lookup, which
      both call `getTreesSummary` and were previously stuck on "Loading…".
      _(tree_api.py:81–110.)_
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
        (no not-found state). Now shows "Tree #… not found." _(trees/[treeId]/page.tsx.)_
      - `/robot`: `res.ok` was never checked, so a non-200 from `/robot/next_task` threw on
        `res.json()` and crashed the page. Now shows a graceful message.
      - `/trees/[treeId]` harvest select offered V1 terms `tender`/`both`; the backend
        `HarvestType` is `mature|potential|premature|all`. Options corrected.
      - `TreeDetailsDrawer`: the harvest lookup (`harvestReady` flip) re-triggered the detail
        effect, firing a **duplicate** `getTreeInventory`/`getTreeInventoryHistory`/
        `getTreeInspections` fetch on first selection. Gated the detail fetch on
        `harvestReady` so it runs once. _(TreeDetailsDrawer.tsx:145–203.)_
    - **Minor cleanup:** removed a dangling `//strech` debug comment; de-duplicated the
      `API_BASE_URL` constant in `DroneUploader.tsx` (now imports the canonical export);
      fixed the `/trees` page title ("Farm Dashboard" → "Trees").
    - **V1 endpoints intentionally kept:** `/detect/trees`, `/drone/*` etc. are the
      preserved V1 data/business logic per the freeze and remain mounted (not dead
      code). `DroneUploader` / `CoconutUploader` are the real V2 survey/inspection
      upload entry points and were kept. _Note:_ `/plantation/map`, `/planner/*` were
      later removed in V3.8.2 as verified-dead (see below).
    - **Verification:** `tsc --noEmit` + `next build` pass (no Leaflet imports remain);
      backend imports clean; isolated DB script proves the twin fix; live twin endpoint
      returns 302 trees; `/trees/summary` ~3.2 s; Playwright **dashboard** (no Farm Map /
      Leaflet, Overview + Recent Activity present), **tree detail** (valid id → detail,
      bogus id → not found, no infinite Loading), **robot** (no crash) — **0 console errors**;
      V2.6 regression suite **15/15, 0 console errors** (twin viewer intact after Leaflet
      removal + backend fixes).
    - _(VERSION 2.7 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
  - **VERSION 2.8 — Digital Twin Polish & UX Refinement (completed; awaiting commit
    approval):** the final polish milestone before Version 2 is frozen. Polish only — no
    new features, no new APIs, no architecture change, no new business logic. Scope was a
    complete visual + interaction audit of the Digital Twin viewer on both `/map` and the
    `/dashboard` card, plus root-cause fixes for the glitches found. The audit confirmed
    the core is already solid: 302/302 box centres align inside their tile images
    (no drift), 0 broken tile images, 0 console errors, mobile bottom-sheet drawer
    anchored to the viewport bottom, dashboard renders 302 boxes with no drawer, culling
    - LOD working (fit = 302 boxes / labels hidden <20% / selected label always visible;
      zoom-in ~72% = 23 culled boxes with all labels + centroids; pan ≈ 60 FPS).
    * **Fix 1 (root cause found) — mosaic `overflow: auto` (legacy V2.2):** `FarmMosaic`
      was the only scroll container inside the transformed stage, while `FarmViewer`'s
      viewport already clips with `overflow: hidden`. The mosaic should never scroll.
      Changed to `overflow: hidden` (single source — fixes both `/map` and the dashboard
      card, which share `FarmMosaic`).
    * **Fix 2 (root cause found) — scaling frame artifact:** `FarmMosaic`'s root carried a
      `1px solid` border + `8px` border-radius that lived _inside the CSS-transformed
      stage_, so they grew with zoom — a frame around the entire plantation that thickened
      as you zoomed in. The `FarmViewer` viewport already supplies the dark container, so
      the border/radius were removed from the mosaic root. The visible result is a
      seamless farm edge meeting the dark viewport (no scaling frame).
    * **Files changed:** `frontend/components/FarmMosaic.tsx` only (the mosaic rendering
      engine; `FarmViewer`, `OverlayLayer`, `TreeDetailsDrawer`, `DashboardFarmCard`, the
      API layer, and all backend are untouched). No new endpoints, no layout-math change
      (`computeMosaicLayout` unchanged), no extra renders / duplicate requests / N+1 /
      layout thrash introduced — the V2.6 optimizations are preserved.
    * **Out of scope (confirmed not glitches, left as-is):** no page-level scroll; selected
      top-row label not clipped by the viewport; toolbar z-index (7) correctly sits above
      the drawer (6) without overlapping the close button; the gap renders as the intended
      black seam (seam-de-emphasised, §V2.6); hover highlights + shows the label (the
      spec's "lightweight hover popup" was not added — it would be a new feature, outside
      this polish milestone's scope; interaction rules from V2.4–V2.7 stand).
    * **Verification:** `tsc --noEmit` passes (0 errors); `next build` succeeds (all routes
      compile, no unresolved imports); backend unaffected (frontend-only change). Playwright
      regression suite `verify_v26.js` **15/15, 0 console errors**; a V2.8 re-audit
      confirms `overflow: hidden`, border/radius `0px`, 302/302 boxes aligned inside tiles,
      0 broken images, 0 console errors.
    * _(VERSION 2.8 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
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
    - _(VERSION 2.8.2 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
  - **VERSION 2.8.3 — Flight Planner Configuration (Architecture Refinement; completed;
    awaiting commit approval):** an architecture refinement **before Version 3** so the
    simulator behaves like a real autonomous survey mission. **Not a new feature, not a
    redesign** — the renderer stays frozen (Decision 6).
    - **Problem addressed:** V2.8.2 still _derived_ the grid from the image count
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
    - _(VERSION 2.8.3 code is implemented and verified; awaiting commit approval — do NOT
      commit yet.)_
  - **VERSION 2.9 — Project Stabilization & Version 3 Readiness (completed; committed
    as `eab06e9`, tagged `v2.9-project-stabilization`):** a final engineering
    stabilization pass **before** Version 3 implementation. **Not a feature, not a
    refactor, not a redesign** — Version 2 architecture and behaviour are unchanged.
    Scope limited to stabilization + Version 3 structure prep; no business-logic or
    user-visible changes.
    - **Dead code removed (provably unused only, per the strict "do not guess" rule):**
      - `api/survey_api.py` — removed the unused `project_tile_center_gps` import
        (the Flight Planner imports it directly) and the dead `base_lat`/`base_lon`
        local assignments + their now-unused `mission` query in
        `generate_tiles_for_mission` (the planner reads `mission.base_gps_*` itself).
      - `api/dashboard_api.py` — removed the unused `SurveyMissionStatus` import.
      - Verified with `pyflakes` (0 issues) and clean backend import. The legacy
        V1 `Task`-based system (`robot_api.py`, `database/tasks.py`, `tree_api`
        `Task` usage, `Task` model) was **deliberately retained** — it is live (mounted
        in `main.py`) and the spec keeps V1 endpoints intentionally; removing it would
        change behaviour and was outside the "provably unused" bar. _Note:_ the
        `map_api` router (`/plantation/map`) was later removed in V3.8.2 as verified-dead.
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
      remains the documented placeholder — left untouched (not a reliable
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
      time-series `RobotTelemetry` persisted for the Operations Center (history, summary,
      timeline, tree-activity, analytics, robot log).
    - **Frontend (A.7):** additive `RobotLayer` (marker + path + battery ring) shares the
      `FarmViewer` transformed stage; `RobotStatusPanel`, `DashboardRobotCard`. The
      Mission History & Analytics page (`/robot/history`) is **presentation-only** — every
      metric is computed backend-side in `analytics/mission_history.py`. (V3.7 supersedes
      the earlier "Playback" concept: read-only analytics over completed runs, no replay.)
      Renderer freeze (Decision 6) preserved — `FarmMosaic`/`OverlayLayer`/`TreeDetailsDrawer`
      unchanged.
    - **Milestones (A.8):** V3.1 Domain → V3.2 Navigation → V3.3 State Machine → V3.4
      Telemetry → V3.5 Visualization → V3.6 Autonomous Behaviour (engine) → V3.7
      Mission History & Analytics → V3.8 Production Hardening.
    - **Critical review (A.9):** flagged and mitigated coupling (single farm-pixel
      coord), duplication (`RobotTask`/`RobotMission` as adapters), polling (WebSocket),
      telemetry scaling (retention + `(robot_id,ts)` index + throttled sampling), and
      complexity (pure `step(dt)` shared by live/replay).
    - **Docs:** `PROJECT_SPECIFICATION.md` **Appendix A (FROZEN)**, `ARCHITECTURE.md`
      Version 3 block, `DECISIONS.md` **Decision 7**, plus the companion
      **`ROBOT_ARCHITECTURE.md`** (Robot Core Rule: deterministic execution). **No
      implementation; baseline FROZEN — proceed to V3.1 on approval.**
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
      - clamps + rejects negatives, exactly one Robot/Battery/Config/Dock (singleton
        invariant). **Live HTTP serve verified** after the dev servers were restarted
        (backend on :8000, frontend on :3000): all 5 endpoints returned correct
        defaults over HTTP. Frontend untouched → `tsc`/`next build`/`verify_v26.js`
        unaffected (no V2 regression).
    - **Implementation report** delivered; **committed as part of the V3 line once
      approved** — V3.1 was implemented and verified, then the dev servers were
      restarted for live verification. Not yet committed to git.
  - **VERSION 3.2 — Robot Navigation Foundation (completed; awaiting approval, NOT
    committed):** the **navigation layer only** — it computes _where_ the robot
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
      (round trip). No A\*, no obstacle avoidance, no route optimization, no change
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
      `created_at`. Never mutated; the single source for later telemetry / Mission
      History & Analytics (V3.4/V3.7). The state machine stays agnostic of
      WebSockets/telemetry — it only writes these rows. Created by
      `Base.metadata.create_all` (new table, no ALTER needed).
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
      edge (it is only a recovery _source_ to RETURNING/IDLE).
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
    edge _into_ a non-ERROR destination from `ERROR`. `RobotStateMachine`
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
      - `main.py` mount were added; V3.1–V3.3 code is untouched.
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
      stays pure and unchanged; only the scheduler now _publishes_ its existing
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
      V3.5's end-to-end run):** a fresh run now reconciles the _persisted_
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
    - **VERSION 3.6 — Live Robot Visualization on the Digital Twin (completed; awaiting
      approval, NOT committed):** the frontend **Live Robot Visualization layer** that
      renders the V3.4–V3.5 simulation on the existing Digital Twin. **Presentation only
      — no business logic, no prediction, no interpolation.** Every pixel comes from the
      backend: the REST Simulation APIs (commands + `GET /robot/simulation`) and the
      `WebSocket /ws/robot` frame. Frontend **never** simulates, estimates, or animates
      robot motion; it renders exactly the latest backend snapshot. Scope matches the
      frozen spec — the Mission History & Analytics (timeline/history/analytics)
      over completed runs was added later in V3.7 as a separate, backend-owned
      subsystem (see VERSION 3.7).
    - **New frontend files (all inline-styled, no Tailwind, per repo convention):**
      - `frontend/lib/api/detection.ts` — extended with the V3 robot contract:
        `V3RobotState`, `RobotSnapshot`, `SimulationStatus`, `RobotFrame`,
        `RobotNavPlan`, `RobotSimEvent`; REST helpers `startSimulation` /
        `pauseSimulation` / `resumeSimulation` / `stopSimulation` / `rechargeRobot` /
        `resetRobot` / `getSimulationStatus` / `getRobotNavPlan`; and
        `RobotWebSocketClient` (auto-reconnect, de-dup, observe-only).
      - `frontend/lib/useRobotSimulation.ts` — shared hook owning the single WS
        connection, the latest snapshot, run status, and the (read-only) navigation
        plan; issues commands via the backend APIs only. Both `/map` and `/robot`
        reuse it so there is exactly **one** WS connection and one source of truth.
      - `frontend/components/robot/RobotMarker.tsx` — robot icon, heading rotation,
        conic battery ring, `ROBOT_STATE_COLORS` map, counter-scaled by `1/scale` so
        it stays constant on screen under zoom/pan.
      - `frontend/components/robot/RobotPathLayer.tsx` — visited/remaining path
        polylines + waypoint dots + current-destination ring, counter-scaled.
      - `frontend/components/robot/RobotLayer.tsx` — composes `RobotPathLayer` +
        tree highlights (reuses `computeMosaicLayout` + `TreeOverlay`; does **not**
        duplicate `OverlayLayer` box rendering) + `RobotMarker`; mounts **inside**
        `FarmViewer`'s transformed stage (`data-testid="robot-layer"`).
      - `frontend/components/robot/RobotStatusCard.tsx` — Robot State badge, Battery
        bar, Mission, Current/Next Tree, Distance Remaining, Sim Time, Speed Factor,
        WS connection indicator; responsive (stacks on narrow viewports).
      - `frontend/components/robot/SimulationControls.tsx` — Start / Pause / Resume /
        Stop / Recharge / Reset / Speed; **forwards intents only**, no business logic.
      - `frontend/app/map/page.tsx` — `/map` hosts the twin (survey mission) + a
        dedicated **Harvest Mission** selector (the robot executes a _harvest_ mission,
        a different entity from the survey mission that selects the mosaic) driving the
        robot overlay + `SimulationControls` + `RobotStatusCard`.
      - `frontend/app/robot/page.tsx` — `/robot` Control Centre keeps the **live legacy
        V1 Task interface** (per AGENTS.md — must not be removed) and adds the V3.6
        simulation control panel (harvest-mission selector + controls + twin + status).
      - `frontend/app/dashboard/page.tsx` — `RobotStatusCard` added to the Digital Twin
        grid (no controls; the dashboard is read-only by design).
      - `frontend/components/FarmViewer.tsx` — optional `robot` / `plan` /
        `destinationTreeId` / `harvestingTreeId` / `completedTreeIds` props; renders
        `RobotLayer` inside the same transformed stage when a live snapshot is supplied.
        No simulation logic in `FarmViewer`.
    - **Architecture discipline (unchanged):** Navigation owns routing;
      `RobotStateMachine` solely mutates `robot.status`; `SimulationEngine` executes
      time; Telemetry/WebSocket observe only. Frontend adds a pure rendering layer
      that consumes their outputs. Counter-scaling reuses the `1/scale` pattern already
      used by tree labels; `RobotLayer` shares the `FarmViewer` stage (no second
      transform) so zoom/pan/fit stay in sync.
    - **Verification:** `tsc --noEmit` 0 errors; `next build` success (0 unresolved
      imports); Playwright `verify_v36.js` **PASS with 0 console errors** — robot
      marker renders on the twin and **moves** (farm-pixel position advances over the
      run), state badge reflects live `MOVING`, battery drains live, Sim Time /
      Speed Factor update, Pause/Resume/Stop/Reset all drive the backend; the marker is
      bound to the live `/ws/robot` frame. `/dashboard` and `/robot` also render with 0
      console errors (the slow `/dashboard/overview` query ~4.9 s is pre-existing,
      unrelated to V3.6). No backend files changed; **no new dependencies**.
    - **NOT committed** — awaiting approval.
  - **VERSION 3.6.1 — Robot Visualization Polish & UX Refinement (completed;
    awaiting approval, NOT committed):** refinement pass on top of V3.6 — smooth
    marker motion, production-grade path visualization, marker polish, the
    Return-to-Dock control, and a **backend simulation-correctness fix**. No
    architecture or backend business-rule changes beyond the bug fix.
    - **Backend fix (root cause):** `SimulationEngine` step `dt` was computed as
      `(now - last_wall) * speed_factor`, measuring **wall-clock time including
      periods the scheduler thread was blocked** — e.g. while an external command
      (`POST /robot/recharge`) held `self._lock`, or while a slow Neon Postgres
      round-trip stalled `_persist`. A resumed tick then simulated several seconds
      at once: it drained the battery massively in a single tick (clobbering a
      manual recharge — battery collapsed 100 → ~81 instead of holding 100) and
      could teleport the robot. Fixed by clamping `dt` to
      `REAL_TICK_INTERVAL_S * speed_factor * 4` in `scheduler._run_loop`, so a
      stall only pauses the robot briefly instead of fast-forwarding. This also
      makes the V3.6.1 `apply_external_battery` / `return_to_dock` commands land
      correctly (they were correct in code but their effect was being instantly
      overwritten by the inflated next tick). `CURRENT.md`/AGENTS.md note: Neon
      first-query latency is ~0.7–5 s, so external commands can take a few seconds
      to round-trip — verified, not a defect.
    - **New backend commands (additive):** `POST /robot/recharge` now also calls
      `scheduler.apply_external_battery(100.0)` (syncs the live `_ctx`, so the
      recharge persists across ticks — the pre-fix version wrote the DB row only
      and was clobbered); new `POST /robot/simulation/return-to-dock` reuses the
      frozen `RETURNING` edge + `engine._divert_to_dock` (graceful recall, mission
      context preserved — replaces the old Stop/terminate semantics).
    - **Frontend (presentation only):** `useRobotSimulation.ts` adds a rAF
      critically-damped **spring** for `displayRobot` (x/y/heading glide between
      backend snapshots) — backend stays authoritative; **battery is taken
      straight from the authoritative snapshot, never spring-smoothed** (a lagging
      battery gauge is wrong for a status readout). `RobotMarker.tsx` polished
      (halo, heading tip, low-battery red ring). `RobotPathLayer.tsx` rewritten:
      faint full route + solid green travelled + dashed blue remaining.
      `SimulationControls.tsx` Stop → **Return to Dock**. `/map` is now
      visualization-only (no controls) + 3 toggles (Show Robot / Show Planned Path
      / Show Current Target); `/robot` is the full control centre; `/dashboard` is
      status-only. All inline-styled; **no new dependencies**.
    - **Verification:** `tsc --noEmit` 0 errors; `next build` success; Playwright
      `frontend/verify_v361.js` **PASS with 0 console errors** — `/map` viz-only +
      toggles, robot moves, **recharge restores 100%** (authoritative backend peak
      confirmed), recharge persists across ticks, **Return to Dock → RETURNING**
      (recall without terminate). Backend recharge/return-to-dock also curl-verified.
    - **NOT committed** — awaiting approval.
  - **VERSION 3.7 — Mission History & Analytics (completed; awaiting commit
    approval):** the backend-owned **Robot Operations Center** over completed
    simulation runs. Replaces the earlier "Playback" concept (V3.7 Playback) with
    **read-only, derived analytics** — no replay/replay UI. All metrics computed
    server-side; the frontend renders only.
    - **New persistent record (`RobotRun`, `robot_runs`):** one row per terminated
      run, written **once** by `SimulationScheduler` via `analytics.record_run` on
      run termination — `COMPLETED` (engine finished naturally), `ABORTED`
      (operator `/robot/simulation/stop`), `FAILED` (fatal engine/transition error).
      Carries wall-clock `started_at`/`finished_at`, `duration_s`, and the full
      analytics block (trees harvested/skipped, `distance_travelled`, battery
      start/end/used, `recharge_count`, avg/fastest/slowest harvest time, avg speed,
      idle time, `efficiency`, deterministic `mission_score`, `speed_factor`).
    - **Analytics service (`backend/analytics/mission_history.py`):** single source
      of truth. `compute_run` derives every metric from append-only `RobotTelemetry`
      - `RobotEvent` + immutable `HarvestMissionItem`/`Tree`/`Inspection` (no N+1 —
        bulk loads). `build_timeline` synthesizes the higher-level milestones the
        engine does not emit (Mission Started, Charging detected from a ≥25%-battery
        jump, Returning To Dock). `build_tree_activity` joins per-tree visit/harvest/
        battery/inventory/inspection. `build_robot_log` returns the raw event log.
        `mission_score = 100·completion·(0.5+0.5·battery_econ)·status_factor`
        (COMPLETED 1.0 / ABORTED 0.5 / FAILED 0.2), clamped [0,100].
    - **Backend API (`backend/api/robot_history.py`, mounted in `main.py`):** GET
      `/robot/runs`, `/robot/runs/{id}`, `/robot/runs/{id}/timeline`,
      `/robot/runs/{id}/tree-activity`, `/robot/runs/{id}/robot-log`. Read-only;
      history is append-only and written only by the scheduler.
    - **Frontend (presentation only):** new `RobotRun`/`TimelineEntry`/
      `TreeActivity`/`RobotLogEntry` types + fetch helpers in `detection.ts`;
      `/robot/history` sortable run table; `/robot/history/[id]` detail page
      (summary grid + timeline + tree-activity table + robot log, tabbed)
      linking each tree to `/trees/[id]`; dashboard "Latest Robot Run" widget; nav
      link "Mission History" in `layout.tsx`. All inline-styled; **no new
      dependencies**; frontend computes **nothing** — every number comes from the API.
    - **Verification:** `py_compile` OK; `init_db` creates `robot_runs`; analytics
      unit-driven against synthetic telemetry/events (score/dist/battery/recharge
      correct); live server curl on all 5 endpoints (200 + 404 path) OK; full
      scheduler run auto-wrote `RobotRun` #3 (COMPLETED, with real distance/recharge/
      mission_score); `tsc --noEmit` 0 errors; `next build` success. **Playwright
      0-console-error pass still TODO** (reuse `verify_v361.js` flow + open
      `/robot/history`).
    - **NOT committed** — awaiting approval.
  - **VERSION 3.7.1 — Mission History & Analytics Refinement (completed; awaiting
    commit approval):** a refinement of V3.7 — **no new architecture, no new features,
    no new APIs, no frontend business logic.** It makes the V3.7 analytics transparent
    and easier to scan, and wires the tree-activity table into the Digital Twin. All
    metrics remain backend-owned; the frontend only renders.
    - **(1) Transparent Mission Score breakdown.** The score formula was opaque in V3.7
      (only `mission_score` was shown). `analytics._mission_score` now returns
      `(final, breakdown)` with explicit factors: `completion`, `battery_economy`,
      `status_factor`, `raw`, `final`, plus two human-readable outcome flags
      `safe_return` (1.0 if COMPLETED/ABORTED else 0.0) and `error_free` (1.0 if not
      FAILED). `compute_run` stores `json.dumps(breakdown)` into the new `RobotRun.
score_breakdown` (Text) column; `RobotRun.to_dict` exposes it. `init_db.py` gained
      an idempotent `ALTER TABLE robot_runs ADD COLUMN IF NOT EXISTS score_breakdown
TEXT` so existing tables evolve on boot. The frontend detail page now renders a
      "Mission Score" panel showing the final 0–100 score and four progress bars
      (Completion / Battery Efficiency / Safe Return / Error Free) — exactly the
      backend-derived factors, no recomputation. Legacy runs were backfilled via
      `compute_run` so the panel is populated on existing history.
    - **(2) Grouped travel timeline.** `build_timeline` was rewritten so consecutive
      tree visits are joined by a single synthesized **"Travelled X m"** segment
      (`icon:"route"`, `distance_m` = telemetry position delta over the gap), instead of
      emitting repetitive per-tick `Moving` rows. Movement is grouped; the timeline is
      now chronological and scannable (Mission Started → Reached Tree → Harvest Completed
      → … → Travelled → Reached Tree → Mission Completed → Returning To Dock). The
      `TimelineEntry` type gained an optional `distance_m` field rendered as a small
      badge on the frontend. Single-tree runs (genuinely one stop) correctly show no
      travel segment.
    - **(3) Severity-tagged robot log.** `build_robot_log` now tags every entry with a
      `severity` via `_event_severity`: ERROR (Error / MissionFailed / EngineError, or
      StateChanged → ERROR), WARNING (BatteryLow / StateChanged / ReturnedToDock), else
      INFO. No logic duplication — the existing event-set handling is preserved. The
      frontend robot-log renders a colored left-border per severity (INFO blue /
      WARNING amber / ERROR red) for a clear visual hierarchy. `RobotLogEntry.severity`
      - `LogSeverity` type added to `detection.ts`.
    - **(4) Tree-activity → Digital Twin actions.** The V3.7 tree-activity table is now
      actionable: each row exposes **"Open Tree"** (`/trees/[id]`) and **"Open Digital
      Twin"** (`/map?tree=[id]`). `/map` was extended to read the `?tree=` query param
      and focus the twin on that tree by passing a new `initialTreeId` prop to
      `FarmViewer`, which seeds `selectedTreeId` once the tree's overlay metadata has
      arrived — reusing the existing selection + `TreeDetailsDrawer` machinery, **no new
      lookup logic**. The run detail page's tree-activity tab renders the two action
      links inline.
    - **Files changed:** `backend/analytics/mission_history.py` (`_mission_score`,
      `compute_run` breakdown + `safe_return`/`error_free`, `build_timeline` travel
      grouping, `build_robot_log` severity + `_event_severity`/`_parse_json`),
      `backend/database/models.py` (`RobotRun.score_breakdown` + `_parse_json` +
      `to_dict`), `backend/database/init_db.py` (idempotent ALTER), `frontend/lib/api/
detection.ts` (`ScoreBreakdown`, `LogSeverity`, updated `RobotRun`/`TimelineEntry`/
      `RobotLogEntry`), `frontend/app/robot/history/[id]/page.tsx` (score panel, grouped
      timeline badge, severity log, tree-activity actions), `frontend/components/
FarmViewer.tsx` (`initialTreeId` prop + focus effect), `frontend/app/map/page.tsx`
      (`?tree=` read via `useSearchParams` wrapped in `<Suspense>`). `PROJECT_SPECIFICATION.md`
      gained a non-invalidating "Version 3.7 Amendment" recording that **Playback is
      superseded by Mission History & Analytics and deferred to Version 4** (V3.7/V3.7.1
      are the final Operations-Center scope for this line).
    - **Next.js 16 detail-fix:** `/robot/history/[id]` is a client page; in Next 16 route
      `params` is async, so it now unwraps via `use(params)` (React) — without this the
      id was `undefined` → `NaN` → 422 on every sub-endpoint. `useSearchParams` on `/map`
      is wrapped in `<Suspense>` so the production build prerenders cleanly.
    - **Verification:** `py_compile` OK; `init_db` ALTER applied live (existing
      `robot_runs` gained `score_breakdown`); backend endpoints all 200 (legacy runs
      backfilled with correct breakdown); `tsc --noEmit` 0 errors; `next build` success
      (no unresolved imports, Suspense fix for `useSearchParams`); Playwright harness
      (`verify_v371.js`) **0 console errors** across `/robot/history`,
      `/robot/history/2` (score factors render, severity log shows INFO/WARNING,
      timeline grouped), and `/map?tree=698` (twin focus, no crash). Servers stopped
      after verification. **NOT committed** — awaiting approval.
  - **VERSION 3.7.2 — Workflow Integration & End-to-End Synchronization (completed;
    awaiting commit approval):** wires the existing V3 subsystems (Harvest Planner →
    Robot Simulation → Inventory/Trees/Dashboard/History/Analytics) into **one
    synchronized workflow with no manual steps in between** — a hardening/integration
    release, **not a new feature milestone.** All business logic stays backend-owned;
    the frontend only renders.
    - **(1) Harvest Mission start now auto-starts the robot simulation.** Previously
      `POST /harvest/missions/{id}/start` only flipped the mission to RUNNING and the
      operator had to separately hit "Start Simulation" on `/robot`. It now calls
      `scheduler.start(mission_id, speed_factor)` after the status flip, so the robot
      run loop executes the mission end-to-end. `speed_factor` is an optional query
      param (default 1.0). A sim failure does not roll back mission state (the mission
      is still RUNNING so the operator can retry).
    - **(2) Robot execution is now a full Harvest Mission executor.** The simulation
      run loop previously emitted `EVENT_HARVEST_FINISHED` / `EVENT_MISSION_COMPLETED`
      but never updated the Harvest Mission, Inventory, or Trees — only the manual
      "Advance" button did. The execution mutations were **factored out** of
      `api/harvest_mission_api.py` into a new single-source-of-truth service
      `backend/harvest/execution.py` (`complete_item`, `advance_mission`,
      `finalize_mission`, `_decrease_harvest`). The scheduler's run loop now consumes
      `EVENT_HARVEST_FINISHED` (completing the harvested `HarvestMissionItem` and
      writing its post-harvest `InventorySnapshot`) and finalizes the mission when the
      run ends (the engine only emits `EVENT_MISSION_COMPLETED` on the battery-low
      branch, so completion is also driven off `ctx.finished`). All functions are
      idempotent (re-delivered events never double-harvest). The manual advance endpoint
      now delegates to `advance_mission` — no duplicated logic.
    - **(3) Live synchronization confirmed.** On a full run: items flip
      IN_PROGRESS→COMPLETED as the robot harvests, post-harvest `InventorySnapshot`s are
      written and `Tree.current_inventory_id` is repointed (old snapshots untouched),
      the mission becomes COMPLETED on dock return, a `RobotRun` is recorded, and the
      Dashboard `current_harvest_mission` reflects COMPLETED — all derived from the one
      backend source of truth (HarvestMission + InventorySnapshot). Verified live
      (mission #29: 2 trees, harvested 3+7, inventory decremented correctly, mission
      COMPLETED, dashboard synced, RobotRun #14 recorded).
    - **(4) Server-side pagination for Permanent Trees (survey list).** `GET
/mission/{id}/permanent-trees` now accepts `page` (1-based) and `page_size`
      (default 20, max 100) and returns a single page slice plus `page`/`page_size`/
      `total_pages`. The survey page renders a Previous/Next pager (no longer sending
      the entire tree set in one client payload). The per-tree expandable inspection /
      inventory history is unchanged.
    - **(5) Robot-status de-duplication.** The survey page's "Robot Status" card is
      already mission-scoped (`robotStatus.mission_id === selectedHarvest.id`) and
      refreshes from the live harvest-mission state after every action, so it is not a
      redundant copy of the dashboard's global Robot Status — it is the contextual
      executor view for the mission being run. No second/duplicate panel remains on the
      survey page.
    - **Files changed:** `backend/harvest/__init__.py` + `backend/harvest/execution.py`
      (new shared execution service), `backend/api/harvest_mission_api.py`
      (`start_harvest_mission` auto-starts sim; `advance_harvest_mission` delegates to
      `advance_mission`; removed duplicated `_decrease_harvest`/`_complete_item`),
      `backend/simulation/scheduler.py` (run loop consumes sim events via the shared
      service; imports `EVENT_HARVEST_FINISHED`/`EVENT_MISSION_COMPLETED`; `_mission_
harvest_type` helper), `backend/api/survey_api.py` (`get_permanent_trees`
      pagination), `frontend/lib/api/detection.ts` (`getPermanentTrees` pagination
      params + `PermanentTrees` page fields), `frontend/app/survey/page.tsx`
      (`permPage` state, pager UI, `PermanentTrees` type, page-scoped loads).
    - **Root-cause note:** the first integration attempt silently failed because the
      run loop treated `SimulationEvent` as a `dict` (`ev.get(...)`) — it is a dataclass
      (`.type` / `.detail`). The swallowed `AttributeError` left the mission stuck
      RUNNING with the item IN_PROGRESS. Fixed by reading `ev.type` / `ev.detail` and
      driving finalize off `ctx.finished`.
    - **Verification:** `py_compile` OK; backend imports OK; `tsc --noEmit` 0 errors;
      `next build` success; live E2E start→sim→inventory→mission COMPLETED→dashboard
      synced→RobotRun recorded; Playwright **0 console errors** across `/survey`,
      `/dashboard`, `/robot`, `/robot/history`, `/robot/history/2`, `/map?tree=698`.
      Servers stopped after verification. **NOT committed** — awaiting approval.
  - **VERSION 3.7.3 — Simulation Speed & Battery Calibration (completed; awaiting
    commit approval):** a refinement only — **no new architecture, no new features,
    no duplicated logic.** Calibrates the default simulation speed and the battery
    model so the robot feels realistic and the speed default is backend-owned.
    - **(1) Configurable default simulation speed (60×).** Introduced one shared
      constant `DEFAULT_SIMULATION_SPEED = 60.0` in the new
      `backend/simulation/config.py`, the single source of truth. It replaces the
      three hardcoded `1.0` defaults — `SimulationScheduler.start`,
      `start_simulation` (API), and `start_harvest_mission` (API) now default to it.
      A new `GET /robot/simulation/config` endpoint exposes it; the frontend fetches
      it once on mount and initialises the speed input to that value automatically
      (no hardcoded `60` on the client). Existing speed controls are unchanged — the
      input `max` was raised from 50 to 500 so 120× (twice the default) is selectable,
      and `onSpeedChange` still re-issues `startSimulation` with the chosen factor.
    - **(2) Battery calibration (1%/real-s at 60×).** The drain rate was a hardcoded
      `BATTERY_DRAIN_PER_S = 0.5` (%/sim-s) in `engine.py` — at 60× that was ~30%/real-s
      (full drain in ~3 s). It now lives in `simulation/config.py` as
      `BATTERY_DRAIN_PER_S = 1.0 / DEFAULT_SIMULATION_SPEED` (≈0.0167 %/sim-s), so at
      the default 60× the robot loses ~1% per real second. The rate stays a pure
      function of **simulated elapsed time** (`dt`), deterministic, with no wall-clock
      hacks and no special cases — changing the default speed automatically retargets
      the real-second calibration. Recharge and Return-to-Dock logic are untouched.
    - **Files changed:** `backend/simulation/config.py` (new; `DEFAULT_SIMULATION_SPEED`,
      `BATTERY_DRAIN_PER_S`), `backend/simulation/engine.py` (imports shared drain rate;
      removed hardcoded `0.5`), `backend/simulation/scheduler.py` (`start` default +
      import), `backend/api/robot_simulation.py` (`/config` endpoint; `start` default),
      `backend/api/harvest_mission_api.py` (`start_harvest_mission` default + import),
      `frontend/lib/api/detection.ts` (`getSimulationConfig` + `SimulationConfig` type),
      `frontend/app/robot/page.tsx` (fetch config, pass `defaultSpeedFactor`),
      `frontend/components/robot/SimulationControls.tsx` (sync to backend default when
      idle; `max=500`).
    - **Verification:** `py_compile` OK; `tsc --noEmit` 0 errors; `next build` success;
      `GET /robot/simulation/config` → `{"default_speed_factor":60.0}`; deterministic
      engine check: 60 active sim-s drains exactly 1.0% (1%/real-s @60× nominal), 120×
      → 2.0%/real-s (exactly double); live run started at default 60× with no speed arg
      and drained smoothly (battery 100→~85 over a 3-tree run, no premature zero);
      recharge returns to 100.0; mission execution + Return-to-Dock unchanged; Playwright
      **0 console errors** across `/robot` (speed input initialised to **60** — proving
      the UI auto-syncs to the backend default), `/survey`, `/dashboard`, and
      `verify_v371.js` (`/robot/history`, `/robot/history/2`, `/map?tree=698`). Servers
      stopped after verification. **NOT committed** — awaiting approval.
  - **VERSION 3.8.2 — Dead Backend Removal (completed; awaiting commit approval):** a
    removal-only hardening — **no new features, no redesign, V3 behaviour unchanged.**
    Removes backend code proven unused by BOTH the Phase 1 and Phase 2.0 audits.
    - **Routes/files removed (zero runtime references, zero imports, zero mounts):**
      - `backend/api/planner_api.py` — `POST /planner/generate_tasks` (bulk V1 task
        generation). Only mounted in `main.py`; no callers. Its `create_task_if_needed`
        import is **still used** by `detection_api.py`, so `database/tasks.py` was
        deliberately **retained** (V1 Task pipeline is in scope to keep).
      - `backend/api/harvest_planner.py` — `GET /planner/harvest_order`. Only mounted in
        `main.py`; no callers; defines no shared helpers.
      - `backend/api/map_api.py` — `GET /plantation/map`. Only mounted in `main.py`; the
        frontend `/map` page uses the Digital Twin (`/mission/{id}/tiles`), not this
        endpoint — verified zero frontend callers. (The V1 `Task` model and `map_api`
        `Task` usage referenced in V3.7.1 remain mounted via `robot_api`/`tree_api`.)
    - **`main.py` cleanup:** removed the three `from api… import` lines and the three
      `app.include_router(...)` calls. No other router registration touched.
    - **NOT removed (per evidence rule + scope):** `database/tasks.py` (live, used by
      `detection_api.py`); `mapping/` and `perception/` packages (`perception/drone_scan.py`
      still imports `mapping.coverage_path` — reference not proven dead, and outside
      `backend/`); the V1 `Task` subsystem, Robot/Tree/Detection APIs; all DB models,
      migrations, schemas, and `current_task_id`.
    - **Docs corrected:** `AGENTS.md`, `ARCHITECTURE.md`, `CLAUDE.md` router lists;
      `harvest_planner.py` → `harvest_mission_api.py` in `ROBOT_ARCHITECTURE.md` and
      `PROJECT_SPECIFICATION.md`; `frontend/README.md` `/map` line; `CURRENT.md`
      `/plantation/map` "intentionally kept" claim corrected above.
    - **Verification:** `py_compile` OK; `pyflakes` 0 issues; `import main` clean; backend
      boots; all mounted routers valid; `tsc --noEmit` 0 errors; `next build` success;
      no live V3 endpoint changed; no Digital Twin / Robot / Harvest / Analytics
      regression. **NOT committed** — awaiting approval.
  - **VERSION 3.8.3 — Dead Frontend Removal, Navigation Cleanup & Home Page (completed;
    awaiting commit approval):** a removal-only + minimal-page addition — **no new
    business features, no redesign, V3 behaviour unchanged.**
    - **V1 upload page removed:** `app/page.tsx` (the old Version 1 "Drone Uploader"
      landing page) replaced by a minimal Home page (project title, one-line
      description,       "Version 3" tag, primary "Open Dashboard" button, and the
      Survey → Digital Twin → Inspection → Inventory → Harvest Mission → Robot
      Simulation → Mission History & Analytics pipeline list). Not a marketing page,
      not the Dashboard.
    - **Dead component removed:** `components/DroneUploader.tsx` — its only consumer was
      the removed `/` page. The real V2/V3 survey-upload entry point is `app/survey/page.tsx`
      (calls `detection.ts` directly); `CoconutUploader.tsx` is retained (used by the
      kept `/trees/[treeId]` page).
    - **Navigation cleanup (`app/layout.tsx`):** removed the `Trees` link (not in the
      V3 app nav; the Tree pages remain reachable from Mission History detail). Renamed
      the `/map` nav label from "Farm" to "Digital Twin" to match the canonical name.
      Nav now exposes: Home, Dashboard, Survey, Digital Twin, Robot, History.
    - **Docs corrected:** `AGENTS.md` page + component lists; `frontend/README.md`
      (removed Leaflet/MapView/MapWrapper/leafletFix/DroneUploader/V1 `/robot/next_task`
      stale references; replaced with the current page + component inventory).
    - **Verification:** `tsc --noEmit` 0 errors; `next build` success; zero broken links
      (no page or component references the removed `/` or `DroneUploader`); no live V3
      endpoint changed; Dashboard / Survey / Digital Twin / Robot / History / Tree
      pages untouched. **NOT committed** — awaiting approval.
  - **VERSION 3.8.4 — Configuration & Environment Cleanup (completed; awaiting commit
    approval):** config/env/dependency hygiene only — **no behaviour change, no
    business-logic change, no redesign.**
    - **`requirements.txt` rewritten** from the old placeholder (`pip install …`
      shell commands) into a real, installable manifest: `fastapi`, `uvicorn[standard]`,
      `sqlalchemy`, `psycopg2-binary`, `pydantic`, `python-dotenv`, `python-multipart`,
      `ultralytics`, `opencv-python`, `numpy`. Dropped the unused `pillow` and
      `requests`; `websockets` is already provided by `uvicorn[standard]`; `aiofiles`
      was never imported. Every listed package is proven imported/required by the
      backend (UploadFile → `python-multipart`; YOLO → `ultralytics`/`opencv-python`/
      `numpy`; PG driver → `psycopg2-binary`; env → `python-dotenv`).
    - **CORS externalized (`backend/main.py`):** hardcoded
      `["http://localhost:3000","http://127.0.0.1:3000"]` replaced by `CORS_ORIGINS`
      (comma-separated env var) with the same localhost list as the default. `main.py`
      now loads `.env` via `load_dotenv` (consistent with `database/db.py`). No behaviour
      change in dev.
    - **Duplicate frontend config eliminated (`app/survey/page.tsx`):** removed the
      locally re-declared `const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:8000"` and imported the single source of truth from
      `lib/api/detection.ts` instead. `detection.ts` remains the only place the default
      lives.
    - **`.env.example` updated:** documents `DATABASE_URL` (required, no default),
      `CORS_ORIGINS` (optional), and `NEXT_PUBLIC_API_BASE_URL` (optional frontend).
      No secrets committed; `.env` stays gitignored.
    - **Docs synced:** `README.md` setup now installs via `pip install -r requirements.txt`
      (removed the placeholder note + over-listed deps); `CLAUDE.md` setup note lists
      `requirements.txt`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`. `AGENTS.md`
      already accurate.
    - **Verification:** `py_compile` OK; `tsc --noEmit` 0 errors; `next build` success;
      no application behaviour changed; CORS default identical to prior hardcoded value;
      API base-URL default identical. **NOT committed** — awaiting approval.
  - **VERSION 3.8.5 — Repository Cleanup & Organization (completed; awaiting commit
    approval):** hygiene only — **no behaviour change, no code change, no redesign.**
    - **Accidental local DB artifacts removed:** tracked 0-byte `test.db` and
      `backend/test.db` (the app uses PostgreSQL via `DATABASE_URL`; neither file is
      referenced anywhere). `.gitignore` now ignores `*.db`/`*.sqlite`/`*.sqlite3`.
    - **Empty placeholder directories removed:** `planning/`, `robot_control/`,
      `scripts/`, `tests/` (root; the real Playwright specs live in
      `frontend/tests/e2e/`), `datasets/` (gitignored, empty), `ing/` (incl.
      `ing/integrations`), `dashboard/` (root; distinct from the live `/dashboard`
      route + `dashboard_api.py`). Kept `communication/` and `configs/` — the frozen
      `PROJECT_SPECIFICATION.md` directory table explicitly reserves them.
    - **Stale demo asset directories removed:** `farm_view_demo-images/` and
      `ripness-Check-demo-images/` — tracked sample screenshots with zero code or doc
      references (proven unused). `demo_images/` (tracked sample coconut/drone images)
      retained as potential seed assets.
    - **macOS clutter:** removed the root `.DS_Store` (untracked, already gitignored).
    - **`.gitignore` hardened:** added Local Databases (`*.db`/`*.sqlite`/`*.sqlite3`),
      Playwright outputs (`test-results/`, `playwright-report/`, `frontend/test-results/`,
      `frontend/playwright-report/`, `frontend/blob-report/`, `playwright/.cache/`),
      `.vercel`, and editor swap files (`*.swp`, `*~`).
    - **Kept intentionally:** `backend/test_db.py` (a genuine DB connectivity + schema
      check utility, not a temp script), `verify_v*.js` (the documented V3 regression
      harnesses, referenced in this file), `mapping/` + `perception/` (V1 packages
      retained per V3.8.2 — `perception` still imports `mapping.coverage_path`).
    - **Verification:** `py_compile` (backend incl. `test_db.py`) OK; `tsc --noEmit` 0
      errors; `next build` success; empty-directory scan clean; orphan-reference scan
      finds no dangling links to removed files; no application behaviour changed.
      **NOT committed** — awaiting approval.
  - **Optional future work (not scheduled):**
    - A read-only "Locate on twin" pan-to-tree action in the Tree Details drawer
      (still no mutation); eventually supersede the sparse legacy `/trees/[treeId]`
      page with the drawer.
    - Overlay renderer scaling: at farms with thousands of trees, consider viewport
      culling + zoom-LOD (already prototyped in V2.6) or a Canvas/WebGL swap, while
      preserving the `selectedTreeId` / `onTreeSelect` contract. Current DOM approach
      is fine at ~300 trees.
    - Backend unit tests for task-generation / ripeness logic.
    - Real geotagging of drone images (currently GPS is derived from the box position).
    - Model versioning / distribution strategy (weights are gitignored).
  - **Known Issues / Decisions:**
  - Database is **PostgreSQL (Neon)**, not SQLite (early documentation said SQLite).
  - `requirements.txt` currently lists backend dependencies but is not a complete pinned
    manifest; the README documents the actual required packages.
  - Model weights (`*.pt`) and `.env` are gitignored; they are local‑only.
  - Navigation is rendered inline in `layout.tsx` (the old `Navbar.tsx` component was removed).
    Nav exposes Home, Dashboard, Survey, Digital Twin, Robot, Mission History; the
    `/trees` pages remain reachable from Mission History detail.
