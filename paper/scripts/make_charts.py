"""Generate publication charts for the IEEE paper (IEEE single-column width)."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
FIG = ROOT / "paper" / "figures"
FIG.mkdir(exist_ok=True, parents=True)

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 8.5,
    "axes.titlesize": 9,
    "axes.labelsize": 9,
    "axes.linewidth": 0.6,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "legend.fontsize": 7.5,
    "figure.dpi": 300,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.02,
})

SINGLE_W = 3.5   # IEEE single column (in)
DOUBLE_W = 6.1   # IEEE double column (in)


def style_ax(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linewidth=0.4, alpha=0.4)


# ---------------------------------------------------------------- chart 1
# Local two-detector evaluation (models in this repo, valid splits)
def chart_local_eval():
    s = json.loads((ROOT / "paper" / "results" / "summary.json").read_text())
    models = s["models"]
    classes = ["coconut_tree", "Mature", "Potential", "Premature"]
    map50 = [models["tree"]["per_class"]["coconut_tree"]["mAP50"],
             models["coconut"]["per_class"]["Mature"]["mAP50"],
             models["coconut"]["per_class"]["Potential"]["mAP50"],
             models["coconut"]["per_class"]["Premature"]["mAP50"]]
    map_std = [models["tree"]["per_class"]["coconut_tree"]["mAP"],
               models["coconut"]["per_class"]["Mature"]["mAP"],
               models["coconut"]["per_class"]["Potential"]["mAP"],
               models["coconut"]["per_class"]["Premature"]["mAP"]]
    labels = ["Tree\ndetector", "Mature", "Potential", "Premature"]

    fig, ax = plt.subplots(figsize=(DOUBLE_W, 4.35))
    x = np.arange(len(labels))
    b1 = ax.bar(x - 0.18, map50, 0.36, label="mAP$_{50}$", color="#2E5B34")
    b2 = ax.bar(x + 0.18, map_std, 0.36, label="mAP$_{50-95}$", color="#8FBF8F")
    for bars, vals in ((b1, map50), (b2, map_std)):
        ax.bar_label(bars, fmt="%.2f", fontsize=6.5, padding=1.5)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylim(0, 1.06)
    ax.set_ylabel("mAP")
    style_ax(ax)
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01, 1, 0.12),
              frameon=False, ncols=2, mode=None, borderaxespad=0)
    fig.savefig(FIG / "chart_local_eval.png", dpi=380)
    plt.close(fig)
    print("chart_local_eval.png")


# ---------------------------------------------------------------- chart 2
# S4 OTD leaderboard: mAP50 vs mAP50-95 incl. transformers
def chart_benchmark():
    rows = [
        ("YOLOv8n", .939, .870), ("YOLOv8s", .941, .873),
        ("YOLOv8m", .934, .877), ("YOLOv8l", .940, .880),
        ("YOLOv8x", .939, .879), ("YOLOv11n", .964, .812),
        ("YOLOv10n", .963, .819), ("RT-DETR", .976, .771),
        ("RF-DETR", .963, .788),
    ]
    names = [r[0] for r in rows]
    map50 = [r[1] for r in rows]
    map_std = [r[2] for r in rows]
    colors50 = ["#2E5B34"] * 5 + ["#B08900"] * 4
    colorsstd = ["#8FBF8F"] * 5 + ["#E4C65A"] * 4

    fig, ax = plt.subplots(figsize=(DOUBLE_W, 5.05))
    x = np.arange(len(rows))
    rival = ["", "", "", "", "", "xx", "xx", "xx", "xx"]
    ax.bar(x - 0.18, map50, 0.36, color=colors50,
           edgecolor="black", linewidth=0.3, hatch=rival)
    ax.bar(x + 0.18, map_std, 0.36, color=colorsstd,
           edgecolor="black", linewidth=0.3, hatch=rival)
    ax.set_xticks(x)
    ax.set_xticklabels(names, rotation=32, ha="right")
    ax.set_ylim(0.6, 1.06)
    ax.set_ylabel("mAP (aerial tree crowns)")
    ax.set_yticks([0.6, 0.7, 0.8, 0.9, 1.0])
    style_ax(ax)
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(fc="#2E5B34", label="mAP$_{50}$ (YOLOv8)"),
                       Patch(fc="#B08900", edgecolor="black", linewidth=0.3, hatch="xx", label="mAP$_{50}$ (v10/v11/DETR)"),
                       Patch(fc="#8FBF8F", label="mAP$_{50-95}$ (YOLOv8)"),
                       Patch(fc="#E4C65A", edgecolor="black", linewidth=0.3, hatch="xx", label="mAP$_{50-95}$ (v10/v11/DETR)")],
              loc="lower left", bbox_to_anchor=(0, 1.02, 1, 0.18),
              frameon=False, ncols=2, fontsize=6.5, mode=None, borderaxespad=0)
    fig.savefig(FIG / "chart_benchmark.png", dpi=380)
    plt.close(fig)
    print("chart_benchmark.png")


# ---------------------------------------------------------------- chart 3
# S2 Table 3: coconut maturity mAP across published approaches
def chart_progression():
    rows = [
        ("ANN/RF/SVM\n(Caladcad 2020)", 0.80),
        ("Faster R-CNN + ResNet-50\n(Parvathi 2021)", 0.89),
        ("YOLOv5\n(Mandava 2023)", 0.87),
        ("YOLOv8 CNN\n(Luthfie 2025)", 0.905),
    ]
    names = [r[0] for r in rows]
    vals = [r[1] for r in rows]
    colors = ["#9CB89C", "#9CB89C", "#9CB89C", "#2E5B34"]

    fig, ax = plt.subplots(figsize=(SINGLE_W, 1.9))
    y = np.arange(len(rows))[::-1]
    ax.barh(y, vals, 0.55, color=colors)
    for yi, v in zip(y, vals):
        ax.text(v + 0.006, yi, f"{v:.1%}", va="center", fontsize=8)
    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=7.5)
    ax.set_xlim(0.5, 1.0)
    ax.set_xlabel("mAP$_{50}$ (coconut maturity)")
    ax.grid(axis="x", linewidth=0.4, alpha=0.4)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.savefig(FIG / "chart_progression.png")
    plt.close(fig)
    print("chart_progression.png")


# ---------------------------------------------------------------- chart 4
# S4: params vs strict-accuracy scatter (diminishing returns of scale)
def chart_scale():
    pts = [
        (3.26, .870), (11.78, .873), (27.22, .877), (45.91, .880), (71.72, .879),
    ]
    fig, ax = plt.subplots(figsize=(SINGLE_W, 2.0))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    ax.plot(xs, ys, "o-", color="#2E5B34", markersize=4, linewidth=1.1)
    for x, y in pts:
        ax.annotate(f"{x:.2g}M", (x, y), textcoords="offset points",
                    xytext=(0, 5), ha="center", fontsize=7)
    ax.set_xlabel("Detector parameters (M)")
    ax.set_ylabel("mAP$_{50-95}$")
    ax.set_ylim(0.864, 0.886)
    style_ax(ax)
    fig.savefig(FIG / "chart_scale.png")
    plt.close(fig)
    print("chart_scale.png")


if __name__ == "__main__":
    chart_local_eval()
    chart_benchmark()
    chart_progression()
    chart_scale()
