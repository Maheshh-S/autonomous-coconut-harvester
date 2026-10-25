# Report Content Map — locked section ↔ figure wiring

This is the master wiring document. The figure plan is **LOCKED** (user
directive, 2026-10-25): no "optional/maybe" placements. Every figure file is
either **IN** (placed in the report, in the exact position listed) or **SPARE**
(captured/copied but NOT placed — held as backup). Chapters 1, 2 and 6 contain
**no figures** — clean prose/tables only, exactly like the guide-approved
college sample.

Figure numbers are **mapping keys only** (see §0). File locations:
`list-of-figures.md`.

## 0. Numbering policy

The current figure numbers (Fig 3.1, 4.2.1, 5.8.2, …) are **not final report
numbers** — they were inherited from the reference scan and serve as stable
mapping keys between sections, files, and this map. At build time the numbers
are re-sequenced to the report's own chapter-wise numbering (VTU rule:
"Fig 3.1"-style), in one mechanical pass. File names and this map keep the
keys.

## 0.1 Placement discipline (from the college sample — mandatory)

- Figures appear **only** in Chapter 3 (1 figure), Chapter 4 (diagrams) and
  Chapter 5 (result screenshots + metric charts). Chapters 1, 2, 6,
  References and Publications have **zero figures** — the Problem Statement,
  Aim & Objectives, Scope and Limitations are clean written prose.
- Figures appear **strictly in section order** — a figure never precedes the
  text that introduces it, and never appears in a section other than its own.
- Figure caption goes **below** the figure, centered, bold:
  `Fig <no> <caption>`; the paragraph after the figure explains it (sample
  does exactly this).
- Max one figure per paragraph position; no two figures back-to-back without
  intervening text.
- Tables (5.1–5.5) are table captions above, chapter-wise numbering.

## 1. Contents (TOC) — locked additions

| # | Addition | Section | Status |
|---|---|---|---|
| T1 | Multilingual Farmer UI | **5.9** | LOCKED into TOC |
| T2 | Verification & Performance | **5.10** | LOCKED into TOC |
| T3 | Software / Hardware Requirements | **3.1 / 3.2** | LOCKED into TOC |
| T4 | Deployment prose | inside **4.2** (HLD figure shows deployment/CI/QA) | LOCKED |
| T5 | Dashboard module figure | **4.1** (Fig 4.1.2) | LOCKED |
| T6 | Robot state machine figure | **4.1** (Fig 4.1.1) | LOCKED |
| T7 | Base papers / existing-system analysis | **2.2 / 2.3** (tables, no figures) | LOCKED |
| T8 | Appendix sub-entries A–D | Appendix | LOCKED |
| T9 | Chapter 3 carries Fig 3.1 only | Chapter 3 | LOCKED |

## 2. LOCKED figure plan (the complete list of what goes in the report)

### Chapter 1 — Introduction — **NO FIGURES** (clean prose)

### Chapter 2 — Literature Survey — **NO FIGURES** (tables only)

### Chapter 3 — Methodology (1 figure)

| Order | Key | Figure | File | Status |
|---|---|---|---|---|
| 1 | Fig 3.1 | 10-Stage System Pipeline | `diagrams/3.1-methodology-pipeline.png` | IN |

### Chapter 4 — Implementation and Flow chart (11 figures, strict order)

