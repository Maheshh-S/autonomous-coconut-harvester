#!/usr/bin/env python3
"""Veraxis college report docx builder.

Builds the VTU-format Word report from the content modules in this directory,
following Project Report/documentation/report-format-spec.md.

Rules implemented (see current-report.md D14-D30):
- A4, margins L1.25in R1.0in T0.75in B0.75in, Times New Roman, 1.5 spacing.
- Thin black page border on every page (w:pgBorders).
- Front matter: roman page numbers (start iv; title/cert/ack manual pages i-iii).
- Chapters: running header (title + rule), footer (dept + Page N), arabic from 1.
- Chapter opener page ("CHAPTER N" alone), then CHAPTER N + centered title.
- Figures captioned below (Fig C.N, auto-numbered in document order),
  tables captioned above (Table C.N). {FIG:key}/{TAB:key} cross-refs resolved.
- Missing figures render as same-ratio grey placeholder boxes.
"""
import os
import re
import sys

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Mm, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DOC_ROOT = os.path.join(HERE, "..")
IMG_ROOT = os.path.join(DOC_ROOT, "documentation")
OUT_PATH = os.environ.get(
    "REPORT_OUT",
    os.path.join(DOC_ROOT, "Draft1. Part 1.docx"))

# REPORT_MODULES: comma-separated subset of content modules to include
# (chapter-wise part builds). Unset = include every module present.
REPORT_MODULES = [m for m in os.environ.get("REPORT_MODULES", "").split(",") if m]

# Displayed page number of the first page of this part (continuity across
# chapter-wise parts: Part N starts at Part N-1's last page + 1).
PAGE_START = int(os.environ.get("PAGE_START", "1"))

# Chapter 1 body inclusion (was withheld from Part 0 during format setup;
# Part 1 is the chapter body itself, so it defaults on).
INCLUDE_CH1_BODY = os.environ.get("CH1_BODY", "1") == "1"
PLACEHOLDER_DIR = os.path.join(HERE, "placeholders")

REPORT_TITLE = "AI POWERED AUTONOMOUS COCONUT HARVESTING SYSTEM"
# Running-header form (str.title() would lowercase "AI" to "Ai")
REPORT_TITLE_HEADER = "AI Powered Autonomous Coconut Harvesting System"
DEPT_FOOTER = "Dept. of CSE, VVIET, Mysuru"
TEXT_WIDTH_IN = 6.27  # A4 with Word "Normal" 1in margins
RIGHT_TAB_IN = 5.6    # page-number column, per the sample (inside the text edge)
LOF_DESC_TAB_IN = 1.9  # description column in the lists, per the sample
CHAPTER_TAB_IN = 1.15  # gap between "Chapter N" and its title in CONTENTS
FIG_WIDTH_IN = 6.0    # chapter pages: Normal margins -> 6.27in text width


def set_page_border(section):
    """User-approved border (from Draft1. Part 0, matches the college sample):
    thin-thick small-gap on top/left, thick-thin on bottom/right, 3pt, 24pt
    from the page edge."""
    sectPr = section._sectPr
    for old in sectPr.findall(qn("w:pgBorders")):
        sectPr.remove(old)
    pgB = OxmlElement("w:pgBorders")
    pgB.set(qn("w:offsetFrom"), "page")
    specs = {
        "top": "thinThickSmallGap",
        "left": "thinThickSmallGap",
        "bottom": "thickThinSmallGap",
        "right": "thickThinSmallGap",
    }
    for edge, val in specs.items():
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), val)
        el.set(qn("w:sz"), "24")
        el.set(qn("w:space"), "24")
        el.set(qn("w:color"), "auto")
        pgB.append(el)
    sectPr.append(pgB)


def set_margins_front(section):
    # Word "Normal" margins (user-set in Draft1. Part 0)
    section.left_margin = Inches(1.0); section.right_margin = Inches(1.0)
    section.top_margin = Inches(1.0); section.bottom_margin = Inches(1.0)


