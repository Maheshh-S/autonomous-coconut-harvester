# Formatting Audit — what the report actually uses, and whose rule it follows

Read-only audit of the seven built files (`Draft1. Part 0–6.docx`, measured
directly from their XML on 2025-10-25 — no file was modified). Each row states
the formatting actually present **in the files**, and whose decision it
follows: **College** (the guide-approved sample report), **University**
(VTU B.E./B.Tech. project-report guidelines), or **User** (your explicit
instruction or manual edit during drafting). Where a rule exists in more than
one source, the strictest applicable source is named first.

Sources:
- **VTU** = `VTU-examination-guidelines.pdf`
- **College** = `COLLEGE_SCANNED-Project Report sample copy 2024-25 copy.pdf`
- **User** = your directives/manual edits (logged in `current-report.md`,
  Tasks 9–48)

## 1. Page setup

| Aspect | Actual value in the files | Follows | Note |
|---|---|---|---|
| Paper size | A4 (210 × 297 mm) | University | VTU mandates A4 bond |
| Margins | **1″ (Normal) on all four sides, every part** | **User** | VTU suggests Left 1.25″ / Right 1″ / Top-Bottom 0.75″; you replaced them with Word "Normal" margins in your manual edit — kept ever since |
| Line spacing (body) | 1.5 lines | University + College | both specify 1.5 |
| Printing side | Single-sided | University | |
| Page border | Front matter only: thin-thick / thick-thin small-gap double frame, 3 pt, 24 pt from page edge | **User** (styled after the College sample) | VTU says nothing about borders; chapter pages deliberately have no frame — they carry the header/footer rules instead |
| Vertical alignment | Top (default) — chapter text is not vertically centred | College sample | the sample's big mid-page "CHAPTER 1" sheet exists, but our chapters start at the top of the content page per your Part 1 screenshots |

## 2. Running header and footer (chapter pages)

| Aspect | Actual value | Follows | Note |
|---|---|---|---|
| Header text | "AI Powered Autonomous Coconut Harvesting System", left, 11 pt, Times New Roman | College | same position/idea as the sample's running title |
| Header rule | 3 pt black bottom border under the header | College | sample shows the heavy rule under the title |
| Footer | "Dept. of CSE, VVIET, Mysuru" left + "Page N" right, 10 pt | College | matches the sample footer exactly |
| Footer rule | 3 pt black top border above the footer | College | matches the sample |
| Front matter header/footer | No header; footer = centred roman page number field (your manual addition in Part 0) | **User** | sample shows roman numerals centred at the bottom — you implemented the field yourself |
| Casing | "AI Powered…" (AI capitalised) | **User** | fixed after the "Ai" bug you spotted |

## 3. Fonts and sizes (all Times New Roman)

| Element | Size in files | Follows | Note |
|---|---|---|---|
| Body text | 12 pt, justified, 1.5 spacing | University + College | VTU: "body or the text of the report should have font size 12" |
| Chapter number ("CHAPTER 1") | 16 pt bold, left, on the content page | University | VTU: chapter number size 16 |
| Chapter title ("INTRODUCTION") | 18 pt bold, CAPS, centred | University + College | VTU: size 18 centred; sample identical |
| Section heading ("1.1 Problem Statement") | **14 pt bold, left** | **User** (sample-aligned) | VTU prescribes 16 pt for section headings; the college sample visibly uses ~14 pt, and you asked to match the screenshots — this is a conscious deviation from the VTU text |
| Subsection heading ("1.2.1 Aim") | **13 pt bold, left** | **User** (sample-aligned) | VTU prescribes 14 pt; sample shows smaller |
| Figure captions | 11 pt, centred, **not bold**, colon form "Fig 3.1: Description", placed **below** the figure | **User** | VTU specifies only chapter-wise numbering, no style; the sample's bold form was replaced by your Part 3 formatting |
| Table captions | 11 pt, centred, not bold, colon form, placed **above** the table | **User** (consistent with figure captions) | |
| Code listings | 10 pt Courier New, single spacing | College | sample prints code in the appendix |
| Table cell text | 10 pt (8 pt in the 6-column literature table) | **User** | density choice for the wide tables |
| Bullets | ➢ arrow glyph, single space, hanging indent 0.25″/0.45″, bold lead-ins | College | matches the sample's ➢ bullets with bold categories |

## 4. Numbering

