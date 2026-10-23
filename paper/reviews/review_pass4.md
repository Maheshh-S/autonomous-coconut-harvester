# Simulated IEEE Review — Pass 4 Audit

**Manuscript:** `paper/main.tex` (compiled `main.pdf`, 10 pp., IEEEtran [conference])
**Date:** 2026-10-19
**Simulated gates:** scope → novelty → validity → data → clarity → compliance → advancement

## Review setup

- **Detected axes:** venue_type = conference · review_scope = full-manuscript · domain = ai-ml (robotics-pervasive) · strictness = standard
- **Assessment boundary:** The submitted manuscript text only. No code, no datasets, no training logs were supplied to the reviewer; absence of these is treated as missing material, not as a fact about the authors' practice.
- **Central claim:** YOLOv8 is the best single detector family for the two perception loops of a digital-twin coconut-harvesting platform (aerial palm detection on survey tiles; close-range three-class maturity grading), supported by (i) published benchmark evidence and (ii) the authors' original evaluation of two YOLOv8n production detectors.
- **Visible evidence:** Published comparisons (Atik & Arkali, Sengun et al., Shiju et al., Luthfie & Alamsyah, plus older baselines) quoted with explicit tables/figures; original results on 865 aerial / 618 close-up validation images with per-class metrics, confusion matrices, P–R curves, and MPS latency.

## Major rejection risks

- **[Critical→Major] No same-data baseline for the original evaluation.** Contribution (ii) trains and evaluates only YOLOv8n on the two Roboflow datasets. The thesis "YOLOv8 beats rivals" is established on *published* data; on the authors' own data there is no rival (e.g., YOLOv11n, Faster R-CNN) trained with an identical split for a controlled comparison, and no baseline at all from the authors' pipeline. *Why it matters:* an AI-ML reviewer applying the baseline-fairness gate reads the platform evaluation as a demonstration, not a comparison; the paper currently asks them to transfer conclusions across datasets. *Fix (text-level, implementable):* reframe the section explicitly — the original evaluation claims *deployment readiness and failure-mode structure*, not superiority; state this in the section header and in Contribution (ii); add one sentence conceding that a same-data head-to-head is future work. *Fix (compute-level, optional):* one same-split YOLOv11n run on both datasets would close the gap entirely.
- **[Major] Replication details for the original models are absent.** The paper never states training resolution, epochs, batch size, augmentation recipe (both datasets), pretraining weights source, or augmentation settings used for the two production detectors. Only validation protocol (Ultralytics 8.4.21 / torch 2.10.0, conf/IoU 0.25/0.45, M4 MPS) is given. *Why it matters:* the validity gate reads the eval as non-reproducible; the paper's own argument leans on augmentation effects, and a reviewer will ask which augmentations the authors actually used. *Fix:* add a compact "Training configuration" paragraph (or mini-table) with the actual hyperparameters; if some settings are not available, say which and why.
- **[Major] Platform-level claims are asserted, not measured.** Claims that grounding makes "multi-flight surveys stay idempotent", that planner gating increases confidence on *mature*, and that validation accuracy "carries over to the mission loop" are system-behaviour claims with no reported system measurements (e.g., grounding precision across re-surveys, mission success rate, end-of-loop inventory error). *Why it matters:* the title binds the paper to the digital-twin platform; a robotics reviewer expects at least one end-to-end or operational metric. *Fix:* either add the measurable platform statistics (counts of permanent trees created/deduplicated across surveys, planner-gate settings, one mission trace) or soften wording to "demonstrated in our system without formal measurement".
- **[Major] Validation-split evaluation.** The authors evaluate on the training-time validation split of their own models (correctly disclosed in Threats to Validity). *Why it matters:* optimistic bias; performance on truly unseen capture conditions (new season, new orchard) is untested, which is precisely the domain-shift condition the paper argues matters most for small-data plantation imagery. *Fix:* acknowledge cross-season/video split as future work; keep the existing Threats paragraph (already does).

## Technical review

