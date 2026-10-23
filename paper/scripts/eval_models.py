"""Local evaluation of the repo's two YOLOv8 detectors against their bundled valid splits.

Results -> paper/results/<name>/ + paper/results/summary.json
"""
import json
import platform
from pathlib import Path

import torch
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "paper" / "results"
RESULTS.mkdir(parents=True, exist_ok=True)

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

MODELS = [
    ("tree", ROOT / "models" / "tree_model" / "tree_detector.pt", ROOT / "models" / "tree_model" / "data.yaml"),
    ("coconut", ROOT / "models" / "coconut_model" / "coconut_detector.pt", ROOT / "models" / "coconut_model" / "data.yaml"),
]

summary = {"device": DEVICE, "models": {}}

for name, weights, data in MODELS:
    print(f"=== {name} ({weights.name}) device={DEVICE} ===", flush=True)
    model = YOLO(weights)
    m = model.val(data=str(data), split="val", device=DEVICE, workers=0,
                  project=str(RESULTS), name=name, exist_ok=True, verbose=True)
    box = m.box
    names = model.names
    per_class = {}
    for i, idx in enumerate(box.ap_class_index):
        cls_name = names[int(idx)]
        per_class[cls_name] = {
            "precision": round(float(box.p[i]), 4),
            "recall": round(float(box.r[i]), 4),
            "mAP50": round(float(box.ap50[i]), 4),
            "mAP": round(float(box.ap[i]), 4),
        }
    record = {
        "weights": str(weights.relative_to(ROOT)),
        "data": str(data.relative_to(ROOT)),
        "classes": names,
        "all": {
            "precision": round(float(box.mp), 4),
            "recall": round(float(box.mr), 4),
            "mAP50": round(float(box.map50), 4),
            "mAP": round(float(box.map), 4),
        },
        "per_class": per_class,
        "speed": {k: round(v, 2) for k, v in (m.speed or {}).items()},
        "images": getattr(m, "results_dict", {}).get("validation", ""),
        "python": platform.python_version(),
        "ultralytics_device": DEVICE,
    }
    summary["models"][name] = record
    print(f"--- {name} all: {record['all']}", flush=True)
    for cls, v in per_class.items():
        print(f"    {cls}: {v}", flush=True)

(RESULTS / "summary.json").write_text(json.dumps(summary, indent=2))
print("WROTE", RESULTS / "summary.json", flush=True)
