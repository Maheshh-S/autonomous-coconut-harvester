# Word Toolchain — how the report files are built, edited, verified and extended

**Audience:** any AI agent or developer asked to create, edit, re-number,
verify or extend the college-report Word documents in
`Project Report/`. Read this before touching anything.

**Golden rules first:**
1. **Never touch `Draft1. Part 0.docx`, `Draft1. Part 6.docx` or
   `CHAPTER-Wise-Sheet.docx` without an explicit user go-ahead for that
   exact change** — they carry the user's manual edits (roman footers,
   borders, contents numbers, new-page breaks). Every other part can be
   regenerated from source.
2. All prose obeys the **humanizer skill** (`.claude/skills/humanizer/`):
   no em/en dashes, no staged contrasts, no stock AI words. Verified
   programmatically after every build.
3. All facts come from the repo docs and the IRJMETS paper — never invent.
4. `current-report.md` is the append-only task ledger; append after every
   action. `report-format-spec.md` holds the formatting rules;
   `report-content-map.md` the figure wiring; `formatting-audit.md` the
   provenance of each formatting decision (College / University / User).

---

## 1. What exists on disk

```
Project Report/
├── Draft1. Part 0..6.docx     the chapter-wise draft parts (Part 0 and 6
│                              are user-edited: DO NOT regenerate)
├── Draft1. Full Report.docx   the assembled single document (pass-2 build)
├── CHAPTER-Wise-Sheet.docx    user's own file (do not touch)
├── documentation/             rules + registers (formatting-audit.md,
│                              report-format-spec.md, report-content-map.md,
│                              lit-survey-verification.md, diagrams/,
│                              ui-screens/, paper-figures/)
└── build/                     THE TOOLCHAIN (this document's subject)
    ├── build_report.py        the builder (all logic)
    ├── content_front.py       front matter blocks
    ├── content_ch1..ch6_back.py  chapter content blocks
    ├── page_map.json          measured page numbers (two-pass build)
    ├── generate_module_diagram.py   draws Fig 4.1.1 (matplotlib)
    ├── build_part0_tables.py  one-off: converted Part 0 lists to tables
    ├── patch_appendix.py      one-off: restructured the appendix
    └── placeholders/          generated placeholder images
```

## 2. Environment (exact, with the pitfalls)

A dedicated uv venv — **the repository's `venv/` is broken** (Homebrew
Python 3.14 pyexpat/libexpat mismatch, and Homebrew 3.12 fails
`platform.mac_ver()`). Always use:

```bash
uv venv /tmp/report-build-venv --python 3.13
uv pip install --python /tmp/report-build-venv/bin/python \
    python-docx pillow docx2pdf pypdf matplotlib
```

Installed: python-docx 1.2.0, Pillow 13.0, pypdf 6.21, docx2pdf 0.1.8
(drives **Microsoft Word** via AppleScript — Word must be installed),
matplotlib 3.11.

## 3. The block model — how content is written

Every chapter is a `content_*.py` module exporting `BLOCKS`, a list of
tuples. The builder walks them in order. Block kinds:

| Block | Shape | Renders as |
|---|---|---|
| `chapter` | `("chapter", "4", "IMPLEMENTATION AND FLOW CHART")` | new section (arabic numbering continues) + "CHAPTER 4" 16 pt + centred 18 pt title |
| `back_chapter` | `("back_chapter", "REFERENCES")` | centred back-matter heading (no chapter number) |
| `h1` / `h2` | `("h1", "4.1  Modules")` | 14 pt / 13 pt bold, keep-with-next |
| `body` | `("body", "text…")` | 12 pt justified; a body right after another body gets the 0.3″ first-line indent |
| `bullets` | `("bullets", [("Lead:", "rest"), …])` | ➢ bullets, bold lead-ins, hanging indent |
| `fig` | `("fig", "4.2", "diagrams/x.png", "Caption", 5.5)` | centred image (width optional, default 6.0″) + caption below `Fig 4.2: Caption` |
| `figph` | `("figph", "5.4.3", "Caption", (16, 10))` | same-ratio grey dashed placeholder box |
| `table` | `("table", "A.1", "Caption", headers, rows, widths, 9)` | bordered table, caption above `Table A.1: …`, repeating header, 10 pt (or given size) |
| `lof` / `lot` | `("lof",)` | List of Figures / Tables tables, rows from the registry |
| `toc_lines` | `("toc_lines", ["Chapter 1\tIntroduction\t", …])` | CONTENTS rows |
| `abbr_rows` | `("abbr_rows", [("AI", "Artificial Intelligence"), …])` | abbreviation table rows |
| `ref` | `("ref", "[1] …")` | hanging-indent reference row |
| `code` | `("code", "line\nline")` | 10 pt Courier block (one paragraph per line) |
| `front_heading` | `("front_heading", "ABSTRACT")` | centred 16 pt front-matter heading |
| `pagebreak` / `spacer` | — | — |

