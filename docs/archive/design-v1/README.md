# ARCHIVED — design-v1 (OUTDATED)

> **Status: ARCHIVED / SUPERSEDED — DO NOT USE AS A DESIGN SOURCE OF TRUTH.**

These documents (written July 2025) describe the **original "tropical-dark" design
direction** for the Veraxis UI (dark canopy theme, cyan `#3FB8B0` accent, and the
v1 component philosophy).

They are **outdated**: the implementation diverged from them early (the shipped UI is a
light "fresh agriculture" theme with a leaf-green accent) and they were never kept in
sync with the many design changes made since.

They are retained here **for historical reference only**.

- Current design source of truth: the implemented code itself
  (`frontend/app/globals.css` design tokens + the live pages/components).
- A fresh UI/UX audit and a new design system are being produced to replace these docs
  (see `docs/UI_UX_AUDIT.md` when it lands).
- Only true constraints that still carry over from this era are the *functional* ones in
  `AGENTS.md` §8 (frozen APIs, `detection.ts` exports, `computeMosaicLayout`,
  Playwright `data-testid`s, user flows) — not any visual direction in these files.

## Contents (as archived, unmodified)

| File | Was |
|---|---|
| `01-design-constitution.md` | Product identity, philosophy, anti-slop bans |
| `02-brand-strategy.md` | Naming, voice, logo direction |
| `03-visual-style-guide.md` | Tropical-dark tokens, type, spacing (outdated) |
| `04-motion-language.md` | Motion/easing principles |
| `05-storyboard.md` | Landing storyboard |
| `06-shot-list.md` | Asset shot list |
| `07-page-ux-strategy.md` | Per-page UX intent |
| `08-component-philosophy.md` | Component specs (outdated) |
| `09-asset-generation-strategy.md` | Clip/asset generation plan |
| `10-google-flow-guidelines.md` | Google Flow asset tooling guide |
