#!/usr/bin/env python3
"""Restructure the appendix in content_ch6_back.py to A-G (code, datasets,
models, API, schema, deployment, training)."""
import ast

P = "content_ch6_back.py"
s = open(P).read()
marker = '    ("h2", "Appendix A: API Endpoint List"),'
i = s.find(marker)
assert i > 0, "appendix marker not found"
head = s[:i]

tail = '''    ("h2", "Appendix A: Source Code Structure"),
    ("body",
     "The complete source code is submitted alongside this report on the "
     "project repository and submission disc, per the university's "
     "software-project requirement, together with a readme describing "
     "setup and usage. The code base comprises 91 source files and about "
     "20,550 lines: 45 Python files (9,386 lines) in the backend and 46 "
     "TypeScript files (11,166 lines) in the frontend, plus the "
     "deployment definitions. This appendix documents the structure and "
     "reprints the four core modules; printing the full listing would "
     "add no information that the repository does not carry."),
    ("code",
 "autonomous-coconut-harvester/"
 "|-- backend/"
 "    |-- api/            19 files  4,783 lines  FastAPI routers (survey,"
 "                                  inspection, harvest, robot, dashboard)"
 "    |-- database/        5 files  1,246 lines  SQLAlchemy models, session,"
 "                                  idempotent startup migrations"
 "    |-- harvest/         2 files    232 lines  shared mission execution"
 "    |-- navigation/      3 files    550 lines  RobotNavigator, plans"
 "    |-- robot/           2 files    165 lines  frozen state machine"
 "    |-- simulation/      5 files  1,098 lines  clock, engine, scheduler"
 "    |-- telemetry/       3 files    415 lines  event bus, WebSocket"
 "    |-- analytics/       2 files    593 lines  history and run scoring"
 "    |-- main.py                   166 lines  app assembly and startup"
 "|-- frontend/"
 "    |-- app/            11 files  5,132 lines  nine pages and routing"
 "    |-- components/     19 files  3,952 lines  twin viewer, overlays,"
 "                                  drawers, robot controls"
 "    |-- lib/             6 files  1,523 lines  API client, mosaic layout,"
 "                                  simulation hook, i18n"
 "    |-- messages/        7 files               locale dictionaries"
 "|-- models/                       tree_detector.pt, coconut_detector.pt"
 "|-- Dockerfile.backend, compose.yml, render.yaml"
 "|-- .github/workflows/ci.yml     compile, build and test gates"),
    ("table", "A.1", "Source modules of the code base",
     ["Location", "Files", "Lines", "Responsibility"],
     [["backend/api", "19", "4,783", "FastAPI routers"],
      ["backend/database", "5", "1,246", "SQLAlchemy models and migrations"],
      ["backend/harvest", "2", "232", "shared mission execution service"],
      ["backend/navigation", "3", "550", "pure movement planning"],
      ["backend/robot", "2", "165", "frozen state machine"],
      ["backend/simulation", "5", "1,098", "clock, engine, scheduler"],
      ["backend/telemetry", "3", "415", "event bus and WebSocket gateway"],
      ["backend/analytics", "2", "593", "history and run scoring"],
      ["frontend/app", "11", "5,132", "nine pages and routing"],
      ["frontend/components", "19", "3,952", "twin viewer and controls"],
      ["frontend/lib", "6", "1,523", "API client, layout, simulation hook"],
      ["models", "2 weights", "6.2 MB each", "YOLOv8 detectors"],
      ["deployment", "4 files", "-", "Docker, compose, Render, CI"]],
     [1.9, 0.9, 1.0, 2.5], 9),
    ("body",
     "Four modules carry the core of the project and are reprinted below "
     "as listings: the frozen transition table that makes illegal robot "
     "states unreachable, the hybrid matching rule that turns detections "
     "into permanent trees, the pure simulation step that drives every "
     "run, and the shared layout function that keeps the twin's tiles, "
     "tree overlay and robot layer in one coordinate space."),
    ("body",
     "Listing A.1: the frozen transition table (backend/robot/"
     "state_machine.py)."),
    ("code",
 "LEGAL_TRANSITIONS: Dict[str, set] = {"
 "  RobotState.DOCKED.value:     {RobotState.IDLE.value, RobotState.ERROR.value},"
 "  RobotState.IDLE.value:       {RobotState.MOVING.value, RobotState.ERROR.value},"
 "  RobotState.MOVING.value:     {RobotState.CLIMBING.value,"
 "                                RobotState.RETURNING.value,"
 "                                RobotState.ERROR.value},"
 "  RobotState.CLIMBING.value:   {RobotState.SCANNING.value, RobotState.ERROR.value},"
 "  RobotState.SCANNING.value:   {RobotState.HARVESTING.value, RobotState.ERROR.value},"
 "  RobotState.HARVESTING.value: {RobotState.MOVING.value, RobotState.ERROR.value},"
 "  RobotState.RETURNING.value:  {RobotState.DOCKED.value, RobotState.ERROR.value},"
 "  RobotState.ERROR.value:      {RobotState.RETURNING.value, RobotState.IDLE.value},"
 "}"
 "def is_legal(current: str, target: str) -> bool:"
 "    return target in LEGAL_TRANSITIONS.get(current, set())"),
    ("body",
     "Listing A.2: the hybrid matching rule (backend/api/survey_api.py)."),
    ("code",
 'dist = gps_distance(lat, lon, t["gps_lat"], t["gps_lon"])'
 'if dist > DISTANCE_THRESHOLD:   # 4 m Haversine radius'
 "    continue"
 "geo = 1.0"
 'if t["last_box_w"] and t["last_box_h"]:'
 "    geo = (min(bw, t['last_box_w']) / max(bw, t['last_box_w']) *"
 "           min(bh, t['last_box_h']) / max(bh, t['last_box_h']))"
 "# hybrid confidence (0..1): 0.7 GPS proximity, 0.3 box geometry"
 "conf = (GPS_WEIGHT * max(0.0, 1.0 - dist / DISTANCE_THRESHOLD)"
 "        + GEO_WEIGHT * geo)"
 "if conf > best_conf:"
 "    best_conf, best = conf, t   # reuse the permanent tree"),
    ("body",
     "Listing A.3: the pure simulation step (backend/simulation/engine.py)."),
    ("code",
 "def step(self, ctx, dt, transition_fn):"
 "    events = []"
 "    if ctx.finished or dt <= 0:"
 "        return events"
 "    ctx.sim_time += dt"
 "    # 1. battery drain, active states only"
 "    if ctx.is_active_state():"
 "        ctx.battery_pct = max(0.0,"
 "                              ctx.battery_pct - BATTERY_DRAIN_PER_S * dt)"
 "        if (not ctx.battery_low and"
 "                ctx.battery_pct <= ctx.battery_low_threshold and"
 "                ctx.status not in {'RETURNING', 'DOCKED', 'ERROR'}):"
 "            ctx.battery_low = True"
 "            self._transition(ctx, 'RETURNING', 'battery low',"
 "                             transition_fn, events)"
 "            self._divert_to_dock(ctx)"
 "    # 2. dispatch on the current state"
 "    handler = {'MOVING': self._step_moving,"
 "               'CLIMBING': self._step_timed,"
 "               'SCANNING': self._step_timed,"
 "               'HARVESTING': self._step_timed,"
 "               'RETURNING': self._step_moving,"
 "               }.get(ctx.status, self._step_idle)"
 "    return events + handler(ctx, dt, transition_fn)"),
    ("body",
     "Listing A.4: the shared farm-pixel layout (frontend/lib/"
     "mosaicLayout.ts)."),
    ("code",
 "export function computeMosaicLayout(tiles, gap = 2) {"
 "  const colW = new Map(), rowH = new Map()"
 "  for (const t of tiles) {"
 "    colW.set(t.grid_col,"
 "             Math.max(colW.get(t.grid_col) ?? 0, t.image_width))"
 "    rowH.set(t.grid_row,"
 "             Math.max(rowH.get(t.grid_row) ?? 0, t.image_height))"
 "  }"
 "  // fit only the occupied farm rectangle: the bounding box comes"
 "  // from the actual tiles, never from an assumed dense grid, so the"
 "  // viewer frames the real farm with no artificial empty rows"
 "  const maxCol = Math.max(...tiles.map(t => t.grid_col))"
 "  const minCol = Math.min(...tiles.map(t => t.grid_col))"
 "  const maxRow = Math.max(...tiles.map(t => t.grid_row))"
 "  const minRow = Math.min(...tiles.map(t => t.grid_row))"
 "  // cumulative column and row offsets place every tile in the one"
 "  // farm-pixel space shared by mosaic, tree overlay and robot layer"
 "  ..."
 "}"),
    ("h2", "Appendix B: Datasets"),
    ("body",
     "The detectors were trained on two public Roboflow datasets published "
     "under the CC BY 4.0 licence, totalling 17,640 images. On top of the "
     "public corpora, the team collected about 500 ground-truth "
     "photographs on coconut farms in and around Mysuru, Karnataka, which "
     "are used to sanity-check both detectors on local plantation imagery "
     "under local lighting and palm varieties. Across the training corpora "
     "and the field set, the project draws on more than 18,100 images."),
    ("table", "B.1", "Datasets used by the project",
     ["Dataset", "Source", "Classes", "Images", "Role"],
     [["Tree training corpus", "Roboflow (CC BY 4.0)", "1 (coconut_tree)",
       "10,343 (9,048 / 865 / 430)", "aerial tree detection"],
      ["Ripeness training corpus", "Roboflow (CC BY 4.0)",
       "3 (Mature, Potential, Premature)", "7,297 (6,384 / 618 / 295)",
       "close-up maturity grading"],
      ["Field-validation set", "team-collected, farms around Mysuru, "
       "Karnataka", "plantation imagery", "about 500",
       "local checks of both detectors"]],
     [1.5, 1.6, 1.3, 1.5, 1.2], 9),
    ("h2", "Appendix C: AI Models"),
    ("body",
     "Two YOLOv8n detectors are deployed inside the FastAPI backend and "
     "loaded at startup; inference runs on CPU, and the trained weights "
     "are published on Hugging Face for reproducibility."),
    ("table", "C.1", "Deployed model cards",
     ["Model", "Architecture", "Classes", "Size", "Deployment"],
     [["tree_detector.pt", "YOLOv8n", "1 (coconut_tree)",
       "3,011,800 parameters, 6.2 MB",
       "serves the survey pipeline and /drone/detection; about 56 ms per "
       "640 px frame on CPU; weights at Hugging Face maheshhs/tree_detector"],
      ["coconut_detector.pt", "YOLOv8n",
       "3 (Mature, Potential, Premature)", "3,011,800 parameters, 6.2 MB",
       "serves inspection processing and /detect/coconuts; about 66 ms "
       "per frame on CPU; weights at Hugging Face maheshhs/coconut_detector"]],
     [1.3, 0.9, 1.3, 1.2, 1.9], 9),
    ("h2", "Appendix D: API Endpoint List"),
    ("body",
     "The FastAPI gateway exposes 68 REST endpoints across the sixteen "
     "routers below, plus one observe-only WebSocket gateway. Commands "
     "travel over HTTP; the live telemetry stream is the only push "
     "channel."),
    ("table", "D.1", "REST routers of the backend gateway",
     ["Router", "Base path", "Responsibility"],
     [list(r) for r in ROUTERS],
     [1.3, 1.7, 3.1], 9),
    ("h2", "Appendix E: Database Schema"),
    ("body",
     "The PostgreSQL schema holds 22 tables in six groups that mirror the "
     "data stores of Chapter 4: survey, detection, tree, inventory, "
     "harvest and robot. Two legacy first-version tables are retained "
     "because the specification keeps the early endpoints mounted."),
    ("table", "E.1", "Database tables and their responsibilities",
     ["Table", "Purpose"],
     [list(r) for r in TABLES],
     [1.7, 4.4], 9),
    ("h2", "Appendix F: Deployment Summary"),
    ("bullets", [
        ("Frontend: ",
         "Next.js application deployed on Vercel; the App Router build is "
         "produced by the same repository with the TypeScript compiler and "
         "production build as gates."),
        ("Backend: ",
         "FastAPI service deployed on Render from a Docker image with a "
         "CPU-only PyTorch layer (image size reduced from 10.4 GB to "
         "2.7 GB), started with Uvicorn behind the platform's health probe "
         "(/health checks the database and the model files)."),
        ("Database: ",
         "PostgreSQL hosted on the Neon cloud platform, connected through "
         "a pooled DATABASE_URL; the schema is created and migrated "
         "idempotently at startup by the backend's init_db module."),
        ("Resilience: ",
         "a boot-time healing routine restores the active mission's upload "
         "bytes from the baked image layer on ephemeral hosts "
         "(AUTO_HEAL_UPLOADS), so demo data survives free-tier restarts."),
        ("Continuous integration: ",
         "GitHub Actions runs the Python compile and syntax gates and the "
         "frontend TypeScript and build gates; the Playwright end-to-end "
         "suites guard the digital twin, survey and robot flows with zero "
         "console errors as the acceptance bar."),
    ]),
    ("h2", "Appendix G: Model Training Configuration"),
    ("body",
     "Both detectors share the YOLOv8n backbone and the recorded "
     "Ultralytics configuration below; the weights are published on "
     "Hugging Face for reproducibility."),
    ("table", "G.1", "Detector training and inference configuration",
     ["Setting", "Tree detector", "Ripeness detector"],
     [list(r) for r in TRAINING],
     [1.9, 2.1, 2.1], 9),
]
'''

# the 5.5-intro replacement earlier left the listing A.2 with a stray colon
# typo fix ('if t[...] :' -> 'if t[...]:') handled in the literal above.
open(P, "w").write(head + tail)
ast.parse(open(P).read())
print("appendix restructured, syntax OK")
