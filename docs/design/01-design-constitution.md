# 01 — Design Constitution

> The single source of truth for every visual, interaction, and motion decision in ARECA.
> This is a planning document. No code, no UI changes, no asset generation. It defines
> *what* ARECA must feel like and *why*. Implementation begins only after approval.

---

## 0. Why this document exists

The previous redesign (v1 UI) was rejected at **3/10**. Engineering was sound; **visual
quality failed**. It read as a generic AI dashboard: interchangeable cards, gradient glow,
scattered icons, no identity. The failure was not a missing feature — it was the absence of
a *design point of view*. This constitution is that point of view. Every later document
(`02`–`10`) and every component, page, color, and clip must be defensible against it.

---

## 1. Product Identity

ARECA is an **Autonomous Coconut Harvesting Platform**.

It is not:
- a generic AI tool
- a SaaS analytics app
- warehouse / factory automation
- humanoid robotics
- cyberpunk "mission control"
- a drone toy

It *is* a precision-agriculture system that fuses:
- **AI + Computer Vision** (YOLO tree & coconut-ripeness detection)
- **Drone Surveying** (planned, GPS-anchored boustrophedon flights)
- **GPS Mapping** (tile geometry, farm-pixel coordinate system)
- **Digital Twin** (the surveyed plantation reconstructed as a living mosaic)
- **Tree Detection & Health** (permanent `Tree` records, observations, inventory)
- **Coconut Maturity Detection** (mature / potential / premature)
- **Autonomous Mission Planning** (Nearest-Neighbour harvest routes)
- **Tree-Climbing Robot** (a purpose-built harvester, not a humanoid)
- **Farm Analytics** (mission history, yield, battery, coverage)

**The identity test (mandatory):** if every word were removed from the interface, a viewer
should still understand — from visuals alone — that this is a system for autonomously
harvesting coconuts from a plantation using drones, computer vision, and a climbing robot.
If it could be mistaken for a fintech dashboard, it has failed.

---

## 2. Design Philosophy

1. **Identity over decoration.** Every visual decision earns its place by reinforcing the
   coconut-plantation / autonomous-harvest identity. Decoration that does not is removed.
2. **Backend owns logic, frontend owns craft.** Per `AGENTS.md`, all business rules live in
   the backend. The UI's job is to make that logic *legible and beautiful*, never to recompute
   it. (This is why the Farm Viewer, `computeMosaicLayout`, `detection.ts`, and Playwright
   `data-testid`s are frozen contracts — see §9.)
3. **Calm authority.** This is an industrial system operating real machinery. The interface
   should feel composed, precise, and trustworthy — not playful, not noisy, not sci-fi.
4. **Documentary realism.** The product's subject is the real world: soil, fronds, bark,
   drones, a climbing robot. Photography and video must look *shot on a real plantation*,
   not rendered as neon concept art.
5. **Restraint is the brand.** Premium is what you *remove*. Fewer, better-chosen surfaces.
   One accent. One type voice. One timeless dark theme.

---

## 3. Emotional Goals

| Moment | Feeling we want |
|---|---|
| First landing | "This is a real, serious autonomous farming system — and it's beautiful." |
| Dashboard | Calm situational awareness. "I know what the farm is doing right now." |
| Survey | Discovery. "The drone is seeing the plantation for me." |
| Digital Twin | Recognition. "That's my farm, exactly as it is." |
| Robot | Confidence. "The machine is doing the work, correctly." |
| History | Closure. "The work is done, here's the proof." |
| Trees | Care. "Each tree is known, monitored, healthy." |

We do **not** want: awe-for-its-own-sake, flashiness, or "look how much AI we used."

---

## 4. Brand Personality

A senior agronomist-engineer. Precise, warm about the land, unsentimental about data.
Speaks in plain language. Trusts the work to speak. Never markets at you.

Voice axes:
- **Tone:** direct, factual, quietly confident.
- **Vocabulary:** plantation, tree, drone, survey, twin, mission, robot, harvest, maturity.
  Avoid: "leverage", "supercharge", "seamless", "smart" (as filler), "powerful".
