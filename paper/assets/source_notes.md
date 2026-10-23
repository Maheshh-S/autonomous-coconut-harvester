# Source Provenance Notes

Every numeric used in `paper/main.tex` traces to one of these sources. PDFs live in repo root `Ref-Papers/`.

## S1 — Automated Coconut Maturity Detection and Timeline Prediction using YOLOv8-based Computer Vision (Shiju, George, Jebaseeli; Grenze Int'l J. Eng. & Tech.)
Refs in `paper/assets/Automated_*.txt`:
- YOLOv8n; held-out test set of 155 images / 1,952 instances; overall mAP50 76.1%.
- TABLE II per-class: Premature P .838 R .829 mAP50 .860 mAP50-95 .613; Potential .779/.771/.847/.696; Mature .643/.495/.576/.380; All .753/.698/.761/.563.
- Framework "CocoVision-Edge"; Grad-CAM XAI saliency; 3-class taxonomy Mature/Potential/Premature — same as `models/coconut_model/data.yaml`.
- Mature hardest (57.6 mAP50) due to visual/color overlap with Potential under varied canopy light.

## S2 — Identifying Coconut Maturity Levels Using CNN and YOLOv8 Deep Learning Algorithms (A. A. Luthfie and Alamsyah; Journal of Information System Exploration and Research, 3(2), Jul 2025, pp 53–62, doi 10.52465/joiser.v3i2.595)
- YOLOv8 CNN: mAP 90.5%, precision 99.3%, recall 94.2%, F1 96.6%.
- Table 3 (vs previous models): Caladcad 2020 ANN/RF/SVM mAP 80%; Parvathi & Tamil Selvi 2021 Faster R-CNN + ResNet-50 mAP 89%; Mandava 2023 YOLOv5 / MobileNet-SSD mAP 87%; Proposed 2025 YOLOv8 CNN mAP 90.5%.

## S3 — Comparative Analysis of YOLOv8 and YOLOv11 on Tree Detection Using UAV RGB and Laser Scanning Data (Sengun, Aksoy, Sertel, Fransson; ISPRS Ann. X-2/W2-2025, UAV-g 2025)
- Best setup: YOLOv8x 960px + augmentation: P 0.974, R 0.837, mAP50 0.934, mAP50-95 0.821.
- Table 1 highlights (640px): YOLOv8s .949/.813/.906/.678 vs YOLOv11s .926/.841/.919/.659 (P/R/mAP50/mAP50-95); 640aug v8s .973/.816/.909/.703 vs v11s .936/.828/.916/.702; YOLOv8m 640 .966/.845/.930/.753; augmentation lifts m to .780.
- YOLOv8 640px mAP50-95 by scale (s,m,l,x): 0.678 / 0.753 / 0.765 / 0.788 — YOLOv11 strictly worse at every scale at 640px ("YOLOv8 uniformly outperforms YOLOv11 for every model scale").
- Insight: small models miss trees; resolution 640→960 helps recall/mAP50-95.

## S4 — Benchmarking YOLO and Transformer-Based Detectors for Olive Tree Crown Identification in UAV Imagery (M. E. Atik and M. Arkali; Geomatics, vol 6, no 2, Art 22, Feb 2026, doi 10.3390/geomatics6020022)
- Datasets (Table 1): OTD (public, DJI Mavic 3M RGB ~2 cm/px, 960x640): 1,338→9,513 aug train / 385 val / 202 test; Yalova (DJI Mavic 3M orthophoto tiles ~3 cm/px): 250→750 / 36 / 69.
- Table 2 (OTD, augmented; FPS/GFLOPs/Params/P/R/mAP50/mAP50-95) — ALL CORSO VERIFIED:
  - YOLOv8n 120.48/11.3/3.26M/.946/.870/.939/.870; v8s 135.13/39.9/11.78M/.939/.879/.941/.873; v8m 120.48/104.3/27.22M/.947/.859/.934/.877; v8l 90.91/210.1/45.91M/.957/.862/.940/.880 (best strict); v8x 60.98/327.9/71.72M/.935/.860/.939/.879
  - YOLOv11n 588.23/6.3/2.58M/.943/.900/.964/.812; v11s .954/.828; v11m .944/.822; v11l .947/.830; v11x .945/.825
  - YOLOv10n 769.23/6.5/2.27M/.958/.888/.963/.819; v12n .966/.820; v12s .958/.834; v12m .954/.835; v12l .957/.836; v12x .953/.834
  - RT-DETR 106.39/103.4/32.0M/.943/.915/.976/.771; RF-DETR 66.21/76.3/31.9M/.945/.739/.963/.788 (recall .739 is the true R column — NOT .9)
  - 9.8x parameter ratio: RT-DETR 32.0M / YOLOv8n 3.26M. Transformers: 66.2/106.4 FPS vs v8n 120.5 FPS.
- Table 3 (OTD, NO augmentation): v8n .968/.898 … v8x .968/.906; v11n .987/.841; RT-DETR .977/.811; RF-DETR .977/.806.
- Table 5 (Yalova, augmented): YOLOv8l mAP50 .878 / mAP50-95 .676 (strict; the STUDY's .878 is mAP50, not strict); v8x .862; YOLOv11m .878/.660 (mAP50 TIE with v8l); v11x .877/.680 (best strict among YOLOv11 Yalova, also tops v8l .676); RT-DETR 102.04 FPS P .812 R .718 .775/.548; RF-DETR .875/.666. YOLOv10 weak on Yalova (strict .548/.541-class values).
- Table 8 RMSE (m²): YOLOv8n OTD aug .478 vs no-aug .915; YOLOv11x best OTD .131; augmentation improves crown-area error.
- Discussion facts (verbatim-quotable from txt lines ~1000-1007): RT-DETR and RF-DETR "require a sufficiently large and diverse dataset to demonstrate their full potential"; YOLOv10 optimised for speed/lightweight deployment "has limitations with complex or variable datasets, such as Yalova"; transformers "achieve competitive performances on the larger OTD dataset"; RT-DETR/RF-DETR edge-detect visible crowns better; RF-DETR Yalova-aug .666 strict nearly matches YOLOv11s .652.
- OBSOLETE (do not reuse): v11n strict .863, v10n strict .851, "8.5x", "12--27 FPS", "27--29M params".

## R — Repo models (facts on disk) + local eval
- `models/tree_model/`: 1 class `coconut_tree`; Roboflow `coconut-tree-detector2` v8, CC BY 4.0 (10,343 images advertised); local splits train 9,048 / valid 865.
- `models/coconut_model/`: 3 classes `Mature, Potential, Premature`; Roboflow `coconut-maturity-detection` v7 (7,327 images advertised); local splits train 6,384 / valid 618.
- Local eval runs → `paper/results/*.txt` (cmdline, settings, metrics) → original results section + charts.

## S5 — Ultralytics YOLOv8 official COCO table (well-publicized; cited)
YOLOv8 COCO val mAP50-95: n 37.3% (10.1M params), s 44.9% (11.2M), m 50.2% (25.9M), l 52.9% (43.7M), x 53.9% (68.2M). Source: Jocher et al., "YOLOv8 by Ultralytics" (GitHub/Apache-2.0).