| Aspect | Actual value | Follows | Note |
|---|---|---|---|
| Front matter numbering | roman i–viii (Title i, Certificate ii, Acknowledgement iii, Abstract iv, Contents v, List of Figures vi, List of Tables vii, Abbreviation viii); numbering starts at iv in the file because your manual Title/Certificate/Acknowledgement sheets take i–iii | University + College | both use roman front matter |
| Chapter numbering | Arabic from 1 | University + College | |
| **Chapter-start skips** | One page number skipped before every chapter from Chapter 2: **5, 11, 16, 30, 51** | University + College | VTU allows thin separator sheets between chapters; the sample's CONTENTS shows the same skips (5 and 12) |
| Section numbering | decimal (1.1, 2.2.1, 4.4.1 …) | University | |
| Figure numbering | chapter-wise **and matching the section**: Fig 4.1.1–4.1.3 under 4.1, Fig 4.4.1/4.4.2 under 4.4, Fig 5.6.1 under 5.6 | College | the sample numbers figures to their sections; user confirmed |
| Table numbering | sequential per chapter (Table 2.1, 5.1–5.5), appendix tables A.1/B.1/C.1/D.1/E.1/G.1 | University + College | |
| Page-number skips (current ledger) | Ch1 = 1–4 · Ch2 = 6–10 · Ch3 = 12–15 · Ch4 = 17–29 · Ch5 = 31–50 · Ch6 = 52–62+ | **User** | you set the final chapter starts and the References/Publications/Appendix page breaks in Part 6 |

## 5. Lists, tables and abbreviations (Part 0)

| Aspect | Actual value | Follows | Note |
|---|---|---|---|
| List of Figures | bordered 3-column table (Figure No | Description | Page No), header repeating, 38 rows with page numbers, 10 pt | **User** | neither VTU nor the sample prescribes a table; you asked for "a clean table" |
| List of Tables | same table format, 12 rows | **User** | |
| Abbreviation | bordered 2-column table (Abbreviation | Expansion), 36 audited entries | **User** | audit: UML removed (never used); RTK, LoRa, RAM, CI, IEEE, CSE added (used in the report/footers); every entry verified with at least one use |
| Contents rows | "Chapter N → tabbed title → page" with a 16 pt gap above chapters; subsections indented 0.6″; page column right-aligned at 5.6″; no dot leaders | College | matches the sample's CONTENTS layout |
| CONTENTS page numbers | filled from the measured ledger; chapter rows carry the post-skip starts (1, 6, 12, 17, 31, 52); back matter per your Part 6 edits (55/58/59) | **User** | you verified and manually adjusted them |

## 6. Chapter and content layout

| Aspect | Actual value | Follows | Note |
|---|---|---|---|
| Chapter opening | "CHAPTER N" (16 pt bold) directly above the centred title, content flows on the same page — no separate opener sheet | College (your Part 1 screenshots) | the sample also opens with the heading on the content page; the earlier mid-page opener experiment was reverted on your instruction |
| Heading orphan rule | keep-with-next on every heading and every image (a heading carries ≥2 lines of content; a figure never separates from its caption) | **User** | layout-quality rule added at your request |
| White-space handling | pre-figure gaps filled with "Reading the …" walkthrough paragraphs instead of blank space | **User** | your directive during Part 4 |
| Paragraph indents | first paragraph after a heading flush; continuation paragraphs indented 0.3″ | College | matches the sample |
| Figure placement | centred, 6.0″ width (UI screenshots 5.5″, small figures smaller) | **User** | width tuning to avoid page-break gaps |

## 7. Content conventions (writing-side)

| Aspect | Rule | Follows | Note |
|---|---|---|---|
| Prose style | humanizer rules: no em/en dashes, no staged contrasts, no stock AI vocabulary, plain verbs | **User** | verified programmatically (0 dashes / 0 banned words) after every build |
| Facts | every number sourced from the repo or the IRJMETS paper — never invented | User + paper | e.g. 242 detections reported against its own screenshot, not smoothed |
| Robot framing | hardware-ready software; simulated components follow real hardware contracts | **User** | stated in Ch1, Ch3, 5.7, 6.2 |
| Cloud framing | data lives in the cloud PostgreSQL (Neon); platform reachable remotely | **User** | Ch1, Ch3, Ch6 |
| References | serial [n] by first occurrence; [1]–[12] literature table, [13]–[22] technical | University | all 22 verified real and searchable |

## 8. Known deviations (for the guide's questions)

| Deviation | From | Why |
|---|---|---|
| Margins 1″ instead of VTU's 1.25/1/0.75 | University text | your manual choice (Word Normal), applied consistently |
| Section headings 14/13 pt instead of VTU's 16/14 | University text | matches the guide-approved sample's visual sizes, per your screenshots |
| Abstract ~175 words instead of VTU's ≤100 | University text | balanced between the VTU rule and the sample's full page, per your instruction |
| Bibliography style slightly simplified (no italics markup in places) | VTU format examples | keeps generated output consistent; all entries are real and searchable |
| Everything else | — | follows VTU and the college sample |

## 9. One-line summary

Page setup, borders, header/footer design, caption style, list layouts and
chapter-openers follow the **college sample as you formatted it**; font sizes,
spacing, decimal/roman numbering, chapter-wise figure/table numbering,
references format and submission rules follow **VTU**; margins, heading sizes,
caption style, skips, list tables and the abbreviation audit carry **your
explicit overrides** — all measured from the files, none assumed.
