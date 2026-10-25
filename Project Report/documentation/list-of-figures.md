# List of Figures (Veraxis — College Report)

LOCKED figure register (see `report-content-map.md` §2 for the authoritative
plan). Every figure is **IN** (placed in the report at the listed position) or
**SPARE** (not placed). Figure numbers are mapping keys — final numbering is
re-sequenced at build time per the numbering policy.

All figure sources live under `Project Report/documentation/`:

- `diagrams/` — Chapter 3 & 4 diagrams
- `ui-screens/` — Chapter 5 UI screenshots (`extra-` prefix = capture-key
  originals; only `extra-dashboard-top.png` is IN, as Fig 4.1.2)
- `paper-figures/` — figures copied from the IRJMETS paper assets

## IN — the figures placed in the report (30)

| Fig No (key) | Description | Source |
|---|---|---|
| Fig 3.1 | Project Methodology — 10-Stage System Pipeline | `diagrams/3.1-methodology-pipeline.png` |
| Fig 4.1.1 | Module architecture — 8 modules over the 6 data stores (generated) | `diagrams/4.1.1-module-architecture.png` |
| Fig 4.1.2 | Robot State Machine — normal cycle, dock-return, fault & recovery | `paper-figures/4.1.1-robot-state-machine.png` |
| Fig 4.1.3 | Mission Control Dashboard | `ui-screens/extra-dashboard-top.png` |
| Fig 4.2 | System Architecture (High-Level Design) | `diagrams/4.2-system-architecture-hld.png` |
| Fig 4.3 | System Flow Diagram | `diagrams/4.3-flow-diagram.png` |
| Fig 4.3.1 | Harvest Mission Execution Flow | `diagrams/4.3-flow-mission-execution.png` |
| Fig 4.4.1 | Data Flow Diagram — Level 0 (Context) | `diagrams/4.4-dfd-level0.png` |
| Fig 4.4.2 | Data Flow Diagram — Level 1 (Processes 1.0–8.0, Stores D1–D6) | `diagrams/4.4-dfd-level1.png` |
| Fig 4.5 | Use Case Diagram | `diagrams/4.5-use-case-diagram.png` |
| Fig 4.6 | Activity Diagram | `diagrams/4.6-activity-diagram.png` |
| Fig 4.7 | Sequence Diagram — Harvest Mission Execution | `diagrams/4.7-sequence-diagram.png` |
| Fig 4.8 | ER Diagram *(regenerate first — defect D-A)* | `diagrams/4.8-er-diagram.png` |
| Fig 4.9 | Class Diagram — Harvest Robot Core | `diagrams/4.9-class-diagram.png` |
| Fig 5.1.1 | Survey mission creation & folder selection | `ui-screens/5.1.1-survey-mission-creation.png` |
| Fig 5.1.2 | Survey image upload, tiling & tile statistics | `ui-screens/5.1.2-survey-upload-tiling.jpeg` |
| Fig 5.2.1 | YOLO detections — 242 detections & match summary | `ui-screens/5.2.1-yolo-detections-matching.png` |
| Fig 5.2.2 | Dataset samples — ripeness classes across lighting | `paper-figures/5.2.2-dataset-samples.png` |
| Fig 5.3.1 | Permanent Tree Registry (255 trees) | `ui-screens/5.3.1-tree-registry.png` |
| Fig 5.4.1 | Digital Twin — Farm Viewer | `ui-screens/5.4.1-twin-viewer-top.jpeg` |
| Fig 5.4.2 | Digital Twin — full mosaic fit view | `ui-screens/5.4.2-twin-full-mosaic.jpeg` |
| Fig 5.4.3 | Tree Details drawer — read-only details | **PLACEHOLDER (G1 — capture pending)** |
| Fig 5.5.1 | Ripeness inspection & Inventory Snapshot | **PLACEHOLDER (G2 — capture pending)** |
| Fig 5.6.1 | Harvest Mission Planner — HM-0004 queue | `ui-screens/5.6.1-harvest-planner-hm0004.png` |
| Fig 5.7.1 | Robot Control Centre — command bar | `ui-screens/5.7.1-robot-control-centre.jpeg` |
| Fig 5.7.2 | Robot simulation on the live mosaic | `ui-screens/5.7.2-robot-sim-live-mosaic.jpeg` |
| Fig 5.8.1 | Mission History — all-runs table (23 runs) | `ui-screens/5.8.1-mission-history-all-runs.png` |
| Fig 5.8.2 | Run #23 Summary — Mission Score 85.2 | `ui-screens/5.8.2-run23-summary.png` |
| Fig 5.8.3 | Run #23 Timeline — sim-time + IST event log | `ui-screens/5.8.3-run23-timeline.png` |
| Fig 5.9.1 | Language picker — 7 locales | `ui-screens/5.9.1-language-picker.png` |
| Fig 5.9.2 | System Dashboard in Kannada | `ui-screens/5.9.2-dashboard-kannada.png` |
| Fig 5.9.3 | System Dashboard in Hindi | `ui-screens/5.9.4-dashboard-hindi.png` |
| Fig 5.10.1a | Confusion matrix — tree detector | `paper-figures/5.10.1a-confusion-matrix-tree.png` |
| Fig 5.10.1b | Confusion matrix — ripeness detector | `paper-figures/5.10.1b-confusion-matrix-ripeness.png` |
| Fig 5.10.2a | PR curve — tree detector (mAP@0.5 0.877) | `paper-figures/5.10.2a-pr-curve-tree.png` |
| Fig 5.10.2b | PR curves — ripeness detector (0.783 all) | `paper-figures/5.10.2b-pr-curve-ripeness.png` |
| Fig 5.10.3 | Routing quality — NN vs optimum / random vs NN | `paper-figures/5.10.3-routing-quality-charts.png` |
| Fig 5.10.4 | Re-survey duplicates vs position error | `paper-figures/5.10.4-resurvey-duplicates-curve.png` |