- **Numbers:** real or explicitly mocked. No invented precision (taste-skill §4.9).

---

## 5. Visual Language

### 5.1 The world, not the dashboard
The dominant visual motif is the **plantation itself** — aerial fronds, dappled light,
drone views, the climbing robot, tree-close inspection. UI chrome (panels, nav, controls)
is deliberately recessive so the world shows through. The interface is a *window onto the
farm*, not a frame around widgets.

### 5.2 Tropical-dark, not "dark mode"
One timeless dark theme, no light/dark toggle (per brief). The dark is the **deep shade
under a coconut canopy at dusk**: near-black with a green-charcoal cast, not pure black,
not slate. Warm earth and leaf tones sit on top. This is distinct from the cold
`zinc-950`/`slate` SaaS default.

### 5.3 One accent, functional not decorative
A single accent derived from the **drone survey scan** — a cool cyan/teal that reads as
"machine vision seeing the world." It is used *only* for live/active/scanning state and
primary actions, never as a glow. (Full tokens in `03-visual-style-guide.md`.)

### 5.4 Material honesty
- Surfaces are matte, not glassy-by-default. Glass (backdrop-blur) is permitted *only* as a
  floating functional layer over moving imagery (e.g. video hero, twin), with a 1px inner
  border and solid fallback — never as the default card material (taste-skill §5, apple-design §12).
- Depth comes from layered near-black values + a single tinted shadow, not from glow or
  neon (taste-skill §9.A).

---

## 6. Accessibility Principles

1. **Contrast:** text ≥ 4.5:1 (AA), large display ≥ 3:1. Never gray-on-gray. Never pure
   `#000`/`#fff` (use off-black/off-white — apple-design §8.B, taste-skill §9.A).
2. **Motion:** `prefers-reduced-motion` is mandatory. All motion above low intensity
   collapses to opacity cross-fades / static (emil §Accessibility, apple-design §14).
3. **Transparency:** `prefers-reduced-transparency` gets solid surfaces (apple-design §14).
4. **Contrast (more):** supported with defined borders, not near-solid-on-near-solid.
5. **Keyboard & labels:** focus rings visible; icon-only controls carry `aria-label`;
   no icon-without-label buttons (ui-ux-pro-max priority 1).
6. **Type:** base 16px, body line-height 1.5; semantic color tokens, never raw hex in
   components (ui-ux-pro-max priority 6).

---

## 7. UX Principles

1. **One question per page** (the axiom from the brief):
   Landing→*What is ARECA?* · Dashboard→*What is happening on the farm?* ·
   Survey→*What did the drone discover?* · Twin→*What does the plantation look like now?* ·
   Robot→*What is the robot doing?* · History→*What happened previously?* ·
   Trees→*What is the condition of every tree?*
   Every page leads with the answer to its question. Secondary content supports, never competes.
2. **Wayfinding** (apple-design §16): every screen answers Where am I / Where can I go /
   What's here / How do I get out. Nav is a single line on desktop (taste-skill §4.7).
3. **Preserve frozen architecture:** Farm Viewer → OverlayLayer → TreeDetailsDrawer
   separation stays intact. The twin is the *single* farm viewer.
4. **Real states, not happy-path-only** (taste-skill §4.5): loading (skeleton matching
   final shape), empty (composed, with a path to populate), error (inline, clear).
5. **Specific labels** (apple-design §16): name nav for contents ("Survey", "Trees"), not
   umbrellas ("Home", "Tools").

---

## 8. Interaction Principles

1. **Response on press, not release** (apple-design §1): `:active` gives instant
   `scale(0.97)` feedback. No dead buttons.
2. **Spatial consistency** (apple-design §7): enter/exit along the same path; drawers
   originate from their trigger; pages transition with direction.
3. **Interruptibility** (apple-design §3): anything a user can grab mid-flight (drawers,
   sheets) uses springs that retarget from the live value — never locked-out transitions.
4. **Motion has a job** (emil §1, taste-skill §5): orient, give feedback, show relationship,
   or tell the story. "It looked cool" is not a valid reason.
