# College Report — Table of Contents (Veraxis Platform)

Template-accurate TOC for the college project documentation. Page numbers are
placeholders — fill after layout. Chapter 5 subsection names follow the
Veraxis pipeline (survey → detection → twin → inspection → planning → robot → analytics)
plus the two platform-level subsections 5.9 (multilingual UI) and 5.10
(verification & performance) added 2026-10-25 — see
`report-content-map.md` (T1–T9) for rationale and figure wiring.

Figure numbers below are mapping keys (see `report-content-map.md` §0) —
final numbering is re-sequenced at layout.

## CONTENTS

| | | Page |
|---|---|---|
| Title Page | | i |
| Certificate | | ii |
| Acknowledgement | | iii |
| Abstract | | iv |
| Contents | | v |
| List of Figures | | vi |
| List of Tables | | vii |
| Abbreviation | | viii |
| **Chapter 1 Introduction** | | 1 |
| 1.1 Problem Statement | | 1 |
| 1.2 Aim & Objective | | 1 |
| 1.3 Methodology | | 2 |
| 1.4 Scope of the project | | 3 |
| 1.5 Limitations | | 4 |
| 1.6 Organization of the report | | 4 |
| **Chapter 2 Literature survey** | | 6 |
| 2.1 Introduction | | 6 |
| 2.2 Literature review | | 6 |
| 2.3 Outcome of the literature review | | 10 |
| 2.4 Summary | | 11 |
| **Chapter 3 Methodology** | | 13 |
| 3.1 Software Requirements | | 13 |
| 3.2 Hardware Requirements | | 14 |
| **Chapter 4 Implementation and Flow chart** | | 15 |
| 4.1 Modules | | 15 |
| 4.2 System Architecture | | 17 |
| 4.3 Flow Diagram | | 17 |
| 4.4 Data Flow Diagram | | 18 |
| 4.5 Use Case Diagram | | 19 |
| 4.6 Activity Diagram | | 20 |
| 4.7 Sequence Diagram | | 22 |
| 4.8 ER Diagram | | 23 |
| 4.9 Class Diagram | | 24 |
| **Chapter 5 Results and Discussions** | | 25 |
| 5.1 Survey Image Ingestion & Tiling | | 25 |
| 5.2 YOLO Tree & Coconut Detection | | 26 |
| 5.3 Permanent Tree Generation & Matching | | 27 |
| 5.4 Digital Twin Farm Viewer | | 28 |
| 5.5 Ripeness Inspection & Inventory Snapshots | | 29 |
| 5.6 Harvest Mission Planning | | 30 |
| 5.7 Robot Mission Execution & Simulation | | 31 |
| 5.8 Mission History & Analytics | | 32 |
| 5.9 Multilingual Farmer UI | | 33 |
| 5.10 Verification & Performance | | 34 |
| **Chapter 6 Conclusions and Future Scope** | | 35 |
| 6.1 Conclusions | | 35 |
| 6.2 Future Scope of Study | | 35 |
| References | | 36 |
| Publications | | 36 |
| Appendix | | 37 |
| A. API Endpoint List | | 37 |
| B. Database Schema (22 tables) | | 38 |
| C. Deployment Summary (Vercel · Render · Neon) | | 39 |
| D. Model Training Configuration | | 40 |

## Notes

- Front matter, Chapters 1, 2, 4, 6, and back matter follow the common college
  template unchanged; Chapter 3 carries only the two requirements subsections
  (3.1/3.2, added 2026-10-25 from the college review decks) plus the Chapter-3
  methodology figure (Fig 3.1, 10-stage pipeline).
- Chapter 4 diagram set maps to the delivered diagram images in
  `documentation/diagrams/` (+ `paper-figures/` for 4.1.1 robot state machine,
  4.2.1 alternate architecture): 4.2 (System Architecture / HLD), 4.3 Flow
  Diagram (+ 4.3.1 mission-execution flow), 4.4.1/4.4.2 DFD Level 0/1,
  4.5 Use Case, 4.6 Activity, 4.7 Sequence, 4.8 ER, 4.9 Class. The Dashboard
  module and robot state machine figures are placed under 4.1 Modules.
- Chapter 5: 5.1–5.8 mirror the eight pipeline modules (each with its
  `ui-screens/` figure set); 5.9 covers the 7-locale multilingual UI
  (V5.0); 5.10 presents the verification experiments and model metrics from
  the IRJMETS paper (Tables 2–6, PR curves, confusion matrices, routing and
  re-survey charts).
- Publications: cite the IRJMETS paper — Mahesh S, Syeda Umme Haani,
  S Mohammed Maaz, Akshatha G, Dr. Madhu B K, "AI Powered Coconut Harvesting
  System," IRJMETS, Vol. 08, Issue 03, March 2026 (e-ISSN 2582-5208).
- Appendix suggestions: DB schema (22 tables), API endpoint list (68
  endpoints), Docker/Render deployment summary, model training configuration
  (paper Table 1).
- Open defects/gaps before layout: capture Fig 5.4.3 (Tree Details drawer),
  Fig 5.5.1 (ripeness inspection + snapshot); regenerate the ER diagram
  (duplicate "ROBOT EVENTS" box) — tracked in `report-content-map.md` §3 and
  `current-report.md` Task 7.
