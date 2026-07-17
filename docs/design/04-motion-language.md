# 04 — Motion Language

> Implements constitution §8 (interaction) + emil-design-eng + apple-design + animation-
> vocabulary. Defines how ARECA moves. No code yet. All motion is OPTIONAL until approved
> and must honor `prefers-reduced-motion`.

---

## 1. Animation Philosophy

Motion is a **service**, not a style. Every animation answers "why does this move?"
(emil §1, taste-skill §5). Valid reasons: orient, give feedback, show relationship, tell the
story. "It looked cool" is rejected.

The brand moves like the **machinery it depicts**: steady, deliberate, machine-precise.
A drone doesn't jitter; the climbing robot doesn't rush. Calm authority (constitution §3).

---

## 2. Motion Hierarchy (what gets motion, and how much)

| Tier | Frequency | Treatment |
|---|---|---|
| **Ambient** (hero video, twin) | always | real footage; loops seamlessly; no UI animation needed on top |
| **Entry / reveal** | on scroll, once | subtle fade + 8–16px rise, staggered 30–60ms |
| **Feedback** (press, hover) | tens×/day | 100–160ms scale/color, ease-out |
| **State change** (drawer, modal, toast) | occasional | 200–300ms, origin-aware |
| **Story** (mission progress, robot path) | rare | scroll-driven / continuous, purposeful |
| **Keyboard actions** (palette, nav) | 100×/day | **NO animation** (emil §1) |

---

## 3. Timing

- **UI feedback:** 100–160ms (emil table). Press `scale(0.97)` at 100–160ms ease-out.
- **Small popovers / tooltips:** 125–200ms.
- **Dropdowns / selects:** 150–250ms.
- **Drawers / modals:** 200–500ms (drawer springs: damping 1.0, response 0.3 — apple-design §4).
- **Marketing / explanatory / story:** can be longer, but still intentional.
- **Rule:** UI animation stays **under 300ms** (emil §4). Faster feels more responsive.
- **Frequency governs intensity** (emil §1): repeated actions → shorter/subtler/none.

---

## 4. Easing (custom curves, not defaults)

Built-in CSS easings are too weak (emil §3). Define once, reuse:

```css
--ease-out:        cubic-bezier(0.23, 1, 0.32, 1);   /* strong ease-out, UI feedback */
--ease-in-out:     cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement */
--ease-drawer:     cubic-bezier(0.32, 0.72, 0, 1);   /* iOS-like sheet (apple-design §3) */
```

- **Enter/exit of UI → ease-out** (responds instantly).
- **Moving on screen → ease-in-out.**
- **Hover/color → ease.**
- **Constant (marquee, progress) → linear.**
- **Never `ease-in`** on UI (feels sluggish — emil §3).
- **Asymmetric** curves feel more alive than symmetric (animation-vocabulary: Asymmetric easing).

---

## 5. Scroll Rhythm (Lenis + GSAP, one clock)

- Use **Lenis** for smooth scroll + **GSAP ScrollTrigger** as the single motion clock
  (MotionSites principle: one clock, never `window.addEventListener("scroll")` —
  taste-skill §5.D bans it).
- Smooth scroll is **subtle** (lenis `lerp ~0.1`), not slippery — this is an industrial tool.
- **Scroll reveal:** `whileInView` (Motion) or ScrollTrigger; fade + `y: 12–16`; stagger
  30–60ms; `once: true`, `amount: 0.3`. Never block interaction during reveal.
- **Canvas frame-scrub:** hero/twin video scrubbed to scroll only where it serves the story
  (MotionSites `vanilla-film` pattern) — optional, gated by reduced-motion.

---

## 6. Micro-interactions

- **Press:** `scale(0.97)` on `:active`, `transition: transform 100–160ms ease-out`
  (emil, apple-design §1). Applies to every pressable element.
- **Hover (pointer-only):** gate behind `@media (hover: hover) and (pointer: fine)`
  (emil §Accessibility) — touch taps must not trigger false hover.
- **Hover on tree box / card:** subtle border lighten + 1px lift (`translateY(-1px)`), NOT a
  glow. 150ms ease.
- **Selected tree (twin):** amber (`--warn`) persistent ring — state, not animation.
- **Skeleton:** shape matches final layout (taste-skill §4.5); subtle shimmer optional, low-opacity.

