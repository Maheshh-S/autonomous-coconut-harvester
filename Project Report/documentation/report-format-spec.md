# Report Format Specification — VTU + VVIET college sample + journey decisions

Authoritative formatting rules for the Word (.docx) college report. Sources,
in priority order:

1. **VTU Examination Guidelines** — B.E./B.Tech. project-report rules
   (`documentation/Examination Guidelines – Visvesvaraya Technological
   University (1).pdf`).
2. **College sample report** (2024-25, guide-approved) —
   `documentation/COLLEGE_SCANNED-Project Report sample copy 2024-25 copy.pdf`.
3. **Decisions locked while drafting** (Tasks 9–36, `current-report.md`) —
   where these exist, they override 1 and 2. All of them are consolidated in
   this revision.

Where the sample and the VTU text differ, the **sample wins**; where the user
has explicitly formatted something (e.g. the Part 3 caption), the **user wins**.

---

## 1. Page setup

| Item | Value |
|---|---|
| Paper | A4 (210 × 297 mm), portrait |
| Printing | One side only |
| Line spacing | 1.5 (body), 1.0 (tables, code, header/footer) |
| Margins | **Word "Normal": 1″ on all sides, every section** (user decision, Task 20; supersedes the VTU 1.25/1/0.75 suggestion) |
| Alignment | Body justified |
| Page border | **Front matter only**: the user-applied double frame (thin-thick small gap top/left, thick-thin bottom/right, sz 24, 24 pt from page edge). **Chapter pages have no frame** — they carry the header/footer rules instead (user decision, Task 20). |

## 2. Fonts and sizes (all Times New Roman)

| Element | Size | Style |
|---|---|---|
| Chapter number ("CHAPTER 1") | 16 pt | Bold, left-aligned above the title |
| Chapter title ("INTRODUCTION") | 18 pt | Bold, CAPS, centered |
| Section heading ("4.1 Modules") | 14 pt | Bold, left |
| Subsection heading ("2.2.1 Base Paper I") | 13 pt | Bold, left |
| Body text | 12 pt | Justified, 1.5 spacing |
| Figure / table captions | 11 pt | **Not bold**, centered — `Fig 3.1: Description` / `Table 5.1: Description` with a colon (user convention from Part 3, Task 30) |
| Table cell text | 10 pt (8 pt for the literature table) | Header row bold |
| References | 12 pt | Numbered [n], hanging indent |
| Code listings | 10 pt | Courier New, single spacing |
| Running header | 11 pt | Left |
| Footer | 10 pt | Left + right |

## 3. Page decoration (actual, as built)

- **Front matter** (Part 0): user's border frame; headers/footers empty; roman
  page numbers starting at iv (title/certificate/acknowledgement are manual
  pages i–iii).
- **Chapter pages** (Parts 1+): **no page frame**. Running header = project
  title, left, 11 pt, with a 3 pt bottom rule. Footer = 3 pt top rule, then
  "Dept. of CSE, VVIET, Mysuru" left and "Page N" (live PAGE field) right,
  joined by a right-aligned tab at the text edge (6.27″).
- **Trap:** Word's built-in *Footer* style carries its own tab stops (centre
  ≈3.25″) that steal "Page N" to the middle. Header/footer paragraphs
  therefore use the **VHeader/VFooter styles derived from Normal** — never
  the built-in Footer style.
- **Running-header casing:** "AI Powered Autonomous Coconut Harvesting
  System" — never `str.title()`, which produces "Ai".

## 4. Numbering

- **Front matter:** roman i–viii (Title i, Certificate ii, Acknowledgement
  iii, Abstract iv, Contents v, List of Figures vi, List of Tables vii,
  Abbreviation viii).
- **Chapters:** Arabic. **One page number is skipped before every chapter
  start from Chapter 2 onward** (blank separator sheet; sample + VTU
  convention, user directive Task 35). Current ledger: Ch1 = 1–4 · Ch2 =
  6–10 · Ch3 = 12–15 · Ch4 = 17–29 · Ch5 starts 31.
- **Figures: numbers match their sections** (sample convention, Task 32):
  Fig 4.1.1/4.1.2/4.1.3 under 4.1, Fig 4.2 under 4.2, Fig 4.4.1/4.4.2 under
  4.4, Fig 5.6.1 under 5.6, etc. Captions sit **below** figures.
- **Tables:** sequential per chapter (Table 2.1, 5.1 …), caption **above**.
- **Sections/subsections:** decimal (1.1, 2.2.1, 4.4.1 …).
- **References:** [n] by first occurrence; Ch2 table = [1]–[12], PickPerfect
  base paper included; IRJMETS technical references follow as [13]–[22]
  (map in `lit-survey-verification.md`).

## 5. Chapter layout

