#!/usr/bin/env python3
"""Build paper/IRJMETS_Veraxis_Submission.docx from paper/latex/main.tex.

Base docx: paper/template/Final year_IRJMETS_Paper.docx — already carries the IRJMETS
template styles, numbering (numId 18 = roman headings, numId 19 = [n] refs),
and figures image1-5 (rels rId8-12). Body is regenerated from main.tex.
"""
import re, os, shutil, zipfile, html
from PIL import Image as PILImage

REPO = '/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester'
TEX = f'{REPO}/paper/latex/main.tex'
BASE_DOCX = f'{REPO}/paper/template/Final year_IRJMETS_Paper.docx'
OUT_DOCX = f'{REPO}/paper/IRJMETS_Veraxis_Submission.docx'
FIGDIR = f'{REPO}/paper/latex/figures'
WORK = '/tmp/hi5/build'
EMU = 914400
TW_IN = 5.7   # template text width in inches

# ---------------------------------------------------------------- preparation
shutil.rmtree(WORK, ignore_errors=True)
os.makedirs(WORK)
with zipfile.ZipFile(BASE_DOCX) as z:
    z.extractall(WORK)

doc_xml_path = f'{WORK}/word/document.xml'
doc_xml = open(doc_xml_path, encoding='utf-8').read()
rels_path = f'{WORK}/word/_rels/document.xml.rels'
rels = open(rels_path, encoding='utf-8').read()

# existing drawing XML verbatim, keyed by rId (perfect extents + docPr reuse)
drawings = {}
LINE_DRAWING = None
for m in re.finditer(r'<w:drawing>.*?</w:drawing>', doc_xml, re.S):
    d = m.group(0)
    em = re.search(r'r:embed="(rId\d+)"', d)
    if em:
        drawings[em.group(1)] = d
    elif LINE_DRAWING is None:
        LINE_DRAWING = d
assert set(drawings) >= {f'rId{i}' for i in range(8, 13)}, drawings.keys()

# ---------------------------------------------------------------- tex parse
tex = open(TEX, encoding='utf-8').read()
bib_brace = re.search(r'\\begin\{thebibliography\}\{[^}]*\}', tex).group(0)
bib_body = tex.split(bib_brace, 1)[1].split('\\end{thebibliography}', 1)[0]
bibitems = re.findall(r'\\bibitem\{([a-zA-Z]+)\}', bib_body)
keymap = {k: i + 1 for i, k in enumerate(bibitems)}

INFIX = [('\\%', '%'), ('\\_', '_'), ('\\&', '&'), ('\\$', '$'),
         (r'\times', '×'), (r'\leq', '≤'), (r'\geq', '≥'), (r'\rightarrow', '→'),
         (r'\rightarrow', '→'), (r'\cdot', '·'), (r'\approx', '≈'), (r'\sim', '∼'),
         (r'\alpha', 'α'), (r'\beta', 'β'), (r'\left', ''), (r'\right', ''),
         (r'\;', ' '), (r'\,', ' '), (r'\{', '{'), (r'\}', '}')]

def clean(s):
    for k, v in INFIX:
        s = s.replace(k, v)
    return re.sub(r'\\[a-zA-Z]+', '', s)

def runs_of(t):
    """latex -> [(text, bold, superscript)]"""
    out = []
    master = re.compile(
        r'\\textsuperscript\{([^{}]*)\}|\\textbf\{([^{}]*)\}|\\texttt\{([^{}]*)\}'
        r'|\\emph\{([^{}]*)\}|\\cite\{([^{}]*)\}|\\url\{([^{}]*)\}|\$([^$]*)\$')
    def append(t, b=False, sup=False):
        t = clean(t)
        t = (t.replace('~', ' ').replace('``', '\u201c').replace("''", '\u201d')
             .replace('---', '\u2014').replace('--', '\u2013'))
        t = html.escape(t, quote=False)
        if t:
            out.append((t, b, sup))
    pos = 0
    for m in master.finditer(t):
        if m.start() > pos:
            append(t[pos:m.start()])
        pos = m.end()
        if m.group(1) is not None:
            append(m.group(1), sup=True)
        elif m.group(2) is not None:
            append(m.group(2), b=True)
        elif m.group(3) is not None or m.group(4) is not None:
            append(m.group(3) or m.group(4))
        elif m.group(5) is not None:
            append(', '.join(f'[{keymap[k.strip()]}]' for k in m.group(5).split(',')))
        elif m.group(6) is not None:
            append(m.group(6))
        else:
            append(m.group(7))
    if pos < len(t):
        append(t[pos:])
    return out

def flat(t):
    return ''.join(t for t, _, _ in runs_of(t))

# ---------------------------------------------------------------- block parsing
body_start = tex.index('% ================= INTRODUCTION')
body_end = tex.index('\\end{thebibliography}')
lines = tex[body_start:body_end].splitlines()