Cross-references: write `{FIG:key}` / `{TAB:key}` anywhere in text; the
builder replaces them with the final number.

**Figure/table numbering:** numeric keys pass through unchanged and match
their sections (Fig 4.1.1, 4.4.1, 5.6.1 — the college-sample convention);
word keys get sequential `chapter.N` numbers. Tables use sequential
`chapter.N` unless the key is `A.1`-style (appendix). Regexes in
`pass_numbering` also accept `a/b` suffixes (`5.10.1a`).

## 4. Running the builder

```bash
cd "Project Report/build"

# one part (chapter-wise review):
REPORT_OUT="../Draft1. Part 6.docx" \
REPORT_MODULES=content_ch6_back PAGE_START=52 \
/tmp/report-build-venv/bin/python build_report.py

# full assembled report (all modules, separator sheets between chapters):
REPORT_OUT="../Draft1. Full Report.docx" \
/tmp/report-build-venv/bin/python build_report.py
```

Env vars: `REPORT_OUT` (output path), `REPORT_MODULES` (comma list of
content modules; unset = all present), `PAGE_START` (displayed start
number for part builds), `CH1_BODY` (1 = include Chapter 1 body; withheld
flag existed for Part 0 review).

The builder handles: A4, margins (Normal 1″), the Part 0 double border +
roman numbering (lowerRoman start=4), chapter sections (decimal numbering,
header "AI Powered…" + 3 pt rule, footer "Dept. of CSE, VVIET, Mysuru ·
Page N" + rule), styles (VChapterNum 16, VChapterTitle 18, VH1 14, VH2 13,
VBody 12, VCaption 11 non-bold colon form, VCode, VRefText, VFrontRow…),
keep-with-next on headings and images, separator page breaks between
chapters (full builds only), per-line code rendering, and the LoF/LoT
registries with page columns.

## 5. Two-pass page numbering (how the CONTENTS/LoF/LoT get real numbers)

Pagination is only known after Word renders the file, so:

1. **Pass 1:** build → convert → extract. Conversion must go through Word
   (`docx2pdf`): **copy the file to a NEW path and convert the copy** — if
   the original is open in Word, `docx2pdf` renders Word's stale in-memory
   copy (this bit twice). Then read the PDF with `pypdf`, normalise each
   page's text, and locate every "CHAPTER n", section heading, "Fig x:"
   caption and "Table x:" caption. Match headings as **standalone lines**
   (`"4.8 ER Diagram"` as a whole line) — substring matching against body
   text produces false hits. Write `build/page_map.json`:
   `{"sections": {heading: page}, "figures": {num: page}, "tables": {…}}`.
   Chapter displayed numbers = each part's own `pgNumType` start + PDF page
   index; part starts chain by the **skip rule** (next chapter starts at
   previous end + 1 skipped number).
2. **Pass 2:** with `page_map.json` present, the builder fills the page
   columns of the CONTENTS rows, LoF and LoT (via the `sec_map`/`fig_map`/
   `tab_map` lookups) and the `{FIG:}`/`{TAB:}` cross-references. Rebuild.
3. Verify with python-docx (`paragraph.text`, tabs → " | "): every row
   ends with its number; spot-check against the PDF.

