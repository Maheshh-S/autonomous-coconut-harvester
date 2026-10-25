#!/usr/bin/env python3
"""Generate the 4.1 module-architecture diagram for the college report.

Eight backend modules in pipeline order (snake layout) over the six data
stores, plus the re-seed feedback arrow. Same visual language as the other
report diagrams: white background, navy module boxes, green accents.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, FancyArrowPatch

NAVY = "#16324f"
GREEN = "#2e7d32"
STORE_FILL = "#eef6ee"
BOX_FILL = "#fcfefe"
ARROW = "#37474f"

modules = [
    ("1", "SURVEY INGESTION\n& TILING"),
    ("2", "YOLO\nDETECTION"),
    ("3", "TREE REGISTRY\n& MATCHING"),
    ("4", "DIGITAL TWIN\nMOSAIC VIEWER"),
    ("5", "RIPENESS INSPECTION\n& INVENTORY"),
    ("6", "HARVEST MISSION\nPLANNING"),
    ("7", "ROBOT MISSION\nEXECUTION"),
    ("8", "MISSION HISTORY\n& ANALYTICS"),
]
stores = [
    ("D1", "Survey tiles\n& mosaic"),
    ("D2", "Detections"),
    ("D3", "Permanent\ntrees"),
    ("D4", "Inventory\nsnapshots"),
    ("D5", "Harvest\nmissions"),
    ("D6", "Mission history\n& telemetry"),
]

W, H = 100, 58
fig, ax = plt.subplots(figsize=(12.4, 7.2), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")

BW, BH = 21.5, 11.5
row1_y, row2_y = 41.5, 22.5
cols = [2.0, 26.5, 51.0, 75.5]
# snake: modules 1-4 left-to-right on row 1; 5-8 right-to-left on row 2
pos = {}
for i, (num, label) in enumerate(modules[:4]):
    pos[int(num)] = (cols[i], row1_y)
for i, (num, label) in enumerate(modules[4:]):
    pos[int(num)] = (cols[3 - i], row2_y)

def draw_module(num, label, x, y):
    box = FancyBboxPatch((x, y), BW, BH, boxstyle="round,pad=0.3,rounding_size=1.2",
                         linewidth=1.8, edgecolor=NAVY, facecolor=BOX_FILL)
    ax.add_patch(box)
    badge = Circle((x + 2.6, y + BH - 2.6), 1.55, facecolor=GREEN, edgecolor="none")
    ax.add_patch(badge)
    ax.text(x + 2.6, y + BH - 2.62, num, ha="center", va="center",
            fontsize=10.5, color="white", fontweight="bold")
    ax.text(x + BW / 2 + 1.2, y + BH / 2, label, ha="center", va="center",
            fontsize=9.6, color=NAVY, fontweight="bold", linespacing=1.45)

def arrow(x0, y0, x1, y1, color=ARROW, style="-", lw=1.7, rad=0.0):
    a = FancyArrowPatch((x0, y0), (x1, y1), arrowstyle="-|>",
                        mutation_scale=16, linewidth=lw, color=color,
                        linestyle=style, connectionstyle=f"arc3,rad={rad}")
    ax.add_patch(a)

for n in range(1, 4):          # 1->2->3->4
    x, y = pos[n]; arrow(x + BW, y + BH / 2, pos[n + 1][0], y + BH / 2)
x, y = pos[4]; arrow(x + BW / 2, y - 0.4, pos[5][0] + BW / 2, row2_y + BH + 0.4)  # 4->5
for n in range(5, 8):          # 5->6->7->8 (right to left)
    x, y = pos[n]; arrow(x, y + BH / 2, pos[n + 1][0] + BW, y + BH / 2)

for num, label in modules:
    x, y = pos[int(num)]
    draw_module(num, label, x, y)

# data-store band
SW, SH, SY = 14.6, 8.2, 1.0
sx = [2.2 + i * (SW + 1.5) for i in range(6)]
for (tag, label), x in zip(stores, sx):
    box = FancyBboxPatch((x, SY), SW, SH, boxstyle="round,pad=0.25,rounding_size=0.9",
                         linewidth=1.5, edgecolor=GREEN, facecolor=STORE_FILL)
    ax.add_patch(box)
    ax.text(x + SW / 2, SY + SH - 1.9, tag, ha="center", va="center",
            fontsize=9, color=GREEN, fontweight="bold")
    ax.text(x + SW / 2, SY + SH / 2 - 1.4, label, ha="center", va="center",
            fontsize=8.2, color=NAVY, linespacing=1.3)

ax.text(W / 2, SY + SH + 2.0, "DATA STORES  ·  cloud PostgreSQL (Neon)  ·  written only by the owning module",
        ha="center", va="center", fontsize=9, color=GREEN, style="italic")

# re-seed feedback: module 8 back to module 6, routed under row 2
arrow(pos[8][0] + BW / 2, row2_y - 0.4, pos[6][0] + BW / 2, row2_y - 0.4,
      color=GREEN, style=(0, (5, 3)), lw=1.6, rad=-0.25)
ax.text((pos[8][0] + pos[6][0] + BW) / 2, row2_y - 5.6,
        "re-seed plan from latest inventory", ha="center", va="center",
        fontsize=8.6, color=GREEN, style="italic")

fig.savefig("/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester"
            "/Project Report/documentation/diagrams/4.1.1-module-architecture.png",
            bbox_inches="tight", facecolor="white", pad_inches=0.15)
print("saved")
