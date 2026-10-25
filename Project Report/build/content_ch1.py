# -*- coding: utf-8 -*-
"""Chapter 1 INTRODUCTION (humanizer-compliant prose)."""

BLOCKS = [
    ("chapter", "1", "INTRODUCTION"),

    ("body",
     "An AI-powered autonomous coconut harvesting system is a full-stack "
     "digital twin platform aimed at removing the human climber from "
     "coconut harvesting. It combines drone imagery, YOLOv8 detection "
     "models, a web-based digital twin and a simulated climbing robot into "
     "one pipeline: drone surveys are tiled and scanned for trees, each "
     "tree receives a permanent GPS-tagged identity, close-up images "
     "classify coconuts as mature, potential or premature, and the counts "
     "drive ordered harvest missions that a robot executes while the "
     "farmer watches from a live dashboard. Designed to be accessible, the "
     "interface runs in seven Indian languages, and every piece of data, "
     "from survey tiles to run history, is stored in a cloud-hosted "
     "PostgreSQL database (Neon) so the plantation can be monitored from "
     "anywhere."),
    ("body",
     "The platform is hardware-ready software. The drone survey pipeline, "
     "the flight planner and the robot are simulated, but each follows the "
     "command and telemetry contract of its real counterpart, so physical "
     "devices can be connected later without changing the application. "
     "Every stage was verified in a real browser against the running "
     "system before the next stage began, and the complete workflow, from "
     "survey tiles to a finished harvest, is reproducible end to end."),

    ("h1", "1.1  Problem Statement"),
    ("body",
     "Coconut harvesting in India still depends on skilled climbers who work "
     "at heights of 15 to 25 m, a task that causes fatal accidents and that "
     "fewer people are willing to do. A palm carries bunches at different "
     "stages of maturity on the same crown, and farmers keep no per-tree "
     "record of what is ready, so harvest decisions on large plantations rest "
     "on memory and lead to cut or missed yield. Existing solutions handle "
     "only isolated parts of the problem: pole cutters reduce climbing but "
     "still need an operator at every tree, climbing-robot prototypes assume "
     "a person decides what to cut, and vision-based classifiers stop at "
     "reporting ripeness. There is a need for one system that observes the "
     "plantation, maintains a per-tree ripeness record, plans the harvest and "
     "executes it, and building that system is the problem this project "
     "addresses."),

    ("h1", "1.2  Aim & Objective"),
    ("h2", "1.2.1  Aim"),
    ("body",
     "The aim of this project is to remove the human climber from coconut "
     "harvesting by building a software platform that observes a plantation "
     "through drone imagery, maintains a per-tree ripeness inventory, plans "
     "harvest missions and drives a harvesting robot through them. The "
     "platform is built to integrate with real hardware. Every simulated "
     "component, from the drone survey pipeline to the robot, follows the "
     "command and response contract of its physical counterpart, so real "
     "devices can be connected later without changing the application."),
    ("h2", "1.2.2  Objectives"),
    ("bullets", [
        ("Detection and mapping of trees: ",
         "to detect coconut trees in drone-captured aerial imagery using a "
         "YOLOv8 detector, assign each tree a permanent GPS-tagged identity, "
         "and keep that identity stable across repeat surveys."),
        ("Ripeness classification and inventory: ",
         "to classify close-up coconuts as mature, potential or premature "
         "using a second YOLOv8 model, and to record the result of every "
         "inspection as an immutable per-tree inventory snapshot."),
        ("Harvest mission planning and robot execution: ",
         "to compose preference-based harvest missions as ordered routes over "
         "the latest inventory, and to execute them with a simulated climbing "
         "robot whose state machine, battery model and telemetry mirror real "
         "hardware behaviour."),
        ("Monitoring and analytics: ",
         "to provide a web dashboard and digital twin viewer for live "
         "plantation status, mission tracking, run history and analytics, "
         "with the interface available in seven Indian languages."),
    ]),

    ("h1", "1.3  Methodology"),
    ("body",
     "The project was developed in stages, and each stage was verified in a "
     "browser against the running system before the next stage began. The "
     "first stage built the perception pipeline: survey image ingestion, "
     "tiling, YOLOv8 tree detection, and GPS-based matching of detections "
     "into permanent tree records. The second stage built the digital twin, a "
     "single interactive viewer that renders the surveyed plantation as a "
     "tile mosaic with detection overlays and a per-tree details view. The "
     "third stage added ripeness inspection, inventory snapshots, harvest "
     "planning and the robot simulation with its telemetry and history. Later "
     "stages hardened deployment, added the multilingual interface and "
     "verified the complete workflow end to end. Chapter 3 describes the "
     "ten-stage pipeline that resulted, and {FIG:pipeline} shows the stages "
     "in order."),

    ("h1", "1.4  Scope of the project"),
    ("bullets", [
        ("Survey ingestion and flight planning: ",
         "drone survey folders are uploaded through the web interface and "
         "tiled by an explicit flight-planner configuration into a coverage "
         "grid, with tile GPS positions derived from a mission base "
         "coordinate."),
        ("Tree detection and registry: ",
         "a YOLOv8 detector runs over every tile, and GPS-proximity matching "
         "converts the detections into permanent tree records with write-once "
         "codes that persist across repeat surveys."),
        ("Digital twin viewer: ",
         "an interactive mosaic of the surveyed plantation with detection "
         "overlays, zoom, pan, tree selection and a read-only details drawer."),
        ("Ripeness inspection and inventory: ",
         "close-up images uploaded per tree run through a three-class "
         "ripeness detector, and the counts are stored as immutable inventory "
         "snapshots that always reflect the latest inspection."),
        ("Harvest mission planning: ",
         "missions are planned from the latest inventory using a nearest "
         "neighbour route and stored as immutable ordered queues of trees."),
        ("Robot simulation and telemetry: ",
         "a time-driven simulation executes each mission through an "
         "eight-state machine with battery modelling, live WebSocket "
         "telemetry and full command controls."),
        ("Mission history and analytics: ",
         "every run writes a backend-owned summary with distance travelled, "
         "battery used, timing and a deterministic mission score."),
        ("Multilingual interface: ",
         "the complete interface is available in English, Kannada, Hindi, "
         "Tamil, Telugu, Malayalam and Marathi."),
        ("Deployment: ",
         "the system runs live on cloud hosting, with the frontend, backend "
         "and database deployed as separate services."),
    ]),

    ("h1", "1.5  Limitations"),
    ("body",
     "The harvesting robot is simulated. The software layer that plans "
     "missions, issues commands and records telemetry is complete and follows "
     "the contract that real hardware would use, but no physical climber has "
     "been connected, so grasping, cutting and trunk locomotion are outside "
     "what this report evaluates. Tree positions are derived from a mission "
     "base coordinate and the tile grid rather than read from image geotags, "
     "which keeps relative geometry consistent while leaving absolute "
     "positions synthetic. Detection accuracy is measured on two public "
     "datasets totalling about 17,600 images. They cover daylight conditions "
     "but no night or dusk footage, and the ripeness validation split is "
     "small at 618 images. The system supports one farm and one robot and "
     "has no user authentication. The twin viewer renders tree boxes as page "
     "elements, which performs well at the demonstrated scale of about 300 "
     "trees but would need canvas rendering for plantations of several "
     "thousand."),

    ("h1", "1.6  Organization of the report"),
    ("body",
     "Chapter 2 reviews the literature on coconut harvesting robots, tree "
     "and fruit detection, and digital twins, and states the gap this "
     "project addresses. Chapter 3 describes the methodology and the "
     "software and hardware environment. Chapter 4 documents the system "
     "design through its modules, architecture and the standard flow, data "
     "flow, use case, activity, sequence, entity relationship and class "
     "diagrams. Chapter 5 presents the implemented system stage by stage "
     "with interface results, the verification experiments and performance "
     "measurements. Chapter 6 concludes the report and lists future work. "
     "The references, the publication that resulted from this project and "
     "the appendices covering the API surface, the database schema, the "
     "deployment summary and the model training configuration follow the "
     "conclusion."),
]