## 6. Surgical editing of user-locked files (the safe pattern)

When a file carries manual user edits that must survive (Part 0, Part 6),
never regenerate it. Instead:

1. `cp file /tmp/backup.docx` first.
2. Load with python-docx **or** edit the XML in place through
   `zipfile` (read every entry, rewrite the archive) — the zip route is
   safest when only text changes.
3. Useful primitives:
   - find a paragraph: search `word/document.xml` for a text marker, walk
     back to `<w:p`, forward to `</w:p>`;
   - replace text in `<w:t>` only (never touch `<w:rPr>`/`<w:pPr>` =
     formatting preserved);
   - `Run.text = "…\t…"`: python-docx converts `\t` to real `<w:tab/>`
     elements (used for the CONTENTS page numbers);
   - `paragraph_format.keep_with_next = True` binds headings to content
     and images to captions;
   - page numbers: patch `<w:pgNumType w:fmt="decimal" w:start="N"/>` in
     the section's `sectPr` (attribute order varies — match loosely);
   - duplicate-paragraph risk when a patch runs twice: always
     `assert marker in text` and verify after reload.
4. Verify after every patch: reopen, count paragraphs/tables/images, run
   the humanizer scan (0 dashes, 0 banned words), confirm the marker
   text.

## 7. Verification checklist (run after EVERY build or patch)

```python
import zipfile, re, html
doc = zipfile.ZipFile(f).read("word/document.xml").decode()
t = html.unescape(re.sub(r"<[^>]+>", " ", doc.replace("<w:tab/>", " § ")))
assert sum(t.count(c) for c in "——–") == 0          # no dashes
assert not re.search(r"\b(crucial|pivotal|robust|seamless|additionally|"
                     r"leverage|delve|showcase|underscore)\b", t, re.I)
# captions in order, images embedded, page starts, no stray {FIG: tokens
```

Also: `p.text` splits at run boundaries — a "missing" row usually just
means the extraction ignored `<w:tab/>` or split runs; verify against
runs/paragraph.text, not raw regex on `w:t`.

## 8. Pitfalls actually hit (do not rediscover these)

| Pitfall | Lesson |
|---|---|
| `str.title()` lowercases "AI" → "Ai" | never auto-title-case; explicit constants |
| Word's built-in *Footer* style injects centre/right tab stops | derive header/footer paragraphs from Normal (VHeader/VFooter styles) |
| `doc.add_section()` clones the previous `sectPr` | page borders duplicate — remove old `pgBorders` before adding |
| `docx2pdf` renders Word's active document when the file is open | always convert a copy under a different path; verify the PDF page count |
| `head -3` on the build can SIGPIPE-kill the script mid-write | build first, pipe output separately |
| `Run.text` setter converts `\t` to `<w:tab/>` | extraction must normalise tabs before matching |
| repo `venv/` pip broken (3.14 pyexpat) | use the uv venv, never `venv/bin/pip` |
| figure/table keys `5.10.1a` fell to sequential numbering | key regex must accept `[ab]` suffixes and `[A-G].n` appendix tables |
| pypdf `extract_text()` normalises differently per page | match headings as standalone lines; verify probes against real renders |

## 9. Extending — what this toolchain can build next

- **New chapters/sections:** add a `content_*.py` module, register it in
  `load_blocks()`'s order list, build with `REPORT_MODULES`.
- **Final merged submission:** the full build already inserts separator
  sheets; remaining manual work is the i–iii sheets, the ER regeneration
  (defect D-A) and the guide review.
- **Related documents the same toolchain can produce:** the slide deck
  (the block model can emit PPTX via python-pptx with the same facts),
  an abstract booklet, a demo-day one-pager (HTML→PDF), the project
  read-me (from Appendix A/B data), or a checklist sheet — reusing
  `content_*.py` facts so nothing diverges.
- **Diagrams:** matplotlib generator pattern (`generate_module_diagram.py`)
  — edit labels/colours, rerun, the docx picks the file up.
- **Numbering changes:** fix `page_map.json` (or re-extract) and rebuild;
  never hand-edit page numbers in Word for content that the builder owns.