| Order | Key | Figure | File | Status |
|---|---|---|---|---|
| 1 | Fig 4.1.1 | Module Architecture (8 modules over 6 data stores) | `diagrams/4.1.1-module-architecture.png` | IN (generated 2026-10-25, user-approved) |
| 2 | Fig 4.1.2 | Robot State Machine (normal / dock-return / fault-recovery) | `paper-figures/4.1.1-robot-state-machine.png` | IN |
| 3 | Fig 4.1.3 | Mission Control Dashboard | `ui-screens/extra-dashboard-top.png` | IN |
| 3 | Fig 4.2 | System Architecture (HLD, incl. deployment & quality) | `diagrams/4.2-system-architecture-hld.png` | IN |
| 4 | Fig 4.3 | System Flow Diagram | `diagrams/4.3-flow-diagram.png` | IN |
| 5 | Fig 4.3.1 | Harvest Mission Execution Flow | `diagrams/4.3-flow-mission-execution.png` | IN |
| 6 | Fig 4.4.1 | Data Flow Diagram — Level 0 (Context) | `diagrams/4.4-dfd-level0.png` | IN |
| 7 | Fig 4.4.2 | Data Flow Diagram — Level 1 | `diagrams/4.4-dfd-level1.png` | IN |
| 8 | Fig 4.5 | Use Case Diagram | `diagrams/4.5-use-case-diagram.png` | IN |
| 9 | Fig 4.6 | Activity Diagram | `diagrams/4.6-activity-diagram.png` | IN |
| 10 | Fig 4.7 | Sequence Diagram — Harvest Mission Execution | `diagrams/4.7-sequence-diagram.png` | IN |
| 11 | Fig 4.8 | ER Diagram | `diagrams/4.8-er-diagram.png` | IN — **DEFECT D-A: regenerate first** (duplicate ROBOT EVENTS box) |
| 12 | Fig 4.9 | Class Diagram — Harvest Robot Core | `diagrams/4.9-class-diagram.png` | IN |

### Chapter 5 — Results and Discussions (17 figures + 5 tables)

| Order | Key | Figure | File | Status |
|---|---|---|---|---|
| 1 | Fig 5.1.1 | Survey mission creation & folder selection | `ui-screens/5.1.1-survey-mission-creation.png` | IN |
| 2 | Fig 5.1.2 | Survey image upload & tile statistics | `ui-screens/5.1.2-survey-upload-tiling.jpeg` | IN |
| 3 | Fig 5.2.1 | YOLO detections & permanent-tree match summary | `ui-screens/5.2.1-yolo-detections-matching.png` | IN |
| 4 | Fig 5.2.2 | Dataset samples (3 ripeness classes) | `paper-figures/5.2.2-dataset-samples.png` | IN |
| 5 | Fig 5.3.1 | Permanent Tree Registry | `ui-screens/5.3.1-tree-registry.png` | IN |
| 6 | Fig 5.4.1 | Digital Twin — Farm Viewer | `ui-screens/5.4.1-twin-viewer-top.jpeg` | IN |
| 7 | Fig 5.4.2 | Digital Twin — full mosaic fit view | `ui-screens/5.4.2-twin-full-mosaic.jpeg` | IN |
| 8 | Fig 5.4.3 | Tree Details drawer open (TREE-0022) | `ui-screens/5.4.3-tree-details-drawer.jpeg` | IN (captured 2026-10-25) |
| 9 | Fig 5.5.1 | Completed ripeness inspection & snapshot INV-0020 | `ui-screens/5.5.1-ripeness-inspection-snapshot.png` | IN (captured 2025-10-25) |
| 10 | Fig 5.6.1 | Harvest Mission Planner (HM-0004) | `ui-screens/5.6.1-harvest-planner-hm0004.png` | IN |
| 11 | Fig 5.7.1 | Robot Control Centre | `ui-screens/5.7.1-robot-control-centre.jpeg` | IN |
| 12 | Fig 5.7.2 | Robot simulation on the live mosaic | `ui-screens/5.7.2-robot-sim-live-mosaic.jpeg` | IN |
| 13 | Fig 5.8.1 | Mission History — all-runs table | `ui-screens/5.8.1-mission-history-all-runs.png` | IN |
| 14 | Fig 5.8.2 | Run #23 Summary (Mission Score 85.2) | `ui-screens/5.8.2-run23-summary.png` | IN |
| 15 | Fig 5.8.3 | Run #23 Timeline | `ui-screens/5.8.3-run23-timeline.png` | IN |
| 16 | Fig 5.9.1 | Language picker (7 locales) | `ui-screens/5.9.1-language-picker.png` | IN |
| 17 | Fig 5.9.2 | Dashboard in Kannada | `ui-screens/5.9.2-dashboard-kannada.png` | IN |
| 18 | Fig 5.9.3 | Dashboard in Hindi | `ui-screens/5.9.4-dashboard-hindi.png` | IN |
| 19 | Fig 5.10.1a | Confusion matrix — tree detector | `paper-figures/5.10.1a-confusion-matrix-tree.png` | IN |
| 20 | Fig 5.10.1b | Confusion matrix — ripeness detector | `paper-figures/5.10.1b-confusion-matrix-ripeness.png` | IN |
| 21 | Fig 5.10.2a | PR curve — tree detector | `paper-figures/5.10.2a-pr-curve-tree.png` | IN |
| 22 | Fig 5.10.2b | PR curves — ripeness detector | `paper-figures/5.10.2b-pr-curve-ripeness.png` | IN |
| 23 | Fig 5.10.3 | Routing-quality charts (NN vs optimum / random) | `paper-figures/5.10.3-routing-quality-charts.png` | IN |
| 24 | Fig 5.10.4 | Re-survey duplicates vs position error | `paper-figures/5.10.4-resurvey-duplicates-curve.png` | IN |

