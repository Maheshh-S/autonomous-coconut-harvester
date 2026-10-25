# AllFindsPaper — ranked literature selection for the Veraxis report

This file is the master ranking of candidate papers for Chapter 2 (Table 2.1).
Restructured on 2026-10-25: the best papers are picked and ordered by relevance
to this project, each with a detailed reason for its position. The original
finds inventory (all 28 Scribd links with verification notes) is preserved at
the bottom as an appendix so nothing is lost.

Selection rules agreed with the user:
- **Base papers stay locked** at the top of Table 2.1 (Cabaluna et al. 2024
  and PickPerfect 2025) — not re-ranked, not touched.
- Everything else is chosen purely on quality and relevance: peer-reviewed
  venue, field validation, closeness to our pipeline (drone survey → ripeness
  vision → permanent tree records → mission planning → robot execution).
- Papers that could not be verified are not cited, no matter how convenient.

## 1. Locked base papers (positions 1–2, do not touch)

| Pos | Paper | Venue | Why it holds this slot |
|---|---|---|---|
| 1 | Computer-Vision-Based Detection and Monitoring System for Mature Coconut Fruits with a Web Dashboard — Cabaluna, Bahinting, Alindayo (2024) | IJACSA, Vol. 15, Issue 11 | Base paper. Closest published system to our monitoring layer: YOLOv8 coconut detection delivered through a web dashboard. Its limitation (laboratory-only, no plantation record, no execution) is the gap we build against. |
| 2 | PickPerfect: Coconut Maturity Detector and Harvester — Amitha I C, Fathima Fiza C P, Aswin Ratheesh D K, Rena Haris V P, K Muhsin (2025) | IJNRD (IJNRD2504302) | Base paper. Closest published pairing of ripeness perception with harvesting hardware. Its limitation (controlled capture, manual support) motivates our software-first, hardware-ready design. |

## 2. Ranked selection for Table 2.1 (positions 3–12)

