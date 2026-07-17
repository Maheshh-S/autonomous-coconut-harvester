# 03 — Visual Style Guide

> The complete visual language for ARECA. Implements `01-design-constitution.md` §5–§9 and
> `02-brand-strategy.md`. This is the document a future implementer reads to build pixels.
> No code yet.

---

## 0. Rejecting the generic default (read this first)

The UI/UX Pro Max design-system tool, run unguided on this product, returned
**"Modern Dark (Cinema Mobile)" + terminal-green `#00FF41` + alert-red `#FF3333` + Inter**.
That is the *exact* AI-default the v1 rejection warned against: a "dark tech" SaaS with
neon green, red alerts, and Inter. **We explicitly reject that output.** It fails the
constitution's identity test (§1) and several bans (§10: Inter, neon/glow, pure-green
accent). The tokens below are the deliberate, defensible replacement — a *tropical-dark*
system rooted in the plantation, not in hacker-terminal cliché.

---

## 1. Typography

### 1.1 Principle
Not Inter by default (taste-skill §4.1). Pick a display sans with an industrial/agricultural
calm and a mono for data. Self-host via `next/font` (never `<link>` Google Fonts in prod —
taste-skill §3.A).

### 1.2 Recommended pairing
- **Display / UI sans:** **Geist** (or **Satoshi** / **Outfit** as alternate). Geometric,
  neutral, technical — reads as "precision instrument," not "friendly startup."
- **Data / code / coordinates mono:** **Geist Mono** (or **JetBrains Mono**). Used for
  tree codes (`TREE-0698`), GPS, battery %, counts — tabular figures mandatory
  (emil: "Tabular numbers — fixed-width digits so numbers don't shift").
- **No serif as default** (taste-skill §4.1 serif discipline). If a serif is ever needed
  (e.g. a long-form story paragraph), it must be justified per the skill and is out of
  scope for v1 UI.

### 1.3 Scale & rhythm (size-specific, apple-design §15)
- Base: **16px**, body line-height **1.5**.
- Display: `clamp(2rem, 5vw, 3.5rem)`, line-height **1.05**, letter-spacing **-0.02em**
  (tighten as it grows).
- Body: letter-spacing **~0**; small labels slightly positive (+0.02em) for legibility.
- Emphasis via **weight + italic of the same family**, never a random serif injected into a
  sans headline (taste-skill §4.1).
- Min body text **12px**; never gray-on-gray (ui-ux-pro-max §6).

### 1.4 Loading / counting numbers
Use **tabular (`font-variant-numeric: tabular-nums`)** for all metrics, GPS, battery,
counts. Counters animate with `MetricCounter` (see `08`).

---

## 2. Grid & Spacing

- **Container:** `max-w-[1400px] mx-auto`, `px-4` mobile → `px-8` desktop (taste-skill §3.E).
- **Breakpoints:** `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536` (taste-skill §3.E).
- **Layout engine:** CSS Grid, never flex-percentage math (taste-skill §3.E).
- **Spacing scale (dense app, dashboard-grade):** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
  Dashboards lean denser than marketing (VISUAL_DENSITY ~7, taste-skill dials).
- **Min-height:** heroes use `min-h-[100dvh]`, never `h-screen` (mobile address-bar jump —
  taste-skill §3.E).

---

## 3. Alignment & Composition

- **Anti-center bias** (DESIGN_VARIANCE ~7, taste-skill §4.3): heroes are split / asymmetric,
  not centered H1-over-blob. e.g. left headline + right HeroVideo; or full-bleed video with
  a lower-third text block.
- **One focused message per section** (taste-skill §4.7 split-header ban): headline + body
  stacked, max-width 65ch; the right column carries a *visual*, not filler text.
- **Bento rhythm, not repetition** (taste-skill §4.7): when a grid is used, vary cell sizes
  and at least 2–3 cells carry real imagery/photography, not text-on-text. Exactly as many
  cells as content (no empty tile).
- **Section-layout variety** (taste-skill §4.7): a page with N sections uses ≥4 distinct
  layout families. No two sections share a family.
- **Zigzag cap:** max 2 consecutive image+text splits; break with full-width / bento /
  marquee (taste-skill §4.7).

---

## 4. Corner Radius & Shape

- **One radius scale, locked** (taste-skill §4.4 shape-consistency):
  - Cards / panels: **12px**
  - Inputs / chips: **8px**
  - Buttons (primary): **full pill** (`9999px`) — interactive elements read as "pressable"
  - Icon buttons / FABs: **full circle**
- Mixed but *ruled*: buttons pill, cards 12, inputs 8. Followed everywhere.

---

## 5. Depth & Elevation

- **No pure-black shadows.** Tinted to the background hue (taste-skill §4.4).
- Elevation via **layered near-black values**, not glow:
  - `--surface` `#161b16` (canopy near-black, green cast)
  - `--surface-raised` `#1d241d`
  - `--surface-sunken` `#10140f`
- Shadow: `0 1px 0 rgba(255,255,255,0.04) inset` (top edge light) + `0 8px 24px
  rgba(0,0,0,0.35)` tinted. Subtle, physical (apple-design §12).
- **Cards only when elevation communicates hierarchy** (taste-skill §4.4). Group related
  items with `divide-y` / border-t / negative space first.

---

## 6. Glass Usage (restrained)