## List of Tables (for the report's List of Tables page)

| Table No (key) | Description | Source |
|---|---|---|
| Table 5.1 | Detection accuracy on held-out validation splits | paper Table 2 (`paper/latex/main.tex`) |
| Table 5.2 | Simulation engine & state-machine checks (E1–E4) | paper Table 3 |
| Table 5.3 | Battery-low diversion stress test | paper Table 4 |
| Table 5.4 | Nearest-neighbour tour length vs references | paper Table 5 |
| Table 5.5 | Re-survey matching under position error | paper Table 6 |

## SPARE pool (captured/copied but NOT placed)

`paper-figures/4.2.1-system-architecture-detailed.png` ·
`ui-screens/5.8.4-run23-robot-log.png` · `5.8.5-run23-tree-activity.png` ·
`5.9.3-dashboard-kannada-full.jpeg` · `5.9.5-dashboard-tamil.png` ·
`5.9.6-dashboard-telugu.png` · `5.9.7-dashboard-malayalam.png` ·
`5.9.8-dashboard-marathi.png` · `extra-dashboard-panels.png` ·
`extra-dashboard-activity.png` · `extra-landing-hero.jpeg` ·
`extra-landing-chapters.png` · `extra-landing-full.jpeg` ·
`extra-history-aborted.png` · `diagrams/4.4-dfd-diagram.png` (superseded) ·
`diagrams/4.4-dfd-mermaid-render.png` (superseded)

## Open items

1. **D-A** — regenerate the ER diagram without the duplicate "ROBOT EVENTS" box.
   (G1 and G2 were captured on 2026-10-25 and placed as Figs 5.4.3 and 5.5.1;
   the captures live in `ui-screens/` with the alternates filed as
   `extra-5.4.3-drawer-crop.jpeg`, `extra-5.5-inspection-history.png`,
   `extra-5.5-inspection-inprogress.png`.)