| Pos | Paper | Venue / Year | Quality signal | Why this position (detailed) |
|---|---|---|---|---|
| 3 | Automated Coconut Maturity Detection and Timeline Prediction using YOLOv8-based Computer Vision — Shiju, George, Jebaseeli | Grenze IJET, 2025 | Peer-reviewed; held-out test of 155 images / 1,952 instances; mAP@0.5 76.1% | The most directly relevant vision paper: it uses the **same three-class taxonomy as our ripeness model** (Mature, Potential, Premature) with the same YOLOv8n backbone, and it reports per-class results that match our own error structure (Mature hardest). Right after the base papers because it validates both our class set and our detector choice. Full text in repo `Ref-Papers/`. |
| 4 | Identifying Coconut Maturity Levels Using CNN and YOLOv8 — Luthfie & Alamsyah | J. of Information System Exploration and Research 3(2), 2025 | Peer-reviewed; mAP 90.5%, P 99.3%, R 94.2% | Second vision anchor: an independent group reporting very high coconut-maturity accuracy with YOLOv8. Together with #3 it shows the ripeness-detection approach is reproducible across datasets and countries, which strengthens our methodology section. |
| 5 | Detection of multi-class coconut clusters for robotic picking under occlusion conditions — Fu, Zheng, Wang, Huang, Fu | IJABE 18(1): 267–278, 2025 | Peer-reviewed (doi 10.25165/j.ijabe.20251801.9031) | The bridge between detection and a real picking robot: multi-class coconut clusters under occlusion, evaluated for a robotic picking workflow. This is exactly the vision-to-actuation boundary our system automates, so it ranks above the pure-hardware papers. |
| 6 | Amaran: An Unmanned Robotic Coconut Tree Climber and Harvester — Megalingam et al. | IEEE/ASME Transactions on Mechatronics, 2020 | Top-tier journal (TMech); field-tested on trees to 15.2 m, trunk 0.66–0.92 m, inclination to 30° | The strongest robotics paper in the pool: a ring-shaped unmanned climber **with a harvester arm and cutter**, actually tested on real palms. It defines the hardware envelope our simulated robot mirrors (climb, harvest, return), and it is the best evidence that climber-plus-harvester on one platform is feasible. First among the mechanism papers because of venue quality and field validation. From the finds (Scribd #3). |
| 7 | Design and experiment of coconut picking robot with climbing — Zheng, Fu, Wang, Yin, Xia, Fu | Smart Agricultural Technology (Elsevier), Vol. 9, 2024 | Peer-reviewed; cited ~5; integrates climbing + picking on STM32 | The most recent integrated climber-harvester experiment, from the same group as #5, so detection and mechanism connect across the two papers. Ranks below Amaran because the venue is lighter and the report describes a prototype experiment rather than a field-validated platform. |
| 8 | Robotic Tree Climbers and Strategies: A Survey — Megalingam, Thirutheri, Manoharan | Int. J. of Intelligent Robotics and Applications (Springer), 2024 | Peer-reviewed survey; doi 10.1007/s41315-024-00380-9 | The newest broad survey of tree-climbing robots (stability, payload, autonomy). Surveys rank below original experiments for our table, but this one is the best single citation for the claim that climbing autonomy is an open, active problem — it supports the problem-statement framing in 2.3. From the finds (Scribd-adjacent, #5). |
| 9 | A Survey on Robotic Coconut Tree Climbers: Existing Methods and Techniques — Megalingam, Sakthiprasad, Sreekanth, Vamsy Vivek | IOP Conf. Ser.: Mater. Sci. Eng. 225, 012201, 2017 | Peer-reviewed conference survey | Coconut-specific climber survey: reviews mechanical designs and their limits, establishing the labour-shortage and climbing-constraint argument our Chapter 1 makes. Pairs with #8 as the survey pair; older and narrower, hence one slot below. From the finds (Scribd #1, duplicate #27 merged). |
| 10 | Status and Scope of Automated Coconut Harvester in India: A Review — Mukul Kumar, Gopinath Bej, H. S. Pandey | J. of Experimental Agriculture International 45(5): 1–15, 2023 | Peer-reviewed review; JEAI | The India-context review: labour shortage, cost and reliability barriers. It grounds the problem statement in the Indian economy (the setting of our project) but adds no technique of its own, so it sits after the surveys. (Citation corrected from the deck: the journal is JEAI, not IJRES.) |
| 11 | Autonomous Control and Implementation of Coconut Tree Climbing and Harvesting Robot — Dubey, Rathod et al. | Procedia Computer Science 85: 755–766, 2016 | Peer-reviewed (Elsevier); ~51 citations | The classic low-cost Arduino-Uno climber. Kept as the historical anchor of the mechanism line — heavily cited, early, and honest about needing supervision. Ranks near the bottom because later papers (#6, #7) supersede it technically; it is here for lineage, not novelty. |
| 12 | Comparative Analysis of YOLOv8 and YOLOv11 on Tree Detection Using UAV RGB and Laser Scanning Data — Sengun, Aksoy, Sertel, Fransson | ISPRS Annals X-2/W2 (UAV-g 2025) | Peer-reviewed benchmark; full text in repo `Ref-Papers/` | Justifies our detector choice with a controlled benchmark: YOLOv8 beats YOLOv11 at every scale at 640 px on UAV tree detection. Least coconut-specific of the twelve, hence last — but it is the citation that answers the viva question "why YOLOv8 and not YOLOv11 or a transformer?" |

## 3. Considered but not selected (with reasons)

| Paper | Source | Reason not selected |
|---|---|---|
| Design and Analysis of Fuel-Based Robotic Coconut Tree Climber — A. T. & Megalingam | IEEE symposium, 2022 (finds, Scribd #2) | Climbing mechanism only; the first author's name is incomplete in the indexed record ("A. T."), and #6/#7/#8 already cover the climber line with stronger venues. |
| Automated coconut tree climber — Maheswaran & Sathesh | Semantic Scholar / Scribd #4 | Author/year unverified; the finds file itself marks it "verify before citing". Cannot pass verification. |
| COCOBOT — Mani & Jothilingam, IJIRSET 2014 | Deck | Semi-autonomous, RF-controlled prototype in a low-tier venue; the mechanism line is better represented by #6, #7, #11. Dropped in the 2025-10-25 quality pass. |
| Atik & Arkali, Geomatics 6(2) 2026 (olive crown, YOLO vs transformers) | repo `Ref-Papers/` | Solid benchmark, but #12 covers the same justification (YOLOv8 vs alternatives on UAV tree detection) with a closer crop; only one benchmark slot. |
| Seven deck entries (Karthikeyan, Ramesh, Afsal, Sharma, Lakshmi, Suresh, Arun Kumar) | College deck | No publisher record exists for any of them (searched 2025-10-25). Replaced by the verified papers above. See `documentation/lit-survey-verification.md`. |

## 4. What changed in Chapter 2 as a result

Table 2.1 order is now: [1] Cabaluna, [2] PickPerfect (locked base papers),
[3] Shiju, [4] Luthfie, [5] Fu, [6] Amaran, [7] Zheng, [8] Megalingam 2024,
[9] Megalingam 2017, [10] Kumar review, [11] Dubey/Rathod, [12] Sengun.
Section 2.3's citations were re-pointed to this numbering. The References
part will list [1]–[12] in this order, then the IRJMETS technical references
as [13]–[22] (Redmon; Jocher; Koirala; Bargoti & Underwood; Grieves &
Vickers; Rosenkrantz; Croes; Harel; Fette & Melnikov; Nair/ICAR-CPCRI).

## 5. Appendix — original finds inventory (preserved, unverified items included)

### 5.1 Verified research papers from the Scribd finds

| # | Title | Authors | Year / venue | Status |
|---|---|---|---|---|
| F1 | A Survey on Robotic Coconut Tree Climbers – Existing Methods and Techniques | Rajesh Kannan Megalingam, K. M. Sakthiprasad, M. M. Sreekanth, Gedela Vamsy Vivek | 2017, IOP Conf. Ser.: Mater. Sci. Eng. 225, 012201 | Verified — selected as pos 9 |
| F2 | Design and Analysis of Fuel-Based Robotic Coconut Tree Climber | A. T. and Rajesh Kannan Megalingam | 2022, IEEE 5th International Symposium | Verified title/venue; first author incomplete — not selected |
| F3 | Amaran: An Unmanned Robotic Coconut Tree Climber and Harvester | Rajesh Kannan Megalingam et al. (9 authors) | 2020, IEEE/ASME Transactions on Mechatronics | Verified — selected as pos 6 |
| F4 | Automated coconut tree climber | Maheswaran and Sathesh | Not confirmed | Unverified — not citable |
| F5 | Robotic Tree Climbers and Strategies – A Survey | Megalingam, Thirutheri, Manoharan | 2024, Int. J. of Intelligent Robotics and Applications (Springer), doi 10.1007/s41315-024-00380-9 | Verified — selected as pos 8 |

### 5.2 Scribd uploads needing PDF verification (not citable as-is)

Project reports, review notes, presentations, and filename-only uploads:
coconut-picker 8/10/11 (10 and 28 are duplicates), "Automatic Coconut
Harvesting System", "wibowo2016", "Design and Fabrication of Tree…",
"Coconut Climbing Machine", "literature survey" compilation, "DESIGN
FABRICATION OF COCOUT TREE CLIMBG MACHINE", "Development of a Low-Cost
Coconut Tree Climber", "amaran review" (derived from F3), "Tree Climbing
Robot – Chapter 1", "13-256331-pdf", "13-pdf", "Coconut (Cocos nucifera L.)
Climbing Mechanism Analysis", "Afan et al. Vol. 106 No. 2 June 2023",
"Journal 2", "Test 11", "Articleupload Article870", "final project DMU",
and a duplicate of the Megalingam 2017 survey.

None of these carries a checkable publisher record, so none is cited. If a
PDF title page turns out to be a real published paper, send it and it will
be verified and inserted on merit.