5. **Frequency governs intensity** (emil §1): actions repeated 100×/day get *no* animation
   (e.g. command-palette, keyboard nav). Rare moments (onboarding, mission complete) may
   carry delight.
6. **Don't animate keyboard actions** (emil §Review): never animate things used hundreds
   of times a day.

---

## 9. Design Rules (hard constraints)

### 9.1 Frozen backend / contract (do not change)
- All backend APIs, routes, schemas.
- `frontend/lib/api/detection.ts` exports.
- `computeMosaicLayout` farm-pixel transform (`frontend/lib/mosaicLayout.ts`).
- Playwright `data-testid`s.
- User flows and page routes.
- FarmViewer / OverlayLayer / TreeDetailsDrawer separation of concerns.

### 9.2 Theme
- One timeless **dark** theme. No light/dark toggle.

### 9.3 Toolkit
- Icons: a **real library** (Phosphor or Tabler), one family, standardized `strokeWidth`.
  **Never hand-roll SVG icons** (taste-skill §3.C).
- Fonts: **not Inter by default** (taste-skill §4.1). A display sans + mono pairing chosen
  for the plantation/industrial voice (see `03`). Self-host via `next/font`.
- Animation: GSAP + Lenis for scroll/canvas work; Motion (`motion/react`) for component
  transitions. Single shared easing curve (see `04`).

---

## 10. Forbidden (the anti-slop list)

Directly from the rejection + the five design skills. Any of these fails the constitution:

- ❌ Generic AI dashboard look (interchangeable cards, "AI-purple" glow, mesh-gradient hero).
- ❌ Gradient **text** on large headers (taste-skill §9.A).
- ❌ Side-stripe accent borders on cards (taste-skill AI-tell).
- ❌ Identical 3-up / N-up card grids with no rhythm (taste-skill §4.7 bento rules).
- ❌ Eyebrow-on-every-section (max 1 per 3 sections — taste-skill §4.7).
- ❌ Hero-metric template ("4.1× faster" fake-precision — taste-skill §4.9).
- ❌ Glassmorphism as the *default* material (taste-skill §5, apple-design §12).
- ❌ Emoji as icons (taste-skill §3.D).
- ❌ **Hand-rolled SVG icons** (taste-skill §3.C, ui-ux-pro-max priority 4).
- ❌ Inter as the default typeface (taste-skill §4.1).
- ❌ Cyberpunk / neon / outer glow / scanline aesthetics (taste-skill §9.A).
- ❌ Generic, humanoid, warehouse, or factory-robotics imagery (product identity).
- ❌ Pure `#000000` / `#ffffff` (taste-skill §9.A, apple-design §8.B).
- ❌ Animation without a stated purpose (emil §1, taste-skill §5).
- ❌ `ease-in` on UI (emil §3); animating `width/height/top/left` (emil §Perf, taste-skill §6.A).
- ❌ Ignoring `prefers-reduced-motion` (mandatory — emil, apple-design §14).
- ❌ `window.addEventListener("scroll", …)` for motion (taste-skill §5.D) — use
  Lenis + GSAP ScrollTrigger / IntersectionObserver / Motion `useScroll`.

---

## 11. The "why" behind the bans

The v1 rejection proved the pattern: an LLM, left to its defaults, produces the *same*
interface for any prompt — Inter + slate-900 + purple glow + three cards. That is the
tell. ARECA's entire value is that it is a *specific* physical system in a *specific* world.
The bans exist so the design cannot collapse into the generic. Each forbidden item is a
known AI-default that erases identity. Replacing it requires a deliberate, defensible
choice — which is the whole point of craft (impeccable: "evidence before claiming done").

---

## 12. How this constitution is enforced

- Every later doc (`02`–`10`) cites the relevant section here.
- Every component in `08-component-philosophy.md` must pass §10.
- The improved `assets/prompts/` set must read as one documentary film consistent with §5.
- Before any implementation, run the taste-skill pre-flight + emil review table against the
  built UI. Zero forbidden patterns is the acceptance bar (alongside 0 console errors).

---

*Next: `02-brand-strategy.md` — naming, voice, and the logo direction that makes the
identity unmistakable without text.*