- **No separate opener page** (sample-faithful, Task 20): each chapter begins
  directly with "CHAPTER N" (16 pt bold, left) then the chapter title
  (18 pt bold CAPS, centered), then body text.
- **Orphan rule (keep-with-next, Task 35):** every heading carries at least
  two lines of its content — keep-with-next is set on all heading styles,
  table captions, and every image paragraph (image stays glued to its
  caption). A heading or figure never strands at a page bottom.
- **White-space discipline (Tasks 34/36):** when a figure does not fit and
  moves to the next page, the gap is filled with *related* content — a
  "Reading the …" walkthrough paragraph before the figure (how to read the
  diagram, legends, concrete element walkthroughs). No dead zones.

## 6. Figures and placeholders

- Figures centered at 6.0″ width (6.27″ text area).
- Placeholder policy: missing figures get a same-ratio grey dashed box
  labelled `PLACEHOLDER — Fig <key>`; the user supplies final images and they
  drop in without layout change. Open placeholders: Fig 5.4.3 (Tree Details
  drawer), Fig 5.5.1 (ripeness inspection + snapshot).
- Generated diagrams (e.g. the 4.1 module map) live in
  `documentation/diagrams/` with their generator script in `build/`, so they
  are reproducible on request. User-supplied replacements are dropped in over
  the same filename.

## 7. Front matter order and content

Title Page (i) → Certificate (ii) → Acknowledgement (iii) → Abstract (iv,
~120–180 words, VTU-first stretched toward the sample) → Contents (v) →
List of Figures (vi) → List of Tables (vii) → Abbreviation (viii, title case).

- **Contents layout:** chapter rows = "Chapter N" + tab (1.15″) + Title-case
  name, 16 pt space-before; subsections indented 0.6″; page column =
  right-aligned tab at 5.6″; no dot leaders.
- **List of Figures / Tables:** three-column header row ("Figure No /
  Description / Page No."), regular weight, description column at 1.9″,
  entries flush left, page column right-aligned at 5.6″.
- **Abbreviation:** bold abbreviation, expansion at a 1.6″ tab.
- Title page, certificate and acknowledgement are **made manually by the
  user** — the builder starts at the Abstract.

## 8. References (VTU format)

Serially numbered by first occurrence, cited as [n]. Textbook and paper
formats per the VTU examples. Final list = [1]–[12] (Chapter 2 table, in
table order) + [13]–[22] (IRJMETS technical references).

## 9. Physical submission (VTU)

CS/IS outer cover = CREAM · hard bound, plastic cover · guide approval before
final print · abstract ≤ 100 words + 4 copies to the department (we print the
sample-style longer abstract in the report; check with the guide) ·
presentation quality carries 40/100 marks.

## 10. Content rules (writing-side)

- **Humanizer skill governs all prose** (`.claude/skills/humanizer/`): no
  em/en dashes, no "not X but Y" staging, no one-line closers, no stock AI
  words (crucial, pivotal, robust, additionally, seamless, leverage …), plain
  is/are/has verbs. Verified programmatically after every build (0 dashes,
  0 banned words).
- **Facts:** every number comes from the repo docs or the IRJMETS paper —
  never invented. Different screenshots' numbers (242 / 243 / 255) are each
  reported only against their own source.
- **Cloud framing:** wherever deployment or data storage is mentioned, state
  that all data lives in the cloud PostgreSQL (Neon) and the platform is
  reachable remotely from any device.
- **Hardware framing:** simulated components follow the response contracts of
  their real counterparts; hardware replaces them behind stable interfaces
  (D21). The robot is described as simulated; no overclaiming.
- **Voice:** the college sample is the writing sample (formal register, caps
  headings, ➢ bullets with bold lead-ins); its conventions override pattern
  rules where they conflict.

## 11. Build system (Part-wise workflow)

- Builder: `Project Report/build/build_report.py` + `content_*.py` modules;
  run with the venv at `/tmp/report-build-venv` (uv Python 3.13,
  python-docx + Pillow + docx2pdf + matplotlib).
- **Part builds:** `REPORT_MODULES=content_chN PAGE_START=<n> REPORT_OUT=…`
  — each part is one chapter; `PAGE_START` chains the page numbers.
- **Page counting:** convert with `docx2pdf` (uses Word for exact
  pagination) and count `/Type /Page` in the PDF. **Always convert a COPY
  under a different path** — if the file is open in Word, docx2pdf renders
  the stale in-memory copy (Tasks 34/36).
- **Verification after every build:** captions in order, cross-refs
  resolved, page start correct, 0 dashes, 0 banned words, images embedded.
- **Ledger maintenance:** after each part, record the page range in
  `current-report.md` and compute the next part's start (previous end + 1
  skipped number).
