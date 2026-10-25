# -*- coding: utf-8 -*-
"""Chapter 5 RESULTS AND DISCUSSIONS — 24 figures (2 placeholders) + 5 tables.
Walkthrough-style prose per the white-space discipline (Tasks 34/36)."""

BLOCKS = [
    ("chapter", "5", "RESULTS AND DISCUSSIONS"),

    # ---------------------------------------------------------- 5.1
    ("h1", "5.1  Survey Image Ingestion & Tiling"),
    ("body",
     "The results begin where the pipeline begins. A survey mission is "
     "created with a base GPS coordinate, the flight planner lays out its "
     "coverage grid from an explicit configuration (two rows by four "
     "columns for the demonstration dataset, boustrophedon traversal), and "
     "the drone imagery folder is uploaded against the mission. "
     "{FIG:5.1.1} shows the mission page with the demonstration survey "
     "selected and the folder dropzone ready."),
    ("fig", "5.1.1", "ui-screens/5.1.1-survey-mission-creation.png",
     "Survey mission creation and drone-imagery folder selection", 5.5),
    ("body",
     "The interface keeps the four steps of the survey visible at all "
     "times (Mission, Imagery, Upload, Harvest), so the operator always "
     "knows where in the pipeline they are. Files are only uploaded in "
     "step three; the folder selection in step two is a preview, which "
     "prevents half-uploaded surveys from creating partial tiles."),
    ("body",
     "{FIG:5.1.2} shows the result after the eight demonstration frames "
     "are uploaded: the tile statistics report eight of eight tiles "
     "completed with none pending, processing or failed, and each uploaded "
     "frame is listed with its filename for verification."),
    ("fig", "5.1.2", "ui-screens/5.1.2-survey-upload-tiling.jpeg",
     "Survey image upload and tile statistics after ingestion", 5.5),
    ("body",
     "The zero in the remaining-tiles counter is the first result of the "
     "system: ingestion is synchronous and deterministic, and the survey "
     "is either fully tiled or marked failed, never partially processed."),
    ("body",
     "Each tile carries its full placement metadata in the database: grid row and column, capture order, pixel dimensions and centre GPS, all written during ingestion. The flight planner raises a validation error if the uploaded folder holds more frames than planned positions, so the grid is never stretched to fit the imagery; spare positions simply stay empty.",
    ),

    # ---------------------------------------------------------- 5.2
    ("h1", "5.2  YOLO Tree & Coconut Detection"),
    ("body",
     "Each completed tile is passed to the YOLOv8 tree detector at a 0.4 "
     "confidence threshold. {FIG:5.2.1} shows the detection results for "
     "the demonstration survey: 242 detections across the eight processed "
     "tiles with none remaining, and the permanent-tree summary underneath "
     "reporting 242 total trees with zero newly created, 242 matched to "
     "existing records and an average matching confidence of 0.974. This "
     "is a re-survey of a plantation the platform already knew, so every "
     "detection was resolved to its existing tree identity instead of "
     "creating duplicates."),
    ("fig", "5.2.1", "ui-screens/5.2.1-yolo-detections-matching.png",
     "YOLO detections and permanent-tree matching summary", 5.5),
    ("body",
     "Both detectors were trained on public Roboflow datasets under the CC "
     "BY 4.0 licence: 10,343 coconut-tree images for the single-class tree "
     "detector and 7,297 images for the three-class maturity detector. "
     "{FIG:5.2.2} shows sample annotations from those datasets, including "
     "the lighting variation (overcast, low light) that the limitations "
     "section of the published paper singles out."),
    ("fig", "5.2.2", "paper-figures/5.2.2-dataset-samples.png",
     "Dataset samples with maturity annotations across lighting conditions"),
    ("body",
     "The three-class taxonomy in the samples (Mature, Potential, "
     "Premature) is the same taxonomy the inspection model and the "
     "inventory snapshots use, which is what allows detection output to "
     "become harvest planning input without any mapping step."),
    ("body",
     "The detections themselves are stored per tile with an index and a confidence value, as raw boxes rather than trees; a detection becomes a tree only after the matching step of section 5.3. Keeping the two layers separate is what allows the detector to be retrained and re-run without touching a single permanent record.",
    ),

    # ---------------------------------------------------------- 5.3
    ("h1", "5.3  Permanent Tree Generation & Matching"),
    ("body",
     "The tree registry is the persistent identity layer of the platform. "
     "{FIG:5.3.1} shows the registry listing every permanent tree with its "
     "GPS fix, its detected coconut count and its remaining harvest tasks, "
     "with search, task filters and pagination over the full plantation."),
    ("fig", "5.3.1", "ui-screens/5.3.1-tree-registry.png",
     "Permanent tree registry with GPS fixes and task filters", 5.5),
    ("body",
     "The registry screenshot is taken from a later session than the "
     "detection results above, after additional surveys had grown the "
     "plantation to 255 registered trees across 32 pages. The growth "
     "itself is the result: repeat surveys extended the registry without "
     "duplicating it, because each detection was matched inside the 4 m "
     "radius and the tree codes are write-once. Task filters (All, Tasks "
     "pending, Clear) let the farmer read the registry as a work list "
     "rather than a catalogue."),
    ("body",
     "Identity rules worth noting in the implementation: each tree code is written once and never reused; matching scores a candidate with 0.7 weight on GPS proximity and 0.3 on bounding-box geometry; and each tree keeps one representative observation chosen by a fixed rule (highest confidence first, then closest to the tile centre, then the newest mission), which is the observation the twin viewer draws.",
    ),

    # ---------------------------------------------------------- 5.4
    ("h1", "5.4  Digital Twin Farm Viewer"),
    ("body",
     "The digital twin is the primary interface of the platform. "
     "{FIG:5.4.1} shows the viewer page: the mission selector, the seam "
     "adjuster, the display toggles (robot, planned path, current target, "
     "follow robot) and the robot status card with battery, mission, next "
     "tree, simulation time and the WebSocket connection state."),
    ("fig", "5.4.1", "ui-screens/5.4.1-twin-viewer-top.jpeg",
     "Digital twin viewer with mission selector and robot status", 5.5),
    ("body",
     "The status card reads directly from the live WebSocket frame, so "
     "battery and position update as the robot works; the follow-robot "
     "toggle drives the viewport from the same frames and disengages "
     "automatically the moment the farmer pans or zooms manually."),
    ("body",
     "{FIG:5.4.2} shows the full mosaic fitted to the viewport: the eight "
     "tiles joined by their stored grid coordinates with the tree overlay "
     "and the planned robot path drawn in the same farm-pixel space, at "
     "19 percent zoom with the seam gap set to two pixels."),
    ("fig", "5.4.2", "ui-screens/5.4.2-twin-full-mosaic.jpeg",
     "Full farm mosaic with detection overlay and planned path", 5.5),
    ("body",
     "Selecting any tree opens the read-only details drawer over the "
     "mosaic, showing the tree code, its GPS position, its times seen and "
     "detection confidence, its current inventory counts, its inspection "
     "history and the latest inspection images. {FIG:5.4.3} shows the "
     "drawer open on tree TREE-0022 of the demonstration plantation, whose "
     "inventory came from the inspection shown in section 5.5."),
    ("fig", "5.4.3", "ui-screens/5.4.3-tree-details-drawer.jpeg",
     "Tree details drawer open on the digital twin", 5.8),

    # ---------------------------------------------------------- 5.5
    ("h1", "5.5  Ripeness Inspection & Inventory Snapshots"),
    ("body",
     "Inspection is the second sensing loop. Close-up images are uploaded "
     "against a tree, run through the three-class ripeness model at a 0.25 "
     "confidence threshold, and the counts are aggregated into an "
     "immutable inventory snapshot with its own code. A new scan creates "
     "a new snapshot and repoints the tree's current-inventory pointer, so "
     "inventory is replaced on every scan while the history is preserved. "
     "In the published paper's end-to-end run, one inspection of a "
     "selected tree yielded 32 detected coconuts (3 Mature, 2 Potential, "
     "27 Premature) and wrote its snapshot in the same interaction. The "
     "demonstration inspection repeats that result live: {FIG:5.5.1} shows "
     "inspection INSP-0013 completed with four close-up images processed "
     "(35 detections in total) and the resulting snapshot INV-0020 carrying "
     "35 coconuts (7 Mature, 8 Potential, 20 Premature) as the tree's "
     "current inventory."),
    ("fig", "5.5.1", "ui-screens/5.5.1-ripeness-inspection-snapshot.png",
     "Completed ripeness inspection with its inventory snapshot", 5.8),
    ("body",
     "The snapshot record carries the four counts (total, mature, potential, premature) together with the inspection that produced it, and the uniqueness constraint allows exactly one snapshot per inspection. The inspection itself moves through its own lifecycle (created, in progress, completed or failed), so an interrupted inspection never writes partial inventory. The per-tree history view lists every snapshot ever taken, which is how the farmer watches ripeness change over the season.",
    ),

    # ---------------------------------------------------------- 5.6
    ("h1", "5.6  Harvest Mission Planning"),
    ("body",
     "Harvest missions are composed from the latest inventory. The planner "
     "reads every tree's current snapshot, keeps the trees that hold the "
     "requested ripeness (mature, potential, premature or all), excludes "
     "trees already assigned to a live mission, and orders the rest by a "
     "nearest-neighbour route from the dock. {FIG:5.6.1} shows the planner "
     "with mission HM-0004 selected: a mature-type mission over one tree "
     "with four expected coconuts, its ordered queue completed, and the "
     "missions HM-0001 to HM-0006 listed underneath with their dates and "
     "statuses."),
    ("fig", "5.6.1", "ui-screens/5.6.1-harvest-planner-hm0004.png",
     "Harvest mission planner with the ordered tree queue", 5.5),
    ("body",
     "The immutability of the mission is visible in the interface: the "
     "queue cannot be reordered or extended after generation, so the route "
     "the robot follows is exactly the route the planner computed, and any "
     "change in inventory produces a new mission instead of a mutation."),
    ("body",
     "Eligibility is computed, not hand-picked: a tree qualifies when it is active, holds a current inventory snapshot and contains at least one coconut of the requested ripeness, and it is excluded while any live mission still references it. Ties in the route computation are broken by ascending tree code, so two planners with the same inventory produce the same queue, and a database constraint prevents a tree from appearing twice in one mission.",
    ),

    # ---------------------------------------------------------- 5.7
    ("h1", "5.7  Robot Mission Execution & Simulation"),
    ("body",
     "Execution is commanded from the Robot Control Centre. {FIG:5.7.1} "
     "shows the command bar (Start, Pause, Resume, Return to Dock, "
     "Recharge, Stop, Reset) with the speed factor set to 60 times real "
     "time, the harvest mission selector, and the robot status card before "
     "a run: battery full, mission idle, next tree already resolved."),
    ("fig", "5.7.1", "ui-screens/5.7.1-robot-control-centre.jpeg",
     "Robot control centre with the simulation command bar", 5.5),
    ("body",
     "The command hierarchy is enforced in the interface itself: run "
     "controls sit together, the speed factor is debounced, and the "
     "destructive Stop and Reset actions are grouped separately on the "
     "right so they cannot be hit in the same motion as a start."),
    ("body",
     "{FIG:5.7.2} shows the simulation running against the live mosaic: "
     "the robot marker carries its battery ring, the planned path is drawn "
     "from the navigation plan, completed legs are marked, and the status "
     "card reports the same state the WebSocket broadcast carries. The "
     "robot, the trees and the tiles all share the one farm-pixel "
     "coordinate space, so the marker sits exactly on the path it will "
     "follow."),
    ("fig", "5.7.2", "ui-screens/5.7.2-robot-sim-live-mosaic.jpeg",
     "Robot simulation running on the live mosaic", 5.5),
    ("body",
     "During execution the platform writes an append-only telemetry row "
     "and an event row per simulation tick, which is what the history "
     "section below replays; the farmer watches the same frames without "
     "being able to influence the run except through the command bar."),
    ("body",
     "During a run the scheduler advances the simulation in one-tenth-of-a-second real ticks, and each tick persists a telemetry row (position, battery, status, speed, waypoint index) plus an event row for anything that happened; the WebSocket gateway broadcasts the same frames to any number of observe-only clients, and a client that disconnects never affects the run. Speed-factor changes are debounced in the interface and applied through the simulation clock, so the timeline stays continuous across speed changes.",
    ),

    # ---------------------------------------------------------- 5.8
    ("h1", "5.8  Mission History & Analytics"),
    ("body",
     "Every terminated run writes one backend-owned summary. {FIG:5.8.1} "
     "shows the history table over 23 runs with status, mission, finish "
     "time, duration, harvested count, battery used, distance and score, "
     "filterable by status and sortable by duration, harvest and score."),
    ("fig", "5.8.1", "ui-screens/5.8.1-mission-history-all-runs.png",
     "Mission history over 23 completed runs", 5.5),
    ("body",
     "The scores in the table are the deterministic mission score defined "
     "by the backend (completion times the battery economy factor times "
     "the status factor), and identical runs produce identical scores, "
     "which is visible in the repeated 85.2 entries for repeat runs of the "
     "same mission."),
    ("body",
     "{FIG:5.8.2} opens run 23: a score of 85.2 out of 100 with its factor "
     "breakdown (completion 100 percent, battery efficiency 70 percent, "
     "safe return 100 percent, error free 100 percent) and the eleven "
     "metrics beneath it: 4 of 4 trees harvested, none skipped, 49 s "
     "duration, 6092.24 m distance, 29.58 percent battery used, 11 "
     "recharges, 24.00 s average harvest time, 1.00 average speed and "
     "9.60 s idle time."),
    ("fig", "5.8.2", "ui-screens/5.8.2-run23-summary.png",
     "Run 23 summary with the mission score breakdown", 5.5),
    ("body",
     "Every number on the summary is derived server-side from the "
     "append-only telemetry and event rows, not from the interface; the "
     "score formula reproduces the headline figure exactly (100 percent "
     "completion and 70 percent battery economy give 100 times 0.5 plus "
     "0.5 times 0.7, which is 85.2)."),
    ("body",
     "{FIG:5.8.3} replays the run as a timeline: each backend event "
     "(mission started, returning to dock, mission completed) carries its "
     "simulation-time chip (t+1.20 s, t+7.20 s) beside the IST wall clock, "
     "so the farmer can read the run in simulated seconds or in real time "
     "and both agree with the telemetry."),
    ("body",
     "The metrics are derived, not entered: distance is the sum of position "
     "deltas across the telemetry samples, recharges are counted from battery "
     "jumps of 25 percent or more, idle time accumulates from consecutive idle "
     "or docked samples, and efficiency is harvested trees per hundred distance "
     "units. Because every input comes from the append-only telemetry and event "
     "tables, the same run always summarises to the same numbers on any page "
     "that shows it."),
    ("fig", "5.8.3", "ui-screens/5.8.3-run23-timeline.png",
     "Run 23 timeline with simulation-time and IST chips", 5.5),

    # ---------------------------------------------------------- 5.9
    ("h1", "5.9  Multilingual Farmer Interface"),
    ("body",
     "The complete interface is available in seven languages: English and "
     "six Indian languages (Kannada, Hindi, Tamil, Telugu, Malayalam, "
     "Marathi) through 553 translation keys per locale, served by the "
     "next-intl runtime with a cookie-based locale and no URL routing, so "
     "links, deep links and tests are identical across languages. "
     "{FIG:5.9.1} shows the language picker with all seven options in "
     "their native scripts."),
    ("fig", "5.9.1", "ui-screens/5.9.1-language-picker.png",
     "Language picker with the seven supported locales", 3.2),
    ("body",
     "The picker shows each language in its own script (Kannada, Hindi, "
     "Tamil, Telugu, Malayalam, Marathi), which is how a farmer who cannot "
     "read the current language finds their own."),
    ("body",
     "{FIG:5.9.2} shows the full dashboard rendered in Kannada: headings, "
     "stat tiles, farm summary, panels, analytics labels and the activity "
     "feed are all translated, while numbers, tree codes and mission codes "
     "stay in their canonical form so data remains unambiguous."),
    ("fig", "5.9.2", "ui-screens/5.9.2-dashboard-kannada.png",
     "System dashboard in Kannada", 5.5),
    ("body",
     "{FIG:5.9.3} shows the same dashboard in Hindi. The translation "
     "pipeline is offline (machine translation with human review), so the "
     "runtime carries no translation service dependency, and a guardrail "
     "script fails the build if any locale drifts from the key set."),
    ("body",
     "Locale travels in a cookie rather than the URL, so a farmer can share a "
     "link without dragging the language along, and each script renders with "
     "its own Noto font stack loaded alongside the Latin fonts. The guardrail "
     "script compares all seven dictionaries on every build and fails if a key "
     "or placeholder drifts, which kept the 553-key set aligned across the six "
     "translations."),
    ("fig", "5.9.3", "ui-screens/5.9.4-dashboard-hindi.png",
     "System dashboard in Hindi", 5.5),

    # ---------------------------------------------------------- 5.10
    ("h1", "5.10  Verification & Performance"),
    ("body",
     "The results so far show the system working; this section shows it "
     "being verified. Two kinds of evidence are reported, following the "
     "published paper: detector accuracy on held-out validation splits, "
     "and seven backend experiments (E1 to E7) run against the project's "
     "own modules with fixed random seeds. Table 5.1 lists the detection "
     "metrics."),
    ("table", "acc", "Detection accuracy on the held-out validation splits",
     ["Model / class", "Precision", "Recall", "mAP@0.5", "mAP@0.5:0.95"],
     [["Tree detector", "0.841", "0.843", "0.877", "0.539"],
      ["Ripeness: all classes", "0.760", "0.747", "0.783", "0.587"],
      ["Ripeness: Mature", "0.637", "0.607", "0.631", "0.430"],
      ["Ripeness: Potential", "0.794", "0.791", "0.860", "0.715"],
      ["Ripeness: Premature", "0.848", "0.842", "0.858", "0.617"]],
     [1.7, 1.1, 1.1, 1.1, 1.2], 9),
    ("body",
     "The confusion matrices in {FIG:5.10.1a} and {FIG:5.10.1b} explain "
     "the numbers. The tree detector concentrates 90 percent of its mass "
     "on the diagonal with no background false positives, which is the "
     "behaviour the matching radius depends on. The ripeness detector "
     "keeps its off-diagonal mass almost entirely in the background "
     "column (missed detections), with little true confusion between "
     "classes; Mature is the weakest class at 0.65 because a partly "
     "turned coconut resembles a Potential one under canopy lighting."),
    ("fig", "5.10.1a", "paper-figures/5.10.1a-confusion-matrix-tree.png",
     "Normalised confusion matrix of the tree detector", 5.3),
    ("fig", "5.10.1b", "paper-figures/5.10.1b-confusion-matrix-ripeness.png",
     "Normalised confusion matrix of the ripeness detector", 5.3),
    ("body",
     "The precision-recall curves in {FIG:5.10.2a} and {FIG:5.10.2b} show "
     "the same structure as curves: the tree detector reaches 0.877 "
     "mAP@0.5, and the ripeness detector reaches 0.783 overall with "
     "Potential (0.860) and Premature (0.858) well ahead of Mature "
     "(0.631). The paper notes that more inspection images per tree, "
     "rather than different decision boundaries, would close the Mature "
     "gap."),
    ("fig", "5.10.2a", "paper-figures/5.10.2a-pr-curve-tree.png",
     "Precision-recall curve of the tree detector", 5.3),
    ("fig", "5.10.2b", "paper-figures/5.10.2b-pr-curve-ripeness.png",
     "Precision-recall curves of the ripeness detector", 5.3),
    ("body",
     "The backend experiments are summarised in Table 5.2. The engine "
     "produced byte-identical event and state traces in every one of 100 "
     "randomised missions (E1, SHA-256 comparison of the full trace), "
     "exactly 17 of the 64 ordered state pairs are legal (E3) and every "
     "one of the seven operational states can fault into Error, all 100 "
     "missions ended finished and Docked with non-increasing battery (E4), "
     "and 88 of 100 missions harvested every tree, the remainder diverted "
     "by the low-battery rule."),
    ("table", "checks", "Simulation engine and state machine checks",
     ["Check", "Result"],
     [["E1: identical event and state trace over two runs (random missions)", "100 / 100"],
      ["E3: legal / illegal ordered state pairs", "17 / 47 of 64"],
      ["E3: self-transitions allowed", "0"],
      ["E3: operational states that can fault to Error", "7 of 7"],
      ["E4: illegal transitions attempted by the engine", "0 in 100 missions"],
      ["E4: missions ending finished and Docked", "100 / 100"],
      ["E4: missions with non-increasing battery", "100 / 100"],
      ["E4: missions harvesting every tree", "88 / 100"],
      ["E4: mean state transitions per tree", "4.4"],
      ["Battery drain at 60x speed", "1.0 percent per real second"]],
     [4.4, 1.6], 9),
    ("body",
     "The battery stress test in Table 5.3 pushes the low-battery rule to "
     "its limit at the lowest simulation speed, where one simulated second "
     "costs a full percent. All four missions end Docked with the battery "
     "at 0.0 percent, and only one or two trees are harvested; the fixed "
     "20 percent threshold does not guarantee arrival with reserve when "
     "the dock is far away, which makes a distance-aware return threshold "
     "the clearest future improvement."),
    ("table", "battery", "Battery-low diversion stress test at 1.0 px per simulated second",
     ["Trees", "Plan length (px)", "Harvested", "Final state", "Final battery (percent)"],
     [["10", "29,835", "2", "DOCKED", "0.0"],
      ["20", "36,815", "2", "DOCKED", "0.0"],
      ["30", "72,290", "1", "DOCKED", "0.0"],
      ["40", "90,398", "1", "DOCKED", "0.0"]],
     [0.9, 1.6, 1.1, 1.2, 1.6], 9),
    ("body",
     "Routing quality is measured against exact optima and a 2-opt "
     "reference in Table 5.4, and {FIG:5.10.3} plots the same results. "
     "Nearest neighbour runs 5.56 to 9.24 percent longer than the exact "
     "optimum for 5 to 8 trees with a worst case near 30 percent, and its "
     "excess over 2-opt grows from 10.14 percent at 10 trees to 16.69 "
     "percent at 100 trees, matching the behaviour the travelling "
     "salesman bound analysis predicts for greedy selection. A random "
     "visiting order is 1.33 to 5.33 times worse, which is the argument "
     "for spatial ordering of any kind."),
    ("fig", "5.10.3", "paper-figures/5.10.3-routing-quality-charts.png",
     "Nearest-neighbour routing quality against exact optimum and random order"),
    ("table", "routing", "Nearest-neighbour tour length (round trip from the dock)",
     ["Trees", "Reference", "NN excess mean (percent)", "NN excess max (percent)", "Random order"],
     [["5", "exact optimum", "5.56", "20.89", "1.33x"],
      ["6", "exact optimum", "5.92", "28.79", "1.47x"],
      ["7", "exact optimum", "8.63", "30.31", "1.55x"],
      ["8", "exact optimum", "9.24", "28.02", "1.60x"],
      ["10", "2-opt reference", "10.14", "-", "1.72x"],
      ["20", "2-opt reference", "14.42", "-", "2.28x"],
      ["50", "2-opt reference", "15.0", "-", "3.83x"],
      ["100", "2-opt reference", "16.69", "-", "5.33x"]],
     [0.8, 1.6, 1.5, 1.5, 1.2], 9),
    ("body",
     "The re-survey experiment in Table 5.5 and {FIG:5.10.4} tests the "
     "matching radius directly: 60 synthetic trees at least 8 m apart are "
     "re-surveyed with growing per-axis position error, using the real "
     "matching code. No duplicates are created for errors up to 1.09 m; "
     "at 2.17 m the 4 m radius creates 11 duplicates and at 4.34 m it "
     "creates 19. Since coconut palms are normally planted 7.5 to 9 m "
     "apart, the radius is suitable for typical plantations and should be "
     "reduced for very dense plots."),
    ("fig", "5.10.4", "paper-figures/5.10.4-resurvey-duplicates-curve.png",
     "Duplicate trees created by the 4 m matching radius under position error"),
    ("table", "resurvey", "Re-survey matching with 60 trees spaced at least 8 m apart",
     ["Error (px)", "Error (m, per axis)", "Trees after survey 1", "Trees after re-survey", "Duplicates"],
     [["0", "0.0", "60", "60", "0"],
      ["10", "0.54", "60", "60", "0"],
      ["20", "1.09", "60", "60", "0"],
      ["40", "2.17", "60", "71", "11"],
      ["80", "4.34", "60", "79", "19"]],
     [1.0, 1.6, 1.5, 1.5, 1.1], 9),
    ("body",
     "Throughput closes the verification. The engine executes 114,575 to "
     "119,599 one-second simulation steps per second on a single CPU "
     "core, more than 800 times the 60 steps per second the default speed "
     "needs, so simulation cost is negligible next to database round "
     "trips, which on the managed serverless PostgreSQL add roughly two "
     "seconds per request. Two engineering observations came from the "
     "development log: a batched update of 302 tree rows took about 80 s "
     "where sequential updates were impractical, and replacing about 600 "
     "sequential queries with two grouped aggregates brought a tree "
     "summary endpoint from a hang above 20 s to about 3 s."),
    ("body",
     "Taken together, the results support the three claims the project "
     "makes: the perception models are accurate enough for their roles, "
     "the simulation and planning layers are deterministic and legal by "
     "construction, and the workflow from survey tiles to a finished "
     "harvest runs end to end on the deployed cloud platform, verifiable "
     "by any reader through the same interface shown in this chapter."),
    ("body",
     "Two further experiments complete the battery. E5 checks the boustrophedon traversal order for sixteen grid and origin configurations, which protects the flight planner against layout regressions; E6 runs the matching code on a SQLite copy of the data and produces the re-survey results above; and the routing experiments place trees randomly on a 4100 by 4100 farm-pixel field with the dock at the origin, so the tour-length conclusions are about the planner's behaviour on random positions rather than measurements from a real plantation.",
    ),
]