---

## 7. Hover Interactions

- Color/border transitions only; **no scale-up of whole cards** (reads as slop). Max a 1px
  lift + border brighten.
- Icon buttons: background fill from `--surface` → `--surface-raised`, 150ms.
- Links: accent underline draw-in via `clip-path` or `scaleX` transform (emil §clip-path),
  origin-aware (left).

---

## 8. Loading Choreography

- **Skeletons** shaped like the content (twin mosaic skeleton = grid of tile rects; tree list
  = row skeletons). Not spinners.
- **Mission start:** a single, calm "mission running" state — the robot marker begins moving
  on the twin. No celebratory burst.
- **Empty states:** composed, with a clear path to populate (e.g. "No survey yet — upload
  drone footage"). Never a dead void.

---

## 9. Page Transitions

- **Direction-aware** (animation-vocabulary: Direction-aware transition): forward nav slides
  new page in from the right; back slides from the left (apple-design §7 spatial consistency).
- Implement via the Next.js View Transitions API or Motion `layoutId` shared elements —
  prefer the browser `view-transition` where supported.
- Duration 250–300ms ease-out; shared elements (e.g. a tree card → tree detail) use a
  **shared element transition** (animation-vocabulary) to keep identity across routes.
- **Never** a full fade-of-everything that loses the user's place.

---

## 10. GSAP Strategy

- **Use GSAP for:** scroll-pinned story sections, canvas frame-scrub, twin parallax (rare),
  scroll-driven route reveal. Not for simple component transitions.
- **One clock with Lenis** (§5). Register plugins once; `gsap.context()` + `ctx.revert()`
  cleanup in `useEffect` (taste-skill §5.A/B).
- **Sticky-stack / horizontal-pan** only if a page genuinely needs scroll-hijack — and only
  with `start: "top top"`, `pin: true` (taste-skill §5.A/B). Used sparingly.
- **Reduced-motion:** all GSAP gated by `useReducedMotion()`; collapse to static.

---

## 11. Framer Motion / Motion Strategy

- **Use Motion (`motion/react`) for:** component enter/exit, drawers, modals, toasts,
  stagger reveals, shared-element transitions, press feedback.
- **Spring for interruptible UI** (apple-design §3/§4): drawer `spring, damping:1.0,
  response:0.3`; momentum flick `damping:0.8`. Bounce subtle (0.1–0.3).
- **Hardware acceleration:** animate `transform`/`opacity` only (emil §Perf). For
  Motion under heavy load, prefer the full `transform` string over `x`/`y` shorthands
  (emil §Framer caveat).
- **`useScroll`/`useMotionValue`** for scroll-linked values — never `useState` for
  continuous scroll/pointer (taste-skill §3.B).

---

## 12. When Motion Should NOT Be Used

- Keyboard-initiated actions (palette, command nav) — zero animation (emil §1).
- Any element seen 100×/day where motion adds no info.
- `prefers-reduced-motion: reduce` → replace slides/springs/parallax with opacity
  cross-fades / static; keep color/opacity that aid comprehension (apple-design §14, emil §Accessibility).
- `prefers-reduced-transparency: reduce` → solid surfaces, no blur (apple-design §14).
- When it would delay perceived response (apple-design §1): respond on press, not release.
- Decoration with no stated purpose — cut it (constitution §10, taste-skill §5).

---

## 13. Motion QA checklist (acceptance)

- [ ] Every animation has a stated purpose (orient/feedback/relationship/story).
- [ ] UI durations ≤ 300ms; feedback 100–160ms.
- [ ] Custom easing used; no `ease-in` on UI; no `transition: all`.
- [ ] `transform`/`opacity` only; no `width/height/top/left` animation.
- [ ] `prefers-reduced-motion` collapses to cross-fade/static.
- [ ] Hover gated behind `hover: hover and pointer: fine`.
- [ ] No `window.addEventListener("scroll")`; Lenis + ScrollTrigger / IntersectionObserver only.
- [ ] Springs retarget from live value (interruptible drawers/sheets).
- [ ] Press feedback `scale(0.97)` present on all pressable elements.

---

*Next: `05-storyboard.md` — the page-to-page emotional arc and transition logic.*