def set_margins_chapter(section):
    # user-set chapter-section margins in Draft1. Part 0
    section.left_margin = Inches(0.5); section.right_margin = Inches(0.5)
    section.top_margin = Inches(0.5); section.bottom_margin = Inches(0.5)

# ---------------------------------------------------------------- content ----

def load_blocks():
    """Chapter-wise incremental build: each chapter is its own module; the
    builder includes every module that exists so far, in document order."""
    order = [
        "content_front",   # Abstract, Contents, LoF, LoT, Abbreviation
        "content_ch1",
        "content_ch2",
        "content_ch3",
        "content_ch4",
        "content_ch5",
        "content_ch6_back",  # Ch6 + References + Publications + Appendix
    ]
    import importlib
    blocks = []
    for name in order:
        if REPORT_MODULES and name not in REPORT_MODULES:
            continue
        try:
            mod = importlib.import_module(name)
        except ModuleNotFoundError:
            continue
        if name == "content_ch1" and not INCLUDE_CH1_BODY:
            # keep only the chapter opener/title; body withheld for review
            blocks.extend([b for b in mod.BLOCKS if b[0] == "chapter"])
        else:
            blocks.extend(mod.BLOCKS)
    if not blocks:
        raise SystemExit("no content modules found")
    return blocks


def pass_numbering(blocks):
    """Final figure/table numbers. Figures use their hierarchical key as the
    number when the key is numeric (4.2, 4.4.1, 5.8.2 ...) -- the college
    sample numbers figures to match their sections. Tables always number
    sequentially (Table C.N) because their keys are words."""
    fig_no = {}
    tab_no = {}
    chapter = 0
    tseq = sseq = 0
    for b in blocks:
        kind = b[0]
        if kind == "chapter":
            chapter = int(b[1]); tseq = sseq = 0
        elif kind in ("fig", "figph"):
            key = b[1]
            if re.fullmatch(r"(\d+(\.\d+)+[ab]?|[A-D]\.\d+)", key):
                fig_no[key] = key
            else:
                sseq += 1
                fig_no[key] = f"{chapter}.{sseq}"
        elif kind == "table":
            key = b[1]
            if re.fullmatch(r"[A-G]\.\d+", key):
                tab_no[key] = key
            else:
                tseq += 1
                tab_no[key] = f"{chapter}.{tseq}"
    return fig_no, tab_no


# Stable numbers for figures referenced in early chapters before their
# chapter module exists in an incremental (chapter-wise) build. The final
# full build recomputes these and overrides only if it disagrees.
FALLBACK_FIG = {"pipeline": "3.1"}
FALLBACK_TAB = {}


def resolve(text, fig_no, tab_no):
    for key, num in fig_no.items():
        text = text.replace("{FIG:%s}" % key, "Fig %s" % num)
    for key, num in tab_no.items():
        text = text.replace("{TAB:%s}" % key, "Table %s" % num)
    for key, num in FALLBACK_FIG.items():
        text = text.replace("{FIG:%s}" % key, "Fig %s" % num)
    for key, num in FALLBACK_TAB.items():
        text = text.replace("{TAB:%s}" % key, "Table %s" % num)
    return text

# ------------------------------------------------------------------ xml ----

def set_pgnum_format(section, fmt, start=None):
    sectPr = section._sectPr
    el = sectPr.find(qn("w:pgNumType"))
    if el is None:
        el = OxmlElement("w:pgNumType")
        sectPr.append(el)
    el.set(qn("w:fmt"), fmt)
    if start is not None:
        el.set(qn("w:start"), str(start))


def para_bottom_border(par, sz="24"):
    pPr = par._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), sz)
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "000000")
    pbdr.append(bottom)
    pPr.append(pbdr)


def para_top_border(par, sz="24"):
    pPr = par._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    top = OxmlElement("w:top")
    top.set(qn("w:val"), "single")
    top.set(qn("w:sz"), sz)
    top.set(qn("w:space"), "1")
    top.set(qn("w:color"), "000000")
    pbdr.append(top)
    pPr.append(pbdr)