SKIP = re.compile(r'^\\(v|hs)space\{[^}]*\}$|^\\itemsep\S*$|^\\centering$|^\\small$|^\\noindent$|^\\needspace\{[^}]*\}'
                  r'|^\\setlength\{[^}]*\}\{[^}]*\}$|^\\begin\{itemize\}$|^\\end\{itemize\}$'
                  r'|^\\begin\{thebibliography\}')
blocks = []
buf = []

def flush():
    if buf and ' '.join(buf).strip():
        blocks.append(('para', ' '.join(buf).strip()))
    buf.clear()

i = 0
while i < len(lines):
    s = lines[i].strip()
    if not s or s.startswith('%') or SKIP.match(s):
        i += 1
        continue
    m = re.match(r'\\irjsec\{(.*)\}$', s)
    if m:
        flush(); blocks.append(('sec', m.group(1).strip())); i += 1; continue
    m = re.match(r'\\irjsub\{(.*)\}$', s)
    if m:
        flush(); blocks.append(('sub', m.group(1).strip())); i += 1; continue
    if s.startswith('\\item '):
        flush(); blocks.append(('item', s[5:].strip())); i += 1; continue
    if s.startswith('\\begin{figure}'):
        flush()
        fig = {'imgs': [], 'cap': ''}
        i += 1
        while not lines[i].strip().startswith('\\end{figure}'):
            fl = lines[i].strip()
            m = re.match(r'\\includegraphics\[width=([0-9.]+)\\textwidth\]\{([^}]*)\}', fl)
            if m:
                fig['imgs'].append([m.group(2), float(m.group(1))])
            m = re.match(r'\\figcap\{(.+)\}', fl)
            if m:
                fig['cap'] = m.group(1)
            i += 1
        i += 1
        blocks.append(('fig', fig))
        continue
    if s.startswith('\\begin{table}'):
        flush()
        tab = {'cap': '', 'rows': []}
        i += 1
        in_tab = False
        while not lines[i].strip().startswith('\\end{table}'):
            fl = lines[i].strip()
            m = re.match(r'\\tablecap\{(.+)\}', fl)
            if m:
                tab['cap'] = m.group(1)
            if fl.startswith('\\begin{tabular}'):
                in_tab = True; i += 1; continue
            if fl.startswith('\\end{tabular}'):
                in_tab = False; i += 1; continue
            if in_tab and fl and fl != '\\hline':
                row = fl[:-2].strip() if fl.endswith('\\\\') else fl
                tab['rows'].append([c.strip() for c in row.split('&')])
            i += 1
        i += 1
        blocks.append(('tab', tab))
        continue
    m = re.match(r'\\bibitem\{([a-zA-Z]+)\}\s*(.*)$', s)
    if m:
        flush()
        bibtext = m.group(2)
        j = i + 1
        while j < len(lines):
            nj = lines[j].strip()
            if not nj or nj.startswith('\\bibitem') or nj.startswith('\\end{thebibliography}'):
                break
            bibtext += ' ' + nj
            j += 1
        blocks.append(('bibitem', bibtext.strip()))
        i = j
        continue
    buf.append(s)
    i += 1
flush()

# ---------------------------------------------------------------- XML builders
F = '<w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/>'
def rpr(bold=False, sz=20, sup=False):
    x = F + ('<w:b/><w:bCs/>' if bold else '') + f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>'
    if sup:
        x += '<w:vertAlign w:val="superscript"/>'
    return x

def run(text, bold=False, sz=20, sup=False):
    return (f'<w:r><w:rPr>{rpr(bold, sz, sup)}</w:rPr>'
            f'<w:t xml:space="preserve">{text}</w:t></w:r>')

def runs_xml(text, bold=False, sz=20):
    return ''.join(run(t, bold or b, sz, s) for t, b, s in runs_of(text))

P_BODY = (f'<w:pPr><w:spacing w:before="54" w:after="54" w:line="276" w:lineRule="auto"/>'
          f'<w:jc w:val="both"/><w:rPr>{F}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>')
P_CENTER = (f'<w:pPr><w:spacing w:before="54" w:after="0" w:line="276" w:lineRule="auto"/>'
            f'<w:jc w:val="center"/><w:rPr>{F}</w:rPr></w:pPr>')
P_HEAD = (f'<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/>'
          f'<w:numId w:val="18"/></w:numPr><w:spacing w:before="54" w:after="0" '
          f'w:line="276" w:lineRule="auto"/><w:jc w:val="center"/>'
          f'<w:rPr>{F}<w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>')
P_CAP = (f'<w:pPr><w:spacing w:before="54" w:after="54" w:line="276" w:lineRule="auto"/>'
         f'<w:jc w:val="center"/><w:rPr>{F}<w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>')