Allowed **only** as a floating functional layer over moving imagery (HeroVideo, twin),
per apple-design §12 + taste-skill §5:
- `backdrop-filter: blur(20px) saturate(160%)` + `rgba(...,0.6)` bg + **1px inner border**
  `rgba(255,255,255,0.08)` + inner top highlight.
- **Solid fallback** under `prefers-reduced-transparency` (apple-design §14).
- **Never** the default card material. Default cards are matte `--surface`.

---

## 7. Photography & Video

- **The product is photographed, not illustrated.** Real plantation footage from
  `assets/clips/` (Google Flow, see `10`) and real survey tile imagery from the backend.
- Heroes **must** have a real visual (taste-skill §4.8) — a clip, never a gradient blob.
- Treatment: documentary, golden-hour/soft-morning, natural grain, no neon grade.
- Photographic backdrops behind text get a **scrim** (gradient or solid 60%+) so text passes
  AA (taste-skill §4.5 CTA contrast).

---

## 8. Illustration & Diagram Style

- **Diagrams** (route, state machine, mission flow) are the only "illustration": thin-stroke
  technical line art in the accent or cream, on `--surface`. Constructed in SVG via a real
  chart/icon approach — not hand-drawn doodles.
- **No hand-rolled decorative SVG** beyond the leaf-reticle mark (constitution §10,
  taste-skill §3.C). Diagrams built from primitives or a lib.

---

## 9. Iconography

- **Library:** one family. Recommended **Phosphor Icons** (`@phosphor-icons/react`) for its
  technical, weighty set; **Tabler** as alternate. (Lucide discouraged — taste-skill §3.C.)
- **Standardize `strokeWidth`** globally (e.g. `1.5`).
- **Never hand-roll SVG icons** (taste-skill §3.C, ui-ux-pro-max p4). Missing glyph → add a
  second lib or compose, don't draw paths.
- Icon-only controls get `aria-label` (constitution §6.5).
- Domain-appropriate glyphs: drone, scan/crosshair, tree/palm, robot/climber, route,
  battery, map/tile, leaf, harvest/basket.

---

## 10. Color Palette (tropical-dark)

> All values off-black/off-white (no pure #000/#fff). Accent is functional (live/active/
> scan), used sparingly. Saturation kept < 80% on neutrals.

### 10.1 Tokens
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0e120d` | page background (canopy near-black, green cast) |
| `--surface` | `#161b16` | cards / panels |
| `--surface-raised` | `#1d241d` | popovers, raised chips |
| `--surface-sunken` | `#10140f` | insets, code blocks |
| `--border` | `#2a322a` | hairline dividers / input rings |
| `--text` | `#E8EDE6` | primary text (warm off-white) |
| `--text-muted` | `#9aa89a` | secondary (≥4.5:1 on `--surface`) |
| `--accent` | `#3FB8B0` | **drone-scan cyan-teal** — live/active/scan/primary action ONLY |
| `--accent-weak` | `#1d3b39` | accent tint backgrounds (selected tree halo, scan zone) |
| `--leaf` | `#6F9A4D` | leaf green — health/positive/mature |
| `--husk` | `#C9B78A` | coconut-husk cream — warmth, secondary highlights |
| `--warn` | `#D8A24A` | amber — selected tree, attention (NOT red alert) |
| `--danger` | `#C25B4E` | error/destructive only (rare) |

### 10.2 Rules
- **One accent per page** (taste-skill §4.2 color-lock): cyan is THE accent. Leaf/husk/warn
  are *semantic status* colors, not competing accents. A page does not suddenly introduce a
  blue badge in the footer.
- **Cyan = machine-is-seeing.** Selected tree halo, live robot, active scan, primary CTA.
  Nothing else gets cyan.
- **No glow.** Accent appears as solid fill / ring / text, never outer-glow (taste-skill §9.A).
- **Contrast verified:** `--text` on `--bg` ≈ 15:1; `--text-muted` on `--surface` ≥ 4.5:1;
  cyan text only on dark, AA-checked.
- **Theme lock:** single dark theme, no section inverts (taste-skill §4.11).

---

## 11. Lighting & Texture

- **Lighting:** soft, directional, natural. UI surfaces read as matte under diffuse light.
- **Texture:** subtle, real — a faint photographic grain *only* on fixed `pointer-events-none`
  overlays (taste-skill §6.E), never on scrolling containers. Default: none; cleanliness wins.
- **No fake-noise gradient meshes** as decoration (taste-skill §9.A, §2.B aurora ban).

---

## 12. Logo Tokens

- Leaf-reticle mark: monochrome `--text` or `--accent` (never gradient).
- Wordmark: `--text`, display sans, tracking `-0.02em`, no gradient text (constitution §10).
- Clear-space: mark height ≥ 1.5× around; min render 20px.

---

## 13. Implementation notes (for later)

- Tailwind v4 CSS-first: define tokens as `@theme` / CSS vars in `globals.css`; do **not**
  hardcode hex in components (ui-ux-pro-max §6).
- One `strokeWidth` and one radius scale enforced via tokens.
- `next/font` for Geist + Geist Mono; `tabular-nums` utility on all numeric components.

---

*Next: `04-motion-language.md` — timing, easing, scroll rhythm, micro/hover, loading,
transitions, GSAP + Motion strategy, and when NOT to animate.*