def add_page_field(par):
    run = par.add_run()
    f1 = OxmlElement("w:fldChar"); f1.set(qn("w:fldCharType"), "begin")
    it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = "PAGE"
    f2 = OxmlElement("w:fldChar"); f2.set(qn("w:fldCharType"), "end")
    run._r.append(f1); run._r.append(it); run._r.append(f2)

# ---------------------------------------------------------------- styles ----

def make_styles(doc):
    st = doc.styles

    def base(name, size, bold=False, align=None, spacing=1.5, before=0, after=6,
             font="Times New Roman"):
        s = st.add_style(name, 1)  # paragraph style
        s.base_style = st["Normal"]
        f = s.font
        f.name = font; f.size = Pt(size); f.bold = bold
        pf = s.paragraph_format
        pf.line_spacing = spacing
        pf.space_before = Pt(before); pf.space_after = Pt(after)
        if align is not None:
            pf.alignment = align
        # ensure east-asian font mapping too
        rpr = s.element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts"); rpr.append(rfonts)
        for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
            rfonts.set(qn(attr), font)
        return s

    n = st["Normal"]
    n.font.name = "Times New Roman"; n.font.size = Pt(12)
    n.paragraph_format.line_spacing = 1.5
    n.paragraph_format.space_after = Pt(6)
    rpr = n.element.get_or_add_rPr()
    rfonts = OxmlElement("w:rFonts")
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), "Times New Roman")
    rpr.append(rfonts)

    base("VBody", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    bi = base("VBodyIndent", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    bi.paragraph_format.first_line_indent = Inches(0.3)
    base("VBodyTight", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=2)
    base("VFrontHeading", 16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=18)
    cn = base("VChapterNum", 16, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, after=6)
    cn.paragraph_format.keep_with_next = True
    ct = base("VChapterTitle", 18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, after=18)
    ct.paragraph_format.keep_with_next = True
    h1 = base("VH1", 14, bold=True, before=12, after=6)
    h1.paragraph_format.keep_with_next = True
    h2 = base("VH2", 13, bold=True, before=10, after=4)
    h2.paragraph_format.keep_with_next = True
    base("VCaption", 11, align=WD_ALIGN_PARAGRAPH.CENTER, before=4, after=12)
    tc = base("VTabCaption", 11, align=WD_ALIGN_PARAGRAPH.CENTER, before=10, after=4)
    tc.paragraph_format.keep_with_next = True
    bl = base("VBullet", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=4)
    bl.paragraph_format.left_indent = Inches(0.45)
    bl.paragraph_format.first_line_indent = Inches(-0.2)
    base("VRefText", 12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=8)
    st["VRefText"].paragraph_format.left_indent = Inches(0.45)
    st["VRefText"].paragraph_format.first_line_indent = Inches(-0.45)
    base("VCode", 10, after=0, spacing=1.0, font="Courier New")
    base("VSmall", 11, after=2)
    base("VCenter", 12, align=WD_ALIGN_PARAGRAPH.CENTER)
    op = base("VChapterOpener", 36, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
              after=0)
    op.paragraph_format.line_spacing = 1.0
    base("VFrontRow", 12, after=4)          # contents / list rows
    base("VFrontHead", 12, bold=True, after=2)  # (reserved; lists use VFrontRow)
    # Header/footer paragraphs MUST derive from Normal: Word's built-in
    # Footer style carries its own centre/right tab stops that otherwise
    # steal "Page N" away from our right-tab layout.
    base("VHeader", 11, spacing=1.0, after=0)
    base("VFooter", 10, spacing=1.0, after=0)

# ------------------------------------------------------------ placeholders ---

def make_placeholder(key, label, ratio=(16, 10)):
    os.makedirs(PLACEHOLDER_DIR, exist_ok=True)
    w, h = 1600, int(1600 * ratio[1] / ratio[0])
    img = Image.new("RGB", (w, h), (245, 245, 245))
    d = ImageDraw.Draw(img)
    # dashed rectangle
    dash, gap = 24, 14
    m = 26
    x0, y0, x1, y1 = m, m, w - m, h - m
    def dashed_line(a, b, vert=False):
        pos = a
        while pos < b:
            end = min(pos + dash, b)
            if vert:
                d.line([(x0, pos), (x0, end)], fill=(150, 150, 150), width=4)
            else:
                d.line([(pos, y0), (end, y0)], fill=(150, 150, 150), width=4)
                d.line([(pos, y1), (end, y1)], fill=(150, 150, 150), width=4)
            pos = end + gap
    dashed_line(x0, x1)
    pos = y0
    while pos < y1:
        end = min(pos + dash, y1)
        d.line([(x0, pos), (x0, end)], fill=(150, 150, 150), width=4)
        d.line([(x1, pos), (x1, end)], fill=(150, 150, 150), width=4)
        pos = end + gap
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 44)
    except Exception:
        font = ImageFont.load_default()
    text = "PLACEHOLDER  |  %s" % label
    tw = d.textlength(text, font=font)
    d.text(((w - tw) / 2, h / 2 - 30), text, fill=(120, 120, 120), font=font)
    sub = "Final image to be inserted at this size before print"
    sw = d.textlength(sub, font=font)
    d.text(((w - sw) / 2, h / 2 + 30), sub, fill=(160, 160, 160), font=font)
    path = os.path.join(PLACEHOLDER_DIR, "ph-%s.png" % key)
    img.save(path)
    return path

# ----------------------------------------------------------------- render ----

def add_body(doc, text, style="VBody"):
    par = doc.add_paragraph(style=style)
    par.add_run(text)
    return par


def add_bullets(doc, items):
    for it in items:
        par = doc.add_paragraph(style="VBullet")
        par.add_run("\u27a2 ")
        if isinstance(it, (tuple, list)):
            lead, rest = it
            r = par.add_run(lead); r.bold = True
            par.add_run(rest)
        else:
            par.add_run(it)


def add_figure(doc, key, path, caption, fig_no, ph_ratio=None, ph_label=None,
               width=None):
    num = fig_no[key]
    if ph_ratio is not None:
        path = make_placeholder(key, ph_label or ("Fig %s" % num), ph_ratio)
    else:
        path = os.path.join(IMG_ROOT, path)
    doc.add_picture(path, width=Inches(width or FIG_WIDTH_IN))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.paragraphs[-1].paragraph_format.keep_with_next = True
    cap = doc.add_paragraph(style="VCaption")
    cap.add_run("Fig %s: %s" % (num, caption))


def add_table_block(doc, key, caption, headers, rows, fig_no, tab_no,
                    widths=None, font_size=10):
    num = tab_no[key]
    cap = doc.add_paragraph(style="VTabCaption")
    cap.add_run("Table %s: %s" % (num, caption))
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.autofit = True
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        r = p.add_run(h); r.bold = True; r.font.size = Pt(font_size)
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.space_after = Pt(2)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            r = p.add_run(str(val)); r.font.size = Pt(font_size)
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.space_after = Pt(2)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph(style="VBodyTight").add_run("")


def chapter_opener(doc, ch_label):
    """Big bold chapter opener, centred horizontally and placed in the
    vertical middle of its own page (sample-faithful, user directive)."""
    for _ in range(11):
        doc.add_paragraph("")
    par = doc.add_paragraph(style="VChapterOpener")
    par.add_run(ch_label)
    doc.add_page_break()


def configure_chapter_section(s, doc):
    """Chapter pages per the sample screenshots: Normal margins, no page
    frame; header = project title over a thick rule; footer = rule, dept
    left, 'Page N' right; arabic page numbers from 1."""
    s.page_width = Mm(210); s.page_height = Mm(297)
    s.left_margin = Inches(1.0); s.right_margin = Inches(1.0)
    s.top_margin = Inches(1.0); s.bottom_margin = Inches(1.0)
    s.header_distance = Inches(0.5); s.footer_distance = Inches(0.5)
    set_pgnum_format(s, "decimal", start=PAGE_START)
    h = s.header
    h.is_linked_to_previous = False
    hp = h.paragraphs[0]
    hp.text = ""
    hp.style = doc.styles["VHeader"]
    r = hp.add_run(REPORT_TITLE_HEADER)
    r.font.size = Pt(11); r.font.name = "Times New Roman"
    para_bottom_border(hp, sz="24")
    f = s.footer
    f.is_linked_to_previous = False
    fp = f.paragraphs[0]
    fp.text = ""
    fp.style = doc.styles["VFooter"]
    fp.paragraph_format.tab_stops.add_tab_stop(
        Inches(TEXT_WIDTH_IN), WD_TAB_ALIGNMENT.RIGHT)
    para_top_border(fp, sz="24")  # match the header rule (3 pt)
    r = fp.add_run(DEPT_FOOTER)
    r.font.size = Pt(10); r.font.name = "Times New Roman"
    fp.add_run("\t")
    r2 = fp.add_run("Page ")
    r2.font.size = Pt(10); r2.font.name = "Times New Roman"
    add_page_field(fp)
    for rr in fp.runs:
        rr.font.size = Pt(10); rr.font.name = "Times New Roman"


def _front_row(doc, left, label, page=None, bold=False, indent=0.0,
               right_tab=RIGHT_TAB_IN):
    """A contents/list-of-figures row: label (optionally page) with a
    right-aligned page-number tab, matching the sample layout."""
    style = "VFrontHead" if bold else "VFrontRow"
    p = doc.add_paragraph(style=style)
    p.paragraph_format.left_indent = Inches(indent)
    r = p.add_run(label)
    if bold:
        r.bold = True
    if page is not None:
        p.paragraph_format.tab_stops.add_tab_stop(
            Inches(right_tab), WD_TAB_ALIGNMENT.RIGHT)
        p.add_run("\t" + str(page))
    return p


def chapter_title_block(doc, ch_label, title):
    par = doc.add_paragraph(style="VChapterNum")
    par.add_run(ch_label)
    par2 = doc.add_paragraph(style="VChapterTitle")
    par2.add_run(title)


def front_heading(doc, title):
    doc.add_paragraph(style="VFrontHeading").add_run(title)


def page_break(doc):
    doc.add_page_break()


def setup_front_section(doc):
    s = doc.sections[0]
    s.page_width = Mm(210); s.page_height = Mm(297)
    set_margins_front(s)
    s.header_distance = Inches(0.4); s.footer_distance = Inches(0.35)
    set_page_border(s)
    set_pgnum_format(s, "lowerRoman", start=4)
    s.header.is_linked_to_previous = False
    s.header.paragraphs[0].text = ""
    s.footer.is_linked_to_previous = False
    s.footer.paragraphs[0].text = ""


def add_chapter_section(doc):
    s = doc.add_section(WD_SECTION.NEW_PAGE)
    configure_chapter_section(s, doc)
    return s


def precompute_registries(blocks, fig_no, tab_no):
    fig_reg, tab_reg = [], []
    for b in blocks:
        if b[0] == "fig":
            fig_reg.append((fig_no[b[1]], resolve(b[3], fig_no, tab_no)))
        elif b[0] == "figph":
            fig_reg.append((fig_no[b[1]], resolve(b[2], fig_no, tab_no) + " [placeholder - final image pending]"))
        elif b[0] == "table":
            tab_reg.append((tab_no[b[1]], resolve(b[2], fig_no, tab_no)))
    return fig_reg, tab_reg


def render(blocks, fig_no, tab_no):
    doc = Document()
    make_styles(doc)
    cp = doc.core_properties
    cp.title = REPORT_TITLE_HEADER
    cp.author = "Mahesh S; Syeda Umme Haani; S Mohammed Maaz; Akshatha G"
    cp.subject = "Final Year Project Report - Dept. of CSE, VVIET Mysuru"

    fig_registry, tab_registry = precompute_registries(blocks, fig_no, tab_no)

    page_map = {}
    map_path = os.path.join(HERE, "page_map.json")
    if os.path.exists(map_path):
        import json
        page_map = json.load(open(map_path))
    sec_map = {re.sub(r"\s+", " ", k).strip(): v
               for k, v in page_map.get("sections", {}).items()}
    for letter in "ABCDEFG":
        for k, v in sec_map.items():
            if k.startswith("Appendix %s:" % letter):
                sec_map["%s." % letter] = v
                break
    fig_map = page_map.get("figures", {})
    tab_map = page_map.get("tables", {})

    starts_with_chapter = blocks[0][0] == "chapter"
    if starts_with_chapter:
        # Part build with no front matter: section 0 IS the chapter section.
        s0 = doc.sections[0]
        for old in s0._sectPr.findall(qn("w:pgBorders")):
            s0._sectPr.remove(old)
        configure_chapter_section(s0, doc)
    else:
        setup_front_section(doc)
    chapters_started = starts_with_chapter

    # LoF/LoT content is inserted via special blocks AFTER numbering is known;
    # we render them when encountered because pass_numbering ran already.
    prev_kind = None
    for b in blocks:
        kind = b[0]
        if kind == "front_heading":
            front_heading(doc, resolve(b[1], fig_no, tab_no))
        elif kind == "chapter":
            if not chapters_started:
                add_chapter_section(doc)
                chapters_started = True
            elif not REPORT_MODULES:
                # full build: a blank separator page consumes one number
                # before every chapter from Chapter 2 onward (VTU separator
                # sheet convention; matches the sample CONTENTS skips)
                doc.add_page_break()
            chapter_title_block(doc, "CHAPTER %s" % b[1], resolve(b[2], fig_no, tab_no))
        elif kind == "back_chapter":
            if not chapters_started:
                add_chapter_section(doc)
                chapters_started = True
            chapter_title_block(doc, "", b[1])
        elif kind == "h1":
            doc.add_paragraph(style="VH1").add_run(resolve(b[1], fig_no, tab_no))
        elif kind == "h2":
            doc.add_paragraph(style="VH2").add_run(resolve(b[1], fig_no, tab_no))
        elif kind == "body":
            # continuation paragraphs take a first-line indent (sample style)
            add_body(doc, resolve(b[1], fig_no, tab_no),
                     style="VBodyIndent" if prev_kind == "body" else "VBody")
        elif kind == "bullets":
            add_bullets(doc, b[1])
        elif kind == "fig":
            add_figure(doc, b[1], b[2], resolve(b[3], fig_no, tab_no), fig_no,
                       width=b[4] if len(b) > 4 else None)
        elif kind == "figph":
            add_figure(doc, b[1], None, resolve(b[2], fig_no, tab_no), fig_no,
                       ph_ratio=b[3], ph_label="Fig %s" % fig_no[b[1]])
        elif kind == "table":
            add_table_block(doc, b[1], resolve(b[2], fig_no, tab_no), b[3],
                            [[resolve(str(c), fig_no, tab_no) for c in row] for row in b[4]],
                            fig_no, tab_no, widths=b[5] if len(b) > 5 else None,
                            font_size=b[6] if len(b) > 6 else 10)
        elif kind == "lof":
            hp = doc.add_paragraph(style="VFrontRow")
            hp.paragraph_format.space_after = Pt(14)
            hp.paragraph_format.tab_stops.add_tab_stop(Inches(LOF_DESC_TAB_IN))
            hp.paragraph_format.tab_stops.add_tab_stop(
                Inches(RIGHT_TAB_IN), WD_TAB_ALIGNMENT.RIGHT)
            hp.add_run("Figure No\tDescription\tPage No.")
            for num, cap in fig_registry:
                p = doc.add_paragraph(style="VFrontRow")
                p.paragraph_format.tab_stops.add_tab_stop(Inches(LOF_DESC_TAB_IN))
                p.paragraph_format.tab_stops.add_tab_stop(
                    Inches(RIGHT_TAB_IN), WD_TAB_ALIGNMENT.RIGHT)
                p.add_run("Fig %s\t%s\t%s" % (num, cap, fig_map.get(num, "")))
        elif kind == "lot":
            hp = doc.add_paragraph(style="VFrontRow")
            hp.paragraph_format.space_after = Pt(14)
            hp.paragraph_format.tab_stops.add_tab_stop(Inches(LOF_DESC_TAB_IN))
            hp.paragraph_format.tab_stops.add_tab_stop(
                Inches(RIGHT_TAB_IN), WD_TAB_ALIGNMENT.RIGHT)
            hp.add_run("Table No\tDescription\tPage No.")
            for num, cap in tab_registry:
                p = doc.add_paragraph(style="VFrontRow")
                p.paragraph_format.tab_stops.add_tab_stop(Inches(LOF_DESC_TAB_IN))
                p.paragraph_format.tab_stops.add_tab_stop(
                    Inches(RIGHT_TAB_IN), WD_TAB_ALIGNMENT.RIGHT)
                p.add_run("Table %s\t%s\t%s" % (num, cap, tab_map.get(num, "")))
        elif kind == "toc_lines":
            for label in b[1]:
                parts = label.split("\t")
                text = parts[0].strip()
                page = parts[1].strip() if len(parts) > 1 else ""
                if text.startswith("Chapter "):
                    # "Chapter N" + tabbed title, gap above, like the sample
                    title = parts[1].strip() if len(parts) > 1 else ""
                    page = sec_map.get("CHAPTER %s" % text.split()[1], page)
                    p = doc.add_paragraph(style="VFrontRow")
                    p.paragraph_format.space_before = Pt(16)
                    p.paragraph_format.tab_stops.add_tab_stop(Inches(CHAPTER_TAB_IN))
                    p.paragraph_format.tab_stops.add_tab_stop(
                        Inches(RIGHT_TAB_IN), WD_TAB_ALIGNMENT.RIGHT)
                    p.add_run("%s\t%s\t%s" % (text, title, page))
                elif text[:1].isdigit() or (
                        len(text) > 1 and text[1] == "." and text[0] in "ABCDE"):
                    key = re.sub(r"\s+", " ", text).strip()
                    page = sec_map.get(key, page)
                    if not page:
                        page = sec_map.get(text.split()[0], page)
                    _front_row(doc, 0, text, page, indent=0.6,
                               right_tab=RIGHT_TAB_IN)
                else:
                    page = sec_map.get(text.upper(), page)
                    _front_row(doc, 0, text, page, right_tab=RIGHT_TAB_IN)
        elif kind == "abbr_rows":
            for ab, exp in b[1]:
                p = doc.add_paragraph(style="VFrontRow")
                p.paragraph_format.tab_stops.add_tab_stop(Inches(1.6))
                r = p.add_run(ab); r.bold = True
                p.add_run("\t" + exp)
        elif kind == "ref":
            p = doc.add_paragraph(style="VRefText")
            p.add_run(resolve(b[1], fig_no, tab_no))
        elif kind == "code":
            for code_line in b[1].split("\n"):
                cp = doc.add_paragraph(style="VCode")
                cp.add_run(code_line if code_line else " ")
        elif kind == "spacer":
            doc.add_paragraph("")
        elif kind == "pagebreak":
            page_break(doc)
        else:
            raise ValueError("unknown block: %r" % (kind,))
        prev_kind = kind

    doc.save(OUT_PATH)
    return fig_registry, tab_registry


def main():
    blocks = load_blocks()
    fig_no, tab_no = pass_numbering(blocks)
    fig_reg, tab_reg = render(blocks, fig_no, tab_no)
    print("Saved:", OUT_PATH)
    print("Figures: %d  Tables: %d" % (len(fig_reg), len(tab_reg)))
    print("--- key -> final figure number ---")
    for b in blocks:
        if b[0] in ("fig", "figph"):
            print("  %-10s -> Fig %s" % (b[1], fig_no[b[1]]))
    print("--- key -> final table number ---")
    for b in blocks:
        if b[0] == "table":
            print("  %-10s -> Table %s" % (b[1], tab_no[b[1]]))


if __name__ == "__main__":
    sys.exit(main())