def para_of(kind, text):
    if kind == 'sub':
        return (f'<w:p><w:pPr><w:spacing w:before="54" w:after="0" w:line="276" w:lineRule="auto"/>'
                f'<w:jc w:val="both"/><w:rPr>{rpr(True)}</w:rPr></w:pPr>'
                + runs_xml(text, True) + '</w:p>')
    return f'<w:p>{P_BODY}' + runs_xml(text) + '</w:p>'

# ---------------------------------------------------------------- new media
new_rels = []           # [(rid, target, src_path)]
next_rid = max(int(x) for x in re.findall(r'Id="rId(\d+)"', rels)) + 10
def install_png(src, target):
    global next_rid
    shutil.copy(src, f'{WORK}/word/{target}')
    rid = f'rId{next_rid}'
    rels = globals()['rels']
    globals()['rels'] = rels.replace('</Relationships>',
        f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/'
        f'officeDocument/2006/relationships/image" Target="{target}"/></Relationships>')
    next_rid += 1
    return rid

EXIST = {'figures/extracted/image1.png', 'figures/extracted/image2.png',
         'figures/extracted/image3.png', 'figures/extracted/image4.png',
         'figures/extracted/image5.png'}
_RID = dict(zip(sorted(EXIST), ['rId8', 'rId9', 'rId10', 'rId11', 'rId12']))

TEXROOT = f'{REPO}/paper/latex'
def srcpath(rel):
    return rel if os.path.isabs(rel) else f'{TEXROOT}/{rel}'

_EXIST_FILENAMES = {os.path.basename(f) for f in EXIST}

_NEW_COUNT = [0]

def new_drawing(path, frac, docpr):
    rid = install_png(path, f'media/image{10 + _NEW_COUNT[0]}.png')
    _NEW_COUNT[0] += 1
    w, h = PILImage.open(path).size
    cx = int(frac * TW_IN * EMU)
    cy = int(cx * h / w)
    name = os.path.basename(path)[:-4]
    return rid, cx, cy, name, (
        f'<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" '
        f'distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{docpr}" name="Picture {docpr}"/>'
        f'<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f'<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="0" name="{name}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        f'</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')

_FIG_DOCPR = [20]

def fig_xml(fig):
    body = ('<w:p><w:pPr><w:spacing w:before="54" w:after="0" w:line="276" w:lineRule="auto"/>'
            '<w:jc w:val="center"/></w:pPr>')
    for path, frac in fig['imgs']:
        base = os.path.basename(path)
        if base in _EXIST_FILENAMES:
            body += drawings[_RID[f'figures/extracted/{base}']]
        else:
            body += new_drawing(srcpath(path), frac, _FIG_DOCPR[0])[4]
            _FIG_DOCPR[0] += 1
    body += '</w:p>'
    return body + f'<w:p>{P_CAP}' + run(flat(fig['cap']), True) + '</w:p>'

def table_xml(tab):
    ncol = len(tab['rows'][0])
    colw = 9504 // ncol
    grid = f'<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{colw}"/>' for _ in range(ncol)) + '</w:tblGrid>'
    trs = []
    for cells in tab['rows']:
        tcs = []
        for c in cells:
            bold = '\\textbf' in c
            p = (f'<w:p><w:pPr><w:spacing w:before="40" w:after="20"/><w:jc w:val="center"/>'
                 f'<w:rPr>{rpr(bold, 18)}</w:rPr></w:pPr>' + runs_xml(c, bold, 18) + '</w:p>')
            tcs.append(f'<w:tc><w:tcPr><w:tcW w:w="{colw}" w:type="dxa"/></w:tcPr>{p}</w:tc>')
        trs.append(f'<w:tr><w:trPr><w:jc w:val="center"/></w:trPr>' + ''.join(tcs) + '</w:tr>')
    tbl = (f'<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:tblBorders>'
           + ''.join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
                     for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
           + '</w:tblBorders></w:tblPr>' + grid + ''.join(trs) + '</w:tbl>')
    return f'<w:p>{P_CAP}' + run(flat(tab['cap']), True) + '</w:p>' + tbl

# ---------------------------------------------------------------- title block (verbatim from tex)
title_runs = run(flat('AI POWERED COCONUT HARVESTING SYSTEM'), True, 28)
def authors_para():
    names = ['Dr.~Madhu B.K', 'Mahesh S', 'Syeda Umme Haani', 'S Mohammed Maaz', 'Akshatha G']
    body = f'<w:p>{P_CENTER}'
    _runs = []
    for i, n in enumerate(names):
        _runs.append(run(flat(n), True, 24))
        _runs.append(run(f'*{i + 1}', True, 24, sup=True))
        if i < len(names) - 1:
            _runs.append(run(', ', True, 24))
    return body + ''.join(_runs) + '</w:p>'

