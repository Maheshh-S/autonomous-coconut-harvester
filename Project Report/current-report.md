# CURRENT REPORT LOG — Veraxis College Project Report

**Strictly append-only.** Every agent or AI working on the college report MUST
read this file first and MUST append a new entry at the bottom after completing
any task, decision, or change. Never edit, reorder, or delete existing entries.
Never rewrite history — if a decision is reversed, append a new entry that
supersedes it explicitly.

**Project:** Veraxis — AI Powered Autonomous Coconut Harvesting System
(final-year B.E. project, Dept. of CSE, VVIET Mysuru, 2025–2026).
**Goal:** produce the college project report documentation.

**Key references (read order for any new agent):**
1. `Project Report/current-report.md` (this file — current stage)
2. `Project Report/documentation/college-report-toc.md` (approved chapter TOC)
3. `Project Report/documentation/list-of-figures.md` (figure register)
4. Repo docs: `AGENTS.md`, `README.md`, `CURRENT.md` (authoritative version log through V5.1), `PROJECT_SPECIFICATION.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `ROBOT_ARCHITECTURE.md`, `PROJECT_DOSSIER.md`
5. Published paper: `paper/latex/main.tex` / `main.pdf` (IRJMETS Vol 08 Issue 03, March 2026) — the authoritative source for all numbers; `paper/results/summary.json` backs Table 2
6. College review decks: `Project Report/documentation/REF-Old-Docs-resources/` (early proposal `Final ppt.pdf` → mid-review `Coconut Project ppt (14-08-26)-Main-.pptx` → final `Final PPT Major Project-main.pptx` / `Major-2nd-one-mmm.pdf`)

---

## Timeline

### [2026-10-25] Task 1 — Full project understanding pass (report kickoff)

- **Status:** DONE
- **What:** Read the entire repository: all engineering docs (AGENTS/README/CURRENT/PROJECT_SPECIFICATION/DECISIONS/ARCHITECTURE/ROBOT_ARCHITECTURE/PROJECT_DOSSIER/PROJECT_RESUME_BRIEF), backend & frontend code structure (via deep-dive passes), the IRJMETS paper and all its assets, and the college review decks.
- **Decisions:**
  - D1: The report must follow the IRJMETS paper's honest framing — simulated robot, simulated flight planner, farm-pixel coordinates — while using the college decks' structure/wording where accurate (the decks mention physical hardware / Gazebo / React-Leaflet that the final system intentionally simulates or dropped).
  - D2: All result numbers (model metrics, determinism, routing, matching) come only from `paper/latex/main.tex` Tables 1–6 and `paper/results/summary.json`. Never invent numbers.
- **Key facts established:** Team = Akshatha G (4VM23CS001), Mahesh S (4VM23CS033), S Mohammed Maaz (4VM23CS043), Syeda Umme Haani (4VM23CS055); Guide = Dr. Madhu B K, Dean of CSE, VVIET Mysuru. System = Veraxis digital-twin platform (FastAPI + Next.js 16 + PostgreSQL/Neon + 2×YOLOv8). Verified metrics: tree detector P 0.841 / R 0.843 / mAP@0.5 0.877; ripeness 0.760 / 0.747 / 0.783; determinism 100/100; 0 illegal transitions; NN routing 5.6–9.2% over optimal; 0 re-survey duplicates ≤ ~1.09 m.

### [2026-10-25] Task 2 — College reference decks reviewed

- **Status:** DONE
- **What:** Read all 4 files in `documentation/REF-Old-Docs-resources/`: `Final ppt.pdf` (earliest proposal: existing-system patent table, base papers PickPerfect 2025 + Cabaluna 2024), `Coconut Project ppt (14-08-26)-Main-.pptx` (mid-review, digital-twin pivot), `Final PPT Major Project-main.pptx` + `Major-2nd-one-mmm.pdf` (final review: 12-entry literature-survey table, problem statement, objectives, methodology, SW/HW requirements, advantages, expected outcomes, 12 references).
- **Decisions:**
  - D3: Chapter 2 Literature Survey will reuse the college-approved 12-entry table + base-paper analysis, merged with the paper's 10 references.
  - D4: Chapter 1 wording (problem statement, objectives, advantages) comes from the final deck.

### [2026-10-25] Task 3 — TOC recheck + recommendations

- **Status:** DONE
- **What:** Rechecked `college-report-toc.md` against the user's scanned reference CONTENTS page (another project's, template-accurate). TOC structure already matches the college template exactly (front matter i–viii, Ch1 1.1–1.6, Ch2 2.1–2.4, bare Ch3, Ch4 4.1–4.9, Ch5 project subsections, Ch6, References/Publications/Appendix).
- **Decisions:**
  - D5: Keep Chapter 3 bare in the contents (template-accurate) but assign it the 10-stage pipeline figure (Fig 3.1).
  - D6: Proposed new subsection **5.9 Multilingual Farmer UI** (7-locale evidence) and **5.10 Verification & Performance** (paper's E1–E7 results) — user has not objected; treat as adopted-unless-changed.
  - D7: Appendix sub-entries: A. API endpoint list, B. Database schema (22 tables), C. Deployment summary (Vercel/Render/Neon).
- **Changed:** Nothing in the TOC file yet (edits deferred until chapter writing starts).

### [2026-10-25] Task 4 — Figure inventory verified + list-of-figures.md created

- **Status:** DONE
- **What:** Viewed all 29 `PROJECT_UI` screenshots and confirmed/corrected the user's classification; viewed all paper figures (`arc-main.png`, `Fault.png`, dataset samples, confusion matrices, PR curves, routing charts, duplicates curve) and `paper/results/*` + `assets/source_notes.md` + `reviews/review_pass4.md`.
- **Decisions:**
  - D8: Figure numbering scheme follows the college reference: hierarchical `Fig 4.4.1/4.4.2` for DFD levels, `Fig 5.x.y` per TOC subsection.
  - D9: UI classification confirmed: mauj=mission creation (5.1.1), mawi=upload+tiling (5.1.2), mayd=242 detections (5.2.1), mdsn=registry (5.3.1), mble/mbpj=twin (5.4.1/2), mbck=planner (5.6.1), mbzd/mcbr=robot (5.7.1/2), mcwr/mdfk/mdhb/mdlh(+mdjk)=history (5.8.1–5.8.5), mdxg+medq(+5 more locale dashboards: mekj/menz/meqc/mesg/meux/mefw)=multilingual (5.9.x).
  - D10: Only 2 UI gaps remain: **Fig 5.4.3** Tree Details drawer open, **Fig 5.5.1** ripeness inspection + inventory snapshot.
- **Created:** `documentation/list-of-figures.md` (full figure register with sources).

### [2026-10-25] Task 5 — Renamed 4 unlabeled diagram images

- **Status:** DONE (superseded in location by Task 7)
- **Changed (original names → new):**
  - `1.png` → `3.1-methodology-pipeline.png` (10-stage pipeline)
  - `2.png` → `4.4-dfd-level0.png` (context DFD)
  - `iiii 2.png` → `4.4-dfd-level1.png` (full DFD, processes 1.0–8.0)
  - `ii.png` → `4.3-flow-mission-execution.png` (harvest execution flow)
- **Note:** `4.4-dfd-diagram.png` and `4.4-dfd-mermaid-render.png` are superseded working renders — keep as sources only, never place in the report.

### [2026-10-25] Task 6 — Folder restructure + UI renames + paper-figure copies

- **Status:** DONE
- **New structure of `Project Report/`:**
  ```
  Project Report/
    current-report.md            ← this log (append-only)
    documentation/
      college-report-toc.md
      list-of-figures.md
      diagrams/                  ← 13 Chapter 3/4 diagram PNGs (figure-numbered names)
      ui-screens/                ← 29 renamed UI screenshots (figure-numbered names;
                                    "extra-" prefix = captured but unassigned)
      paper-figures/             ← 9 figures COPIED from paper/latex/figures/
                                    (originals untouched in paper/)
      REF-Old-Docs-resources/    ← college review decks (unchanged)
  ```
  (`images/` and `images/PROJECT_UI/` were dissolved; .DS_Store files removed.)
- **Changed — all 29 UI screenshots renamed** (capture key → new name):
  - mauj → `5.1.1-survey-mission-creation.png`
  - mawi → `5.1.2-survey-upload-tiling.jpeg`
  - mayd → `5.2.1-yolo-detections-matching.png`
  - mdsn → `5.3.1-tree-registry.png`
  - mble → `5.4.1-twin-viewer-top.jpeg`
  - mbpj → `5.4.2-twin-full-mosaic.jpeg`
  - mbck → `5.6.1-harvest-planner-hm0004.png`
  - mbzd → `5.7.1-robot-control-centre.jpeg`
  - mcbr → `5.7.2-robot-sim-live-mosaic.jpeg`
  - mcwr → `5.8.1-mission-history-all-runs.png`
  - mdfk → `5.8.2-run23-summary.png`
  - mdhb → `5.8.3-run23-timeline.png`
  - mdlh → `5.8.4-run23-robot-log.png`
  - mdjk → `5.8.5-run23-tree-activity.png`
  - mdxg → `5.9.1-language-picker.png`
  - medq → `5.9.2-dashboard-kannada.png`
  - mefw → `5.9.3-dashboard-kannada-full.jpeg`
  - mekj → `5.9.4-dashboard-hindi.png`
  - menz → `5.9.5-dashboard-tamil.png`
  - meqc → `5.9.6-dashboard-telugu.png`
  - mesg → `5.9.7-dashboard-malayalam.png`
  - meux → `5.9.8-dashboard-marathi.png`
  - luvi → `extra-landing-hero.jpeg`
  - lvyp → `extra-landing-chapters.png`
  - lwcp → `extra-landing-full.jpeg`
  - lwkl → `extra-dashboard-top.png`
  - maqo → `extra-dashboard-panels.png`
  - maso → `extra-dashboard-activity.png`
  - mdbp → `extra-history-aborted.png`
- **Changed — 9 figures copied from `paper/latex/figures/` into `paper-figures/`** (copies; paper originals untouched):
  - `arc-main.png` → `4.2.1-system-architecture-detailed.png`
  - `Fault.png` → `4.1.1-robot-state-machine.png`
  - `fig_dataset_samples.png` → `5.2.2-dataset-samples.png`
  - `cmat_tree.png` → `5.10.1a-confusion-matrix-tree.png`
  - `cmat_coconut.png` → `5.10.1b-confusion-matrix-ripeness.png`
  - `pr_tree.png` → `5.10.2a-pr-curve-tree.png`
  - `pr_coconut.png` → `5.10.2b-pr-curve-ripeness.png`
  - `extracted/image4.png` → `5.10.3-routing-quality-charts.png`
  - `extracted/image5.png` → `5.10.4-resurvey-duplicates-curve.png`
- **Updated:** `documentation/list-of-figures.md` rewritten to point at the new paths (diagrams/ + ui-screens/ + paper-figures/) and to include the 9 paper figures as Figs 4.1.1, 4.2.1, 5.2.2, 5.10.1a/b, 5.10.2a/b, 5.10.3, 5.10.4.

### [2026-10-25] Task 7 — Full section↔figure content map + TOC gap analysis

- **Status:** DONE
- **What:** Inspected the 7 remaining Chapter-4 diagrams (4.2 HLD, 4.3 flow, 4.5 use case, 4.6 activity, 4.7 sequence, 4.8 ER, 4.9 class) to ground a complete section-by-section wiring of content ↔ figures ↔ gaps.
- **Created:** `documentation/report-content-map.md` — the master wiring document (numbering policy, TOC enhancements T1–T9, per-section figure tables with READY/GAP/OPTIONAL status, consolidated gap list G1–G3, defect D-A, cross-checks).
- **Decisions:**
  - D11 (numbering policy): All current figure numbers (Fig 3.1, 4.2.1, 5.8.2, …) are **mapping keys inherited from the reference project's scan, not final report numbers**. They stay stable in file names, the map, and the list-of-figures; final numbering is re-sequenced once at layout time (single find-replace pass).
  - D12 (TOC additions adopted as proposals): 5.9 Multilingual Farmer UI (user explicitly requested), 5.10 Verification & Performance, 3.1/3.2 Software & Hardware Requirements (moved from the decks into Chapter 3), Appendix sub-entries A–D, Dashboard + robot-state-machine figures placed under 4.1 Modules. Deployment stays prose under 4.2 (the HLD figure already shows the Deployment & Quality column).
  - D13: Chapter 4 diagram coverage verified complete — 4.7's sequence diagram already includes the WebSocket broadcast path (no extra sequence diagram needed); 4.2 HLD already covers deployment/CI/QA.
- **Findings / gaps handed to the user:**
  - **G1** — capture Fig 5.4.3: Tree Details drawer open on `/map`.
  - **G2** — capture Fig 5.5.1: ripeness inspection + immutable inventory snapshot (the ONLY section with zero ready figures).
  - **G3 (optional)** — capture a robot mid-run state (MOVING/HARVESTING, partial path, battery < 100%).
  - **D-A (defect)** — `diagrams/4.8-er-diagram.png` has a **duplicate "ROBOT EVENTS" box** (the extra copy holds telemetry fields and a typo `missionore`); ER must be regenerated without it. No mermaid source exists for the ER — needs original tooling or a regeneration pass.
- **Changed:** no existing files edited; map is additive.

### [2026-10-25] Task 8 — college-report-toc.md updated with adopted enhancements

- **Status:** DONE
- **What:** User caught that Task 7's TOC enhancements were never applied to `college-report-toc.md` (Task 3 had deferred the edits). Applied them now.
- **Changed (`documentation/college-report-toc.md` rewritten):**
  - Added **3.1 Software Requirements / 3.2 Hardware Requirements** under Chapter 3 (T3).
  - Added **5.9 Multilingual Farmer UI** (T1) and **5.10 Verification & Performance** (T2) to Chapter 5.
  - Expanded Appendix into sub-entries **A. API Endpoint List, B. Database Schema (22 tables), C. Deployment Summary, D. Model Training Configuration** (T8).
  - Notes section rewritten: figure-number mapping-key policy (D11), figure placements (4.1 gains dashboard + robot-FSM figures; 4.4 splits into Level 0/1), Chapter 5 structure rationale, full IRJMETS publication citation, and the open gaps (5.4.3, 5.5.1 captures + ER regeneration defect).
  - Page numbers adjusted sequentially as placeholders (Ch5 now 25–34, Ch6 35, back matter 36–40) — still to be finalised at layout.
- **Consistency:** TOC ⇄ `report-content-map.md` (T1–T9) ⇄ `list-of-figures.md` now agree.

### [2026-10-25] Task 9 — College sample scan + VTU guidelines reviewed; format spec created

- **Status:** DONE
- **What:** Read `documentation/COLLEGE_SCANNED-Project Report sample copy 2024-25 copy.pdf` (12-page scan of the 2024-25 guide-approved sample report) and `documentation/Examination Guidelines – Visvesvaraya Technological University (1).pdf` (VTU B.E. project-report rules). Extracted every formatting rule and cross-checked the two.
- **Created:** `documentation/report-format-spec.md` — the authoritative format spec for the Word build (page setup, fonts/sizes, page border, header/footer, numbering, front matter, chapter layout, placeholder policy, references, certificate wording, submission checklist, docx build plan).
- **Decisions:**
  - D14 (placeholder policy, user-approved): missing figures (G1/G2, optional G3, ER regeneration) get **same-ratio light-grey dashed placeholder boxes** labelled `PLACEHOLDER — Fig <key>` in the docx; user supplies final images at the same ratio and they drop in without layout changes. No random stand-in images.
  - D15 (conflict rule): where the VTU text and the college sample differ, the **sample wins** (it is department-accepted). Notable: VTU says abstract ≤ 100 words, sample runs ~1 page — default to sample-style (~200–250 words), flagged as a decision point for the guide.
  - D16 (format baseline): A4, margins L1.25″/R1″/T0.75″/B0.75″, Times New Roman, 1.5 spacing; chapter no. 16 pt / chapter title 18 pt centered / section 16 pt / subsection 14 pt / body 12 pt justified; thin black page border on every page; running header (title + rule) and footer (Dept. of CSE, VVIET, Mysuru · Page N) on chapter pages; front matter numbered i–viii (roman, bottom-center), chapters Arabic from 1.
  - D17 (build tooling): report generated with python-docx into `Project Report/Veraxis-College-Report.docx`, named styles per the spec, figure/table numbers finalized at build time.
  - D18 (VTU facts): CS/IS outer cover = CREAM; guide approval required before final print; overall presentation carries 40/100 marks — presentation polish is a priority.
- **User confirmations this task:** figure set accepted as ready-except-gaps; ER defect acknowledged; placeholder approach approved; report to be generated as a Word document.

### [2026-10-25] Task 10 — Figure plan LOCKED (no "optional/maybe" placements)

- **Status:** DONE
- **What:** User directive: the previous map's 🔵 "optional" markers and suggestions like a figure in the Problem Statement are not allowed. The college sample's discipline is mandatory — figures only where the format expects them, in strict order; Problem Statement / Aim & Objectives etc. are clean prose. Locked the entire plan.
- **Decisions:**
  - D19 (placement discipline, from the sample): figures exist ONLY in Ch3 (1), Ch4 (12), Ch5 (17). Chapters 1, 2, 6, References, Publications and Appendix contain ZERO figures. Figures appear strictly in section order, caption below, explanatory paragraph after, never two back-to-back without text.
  - D20 (locked choices, replacing all hedges): architecture = `4.2-system-architecture-hld.png` ONLY (paper's arc-main demoted to spare); 5.8 = exactly 3 figures (all-runs, run summary, timeline); 5.9 = exactly 3 (picker, Kannada, Hindi); mid-run robot capture (old G3) DROPPED; landing-page and dashboard-lower screenshots NOT placed; Appendix has no figures.
- **Changed:** `report-content-map.md` rewritten as a LOCKED plan (§0.1 placement discipline, §2 IN-list of 30 figures + 5 tables, §3 SPARE pool, §4 open items, §5 cross-checks); `list-of-figures.md` rewritten to match (IN / SPARE split, List of Tables added).
- **Final counts:** 30 figures IN (28 ready + 2 placeholders) + 5 tables; 16 files in the spare pool; open items reduced to G1, G2, D-A.

### [2026-10-25] Task 11 — User framing clarification: hardware-integration positioning

- **Status:** LOGGED (user statement, recorded verbatim in intent)
- **User clarification:** This is a **software platform built to integrate with real hardware in the future**. The simulated components (drone survey pipeline, flight planner, robot) are **researched and backed by real hardware response types** — the simulation mirrors the data/telemetry/commands real hardware would produce. When real hardware arrives, its live data flows into the same software unchanged (the swap-in contract: HTTP command set + WebSocket telemetry frame for the robot; PlannerConfig interface for the drone).
- **Decision:**
  - D21 (framing, refines D1): The report must NOT frame the system as "only a simulation" nor overclaim working hardware. Canonical framing: *the platform is hardware-ready software — every simulated component emulates the response contract of its real counterpart (drone imagery ingestion, flight-planner waypoints, robot telemetry/state), so real devices replace the emulators behind stable interfaces without changing the application.* This framing goes into: Ch1 Introduction, Ch4 architecture (real-robot swap contract), 5.7 (robot section), and Ch6 Future Scope.
  - This supersedes the narrower "honest simulated framing" of D1 where the two conflict; D1's number-accuracy rule still stands.

### [2026-10-25] Task 12 — Kickoff questions answered; final pre-build decisions locked

- **Status:** DONE (user answered all four questions)
- **Decisions:**
  - D22 (title): Report title = **"AI POWERED AUTONOMOUS COCONUT HARVESTING SYSTEM"** (college-deck title). User states they have updated the papers to match. Used everywhere: title page slot, headers, abstract, publication citation (⚠️ verify the final published IRJMETS PDF carries this title before print).
  - D23 (authors): Order = **published-paper order** with user-corrected USNs: Mahesh S (4VM23CS**030**), Syeda Umme Haani (4VM23CS055), S Mohammed Maaz (4VM23CS043), Akshatha G (4VM23CS001). ⚠️ Note: Mahesh's USN appears as 4VM23CS030 in the user's correction — every deck previously said 4VM23CS033. Follow the user's 030, but flag for a final proofread against the college records.
  - D24 (front matter split): **Title page, Certificate, Acknowledgement are EXCLUDED from the docx build** — the user makes those manually and inserts them. The generated document starts at the Abstract. Front-matter roman numbering is still planned as if they occupy i–iii (Abstract = iv) so the manual pages slot in without renumbering.
  - D25 (abstract length): Balanced per user instruction — VTU rule first (≤100 words), stretched toward the sample: target **~120–180 words**, condensed from the IRJMETS abstract.
  - D26 (minor, agent-decided): "Veraxis" is used as the system name in prose (it is the platform's name across docs/UI); the appendix includes short code excerpts (state-machine transition table, tree-matching core) mirroring the sample's "Web Code" appendix style.
- **No open questions remain. Build may start.**

### [2026-10-25] Task 13 — Second round of kickoff questions answered

- **Status:** DONE (user answered all four; no further questions open)
- **Decisions:**
  - D27 (length): target **~45–55 pages** excluding front matter — sample-like depth, comfortable for 30 figures + 5 tables.
  - D28 (print): **colour print** — dark UI screenshots and coloured charts keep their colours; no grayscale conversion needed.
  - D29 (branding): **generic prose only** — "the system" / "the proposed system"; the name "Veraxis" is NOT used in the report body (it stays only where unavoidable, e.g. nothing — screenshots contain the brand but prose stays impersonal).
  - D30 (schedule): **no Gantt/schedule chart** — Ch3 stays pipeline figure + 3.1/3.2 requirements, as the sample does.
- **Build is fully unblocked; no open questions remain.**

### [2026-10-25] Task 14 — humanizer skill installed; chapter-wise build workflow adopted

- **Status:** DONE
- **What:** Installed the `humanizer` skill (github.com/blader/humanizer v3.1.0) into `.claude/skills/humanizer` with symlinks in `.agents/skills/` and `.zcode/skills/`; read SKILL.md in full (397 lines, 26 patterns).
- **Decisions:**
  - D31 (user directive): ALL report prose is written under the humanizer rules: no em/en dashes, no "not X but Y" staging, no one-line closers, no stock AI vocabulary (crucial, pivotal, robust, key, showcase, underscore, delve, additionally, etc.), no inflated significance, plain is/are/has verbs, varied sentence length, concrete facts only. Verified programmatically after every build (dash count must be 0; banned-word scan must be clean).
  - D32 (voice override, per the skill's Voice section): the college sample report is the writing sample for this document; its conventions (formal register, ALL-CAPS chapter headings, categorized bullet lead-ins) override pattern rules where they conflict.
  - D33 (workflow, user directive): builds are CHAPTER-WISE, not one-shot. Order: front matter first, then Ch1, Ch2, … Ch6+back matter. After each chapter the user reviews/edits before the next is written. Each chapter is its own content module; the builder includes every module present.
- **Changed:** `build/build_report.py` load_blocks now imports chapter modules incrementally (content_front, content_ch1 … content_ch6_back), skipping missing; added FALLBACK_FIG/FALLBACK_TAB so early cross-references (e.g. Fig 3.1 cited in Ch1) resolve correctly in partial builds.

### [2026-10-25] Task 15 — Front matter + Chapter 1 written and built (draft 1)

- **Status:** BUILT, awaiting user review (chapter-wise checkpoint)
- **What:** Wrote `build/content_front.py` (Abstract ~175 words per D25; CONTENTS listing the full locked TOC with front-matter roman pages and blank chapter pages; LIST OF FIGURES/TABLES auto-generated from the build registry; ABBREVIATION with 30 entries) and `build/content_ch1.py` (1.1 Problem Statement in 3 clean prose paragraphs, no figures per D19; 1.2 Aim & Objective with 4 categorized objective bullets; 1.3 Methodology staging narrative with Fig 3.1 cross-ref; 1.4 Scope as 9 categorized bullets; 1.5 Limitations honest per D1/D21 including the simulated-robot statement; 1.6 Organization).
- **Output:** `Project Report/AI-Powered-Autonomous-Coconut-Harvesting-System-College-Report.docx` (front matter starts at page iv; Chapter 1 opener + title + 1.1–1.6; roman/arabic sections; page borders; running header/footer on chapter pages).
- **Verified programmatically:** 2 sections; lowerRoman start=4 + decimal start=1; no unresolved {FIG:} tokens; 0 em/en dashes; 0 banned-word hits; document opens in the viewer (134 blocks).
- **Numbers used (all sourced):** 15–25 m climbing height (paper/decks); ~17,600 total dataset images (10,343 + 7,297); 618 ripeness val images; ~300-tree DOM renderer scale; 100/100 determinism; 7 locales (paper + CURRENT.md V5.0/V5.1).
- **Build env:** `/tmp/report-build-venv` (uv-managed Python 3.13; python-docx + Pillow). Repo venv unusable (Homebrew 3.14 pyexpat breakage). Rebuild: `cd "Project Report/build" && /tmp/report-build-venv/bin/python build_report.py`.

### [2026-10-25] Task 16 — Header, footer and page border removed from the generated docx

- **Status:** DONE
- **What:** User directive: remove the running header, footer and page border from the generated document for now; they will add these decorations manually.
- **Changed:** `build/build_report.py` no longer emits `w:pgBorders`, header title text, or footer (dept/page-number) content in either section. Margins and the roman(iv)/arabic(1) page-number formats are retained. Verified after rebuild: 0 pgBorders occurrences, all 4 header/footer parts empty.
- **Note:** The format spec (`report-format-spec.md` §3) still documents the border/header/footer design for the final manual pass.

### [2026-10-25] Task 17 — Draft renamed; user's manual format changes adopted into the builder

- **Status:** DONE
- **What:** User manually edited the generated docx (renamed to `Project Report/Draft1. Part 0.docx`): margins changed, the college-sample border applied, Chapter 1 body content removed while keeping the Chapter 1 big-title opener page. Directive: do not modify that file.
- **Observed user settings (extracted from the file's XML):**
  - Front-matter section: Word "Normal" margins (1″ all sides).
  - Chapter section: 0.5″ margins all sides.
  - Border on both sections: `thinThickSmallGap` top/left, `thickThinSmallGap` bottom/right, sz 24, space 24, offsetFrom page, colour auto.
  - Headers/footers remain empty (manual).
- **Decisions:**
  - D34: The builder reproduces the user's exact section settings (verified: margins + border XML byte-identical to Part 0 after fixing a stale duplicate border function that had overridden the new one). Output filename moved to `Draft1. Part 1.docx` so Part 0 is never overwritten. FIG_WIDTH raised to 6.8″ to suit the 0.5″ chapter margins.
  - D35: Chapter 1 body text remains in `build/content_ch1.py`; the user's removal was in the docx only. At the next build (Part 1, with Chapter 2) the Ch1 body re-enters the document unless the user says otherwise — their review edits to Ch1 prose should be given as edits to the content module (or as notes) so they persist across builds.
- **File state:** `Draft1. Part 0.docx` untouched (user-owned). Next build writes `Draft1. Part 1.docx`.

### [2026-10-25] Task 18 — Draft1. Part 0 reformatted to match the college sample

- **Status:** DONE (rebuilt in place; user's section settings preserved byte-identically)
- **What:** User asked to apply the sample document's formatting to the pages present in Part 0. Builder updated and Part 0 regenerated.
- **Formatting changes applied (from the sample scan):**
  - **Contents:** rows flush-left (front matter + chapter lines), numbered subsections/appendix items indented 0.35″, page numbers right-aligned at the text edge via tab (no leaders, like the sample).
  - **List of Figures / List of Tables:** three-column layout with a bold header row ("Figure No / Description / Page No."), description column at 1.5″, page column right-aligned (empty until layout); sub-figure rows (e.g. Fig 5.6.1) indented one step, as in the sample.
  - **Abbreviation:** heading changed to title case "Abbreviation" (the sample uses title case here, caps elsewhere).
  - **Chapter opener page:** "CHAPTER 1" enlarged to 36 pt bold centered (new VChapterOpener style) on its own bordered page, matching the sample's large chapter openers; the "CHAPTER 1" + "INTRODUCTION" title block follows on the next page.
- **Preserved from the user's manual edit (D34):** Normal 1″ margins on front matter, 0.5″ margins on the chapter section, the thin-thick/thick-thin sample border, empty headers/footers, and the removed Chapter 1 body (builder flag `INCLUDE_CH1_BODY=0`; flip to 1 only on user approval).
- **Fixed during the pass:** duplicate `pgBorders` (python-docx `add_section` clones the previous section's properties — border is now idempotent); stale lock-file cleanup noted.
- **Verified:** 2 sections / 2 borders; margins + border XML identical to the user's version; Ch1 body absent; 0 dashes / 0 banned words; opener style applied at 36 pt.
- **Safety:** pre-rebuild copy at `/tmp/Draft1-Part0-backup.docx`. ⚠️ The user has Part 0 open in Word (lock file present) — they must close and reopen to see the rebuilt version.

### [2026-10-25] Task 19 — Contents/LoF/LoT layout corrected to the user's screenshots

- **Status:** DONE (Part 0 rebuilt in place)
- **What:** User sent 3 screenshots of the sample's CONTENTS and LIST OF FIGURES pages; my previous layout deviated in several ways. Corrections applied:
  - Chapter rows in CONTENTS: **"Chapter N" + tab (1.15″) + Title-case title** (e.g. "Chapter 1 → Introduction"), not "CHAPTER N  NAME"; a clear vertical gap (16 pt space-before) above every chapter row.
  - Subsection rows: indented **0.6″** with single spacing in the label ("1.1 Problem Statement"); appendix items A–D same indent.
  - Page-number column: right-aligned tab at **5.6″** (inside the text edge, per the screenshots), used by all rows.
  - LIST OF FIGURES / TABLES: header row ("Figure No / Description / Page No.") is **regular weight** with a 14 pt gap after it; description column tab at **1.9″**; **all entries flush left** (no sub-number indentation); rows separated ~4 pt.
  - CONTENTS_LINES rewritten to the tabbed chapter form; VFrontRow spacing opened up.
- **Verified in XML:** 86 tab-stop groups; positions 8064 (page col) ×56, 2304 (abbrev col) ×30, 1656 (chapter col) ×6, 2736 (list desc col) ×2 — list entry rows will add their 1.9″ stops as figures/tables register in later chapters. Chapter-row and list-header tab sequences confirmed. Ch1 body still withheld; margins/border/headers unchanged.
- **Note:** user must close and reopen Part 0 in Word to see this rebuild.

### [2026-10-25] Task 20 — Part 1 built (Chapter 1 body, sample chapter-page format)

- **Status:** BUILT, awaiting user review
- **What:** User locked Part 0 (do-not-touch) and provided screenshots of the sample's chapter pages defining the Part 1 format. Built `Draft1. Part 1.docx` containing Chapter 1 (1.1–1.6, full prose) in that format.
- **Format implemented (from the screenshots):**
  - **No page frame on chapter pages** — the user clarified the rules are above and below only: header paragraph with thick bottom rule, footer paragraph with top rule.
  - **Header:** project title top-left (title case, 11 pt).
  - **Footer:** "Dept. of CSE, VVIET, Mysuru" left, "Page N" (PAGE field, arabic from 1) right.
  - **Margins:** Normal 1″ all sides (chapter section too).
  - **No separate opener page:** page 1 starts "CHAPTER 1" (16 pt bold, left) then "INTRODUCTION" (18 pt bold, centered), then body — per the screenshots.
  - **Headings:** 1.1-style = 14 pt bold; x.y.z = 13 pt bold (sample sizes).
  - **Body:** justified, 1.5 spacing; continuation paragraphs get a 0.3″ first-line indent (auto: any body paragraph following another body paragraph).
  - **Bullets:** ➢ with hanging indent (bullet 0.25″, text/wrap 0.45″); bold lead-ins kept.
- **Builder changes:** `REPORT_MODULES` env selects content modules for part builds; `configure_chapter_section()` replaces the old bordered chapter section; chapter rendering no longer emits opener pages (sample-faithful); `INCLUDE_CH1_BODY` now defaults on.
- **Verified:** 1 section, 0 pgBorders, margins 1440, decimal start=1, header/footer text + PAGE field + both rules present, VBodyIndent/VBullet/VH1 style values correct, 13 ➢ bullets, 0 dashes, 0 banned words.
- **Prose:** identical to the Task 15 draft (humanizer-compliant), unchanged pending user review.

### [2026-10-25] Task 21 — Part 1 content edits (footer confirmed, 1.2.1/1.2.2 split, PS compressed)

- **Status:** DONE (Part 1 rebuilt)
- **What:** User review edits for Part 1:
  - **Footer:** requested dept-left / page-right with space between — verified the generated footer already does exactly this (right-aligned tab at 9029 twips = 6.27″, PAGE field live); no change needed.
  - **1.2 restructured per the sample screenshot:** now `1.2.1 Aim` (aim paragraph) and `1.2.2 Objectives` (➢ bullets); the old "The objectives of the project are:" line removed.
  - **Problem Statement compressed to one paragraph** (140 words): danger + labour decline, no per-tree readiness record, fragmented existing solutions, the need for one integrated system.
- **Verified:** heading order 1.1 < 1.2 < 1.2.1 < 1.2.2; PS is a single paragraph; 0 dashes / 0 banned words; footer tab + PAGE field intact.
- **Part 0 remains untouched.**

### [2026-10-25] Task 22 — Part 1 rebuilt with consistent header/footer rules

- **Status:** DONE
- **What:** User reported Part 1 "not changed" (stale copy open in Word — the on-disk XML did contain the Task 21 edits, re-verified) and asked for consistency between the line above (header rule) and below (footer rule).
- **Changed:** header rule and footer rule are now **identical: 3 pt single black line, 1 pt space from text** (footer was 1.5 pt before). Rebuilt Part 1.
- **Verified:** header sz=24/space=1, footer sz=24/space=1, footer right tab at 9029 twips (6.27″) with live PAGE field, 1.2.1 Aim + 1.2.2 Objectives present, Problem Statement one 140-word paragraph, 0 dashes / 0 banned words. File mtime 03:05:57.
- **User instruction given:** close Word WITHOUT saving the stale copy, then reopen `Draft1. Part 1.docx` to see the rebuild.

### [2026-10-25] Task 23 — Part 2 built (Chapter 2 Literature Survey)

- **Status:** BUILT, awaiting user review
- **What:** Wrote `build/content_ch2.py` and built `Draft1. Part 2.docx` (chapter-pages format: same header/footer/rules/margins as Part 1, Normal margins, no page frame; page numbers restart at 1 per-part).
- **Contents (no figures, per D19; one table per the locked plan):**
  - 2.1 Introduction — three survey strands + the two base papers.
  - 2.2 Literature review — **Table 2.1** with the college-approved 12-entry survey in the department's 5-column format (Sl. No / Author, Year / Title, Journal / Methodology / Outcome), entries verbatim from the final deck (D3); then **2.2.1 Base Paper I: PickPerfect (2025) [13]** and **2.2.2 Base Paper II: Cabaluna et al. (2024) [4]**, each with Key points / Limitations / Gaps bullets from the early deck.
  - 2.3 Outcome — synthesis of the three strands with bracket citations, the gap analysis (no permanent identity, no per-tree inventory, no executable planning; base-paper limits), and how the proposed system connects the strands.
  - 2.4 Summary.
- **Reference numbering plan (for Part 6):** table entries = [1]–[12] in table order; PickPerfect = [13]; the IRJMETS paper's 10 technical references follow as [14]–[23] cited from Chapter 3 onward (recorded in the module docstring).
- **Verified:** 1 table with 13 rows (header + 12); all headings in order; Table 2.1 caption auto-numbered; chapter header/footer identical to Part 1; 0 dashes / 0 banned words; ends with 2.4 Summary.
- **Note:** per-part page numbers restart at 1; the final assembly pass will renumber continuously and fill Contents/LoF/LoT page columns.

### [2026-10-25] Task 24 — Chapter 2 literature verified online, corrected, and reordered by relevance

- **Status:** DONE (Part 2 rebuilt)
- **What:** User asked to reconfirm every literature entry on the internet, make it real where possible, and order the table most-relevant-first (base papers top, least relevant last).
- **Verification outcome (full record in `documentation/lit-survey-verification.md` with source URLs):**
  - 5 deck entries verified REAL, three with citation corrections: Cabaluna et al. is **IJACSA Vol. 15, Issue 11, 2024** (deck said Vol. 14/12); Zheng et al. is **Smart Agricultural Technology, Vol. 9, Elsevier 2024** (deck said IJABE); the India review is **Journal of Experimental Agriculture International 45(5): 1–15** (deck said IJRES). Rathod/Dubey (Procedia CS 85: 755–766) and COCOBOT (IJIRSET 3(3), 2014) were already correct.
  - 7 deck entries (Karthikeyan, Ramesh, Afsal, Sharma, Lakshmi, Suresh, Arun Kumar) returned **no publisher record under any title/author combination** — dropped. Topics preserved by 7 verified replacements: PickPerfect (IJNRD2504302, 2025), Shiju et al. (Grenze IJET 2025, YOLOv8 3-class maturity — repo Ref-Papers), Luthfie & Alamsyah (Joiser 3(2) 2025 — repo Ref-Papers), Fu et al. (IJABE 18(1) 2025, occlusion-aware cluster detection), Vijaya Ramnath et al. (IEEE ICPECTS 2024, autonomous climber), Sengun et al. (ISPRS UAV-g 2025), Atik & Arkali (Geomatics 6(2) 2026).
- **Decisions:**
  - D36 (table order, user directive): Table 2.1 rows ordered by relevance: [1] Cabaluna (base), [2] PickPerfect (base), [3]–[5] coconut ripeness vision, [6]–[9] coconut climbing/picking robots, [10] India review, [11]–[12] general UAV detector benchmarks. Base-paper subsections renumbered accordingly (2.2.1 = Cabaluna [1], 2.2.2 = PickPerfect [2]).
  - D37 (citation map for Part 6): table = [1]–[12]; the IRJMETS paper's 10 technical references become [13]–[22] (recorded in the verification file).
- **Verified in rebuilt Part 2:** 13 table rows in the new order; no unverifiable author names remain; corrected journals present; 0 dashes / 0 banned words.
- **Note:** if the guide knows any dropped entry as a real publication, send the PDF/link and it can be restored in place of an equivalent row.

### [2026-10-25] Task 25 — AllFindsPaper.md restructured into ranked selection; Chapter 2 synced

- **Status:** DONE (Part 2 rebuilt)
- **What:** User pointed to `Project Report/AllFindsPaper.md` (their Scribd finds with earlier verification notes: 5 verified papers incl. Amaran in IEEE/ASME TMech and two Megalingam surveys; 23 unverifiable uploads) and asked to pick the best papers unbiasedly, reorder that file itself with detailed position rationale, keep base papers untouched, and use the result for Chapter 2.
- **Changed (`AllFindsPaper.md` rewritten):** now structured as (1) locked base papers, (2) ranked selection for Table 2.1 positions 3–12 with a detailed why-this-position column (quality signal + relevance to our pipeline), (3) considered-but-not-selected with reasons (fuel climber 2022 — incomplete author record; Maheswaran — unverified; COCOBOT — superseded, low-tier venue; Atik — redundant benchmark; 7 unverifiable deck entries), (4) the citation map, (5) the original finds inventory preserved as an appendix.
- **Final Table 2.1 order:** [1] Cabaluna (base), [2] PickPerfect (base), [3] Shiju (same 3-class taxonomy as our model), [4] Luthfie, [5] Fu (vision→robotic picking), [6] **Amaran (IEEE/ASME TMech 2020 — best robotics paper, from the finds)**, [7] Zheng, [8] Megalingam 2024 Springer survey (finds), [9] Megalingam 2017 IOP survey (finds), [10] Kumar India review, [11] Dubey/Rathod 2016 (classic anchor), [12] Sengun benchmark (answers "why YOLOv8").
- **Changed (`content_ch2.py`):** table rebuilt in this order; 2.3 outcome citations re-pointed ([1]–[12]); the finds papers (Amaran, both Megalingam surveys) now carry accurate methodology/outcome cells from their verified records.
- **Verified in rebuilt Part 2:** 13 rows in strictly increasing relevance order; Amaran TMech + Springer survey rows present; all 2.3 citations resolve; 0 dashes / 0 banned words.
- **Note:** COCOBOT was dropped from the table in this quality pass (kept in the verification record). The finds-derived papers give Chapter 2 two IEEE/ASME-, Springer- and IOP-published anchors.

### [2026-10-25] Task 26 — Continuous page numbers, footer tab fix, Link column in Table 2.1

- **Status:** DONE (Part 1 and Part 2 rebuilt)
- **User requirements:** page numbers must CONTINUE across parts (no restart); footer must be dept-left / page-right with the gap between (it had drifted to the centre); table details must be true; humanizer skill always; add an Original Link column to Table 2.1 with real working links.
- **Root cause found for the footer drift:** Word's built-in "Footer" style carries its own tab stops (centre ≈3.25″, right ≈6.5″). Our paragraph-level right tab ADDS to those, so the first Tab after the department name jumped to the style's centre stop, putting "Page N" in the middle. Fix: header/footer paragraphs now use new **VHeader/VFooter styles derived from Normal** (no inherited tabs), so the only stop is our right tab at 6.27″. Applied to both parts.
- **Page-number continuity:** Part 1 (rebuilt with the footer fix) converted to PDF via Word (`docx2pdf`) = **4 pages**, so Part 2 is built with `pgNumType start=5` (builder env `PAGE_START`). Each future part will start at the previous part's last page + 1, measured the same way.
- **Table 2.1 changes:** 6th column "Original Link" added (8 pt cells, widths 0.35/0.95/1.3/1.2/1.15/1.3″) with the verified publisher/DOI link for all 12 papers (links recorded in `documentation/lit-survey-verification.md`). Citation corrections found while link-hunting: **Amaran is Vol. 26, pp. 288–299, 2021** (doi 10.1109/TMECH.2020.3014293) — year fixed from 2020; **Shiju et al. is Vol. 16, Issue 36** with authors Snehit T. Shiju, Sneha George, T. Jemima Jebaseeli.
- **Verified:** Part 2 pgNumType start=5; footer uses VFooter (no built-in Footer style), right tab 9029, PAGE field; all 12 links present; Amaran/Shiju corrections in; 13 rows; 0 dashes.
- **Backups:** `/tmp/Draft1-Part1-backup.docx` (pre-rebuild Part 1). Part 0 untouched.

### [2026-10-25] Task 27 — Link column removed from the college report (kept in the verification MD); Part 2 final review

- **Status:** DONE (Part 2 rebuilt)
- **What:** User clarified the Original Link column belongs only in `documentation/lit-survey-verification.md`, not the college report. Table 2.1 reverted to the department's 5-column format (Sl. No / Author, Year / Title, Journal / Methodology / Outcome) with 10 pt cells and the original widths.
- **Kept from Task 26:** page numbering starting at 5 (Part 1 = 4 pages), the VHeader/VFooter footer fix (dept left / Page N right), and the citation corrections (Amaran = IEEE/ASME TMech Vol. 26: 288–299, 2021; Shiju et al. = Grenze IJET Vol. 16, Issue 36). The links themselves remain recorded in `lit-survey-verification.md`.
- **Final review of Part 2 (full pass):** heading order 2.1→2.4 correct; Table 2.1 = 13 rows × 5 columns, caption auto-numbered; 2.3 citations consistent with the final ranking ([1]–[12]); no URLs or link column in the docx; 0 dashes / 0 banned words; ends with 2.4 Summary; footer/header verified.
- **No further changes needed.** Part 2 ready for the user's read; next step on their go: Part 3 (Chapter 3 Methodology, page numbering continues from Part 2's last page).

### [2026-10-25] Task 28 — Part 2 locked; Part 3 built (Chapter 3 Methodology)

- **Status:** Part 2 LOCKED by user. Part 3 BUILT, awaiting review.
- **What:** Wrote `build/content_ch3.py`; built `Draft1. Part 3.docx` — Chapter 3 METHODOLOGY, pages 9–12 (Part 2 rendered 4 pages via Word/docx2pdf; numbering continues).
- **Contents:**
  - Methodology narrative: stage-wise verified development, the two-sensing-roles split (drone wide-area vs close-up ripeness), Fig 3.1 (`diagrams/3.1-methodology-pipeline.png`, embedded, auto-numbered Fig 3.1), explanatory paragraph, then the **ten stages as ➢ bullets with bold lead-ins** (survey capture → ingestion/tiling → YOLO detection → permanent tree matching → twin viewer → ripeness inspection → inventory snapshots → harvest planning → robot execution → history/analytics), each carrying its real parameters (0.4/0.25 conf, 4 m Haversine, 0.7/0.3 hybrid score, 8-state machine, etc.).
  - Hardware-facing-simulation paragraph (D21 framing: response contracts allow hardware swap).
  - **3.1 Software Requirements** (7 categorized bullets: backend, AI/vision, frontend, telemetry, testing, deployment, tools) and **3.2 Hardware Requirements** (development computer + internet as what runs today; survey drone, robot camera, climbing robot as future integration targets through existing interfaces).
- **Verified:** pgNumType start=9; 1 embedded image; Fig 3.1 caption; 22 ➢ bullets; {FIG} cross-refs resolved (Ch1's fallback matches); footer VFooter/right-tab/PAGE; 0 dashes / 0 banned words.
- **Page ledger:** Part 1 = 1–4, Part 2 = 5–8, Part 3 = 9–12. Next part (Ch4) starts at 13 (recount before building).

### [2026-10-25] Task 29 — Casing fixes, Part 3 formatting pass, cloud framing, requirements clarified

- **Status:** DONE (Part 3 rebuilt; Parts 1–2 surgically patched)
- **What the user reported:** header shows "Ai Powered" (lowercase i); Part 3 has formatting gaps; 3.1/3.2 must be clean/clear/real; questioned whether SW/HW requirements belong in Chapter 3 and what "hardware requirements" means; new framing requirement — the cloud story (PostgreSQL on Neon, accessible remotely) must be stated wherever relevant.
- **Changes:**
  - **Header casing (root cause):** the builder used Python `str.title()`, which lowercases "AI" → "Ai". Fixed via an explicit `REPORT_TITLE_HEADER` constant; rebuilt Part 3; **surgically patched the locked Part 1 and Part 2 docx headers in place** (header XML text swap only — no other bytes touched; verified both now read "AI Powered Autonomous Coconut Harvesting System").
  - **Bullet spacing:** removed the double space after the ➢ glyph (single space now) in the builder.
  - **Part 3 formatting/content:** 3.1 rewritten as 9 crisp single-line bullets with real versions (Python 3.14, FastAPI/Uvicorn, SQLAlchemy 2, Neon PostgreSQL as its own Database bullet, YOLOv8/PyTorch CPU, Next.js 16/React 19/TS/Tailwind 4, next-intl, GSAP+Lenis, /ws/robot, Playwright+tsc+build gates, Docker/Vercel/Render/CI, Git/VS Code/npm). 3.2 rewritten to answer the user's question directly: two groups — (a) what the running system needs today (development computer 8 GB min / 16 recommended, GPU not required — training and all Chapter 5 experiments ran on the project's laptop; internet connection because DB/services are cloud-hosted) and (b) future integration hardware (survey drone, robot camera, climbing robot) joining through existing contracts.
  - **Cloud framing (user directive):** added to Part 3 (methodology paragraph: "cloud-deployed… plantation model, inventory and run history live in a cloud-hosted PostgreSQL database (Neon)… reachable from any device, from anywhere"; 3.2 bullets) and surgically appended to locked Part 1 (1.4 Deployment bullet now names Vercel/Render/Neon + accessible from anywhere) and Part 2 (2.3 closing paragraph now states the cloud database and remote access). Parts 1–2 patched via XML text replacement only.
- **SW/HW placement question — answered with evidence:** the scanned sample report's CONTENTS contains NO requirements section anywhere (its Chapter 3 is two pages of methodology); the requirements content exists only in the college PPT decks. Placing 3.1/3.2 inside Chapter 3 follows the user-approved TOC and common VTU practice (requirements inside the methodology/system chapter). Recommendation: keep as is; if the guide prefers sample purity, alternatives are folding them into Chapter 3 prose without numbers or moving them to the Appendix.
- **Verified:** Part 3 rebuilt (4 pages, 9–12), header "AI Powered…", single-space bullets, cloud phrases present, 0 dashes / 0 banned words; Parts 1–2 headers patched in place.

### [2026-10-25] Task 30 — Bullet fix applied to all parts; caption convention adopted from the user's Part 3

- **Status:** DONE
- **What the user asked:** apply the Part 3 formatting fixes to all parts; check figure-caption formatting against VTU/college sources and, if unspecified, adopt the user's Part 3 caption formatting.
- **Findings:** VTU specifies only chapter-wise figure/table numbering ("Fig 2.1 …, Table 3.1 …"), no style; the college sample shows a bold centered caption. The user's Part 3 caption ("Fig 3.1: Ten-stage methodology pipeline of the proposed system") is centered, 11 pt, **not bold**, with a colon after the number — adopted as the report standard per the user's directive.
- **Changed:**
  - Builder: VCaption/VTabCaption are no longer bold; captions render as `Fig C.N: Description` / `Table C.N: Description`. Part 4+ inherits automatically.
  - Part 1 & Part 2 (locked files, surgical XML patch only): the 13 + 6 double spaces after ➢ bullets fixed to single space; Part 2's table caption converted to the same convention (`Table 2.1: Literature survey of twelve studies`, non-bold via run-level `b w:val="0"` + VTabCaption style non-bold). Both files verified to open cleanly with 0 double-space bullets left.
  - `report-format-spec.md` §2 updated to record the caption convention and its source.
- **Untouched:** Part 0; everything else in Parts 1–2 (only the bullet spaces and the Part 2 caption text were modified in place).

### [2026-10-25] Task 31 — Chapter 1 opens with system overview (sample-faithful); page chain re-verified

- **Status:** DONE
- **What:** User showed the sample's Chapter 1 layout: two overview paragraphs between the chapter title and 1.1 Problem Statement. Our Part 1 jumped straight to 1.1. Fixed.
- **Changed:**
  - `content_ch1.py`: two overview paragraphs added (what the platform is — full-stack digital twin, pipeline summary, seven languages, cloud-hosted Neon PostgreSQL, monitorable from anywhere; and the hardware-ready framing — simulated components following real hardware contracts, stage-wise browser verification).
  - **Part 1 patched surgically** (insertion after the INTRODUCTION title paragraph, VBody/VBodyIndent styles, zero other bytes changed) — Part 1 still renders **4 pages** (the paragraphs fit page 4's remaining space).
  - Page chain re-measured after Task 29's edits: Part 2 now renders **5 pages** (the cloud sentence pushed it), so **Part 3's start was corrected from 9 to 10** (surgical pgNumType patch; also made fmt="decimal" explicit).
- **Page ledger (current truth):** Part 1 = 1–4 · Part 2 = 5–9 · Part 3 = 10–13. Part 4 will start at 14 (recount before building).
- **Verified:** intro paragraphs precede 1.1; all three parts open cleanly; 0 dashes in all parts.

### [2026-10-25] Task 32 — Part 4 built (Chapter 4, all 12 diagrams)

- **Status:** BUILT, awaiting user review. **Page ledger:** Part 1 = 1–4 · Part 2 = 5–9 · Part 3 = 10–13 · **Part 4 = 14–23.**
- **What:** Wrote `build/content_ch4.py`; built `Draft1. Part 4.docx` — Chapter 4 IMPLEMENTATION AND FLOW CHART with all 12 locked figures, each introduced by prose and followed by an explanatory paragraph (sample style).
- **Numbering decision (D38):** figure numbers now **match their sections**, exactly like the college sample (Fig 4.4.1 Level 0 lives under section 4.4). Builder `pass_numbering` changed: numeric hierarchical keys pass through as the final number (4.1.1, 4.2, 4.3.1, 4.4.1 …); word keys fall back to sequential. Table 2.1 numbering unaffected.
- **Figure order in the chapter:** 4.1.1 robot state machine + 4.1.2 mission-control dashboard (under 4.1 Modules) · 4.2 system architecture · 4.3 system flow · 4.3.1 harvest-mission execution flow · 4.4.1 DFD Level 0 · 4.4.2 DFD Level 1 · 4.5 use case · 4.6 activity · 4.7 sequence · 4.8 ER · 4.9 class. Prose includes the cloud framing (4.2), the two feedback cycles (4.3), the immutable-pointer design (4.8) and the hardware-ready class separation (4.9).
- **Verified:** 12 images embedded; 12 unique captions in order; all cross-refs resolved; sections 4.1–4.9 all present; pgNumType start=14; footer/header correct; 0 dashes / 0 banned words; rendered pages 14, 15, 16, 21, 22, 23 visually checked (figure sizing, caption form, dense ER/class legibility).
- **⚠️ Open defect carried into the render:** Fig 4.8 (ER) still shows the duplicate "ROBOT EVENTS" box (defect D-A) — it prints as-is until the user supplies a regenerated diagram; swap is one file replacement.

### [2026-10-25] Task 33 — 4.1 corrected with a generated module-architecture figure (user-approved)

- **Status:** DONE (Part 4 rebuilt)
- **What:** User challenged 4.1 "Modules": leading it with the robot state machine was title-mismatched, and no true "modules" figure existed. User approved generating one and keeping FSM + dashboard under 4.1.
- **Changed:**
  - **Generated** `documentation/diagrams/4.1.1-module-architecture.png` via `build/generate_module_diagram.py` (matplotlib, 200 dpi): 8 modules in snake pipeline order over the 6 data stores (D1–D6), "written only by the owning module" annotation, dashed re-seed feedback arrow from analytics to planning — same navy/green visual language as the existing diagrams.
  - 4.1 now flows: module map (Fig 4.1.1) → robot state machine (Fig 4.1.2) → dashboard (Fig 4.1.3), with prose re-pointed to the new numbering.
  - Part 4 rebuilt: **13 figures**, 11 pages → **pages 14–24**. `list-of-figures.md` and `report-content-map.md` synced (figure count now 32 ready).
- **Verified:** captions 4.1.1–4.9 in order; cross-refs resolved; 0 dashes / 0 banned words.
- **Note:** the generator script is committed to `build/` so the diagram is reproducible/editable on request.

### [2026-10-25] Task 34 — Fig 4.1.1 replaced with the user's illustrated version; pre-figure white space filled

- **Status:** DONE (Part 4 rebuilt and visually verified)
- **What:** User supplied their own illustrated module-architecture render (`00BD246C-…png`, kept at `Project Report/`) to replace my generated Fig 4.1.1, and asked to fill the white gaps before large figures with related text instead of leaving blank space (figures that do not fit still move to the next page).
- **Changed:**
  - `documentation/diagrams/4.1.1-module-architecture.png` replaced with the user's version (photos/icons variant, same content and structure).
  - Expanded seven section introductions in `content_ch4.py` with related, factual content so pre-figure pages fill: 4.3 (how to read the flow: stage numbers shared with Fig 3.1, edge legend, cloud backbone; remote-access framing), 4.4 (flow vs data-flow purpose; boundary statement), 4.4.2 (D1–D6 labels shared across flow/DFD/ER), 4.5 (packages mirror modules; single-tenant note), 4.6 (edge legend; the four decisions), 4.7 (nine lifelines; 13 steps; sync vs async; where the run record is written), 4.8 (16 of 22 entities; PK/FK/colour notation), 4.9 (notation legend; IllegalTransition; hardware-ready point).
- **Verified:** Part 4 now renders **12 pages = 14–25**; fresh PDF pages 17–20 visually checked — gaps filled, figures and captions correct; 0 dashes / 0 banned words. (An earlier PDF check had rendered stale content; re-converted fresh.)
- **Page ledger:** Part 1 = 1–4 · Part 2 = 5–9 · Part 3 = 10–13 · Part 4 = 14–25. Part 5 starts at 26 (recount before building).

### [2026-10-25] Task 35 — Chapter-start page skips, orphan rule, caption checks across Parts 1–4

- **Status:** DONE
- **User requirements:** (1) skip one page number at every chapter start from Chapter 2 onward (sample + VTU separator-sheet convention); (2) figure captions must sit below the image; (3) a subheading must carry at least two lines of its content — no heading stranded at a page bottom; (4) keep filling pre-figure white space with related text.
- **Changed (surgically, all four parts):**
  - **Skip rule:** chapter starts are now Ch1=1 · Ch2=6 · Ch3=12 · Ch4=17 — one number skipped before each chapter from Ch2 on (skipped: 5, 11, 16). Ledger: Part 1 = 1–4 · Part 2 = 6–10 · Part 3 = 12–15 · Part 4 = 17–29. Part 5 will start at 31 (skip 30), recounting before its build. CONTENTS page numbers will be filled with these values at the final assembly pass.
  - **Orphan rule (keep-with-next):** added to the VH1/VH2/VChapterNum/VChapterTitle/VTabCaption style definitions in all four files, and to every image paragraph (13 in Part 4, 1 in Part 3) so a figure can never be separated from its caption and a heading can never be stranded. Pagination shifted with this rule (Part 4 12→13 pages), hence the recount above.
  - **Caption placement verified:** all 13 figures in Part 4 are immediately followed by their caption; builders already emit captions below figures (tables keep the caption above, per VTU).
- **Builder:** same keep-with-next rules added for future parts (Part 5+ inherits).
- **Checks:** all four files open cleanly; footers show the new starts; 0 dashes across parts.

### [2026-10-25] Task 36 — Part 4 white space filled with walkthrough paragraphs; stale-render trap identified

- **Status:** DONE (Part 4 rebuilt, 13 pages = 17–29, start unchanged)
- **What:** User showed pages 24–29 carrying 20–30% dead space (each section's figure pushed to the next page left only one paragraph behind). Fixed by adding a **"Reading the …" walkthrough paragraph before the figure of sections 4.5–4.9** — package-by-package use-case reading, activity loop mechanics, the 13 sequence steps grouped, ER chain walkthrough, and class-diagram-to-sequence mapping — all factual, humanizer-clean.
- **Verified:** pages 24–27 now run nearly to the bottom (two full paragraphs per section); all five walkthroughs confirmed in the docx.
- **⚠️ Render trap (root cause found):** when the user has a part open in Word, `docx2pdf` converts Word's stale in-memory copy, so freshly built content appears "missing". **Rule: always convert a COPY under a different path** (e.g. `cp file /tmp/render.docx`) for page counting and visual checks. The Task 34 "stale PDF" incident had the same cause.
- **Ledger unchanged:** Part 4 = 17–29 (13 pages). Part 5 will start at 31 (skip 30), recounting before build.

### [2026-10-25] Task 37 — report-format-spec.md consolidated with all journey formatting decisions

- **Status:** DONE
- **What:** User asked to fold every formatting finding from the drafting journey into the spec MD. `documentation/report-format-spec.md` rewritten as the single consolidated reference (11 sections), superseding its earlier VTU-only draft.
- **Now captured in the spec:** Normal 1″ margins everywhere (user override of VTU suggestion); border only on front matter, header/footer rules on chapter pages; VHeader/VFooter Normal-derived styles and the Footer-style tab-stop trap; "AI Powered…" header casing; caption convention (11 pt, not bold, colon form, below figures / above tables); hierarchical figure numbers matching sections; chapter-start page skips with the live ledger (1–4 / 6–10 / 12–15 / 17–29 / Ch5 = 31); keep-with-next orphan rule; white-space discipline via "Reading the …" walkthrough paragraphs; placeholder policy; cloud + hardware framing content rules; humanizer verification loop; part-build env vars (REPORT_MODULES, PAGE_START, REPORT_OUT); the docx2pdf stale-copy render trap (always convert a copy); per-part verification checklist.
- This file is now the onboarding document for any future agent or person doing layout work.

### [2026-10-25] Task 38 — Part 5 built (Chapter 5, 24 figures + 5 tables)

- **Status:** BUILT, awaiting user review. **Page ledger:** Part 1 = 1–4 · Part 2 = 6–10 · Part 3 = 12–15 · Part 4 = 17–29 · **Part 5 = 31–51** (21 pages). Part 6 starts at 53 (skip 52).
- **What:** Wrote `build/content_ch5.py`; built `Draft1. Part 5.docx` — Chapter 5 RESULTS AND DISCUSSIONS with the full locked figure set, walkthrough-style prose (white-space discipline applied from the first draft, every page filled).
- **Contents:** 5.1 ingestion & tiling (2 figs) · 5.2 detection (2 figs incl. dataset samples; 242 detections → 242 matched, 0.974 avg confidence reported against its own screenshot) · 5.3 registry (255-tree later-session screenshot, explained as such) · 5.4 twin viewer (2 figs + **placeholder Fig 5.4.3** drawer) · 5.5 inspection (**placeholder Fig 5.5.1**; paper's 32-coconut end-to-end inspection cited) · 5.6 planner HM-0004 · 5.7 robot execution (2 figs) · 5.8 history (all-runs 23, run-23 summary with score 85.2 formula check 100×(0.5+0.35)=85.2, timeline) · 5.9 multilingual (picker at reduced width, Kannada + Hindi dashboards) · 5.10 verification (Tables 5.1–5.5 verbatim from the paper + confusion matrices, PR curves, routing charts, duplicates curve + throughput paragraph).
- **Builder fixes:** per-figure width override (language picker at 3.2″); hierarchical-number regex now accepts a/b suffixes (5.10.1a had fallen to sequential 5.1/5.2 — fixed, all 24 captions verified in exact order).
- **Verified:** 24 images embedded (2 placeholders); 5 tables (acc/checks/battery/routing/resurvey); captions 5.1.1→5.10.4 exact; cross-refs resolved; pgNumType start=31; renders 21 pages; 0 dashes / 0 banned words. Render trap avoided (converted the real path after the copy attempt failed; user did not have Part 5 open).

### [2026-10-25] Task 39 — Part 5 white space filled; duplicates removed

- **Status:** DONE (Part 5 rebuilt, 20 pages = 31–50; start unchanged)
- **What:** User reported white space on nearly every page of Part 5 (the "screenshot + one paragraph" pattern). Fixed with two levers:
  - **Width tuning:** the 14 UI screenshots reduced from 6.0″ to 5.5″ and the four square paper charts (5.10.1a/b, 5.10.2a/b) to 5.3″, so figure+caption blocks pack with text instead of forcing page breaks. (Language picker stays 3.2″.)
  - **Nine walkthrough paragraphs added** (one per thin section, all factual from the code): tile metadata & planner validation (5.1), detections-as-raw-boxes layering (5.2), identity rules — write-once codes, 0.7/0.3 score, representative-observation rule (5.3), snapshot semantics & inspection lifecycle (5.5), eligibility computation & tie-breaking (5.6), scheduler tick/telemetry/client-isolation details (5.7), metric derivation formulas (5.8), cookie locale & Noto fonts & guardrail (5.9), E5/E6/E7 experiment scope (5.10).
- **Fixed en route:** two duplicate paragraphs (5.8 metrics, 5.9 cookie) created by the earlier partially-applied patch — removed; all nine walkthroughs verified present exactly once; syntax-checked.
- **Verified visually:** pages 32–37 and 43–44 render full; placeholders sit naturally with text around them; Part 5 = 20 pages (31–50). Part 6 starts at 52 (skip 51); recount before its build.

### [2026-10-25] Task 40 — Gap captures G1/G2 placed; Part 5 placeholders resolved

- **Status:** DONE (Part 5 rebuilt, 20 pages = 31–50, unchanged)
- **What:** User added five new captures in `Project Report/New Folder With Items/`. Reviewed all five, picked the best per slot, renamed into `documentation/ui-screens/`, and dissolved the folder:
  - **Fig 5.4.3** ← `SCR-20261025-fvpl.jpeg` → `5.4.3-tree-details-drawer.jpeg` (Digital Twin with the TREE-0022 details drawer open: tree info, current inventory 35/7/8/20, inspection history, latest inspection images).
  - **Fig 5.5.1** ← `SCR-20261025-fvho.png` → `5.5.1-ripeness-inspection-snapshot.png` (Survey page, TREE-0022: completed inspection INSP-0013 with 4 images processed → snapshot INV-0020, 35 coconuts: 7 Mature, 8 Potential, 20 Premature).
  - Spares: `SCR-…-ftqh.png` → `extra-5.5-inspection-history.png`; `SCR-…-fury.png` → `extra-5.5-inspection-inprogress.png`; `SCR-…-fvve.jpeg` → `extra-5.4.3-drawer-crop.jpeg`.
- **Content updates:** both figph placeholder blocks replaced with real figures (5.8″ width); 5.4 lead-in now lists the drawer's contents and ties TREE-0022's inventory to section 5.5; 5.5 intro now cites the live demonstration result (INSP-0013, four images, 35 detections, snapshot INV-0020 with 7/8/20) alongside the paper's 32-coconut end-to-end run.
- **Gaps status:** G1 and G2 CLOSED. The only open defect is D-A (ER regeneration).
- **Registers synced:** `list-of-figures.md` and `report-content-map.md` updated (placeholders → real files, G1/G2 closed). Verified: 24 real images (no placeholders), prose mentions INSP-0013/INV-0020/TREE-0022, 0 dashes.
- **Housekeeping note:** single-line duplicate-paragraph risk from partial patches was checked and cleaned in Task 39; the inserts here used verified anchors.

### [2026-10-25] Task 41 — Part 6 built (Chapter 6 + References + Publications + Appendices A–D)

- **Status:** BUILT, awaiting user review. **Page ledger:** Part 1 = 1–4 · Part 2 = 6–10 · Part 3 = 12–15 · Part 4 = 17–29 · Part 5 = 31–50 · **Part 6 = 52–59** (8 pages). The DRAFT IS COMPLETE at 59 numbered pages + front matter.
- **Structure (matches the sample's CONTENTS tail):** Chapter 6 carries only 6.1 Conclusions and 6.2 Future Scope of Study; REFERENCES, PUBLICATIONS and APPENDIX follow as unnumbered back-matter sections.
- **Contents:**
  - **6.1 Conclusions** — four paragraphs: what was built (end-to-end pipeline, cloud-deployed, Neon, reachable from anywhere), the verification recap (100/100 determinism, 0 illegal transitions, 5.56–9.24% routing excess, 0 duplicates ≤1.1 m, 0.877/0.783 mAP, live run 85.2), the architectural separations that make results durable, and the integration contribution.
  - **6.2 Future Scope** — three ➢ groups: software (distance-aware battery rule, 2-opt refinement, canvas rendering, auth/multi-farm, mission-scoped planner config), hardware (physical robot via the HTTP/WS contract, GPS drone with RTK geotags, robot camera + post-harvest verification scans), research (local datasets incl. night/dusk, larger ripeness split, multi-class cluster detection, adaptive strategies).
  - **REFERENCES** — [1]–[12] in Chapter 2 table order, [13]–[22] IRJMETS technical references; 22 entries verified.
  - **PUBLICATIONS** — the IRJMETS citation with the "Autonomous" title (D22).
  - **APPENDIX** — A: API routers table (16 routers, 68 endpoints + WebSocket); B: database schema table (22 tables incl. the two retained legacy tables); C: deployment summary bullets (Vercel/Render/Neon, 2.7 GB CPU image, boot heal, CI); D: model training configuration table (both detectors, per paper Table 1).
- **Builder fix:** appendix tables now number as **Table A.1 / B.1 / D.1** (back-matter keys pass through instead of chapter-sequential).
- **Verified:** 8 pages; all sections present; 22 unique references; appendix table numbers correct; 0 dashes / 0 banned words.

### [2026-10-25] Task 42 — 6.2 Future Scope rewritten (user brief); appendix plan proposed

- **Status:** 6.2 DONE (Part 6 rebuilt, 8 pages = 52–59, unchanged). Appendix plan PROPOSED, pending user answers.
- **6.2 changes (user brief):** removed the battery-rule, route-refinement and rendering-scale bullets and the "618 images" line; kept multi-user/multi-farm hardening; added two big software items (predictive yield intelligence from the accumulated inventory history; crop-health detector on the same drone tiles) and an impressive field-real hardware programme (ring-type climber-harvester with IP-rated enclosure, Jetson-class edge AI on the robot, RTK multispectral drone, solar-assisted dock with 4G/LoRa backhaul, season-long pilot on partner coconut farms around Mysuru measuring time/damage/safety against human climbers). Research bullets kept, Mysuru-linked, 618 line removed.
- **Measured code-base stats for the appendix plan:** backend 45 Python files / 9,386 lines; frontend 46 TS/TSX files / 11,166 lines; deployment: Dockerfile.backend, compose.yml, render.yaml, GitHub Actions ci.yml; models: tree_detector.pt + coconut_detector.pt (6.2 MB each) with data.yamls.
- **Appendix restructure plan (proposed, awaiting approval):** A Source Code Structure (repo tree + module table + 3–4 representative excerpts, full code on the submission disc/repository per VTU software-project rule) · B Datasets (Roboflow CC BY 4.0: 10,343 + 7,297; self-collected Mysuru farm images: count needed from user) · C AI Models (model cards: classes, params, sizes, deployment, Hugging Face) · D API Endpoint List (existing) · E Database Schema (existing) · F Deployment Summary (existing) · G Model Training Configuration (existing).

### [2026-10-25] Task 43 — Appendix restructured to A–G (code, datasets, models + the existing four); Part 6 rebuilt

- **Status:** DONE (Part 6 rebuilt, **11 pages = 52–62**; total draft now 62 numbered pages + front matter)
- **What:** User approved the appendix plan (college video prescribes no structure), confirmed ~500 team-collected images (kept, framed as a field-validation set — a genuine differentiator), and asked what the code excerpts mean and where they lie.
- **New appendix structure:**
  - **A. Source Code Structure** — the VTU software-submission rule stated (full code on the repository/disc with a readme); measured stats (91 source files, ~20,550 lines: backend 45 files/9,386 lines, frontend 46 files/11,166 lines); repo tree as a code block; **Table A.1** module/location/files/lines/responsibility; and **Listings A.1–A.4** reprinting the four core modules: the frozen transition table (backend/robot/state_machine.py), the hybrid matching rule (backend/api/survey_api.py), the pure simulation step (backend/simulation/engine.py), and the shared farm-pixel layout (frontend/lib/mosaicLayout.ts).
  - **B. Datasets** — Table B.1: Roboflow corpora (10,343 + 7,297, CC BY 4.0) plus the team's ~500 field-validation photographs from coconut farms around Mysuru, Karnataka; total stated as more than 18,100 images.
  - **C. AI Models** — Table C.1 model cards: both YOLOv8n detectors (classes, 3,011,800 params, 6.2 MB, ~56/66 ms CPU inference, deployment endpoints, Hugging Face hosting).
  - **D–G** — API endpoint list, database schema, deployment summary and training configuration (existing content, re-lettered; tables D.1/E.1/G.1).
- **Builder:** code blocks now render one paragraph per line (robust line breaks); appendix table keys A–G pass through (Table A.1 style).
- **Verified:** 11 pages; all seven appendix sections and four listings present; tables A.1/B.1/C.1/D.1/E.1/G.1; 0 dashes / 0 banned words. (patch_appendix.py kept in build/ as the reproducible restructurer.)
- **Ledger:** Part 6 = 52–62. Full draft = 62 numbered pages + front matter. Remaining: final assembly (separator blanks, CONTENTS/LoF/LoT page fills) and the ER regeneration (D-A).

### [2026-10-25] Task 44 — FINAL ASSEMBLY: full report built with separator blanks and filled page numbers

- **Status:** DONE. **`Draft1. Full Report.docx` is the complete report**: front matter + Chapters 1–6 + References/Publications/Appendices, 38 figures, 12 tables, 22 references, 62 numbered pages plus front matter (iv–viii) and five blank separator sheets (5, 11, 16, 30, 51).
- **What was done:**
  - Full build from all seven content modules into one document; blank separator pages inserted before Chapters 2–6 (the skipped numbers, per the sample/VTU convention).
  - **Two-pass page numbering:** pass 1 built the full document; the page map was extracted from the verified per-part renders (front offsets: Ch1=1, Ch2=6, Ch3=12, Ch4=17, Ch5=31, Ch6=52) into `build/page_map.json`; pass 2 rebuilt with **CONTENTS chapter/section rows, List of Figures (38) and List of Tables (12) page columns filled**, including References (54), Publications (57), Appendix (57) and the A–G sub-entries (57/59/60/60/61/61/62).
  - Builder: separator logic (full builds only), page-map loader with section/figure/table lookups + appendix letter aliases, int-safe page rendering, per-line code-block rendering, A–G appendix table keys.
  - Verification (text-level, via python-docx): CONTENTS rows carry the ledger numbers; LoF/LoT rows carry per-figure/table pages (spot: Fig 3.1→12, Fig 4.1.1→18, Fig 5.10.4→49, Table 5.2→47); References/Publications/Appendix rows filled; appendix sub-entries filled.
- **⚠️ Render-trap note:** full-document PDF conversion via Word is unreliable while any part is open in Word (it exported the active document twice). Page numbers above were derived from the per-part renders instead; if a fresh full render is wanted, close all report files in Word first, then convert `Draft1. Full Report.docx` directly.
- **Remaining user items:** (1) ER regeneration (defect D-A) — swap `diagrams/4.8-er-diagram.png` and rebuild; (2) the manual Title Page / Certificate / Acknowledgement sheets (i–iii); (3) guide review; (4) print: cream cover, colour, one-sided.

### [2026-10-25] Task 45 — Part 0 completed: CONTENTS/LoF/LoT fully numbered (user's roman footers preserved)

- **Status:** DONE (Part 0 updated surgically; user's manual roman page numbers, border and formatting untouched)
- **What the user asked:** fill the CONTENTS page numbers cleanly (chapter rows carrying their post-skip start pages), reconfirm figure/description/page rows in the List of Figures, and make sure LoF/LoT/Abbreviation are all correct — changes in Part 0 only.
- **Changes (surgical, python-docx round-trip on Part 0 only):**
  - **CONTENTS:** all 54 rows now carry page numbers — front matter i–viii (pre-filled), chapter rows = post-skip starts (Ch1=1, Ch2=6, Ch3=12, Ch4=17, Ch5=31, Ch6=52), section rows from the measured map (1.1=1 … 2.3=9, 3.1=14, 4.1=17 … 5.10=44, 6.2=53), back matter (References=54, Publications=57, Appendix=57, A=57, B=59, C=60, D=60). A mangled Chapter 1 row ("… | Introduction | Introduction") repaired to "Chapter 1 | Introduction | 1"; double-tab artifacts normalised.
  - **List of Figures:** the 38 entry rows transplanted from the verified Full report after the header (figure number, final caption, page — Fig 3.1=12 … Fig 5.10.4=49).
  - **List of Tables:** the 12 entry rows transplanted (Table 2.1=6, 5.1=44, 5.2=47, 5.3=47, 5.4=48, 5.5=49, A.1=58, B.1=59, C.1=60, D.1=60, E.1=61, G.1=62).
  - **Abbreviation page:** verified unchanged and correct.
- **Incident:** the first transplant's rows were lost in a later save (rows present in memory, gone after reload); re-inserted with an immediate reload check — now stable (44+ rows verified across two reloads). Backup before all edits: `/tmp/Draft1-Part0-backup2.docx`.
- **Verification:** CONTENTS 54/54 rows numbered; LoF 38/38 rows with pages; LoT 12/12 rows with pages; sample rows correct; the user's roman footers, border and margins untouched.

### [2026-10-25] Task 47 — REVERTED: chapter-opener experiment removed from Parts 1–6 per user directive

- **Status:** DONE (Parts 1–6 restored; Part 0 untouched throughout)
- **What happened:** The user asked for big bold "CHAPTER N" text centred in the middle of its own page. I rebuilt Parts 1–6 with opener pages and shifted starts — the user stopped it mid-turn: **only Part 0 was to be touched.** All opener changes revoked.
- **Revert:** builder's chapter branch no longer emits opener pages (the unused VChapterOpener style/function remain in the builder source but emit nothing); Parts 1–6 rebuilt from source with the previous settings and page starts.
- **Verified:** Parts 1–6 = starts 1/6/12/17/31/52, page counts 4/5/4/13/20/8, no opener paragraphs, content intact; **Part 0 untouched** — CONTENTS rows fully numbered (e.g. "Chapter 5 → 31"), 38 LoF rows + 12 LoT rows with pages, user's roman footers/border intact.
- **Open formatting request (from the same message, NOT yet done — Part 0 scope):** convert List of Figures / List of Tables / Abbreviation to clean tables, and the abbreviation audit (remove UML — unused; add RTK, LoRa, RAM, CI, IEEE, CSE — used in the report/footers). Measured audit: all other current entries have ≥1 use in the report; CSE/VVIET appear in every footer.
- **Chapter-text centring request:** parked pending user clarification — the current chapter format (approved Part 1 screenshot) starts "CHAPTER N" left-aligned atop the content page; a mid-page centred opener requires an opener page, which the user just rejected for Parts 1–6. **Do not implement without explicit instruction.**

### [2026-10-25] Task 48 — Part 0: List of Figures / List of Tables / Abbreviation converted to clean tables; abbreviation audit applied

- **Status:** DONE (Part 0 surgically updated; user's manual edits preserved)
- **What the user asked:** convert List of Figures, List of Tables and Abbreviation into clean, properly formatted tables with the data inside; audit the abbreviations against the whole report (remove unused, add missed); do NOT touch their manually-numbered CONTENTS rows or their Part 6 changes (References/Publications/Appendix each on a new page — user measured 55/58/59 themselves).
- **Changes:**
  - **List of Figures** → bordered 3-column table (Figure No | Description | Page No), header row repeating across pages, 38 rows with page numbers (Fig 3.1=12 … Fig 5.10.4=49), Times New Roman 10 pt, widths 1.15/3.95/1.15″.
  - **List of Tables** → same format, 12 rows (Table 2.1=6, 5.1=44, 5.2=47, 5.3=47, 5.4=48, 5.5=49).
  - **Abbreviation** → bordered 2-column table (Abbreviation | Expansion), **36 audited entries**: removed UML (never used in the report); added CSE, CI, IEEE, LoRa, RAM, RTK (all used); every remaining entry verified with at least one use in the report text (VVIET/CSE appear in every page footer).
  - All three tables placed directly under their headings; old tab-row paragraphs deleted; table borders, header-repeat and cell fonts set via XML.
- **User's manual state respected:** CONTENTS rows untouched — section rows carry the measured numbers, chapter rows left blank by the user (their manual spacing preserved), back-matter rows are the user's own values (References 55, Publications 58, Appendix 59 — matching their Part 6 new-page edits, measured fresh: REFERENCES=55, PUBLICATIONS=58, APPENDIX=59).
- **LoT appendix rows synced to the user's new Part 6 pagination:** A.1=59, B.1=61, C.1=61, D.1=62, E.1=62, G.1=63 (measured from a fresh Part 6 render).
- **Note:** the A–D sub-entry rows do not exist in the user's Part 0 CONTENTS — matches the sample's clean "Appendix" entry; not added.
- Backup before edits: `/tmp/Draft1-Part0-backup3.docx`.

### [2026-10-25] Task 49 — formatting-audit.md written (read-only attribution document)

- **Status:** DONE (no report file touched — pure read-only audit via zipfile)
- **What:** User asked for an MD document listing every formatting choice actually used across the parts (fonts, sizes, "namespaces"/page setup, numbering), each attributed to College sample, University (VTU) or User — to clarify provenance when asked. Explicitly read-only: parts inspected via direct XML reads, nothing modified.
- **Created:** `documentation/formatting-audit.md` — 9 attribution tables: page setup (margins, border, spacing), header/footer (incl. casing fix), fonts/sizes per element, numbering (roman/arabic, chapter-start skips 5/11/16/30/51, section-matched figure numbers), list/table/abbreviation formats, chapter & content layout (opener state, orphan rule, white-space method), content conventions (humanizer, facts, cloud/hardware framing), and a **Known deviations** table for guide questions (Normal margins vs VTU 1.25/1/0.75; 14/13 pt headings vs VTU 16/14; ~175-word abstract vs VTU ≤100 — each with the reason and whose decision it was).
- **Measured highlights (from the files):** all parts on Normal 1″ margins; Part 0 carries the user's double-frame border and roman footer field; chapter pages carry title+rule header and Dept/Page footer; heading styles 16/18/14/13/12 pt TNR; 38 figures + 12 tables referenced with filled page numbers; Part 6 contains the user's 3 page breaks before References/Publications/Appendix.

### [2026-10-25] Task 50 — Page numbers re-measured after the user's margin/spacing changes; Part 0 numbers updated (numbers only)

- **Status:** DONE (Part 0 page numbers only; zero formatting/content changes anywhere)
- **What:** User updated margins to the VTU rules in all parts and made spacing changes (new page counts: P0 = 8, P1 = 4, P2 = 4, P3 = 4, P4 = 13, P5 = 20, P6 = 13). Asked to re-measure and update only the page numbers in Part 0.
- **Measured (fresh renders via copies, Word-exact):** front matter spans iv–xi (Contents v–vi, List of Figures vii–viii, List of Tables ix, Abbreviation x–xi); chapter starts with the skip rule: **Ch1 = 1 · Ch2 = 6 · Ch3 = 11 · Ch4 = 16 · Ch5 = 30 · Ch6 = 51** (skips 5/10/15/29/50); all section/figure/table positions extracted per part.
- **Updated in Part 0 (numbers only, run-level edits — labels, tabs, spacing, user's space-formatted chapter rows preserved):**
  - Front-matter rows: Contents v, List of Figures vii, List of Tables ix, Abbreviation x.
  - CONTENTS chapter rows: 1 / 6 / 11 / 16 / 30 / 51; all 27 section rows; back matter References 54, Publications 57, Appendix 58, A. 58, B. 60, C. 60, D. 61.
  - LoF table: all 38 page cells (Fig 3.1 = 11 … Fig 5.10.4 = 48).
  - LoT table: all 12 page cells (Table 2.1 = 6, 5.1 = 43 … A.1 = 58, G.1 = 62).
- **Not touched:** Parts 1–6, user's chapter-row spacing, back-matter values they typed (References/Publications/Appendix rows keep their tab structure), border, footers, fonts.
- **Note:** Part 6 back matter measured under the new margins: REFERENCES = 54, PUBLICATIONS = 57, APPENDIX = 58, Appendix A = 58, B = 60, C = 60, D = 61, E = 61, F = 62, G = 62 — the Part 0 values above match these measurements. (The user's own CONTENTS back-matter values — 55/58/59 — were typed under the previous margins and may need a one-number touch-up by them, or say the word and I'll align them.)

### [2026-10-25] Task 51 — CONTENTS page numbers corrected after the user's margin/spacing edits (Ch4–6 + Chapters 1–2)

- **Status:** DONE (Part 0 page numbers only; nothing else touched)
- **What:** User reported the subheading numbers from Chapter 4 on were not truly correct. Root cause: my Task 50 fill computed Chapter 4+ positions from a start-page miscalculation (Part 4 mapped from 16 instead of its real 17), shifting every Ch4 subheading and the back matter by −1; and Chapters 1–2 rows had lost their numbers in the user's manual edit.
- **Corrected (Part 0, numbers only — labels/tabs/spacing preserved):**
  - Chapter rows now read: Ch1 = 1 · Ch2 = 6 · Ch3 = 12 · Ch4 = 17 · Ch5 = 31 · Ch6 = 52 (matching each part's own pgNumType start exactly).
  - Chapter 4 subheadings: 4.1 = 17, 4.2 = 19, 4.3 = 20, 4.4 = 22, 4.5 = 24, 4.6 = 25, 4.7 = 26, 4.8 = 27, 4.9 = 28.
  - Chapter 5 subheadings unchanged (verified correct): 5.1 = 31 … 5.10 = 43.
  - Back matter corrected: References = 55, Publications = 58, Appendix = 59 (the user's original values — they were right; my Task 50 fill had overwritten them).
  - Chapters 1–2 rows filled: Chapter 1 = 1, Chapter 2 = 6.
  - LoF: Fig 3.1 corrected 11 → 12 (Part 3's first content page).
- **Verification:** line-level extraction from the margin-era renders (standalone heading lines only) confirms every number; CONTENTS = 50 numbered rows, 0 missing; LoF/LoT intact.
- **⚠️ One inconsistency flagged, user decision:** with the new margins Part 2 ends at page 9, so a single skip gives Chapter 3 = 11 — but the Part 3 file's numbering starts at **12** (two numbers skipped: 10 and 11). Left as the user set it; if a single skip was intended, Part 3's start should be 11 and everything after shifts −1.

### [2026-10-25] Task 52 — word-toolchain.md written (agent-facing toolchain guide)

- **Status:** DONE (documentation only; no report file touched)
- **What:** User asked for a document other AI agents can adopt: what tooling built the Word files, what scripts exist, how creation/editing/number-calculation works, and what can be built next.
- **Created:** `documentation/word-toolchain.md` — 9 sections: golden rules (locked files, humanizer, facts, ledger), disk layout, exact environment (uv venv + package versions + the broken-repo-venv pitfall), the block model (all 17 block kinds with shapes), builder invocation (env vars, part vs full builds), the two-pass page-numbering workflow (docx2pdf copy-trap, pypdf extraction, standalone-line heading matching, skip-rule chaining), the surgical-editing pattern for user-locked files (zipfile round-trips, run primitives, pgNumType patching, backups, reload verification), the verification checklist with code, the 9-pitfall table actually encountered, extension recipes (new chapters, related documents, diagrams, numbering changes).
- Cross-references `current-report.md`, `report-format-spec.md`, `report-content-map.md`, `lit-survey-verification.md` and the user-locked file list. Note: the user added `CHAPTER-Wise-Sheet.docx` to the folder (their own file — do not touch).

### [2025-10-25] Task 53 — Git: ignore rules set; documentation/toolchain pushed; Word drafts kept local

- **Status:** DONE — committed as `087a216` and pushed to `origin/main`
  (74 files).
- **What:** User asked to wire the report work into Git: ignore what should be ignored, push the rest. The Word drafts stay local — after the guide's changes the user will rename the final and trigger the rename+commit+push.
- **.gitignore additions:** `Project Report/*.docx` (all Word drafts + lock files), `Project Report/~$*`, `Project Report/build/placeholders/` (generated), `Project Report/documentation/COLLEGE_SCANNED-*.pdf` (third-party department-internal scan, kept local).
- **Pushed to origin/main:** documentation (formatting-audit.md, word-toolchain.md, report-format-spec.md, report-content-map.md, list-of-figures.md, lit-survey-verification.md, college-report-toc.md, diagrams/, ui-screens/, paper-figures/, images/PROJECT_UI, REF-Old-Docs-resources decks, VTU guidelines pdf), build/ toolchain (builder, content modules, page_map.json, diagram generator, patch scripts), current-report.md, AllFindsPaper.md, and the user's module-diagram PNG.
- **Deliberately not pushed:** Word drafts (Draft1. Part 0–6, Full Report, CHAPTER-Wise-Sheet), Word lock files, build/placeholders, the college sample scan.
- **Next Git action (on user's word):** after the guide's changes, rename the final docx and commit+push it.

---

## Current stage (for any agent reading this)

- **Where we are:** Report BUILD IS UNDERWAY, chapter-wise (D33). Front matter
  and Chapter 1 are written, built and open in the user's viewer. WAITING FOR
  USER REVIEW of front matter + Chapter 1 before Chapter 2 is written.
- **Next actions (in order):**
  1. User reviews draft (abstract wording, problem statement, objectives,
     scope, limitations) and requests edits; apply edits to
     `build/content_front.py` / `build/content_ch1.py`, rebuild.
  2. Chapter 2 (literature survey: 12-entry college table + base papers +
     paper's related work, outcome, summary) → build → review.
  3. Ch3 (pipeline figure + 3.1/3.2 requirements) → Ch4 (12 figures) →
     Ch5 (24 figures + 5 tables, placeholders at 5.4.3/5.5.1 keys) →
     Ch6 + References + Publications + Appendix A–D. Same review cadence.
  4. User supplies gap captures (G1 Fig 5.4.3 drawer, G2 Fig 5.5.1
     inspection) + regenerated ER diagram (defect D-A); replace placeholders.
  5. Final pass: page numbers in TOC/LoF/LoT; guide review; print (cream
     cover, colour).
- **Hard rules for this effort:**
  - `current-report.md` is strictly append-only (timeline entries; this stage
    summary is the only living section).
  - All facts/numbers come from repo docs + the IRJMETS paper — never invent.
  - ALL prose obeys the humanizer skill (D31); verify 0 dashes / 0 banned
    words after every build.
  - `paper/IRJMETS_Veraxis_Submission.docx` and `-EditedByauthor-Main.docx`
    must never be rebuilt/overwritten (repo rule).
  - Robot framing per D21 (hardware-ready software, simulated components
    mirror hardware contracts). Formatting per `report-format-spec.md`
    (sample wins over VTU text, D15). Build env: `/tmp/report-build-venv`
    (recreate via `uv venv /tmp/report-build-venv --python 3.13 && uv pip
    install --python /tmp/report-build-venv/bin/python python-docx pillow`
    if missing).

### [2026-10-25] Task 54 — Part 6 appendices reworked: A structure table (Times New Roman), B dataset screenshots, and a listings line-break repair

- **What the user asked:** review the new `SS/` dataset screenshots, add the ones that define the datasets (what we use, its link, how many images) into Appendix B, and rebuild Appendix A so the source-code structure is cleanly visible, in Times New Roman, explaining each part's responsibility (what / why / how). Touch only Part 6's appendix.
- **Screenshot review (11 files in `SS/`):** picked 3; copies live in `documentation/diagrams/` as `B.1-dataset-workspace-structure.png` (oagg: both workspaces' folder tree), `B.2-dataset-samples.jpeg` (nzia: close-up bunches + aerial views), `B.3-dataset-annotation.jpeg` (nxfo: image + YOLO label file). Rejected: near-duplicate crops (oaoq, oaqe, oawh too small), file-list dumps (obag, objq), redundant wide shots (nvoq, nwzz, ocab).
- **Dataset facts verified on disk** (not from memory): tree corpus = Roboflow "Coconut-tree Detector2" v8, CC BY 4.0, universe.roboflow.com/kevonteh-brown-8k5io/coconut-tree-detector2, local splits 9,048 / 865 / 430 = 10,343 images; ripeness corpus = Roboflow "Coconut Maturity Detection" v7, CC BY 4.0, universe.roboflow.com/coconut-maturity-detection/coconut-maturity-detection, local splits 6,384 / 618 / 295 = 7,297 images. Table B.1 numbers match the local counts exactly.
- **Appendix A change:** deleted the monospace ASCII tree (the jumbled block); Table A.1's Responsibility column rewritten with real per-folder responsibilities (what it contains, why and how it is used); intro paragraph updated to point at the table. Listings A.1–A.4 kept as Courier code (they are code, not structure).
- **Root-cause defect found and fixed (affects the whole appendix, pre-existing):** every `("code", ...)` block in `content_ch6_back.py` was written as adjacent string literals with no `\n`, so the builder emitted each listing as ONE collapsed line (Word showed the whole listing as run-on mush). All four listings now carry real newlines; the docx listings were rebuilt one VCode paragraph per line (70 total). This was part of the "jumbled" look the user flagged.
- **Method:** surgical in-place edit of `Draft1. Part 6.docx` via `/tmp/edit_part6_appendix.py` (python-docx), NOT a rebuild — the user's margin (1.25"/1"/0.75"/0.75"), spacing and border edits are preserved byte-for-byte outside the touched paragraphs. `content_ch6_back.py` updated in parallel so builder source and docx stay in sync for future rebuilds.
- **Verified:** copy converted to PDF (stale-copy rule), pages rendered and inspected: Appendix starts on labelled page 59 (unchanged, so Part 0 numbers hold: References 55, Publications 58, Appendix 59); Table A.1 clean TNR; listings line-broken; Figs B.1–B.3 with captions below; Appendix C now starts on page 64 (was 63) — Part 0 lists no A–D sub-entries so no Part 0 change needed. Humanizer scan clean (no banned words, no dashes).
- **Safety:** pre-edit backup at `Draft1. Part 6 (backup before appendix fix).docx` (delete after the user confirms) and `/tmp/Part6-pre-appendix-backup.docx`. **Part 6 was OPEN in Word during the edit — the user must close it WITHOUT saving and reopen to see the new appendix.**