- **Scope:** Yes — an IEEE-industrial-applications/robotics-AG venue fits: applied detection benchmark + deployed-perception engineering. The argument is engineering-economics oriented (compute budget, box-tightness for GPS grounding), which reviewers in AG applications recognize. No scope risk at a general conference track.
- **Novelty:** Modest but honestly framed. The paper is a *position + application* study: the architectural survey is new in its platform-level framing (both loops on one family), but no new architecture, dataset, or model is introduced. Risk of "incremental" comments is real; the paper partially mitigates by tying detection choice to a measurable system property (strict-IoU grounding). A reviewer may still ask: what is technically new? *Fix:* strengthen Contribution (iii) — the failure-mode → monitoring/planner-gating mapping (mature-decay gate, confusion-matrix → survey-quality) is the most novel element and is currently buried mid-section; surface it in the abstract/intro.
- **Validity:** Mostly sound. Claims faithfully track the quoted tables (margins 8.2–10.9 pts strict IoU vs transformers, 9.8× params, 22× params → +0.9 pt, all consistent and properly attributed). Two validity concerns: (a) the "order of magnitude faster than two-stage frameworks" sentence in §5.1 is not anchored to a cited FPS pair in the table unlike every other quantitative claim — cite the Faster R-CNN FPS from \cite{shiju2025maturity} or soften; (b) reasonableness of the unaugmented-augmented YOLOv8m comparison in tab:isprs (mAP50 missing, "—") should be explained in a table footnote.
- **Data and experiments:** Published evidence is the paper's strongest suit (23+ detector benchmark, head-to-head YOLOv8/YOLOv11 across scales/resolutions, per-class maturity tables). The original evaluation is thin on quantity of configurations (one model per task) and on independent data; per-class support (Mature 101) is correctly flagged. Baseline fairness *within* the quoted literature is good since all FPS/GFLOPs/params come from one benchmark paper each.
- **Clarity:** Good after revision; argument chain object→condition→harm→prior-limitation→method is present and explicit (§1 + §3.2 Steps list). Notation consistent (mAP50/mAP50-95 defined once). One clarity gap: the abstract compresses the whole contribution and is ~35 lines of dense prose; consider one sentence lighter. Figures communicate; captions identify conditions/metrics.
- **Compliance:** Page limit ok (10 pp against a 10–12 target). Missing: code/data availability statement (venue-dependent), and *two placeholder emails in the author block* must be fixed before submission. Bibliography is self-built (thebibliography): verify against venue BibTeX expectations. Color-only coding in Fig. benchcharts ("gold/green") is a grayscale-compliance risk — IEEE graphics guidance explicitly flags color-only reliance.
- **Advancement:** Realistic, bounded claim — design guidance for small-data plantation perception. The least durable element is the single-orchard nature of the quoted benchmarks; the authors hedge ("relative evidence") which is appropriate.

## Presentation and first impression

- **Figures/tables:** 10 figures + 5 tables in 10 pages — heavy float density; risk of figure/orphan layout awkwardness to check in a render sweep (Pass 5). Table tab:isprs has an unexplained "—" mAP50 cell. Color-reliance risk on Fig. ~\ref{fig:benchcharts}. LP figure quality (PNG) to be verified at ≥300 dpi.
- **Formatting/notation:** IEEEtran fine; bibitem style consistent; two placeholder emails (Critical for submission-readiness, trivial fix).
- **Writing:** Voice is direct and mostly de-AI'd; minor residual: abstract length; hedged phrasing "normally only specialised augmentation…" fine.

## Actionable revision plan (ordered)

1. Reframe §6.3 "Original Evaluation" header + Contribution (ii) to claim *deployment readiness + failure-mode structure*, explicitly noting absence of a same-data rival (text-only fix; optional extra YOLOv11n run is out of budget unless the user wants it).
2. Add a training-configuration paragraph (authors must supply: resolution, epochs, batch, augmentation recipe, pretrained weights).
3. Soften or cite the "order of magnitude faster than two-stage frameworks" claim with the Shiju consolidated FPS numbers; explain the "—" cell in tab:isprs.
4. Temper platform-behaviour assertions (idempotent grounding, carry-over to mission loop) to measured vs demonstrated wording.
5. Surface the failure-mode → monitoring mapping (planner gating, survey-quality monitoring) into the abstract/contributions as the paper's distinctive system contribution.
6. Fix the two placeholder emails; add a code/data availability line.
7. Grayscale-safe recoloring or line-style differentiation of chart figures (Pass 5 scope).

## Likely decision posture

Bounded assessment (not an editor decision): at a **conference**, the paper sits at **borderline-accessible** risk today — strong published-evidence core and clear system framing, but the no-same-data-baseline + missing replication-details pair is what a fast conference review does not forgive with no revision cycle. With fixes 1–3 and 6 applied (all text-level), the paper's case becomes defensible: the thesis is deliberately scoped to "one detector family for both loops", the quoted evidence genuinely supports it, and the original evaluation honestly claims readiness rather than superiority. At a **journal**, this is a Major Revision decision with the same fix list.

## Post-review agreed actions for this audit (→ applied to main.tex where text-level)

- [x] Fix placeholder emails → **requires author input (users' real addresses)** — cannot fabricate.
- [ ] Apply fixes 1, 3, 4, 5 (text-level) — queued for Pass 6 final polish compilation.
- [ ] Training-config paragraph — **requires author input** (training hyperparameters not recorded in repo).
- [ ] Grayscale check of charts — Pass 5.
