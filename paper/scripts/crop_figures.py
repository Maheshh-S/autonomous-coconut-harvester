"""Crop the target figures out of rendered reference-paper pages.

Input : paper/figures/s{1..4}_p-*.png (full rendered pages, ratios are fractions of page W/H)
Output: paper/figures/<figname>.png (200dpi crops)
"""
from PIL import Image
from pathlib import Path

F = Path(__file__).resolve().parents[1] / "figures"

# (source_page, output_name, x_lo, x_hi, y_lo, y_hi)
CROPS = [
    ("s2_p-05.png", "fig_yolov8_architecture.png",        0.12, 0.88, 0.060, 0.236),
    ("s1_p-3.png",  "fig_dataset_samples.png",            0.27, 0.75, 0.5755, 0.745),
    ("s1_p-4.png",  "fig_yolov8n_schematic.png",          0.28, 0.72, 0.075, 0.288),
    ("s1_p-4.png",  "fig_gradcam_maturity.png",           0.20, 0.80, 0.505, 0.705),
    ("s3_p-5.png",  "fig_tree_detection_resolution.png",  0.05, 1.00, 0.070, 0.388),
    ("s3_p-5.png",  "fig_tree_detection_augmentation.png",0.06, 0.95, 0.405, 0.695),
    ("s4_p-12.png", "fig_benchmark_charts.png",           0.27, 0.91, 0.088, 0.302),
    ("s4_p-12.png", "fig_transformer_failures.png",       0.40, 0.92, 0.775, 0.892),
]

for src, out, xl, xh, yl, yh in CROPS:
    src_path = F / src
    if not src_path.exists():
        print(f"SKIP {out}: missing {src}")
        continue
    img = Image.open(src_path)
    W, H = img.size
    crop = img.crop((int(xl * W), int(yl * H), int(xh * W), int(yh * H)))
    crop.save(F / out)
    print(f"{out}: {crop.size} from {src} {img.size}")