Tables (all IN, chapter-wise numbering finalized at build): Table 5.1
Detection accuracy · Table 5.2 Simulation/state-machine checks · Table 5.3
Battery stress test · Table 5.4 Routing quality · Table 5.5 Re-survey
matching (from `paper/latex/main.tex` Tables 2–6).

### Chapter 6 / References / Publications — **NO FIGURES**

### Appendix — **NO FIGURES** (text listings: A. API endpoints, B. DB schema, C. deployment, D. training config)

## 3. SPARE pool (NOT placed in the report — backup only)

| File | Content | Why spare |
|---|---|---|
| `paper-figures/4.2.1-system-architecture-detailed.png` | Paper's architecture diagram | 4.2 HLD chosen as the single architecture figure (T4) |
| `ui-screens/5.8.4-run23-robot-log.png` | Run #23 Robot Log | 3 figures locked for 5.8; log is a spare |
| `ui-screens/5.8.5-run23-tree-activity.png` | Run #23 Tree Activity | spare |
| `ui-screens/5.9.3-dashboard-kannada-full.jpeg` | Kannada dashboard full scroll | 3 figures locked for 5.9 |
| `ui-screens/5.9.5-dashboard-tamil.png` … `5.9.8-dashboard-marathi.png` | TA/TE/ML/MR dashboards | spares |
| `ui-screens/extra-dashboard-panels.png`, `extra-dashboard-activity.png` | Dashboard lower sections | 4.1.2 uses the top view only |
| `ui-screens/extra-landing-hero.jpeg`, `extra-landing-chapters.png`, `extra-landing-full.jpeg` | Landing page | Ch1 has no figures (sample discipline) |
| `ui-screens/extra-history-aborted.png` | Aborted-runs filter view | spare |
| `diagrams/4.4-dfd-diagram.png`, `4.4-dfd-mermaid-render.png` | Superseded DFD renders | never placed |

## 4. Outstanding items (the ONLY things not locked)

1. **G1** — capture Fig 5.4.3: Tree Details drawer open on `/map`. Until then: placeholder box, same ratio as 5.4.1 (landscape ≈ 16:10).
2. **G2** — capture Fig 5.5.1: ripeness inspection + inventory snapshot. Placeholder ratio ≈ 16:10.
3. **D-A** — regenerate `diagrams/4.8-er-diagram.png` without the duplicate "ROBOT EVENTS" box (and the `missionore` typo). No mermaid source exists — needs the original tool or a regeneration pass. Until then the docx carries the current PNG.

Nothing else is open. The plan above is final unless the guide requests changes.

## 5. Cross-checks

- 30 figures locked (1 + 12 + 17) + 5 tables; 2 placeholders pending capture; 1 diagram pending regeneration.
- Every locked figure sits in exactly one section, in ascending order within its chapter — no mid-text random placement.
- Chapters 1, 2, 6, References, Publications, Appendix: zero figures, matching the sample.
- No figure file appears twice; every IN figure's file exists except the two placeholders and the ER regeneration.