def affil_para(sup, text):
    return (f'<w:p>{P_CENTER}' + run(sup, False, 22, sup=True) + run(flat(text), False, 22) + '</w:p>')

ABS = ('Manual coconut harvesting depends on climbers working at heights of 15 to 25 metres, and growers '
       'have no digital record of which trees are ready to harvest. This paper presents an AI powered coconut '
       'harvesting system (Veraxis), a full-stack digital twin platform that turns drone survey imagery into a '
       'structured, queryable plantation model and drives a simulated climbing robot to harvest it. A YOLOv8 tree '
       'detector processes survey tiles laid out by a configurable flight planner; GPS-proximity matching with a '
       '4 m radius assigns permanent tree identities and mission-scoped observations; a second YOLOv8 model '
       'classifies close-up coconuts as Mature, Potential or Premature and writes immutable inventory snapshots; '
       'and a nearest-neighbour planner builds immutable harvest missions. The robot is a deterministic, '
       'event-driven simulation with a frozen state machine, battery model and WebSocket telemetry, so real '
       'hardware would replace only the engine. The contribution is the integration rather than any new network '
       'or learning rule: a digital twin that keeps a plantation as a persistent, queryable object and evaluates '
       'the complete workflow, from survey tiles to a finished harvest, end to end. In our tests the engine '
       'reproduced identical traces in 100 of 100 randomised missions with no illegal state transition, '
       'nearest-neighbour routes were 5.6 to 9.2 percent longer than optimal for 5 to 8 trees, and re-survey '
       'matching created no duplicate trees for position errors up to about 1 m. The robot remains simulated and '
       'field trials are future work.')
KW = ' Digital Twin, Precision Agriculture, Coconut Harvesting, YOLOv8, Robot Simulation, WebSocket Telemetry'

prelude = [
    f'<w:p>{P_CENTER}' + title_runs + '</w:p>',
    authors_para(),
    affil_para('1', 'Dean & Professor, Department of Computer Science and Engineering, Vidya Vikas Institute of Engineering and Technology, Mysuru, Karnataka, India.'),
    affil_para('2,3,4,5', ' Final-year B.E. Students, Department of Computer Science and Engineering, Vidya Vikas Institute of Engineering and Technology, Mysuru, Karnataka, India.'),
    f'<w:p>{P_CENTER}' + run('ABSTRACT', True, 24) + '</w:p>',
    f'<w:p>{P_BODY}' + run(ABS) + '</w:p>',
    f'<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/></w:pBdr>'
    f'<w:spacing w:before="54" w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/>'
    f'<w:rPr>{rpr()}</w:rPr></w:pPr>' + run('Keywords:', True) + run(KW) + '</w:p>',
    # horizontal divider line under keywords — reuse the base doc's drawn line (no r:embed)
]
prelude.append(f'<w:p>{P_CENTER}' + LINE_DRAWING + '</w:p>')

# ---------------------------------------------------------------- assemble body
parts = list(prelude)
_ac = 0  # ACK done?
for kind, data in blocks:
    if kind == 'sec':
        if data == 'ACKNOWLEDGEMENTS':
            parts.append(f'<w:p>{P_CENTER}' + run(data, True, 24) + '</w:p>')
        else:
            parts.append(f'<w:p>{P_HEAD}' + run(data, True, 24) + '</w:p>')
    elif kind == 'sub':
        parts.append(para_of('sub', data))
    elif kind == 'item':
        parts.append(f'<w:p>{P_BODY}' + run('\u2022') + runs_xml(data) + '</w:p>')
    elif kind == 'bibitem':
        parts.append(f'<w:p>{P_BODY}' + runs_xml(data) + '</w:p>')
    elif kind == 'fig':
        parts.append(fig_xml(data))
    elif kind == 'tab':
        parts.append(table_xml(data))
    else:
        parts.append(para_of('para', data))
body = ''.join(parts)

# sectPr from base doc
sect = doc_xml[doc_xml.rindex('<w:sectPr'):doc_xml.rindex('</w:sectPr>') + len('</w:sectPr>')]
body += sect

new_doc = doc_xml[:doc_xml.index('<w:body>') + len('<w:body>')] + body + '</w:body></w:document>'
open(doc_xml_path, 'w', encoding='utf-8').write(new_doc)
open(rels_path, 'w', encoding='utf-8').write(rels)

# ---------------------------------------------------------------- rezip
if os.path.exists(OUT_DOCX):
    os.remove(OUT_DOCX)
with zipfile.ZipFile(OUT_DOCX, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(WORK):
        for f in files:
            if f == '.DS_Store':
                continue
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, WORK))

print('blocks:', len(blocks))
for kind, data in blocks:
    label = flat(data) if isinstance(data, str) else (data.get('cap') or len(data['imgs']))
    print(f'  {kind}: {label[:70]}')
print('OK ->', OUT_DOCX)
