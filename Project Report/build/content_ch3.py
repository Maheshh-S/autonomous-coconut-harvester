# -*- coding: utf-8 -*-
"""Chapter 3 METHODOLOGY (humanizer-compliant prose; Fig 3.1 + 3.1/3.2)."""

BLOCKS = [
    ("chapter", "3", "METHODOLOGY"),

    ("body",
     "The proposed system is organised as ten connected stages, ordered so "
     "that every stage consumes only the outputs of the stages before it. "
     "Development followed the same order: each stage was implemented in "
     "the backend, exposed through the web interface, verified in a real "
     "browser against the running system, and only then was the next stage "
     "started. Working this way kept integration problems inside the stage "
     "that produced them, and it meant the system was demonstrable end to "
     "end at every checkpoint of the schedule."),
    ("body",
     "The stages also separate the two sensing roles of the platform. The "
     "drone performs wide-area survey work, and its imagery feeds tree "
     "detection; close-up ripeness judgement happens later, in the "
     "inspection stage, where the camera is near the bunch. Keeping the two "
     "in separate stages lets either detector be retrained or replaced "
     "without touching the other, and it is the reason the perception side "
     "of the system is two small models rather than one large one. "
     "{FIG:pipeline} shows the complete pipeline from drone survey capture "
     "to mission analytics."),
    ("fig", "pipeline", "diagrams/3.1-methodology-pipeline.png",
     "Ten-stage methodology pipeline of the proposed system"),
    ("body",
     "The ten stages in {FIG:pipeline} work as follows, in the order the "
     "system executes them."),
    ("bullets", [
        ("Drone survey capture: ",
         "a survey mission is created with a base GPS coordinate, and a "
         "flight planner lays out the coverage grid explicitly (rows, "
         "columns, origin corner, boustrophedon traversal order and "
         "spacing) instead of inferring it from the number of images."),
        ("Image ingestion and tiling: ",
         "the drone imagery folder is uploaded through the web interface, "
         "and each frame becomes a tile with its grid row and column, "
         "capture order, pixel size and centre GPS stored in the database."),
        ("YOLO tree and coconut detection: ",
         "a YOLOv8 detector with a single tree class runs over every tile "
         "at a 0.4 confidence threshold, and the raw bounding boxes are "
         "stored per tile as detections, not yet as trees."),
        ("Permanent tree generation and matching: ",
         "each box centre is projected to GPS and matched against existing "
         "trees within a 4 m Haversine radius using a hybrid score (0.7 GPS "
         "proximity, 0.3 box geometry). A match reuses the permanent tree "
         "record; a miss creates a new one with a write-once code "
         "(TREE-0001 onwards), so repeat surveys never duplicate trees."),
        ("Digital twin mosaic viewer: ",
         "the surveyed tiles are arranged by their stored grid coordinates "
         "into one continuous mosaic, and a single farm-pixel coordinate "
         "function grounds the tiles, the detection overlay and the robot "
         "layer in the same space, with zoom, pan, fit and a per-tree "
         "details drawer."),
        ("Ripeness inspection: ",
         "close-up images uploaded against a tree run through a second "
         "YOLOv8 model with three classes (Mature, Potential, Premature) at "
         "a 0.25 confidence threshold."),
        ("Inventory snapshots: ",
         "the detection counts are aggregated into an immutable per-tree "
         "inventory snapshot, and the tree's current-inventory pointer is "
         "moved to the new snapshot, so a fresh scan replaces the previous "
         "count while history is preserved."),
        ("Harvest mission planning: ",
         "trees whose latest snapshot holds the requested ripeness are "
         "ordered by a nearest-neighbour route from the dock and stored as "
         "an immutable mission with one ordered queue item per tree."),
        ("Robot mission execution: ",
         "a time-driven simulation executes the mission through an "
         "eight-state machine (Idle, Moving, Climbing, Scanning, "
         "Harvesting, Returning, Error, Docked) with a battery model, "
         "command controls (start, pause, resume, cancel, advance, return "
         "to dock, recharge) and live WebSocket telemetry; its command and "
         "telemetry contracts mirror real hardware."),
        ("Mission history and analytics: ",
         "every run writes one backend-owned summary with distance "
         "travelled, battery used, timing, recharges and a deterministic "
         "mission score, replayable as a timeline, per-tree activity and a "
         "run log."),
    ]),
    ("body",
     "The hardware-facing stages are deliberately simulated. The flight "
     "planner, the survey ingestion and the robot follow the response "
     "contracts of their physical counterparts, which is what allows real "
     "devices to replace them later without application changes. The "
     "platform itself is cloud-deployed: the plantation model, inventory "
     "and run history live in a cloud-hosted PostgreSQL database (Neon), "
     "and the services run on Vercel and Render, so the digital twin, the "
     "live telemetry and the analytics are reachable from any device, from "
     "anywhere. The requirements below reflect that split: what the "
     "software needs today, and what the platform expects from hardware "
     "when it is connected."),

    ("h1", "3.1  Software Requirements"),
    ("bullets", [
        ("Backend: ",
         "Python 3.14, FastAPI, Uvicorn, SQLAlchemy 2 as the ORM and "
         "python-dotenv for configuration."),
        ("Database: ",
         "PostgreSQL hosted on the Neon cloud platform, connected through "
         "a DATABASE_URL environment variable; all survey, inventory, "
         "mission and telemetry data is stored in this cloud database."),
        ("AI and vision: ",
         "Ultralytics YOLOv8 with PyTorch (CPU inference), OpenCV, NumPy "
         "and Pillow."),
        ("Frontend: ",
         "Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS "
         "4."),
        ("Interface and motion: ",
         "next-intl for the seven-language interface (English, Kannada, "
         "Hindi, Tamil, Telugu, Malayalam, Marathi); GSAP 3 and Lenis for "
         "the landing-page motion."),
        ("Real-time telemetry: ",
         "a WebSocket gateway (/ws/robot) over an internal event bus, with "
         "commands exchanged over HTTP."),
        ("Testing: ",
         "Playwright end-to-end suites for the digital twin, survey and "
         "robot flows; TypeScript compilation and a production build as "
         "acceptance gates."),
        ("Deployment: ",
         "Docker for the backend (a CPU-only PyTorch image), Vercel for "
         "the frontend, Render for the backend service, and GitHub Actions "
         "for continuous integration."),
        ("Development tools: ",
         "Git and GitHub, VS Code, and npm for frontend package "
         "management."),
    ]),

    ("h1", "3.2  Hardware Requirements"),
    ("body",
     "The hardware the project needs falls into two groups. The first is "
     "what the running system requires today: only a computer and an "
     "internet connection, because the database and the services live in "
     "the cloud. The second is the plantation hardware the platform is "
     "designed to integrate; these devices are not prerequisites, and each "
     "joins through an interface that already exists."),
    ("bullets", [
        ("Development computer: ",
         "a laptop or desktop with at least 8 GB RAM (16 GB recommended) "
         "capable of running the Next.js frontend, the FastAPI backend and "
         "YOLOv8 inference. A GPU is not required: model training and every "
         "experiment reported in Chapter 5 ran on the project's laptop."),
        ("Internet connection: ",
         "required for development and use, since the PostgreSQL database "
         "is hosted on Neon and the application is deployed on Vercel and "
         "Render; the platform has no single-machine installation to "
         "maintain."),
    ]),
    ("body", "Future integration hardware, connected through the existing "
     "contracts:"),
    ("bullets", [
        ("Survey drone: ",
         "a GPS-enabled drone with a downward-facing camera that returns "
         "overlapping aerial frames of the plantation, feeding the survey "
         "ingestion and flight-planner interfaces."),
        ("Robot camera or edge device: ",
         "a camera module carried by the climbing robot for close-up "
         "ripeness inspection images, feeding the inspection upload "
         "interface."),
        ("Climbing and harvesting robot: ",
         "a motorised unit that climbs the trunk and cuts or plucks "
         "bunches on command, replacing the simulation engine behind the "
         "platform's HTTP command set and WebSocket telemetry contract."),
    ]),
]
