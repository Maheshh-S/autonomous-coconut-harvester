# -*- coding: utf-8 -*-
"""Chapter 4 IMPLEMENTATION AND FLOW CHART — 12 figures in section order
(locked plan; figure numbers match their sections, sample convention)."""

BLOCKS = [
    ("chapter", "4", "IMPLEMENTATION AND FLOW CHART"),

    ("h1", "4.1  Modules"),
    ("body",
     "The implementation is organised into eight backend-owned modules, "
     "arranged in pipeline order. Each module owns its data, exposes it "
     "through REST endpoints, and never trusts the frontend with a business "
     "rule; the interface presents results and sends intents."),
    ("bullets", [
        ("Survey ingestion and tiling: ",
         "creates survey missions, receives drone imagery folders and turns "
         "them into positioned tiles through the flight planner."),
        ("YOLO detection: ",
         "runs the tree detector over every tile and stores raw bounding "
         "boxes."),
        ("Permanent tree registry and matching: ",
         "projects detections to GPS, matches them into permanent tree "
         "records and maintains mission-scoped observations."),
        ("Digital twin viewer: ",
         "serves the mosaic, tree overlay and per-tree details over one "
         "shared farm-pixel coordinate function."),
        ("Ripeness inspection and inventory: ",
         "receives close-up images, runs the three-class ripeness model and "
         "writes immutable inventory snapshots."),
        ("Harvest mission planning: ",
         "selects eligible trees from the latest inventory and stores "
         "nearest-neighbour ordered missions."),
        ("Robot mission execution: ",
         "drives the simulated robot through the frozen state machine with "
         "battery modelling, commands and WebSocket telemetry."),
        ("Mission history and analytics: ",
         "summarises every terminated run into a score, timeline, per-tree "
         "activity and log."),
    ]),
    ("body",
     "The module map in {FIG:4.1.1} places the eight modules in pipeline "
     "order over the six data stores. Every store is written only by its "
     "owning module, and the dashed arrow marks the re-seed loop in which "
     "mission analytics feed the latest inventory back into harvest "
     "planning."),
    ("fig", "4.1.1", "diagrams/4.1.1-module-architecture.png",
     "Module architecture of the platform with its data stores"),
    ("body",
     "Within that map, the robot execution module is the only component "
     "permitted to change robot status, and it does so exclusively through "
     "the frozen transition table in {FIG:4.1.2}: the normal harvest cycle "
     "runs Idle, Moving, Climbing, Scanning and Harvesting, the "
     "return-to-dock loop closes the cycle, and every operational state may "
     "fault into Error, from which recovery goes only to Idle or Returning."),
    ("fig", "4.1.2", "paper-figures/4.1.1-robot-state-machine.png",
     "Robot state machine with the frozen legal transitions"),
    ("body",
     "Every transition is validated against this table and appended to an "
     "immutable transition log, so no run can enter an undefined state; the "
     "experiments in Chapter 5 confirm zero illegal transitions across 100 "
     "randomised missions."),
    ("body",
     "The mission control dashboard module reads across the other modules "
     "and gives the operator one situational view. {FIG:4.1.3} shows its "
     "top page: plantation totals, survey and harvest state, the latest run "
     "score, and the live robot status beside a miniature digital twin that "
     "links to the full viewer."),
    ("fig", "4.1.3", "ui-screens/extra-dashboard-top.png",
     "Mission control dashboard with farm totals and live robot status"),
    ("body",
     "All figures on the dashboard are server-computed; the page polls the "
     "overview endpoint and renders what it receives."),

    ("h1", "4.2  System Architecture"),
    ("body",
     "The architecture has three cooperating layers: a Next.js frontend "
     "that only presents data, a FastAPI backend that owns every business "
     "rule and runs the YOLO models locally, and a PostgreSQL data layer "
     "accessed through SQLAlchemy. The backend is the single source of "
     "truth. The whole platform is cloud-deployed, with the frontend on "
     "Vercel, the backend on Render and the database on the Neon cloud, so "
     "the plantation model and the live telemetry are reachable from "
     "anywhere through a browser."),
    ("fig", "4.2", "diagrams/4.2-system-architecture-hld.png",
     "High-level system architecture from client to deployment"),
    ("body",
     "{FIG:4.2} shows the layers end to end. The client column holds the "
     "farmer's browser, the App Router pages and the live telemetry client. "
     "The backend column holds the API gateway with its REST routers, the "
     "domain services (flight planner, tree matching, harvest planner, "
     "state machine, simulation engine) and the telemetry path through the "
     "event bus. The data column holds the image store, the 22-table "
     "PostgreSQL schema and the YOLO weights. The right column shows the "
     "deployment and quality infrastructure: Docker, Render, GitHub "
     "Actions and the Playwright acceptance suites."),

    ("h1", "4.3  Flow Diagram"),
    ("body",
     "{FIG:4.3} traces the complete workflow as the system executes it. The "
     "stages carry the same numbers as the methodology pipeline in Fig 3.1, "
     "so the two diagrams can be read side by side: the solid arrows are the "
     "normal flow, the dashed amber arcs are the two feedback cycles, and "
     "the green dashed connectors mark what is stored in and fetched from "
     "the cloud database. Because every stage passes through that cloud "
     "backbone (PostgreSQL on Neon), the state of the plantation survives "
     "any device: a survey run on one laptop, an inspection on a phone and "
     "the robot console all see the same trees, the same counts and the "
     "same missions."),
    ("fig", "4.3", "diagrams/4.3-flow-diagram.png",
     "System flow diagram across the ten stages and the cloud database"),
    ("body",
     "The flow makes the two feedback cycles explicit. After a harvest, the "
     "post-harvest inventory update returns to the inventory stage so the "
     "next plan is composed from fresh counts, and the re-survey cycle "
     "feeds new drone imagery back into detection, keeping the twin current "
     "without duplicating trees."),
    ("body",
     "The ninth stage, robot execution, is dense enough to warrant its own "
     "flow. {FIG:4.3.1} expands it into five steps: the mission is "
     "validated and frozen, the nearest-neighbour queue is loaded, the "
     "state machine drives the robot, each harvested tree writes a "
     "post-harvest snapshot, and the mission auto-completes when the queue "
     "is exhausted."),
    ("fig", "4.3.1", "diagrams/4.3-flow-mission-execution.png",
     "Harvest mission execution flow with its data stores"),
    ("body",
     "The data stores under the flow (harvest missions, inventory "
     "snapshots, mission history) are written by the mission engine alone, "
     "which is why manual advance and simulated execution produce identical "
     "records."),

    ("h1", "4.4  Data Flow Diagram"),
    ("body",
     "The data flow diagrams expose how information moves, as a complement "
     "to the flow chart, which shows when it moves. {FIG:4.4.1} is the "
     "context level: it shows the three actors and the single system "
     "boundary. The farmer submits surveys, inspections and mission "
     "commands and receives the twin, reports and analytics in return; the "
     "drone supplies geotagged survey images; the robot exchanges harvest "
     "missions and commands for telemetry and status. Nothing crosses the "
     "boundary except these inputs and outputs, which is what keeps the "
     "backend the single authority over the data."),
    ("fig", "4.4.1", "diagrams/4.4-dfd-level0.png",
     "Data flow diagram, Level 0 (context)"),
    ("body",
     "{FIG:4.4.2} decomposes the system into its eight processes and six "
     "data stores. Survey ingestion (1.0) feeds detection (2.0), whose "
     "candidates are registered and matched (3.0) into permanent trees "
     "before the twin viewer (4.0) reads them; inspections (5.0) write the "
     "snapshots that planning (6.0) consumes; execution (7.0) drives the "
     "robot and analytics (8.0) closes the loop for the farmer. The stores "
     "carry the same D1 to D6 labels used throughout the chapter, so the "
     "flow diagram, the data flow diagram and the ER diagram all refer to "
     "the same six collections of tables."),
    ("fig", "4.4.2", "diagrams/4.4-dfd-level1.png",
     "Data flow diagram, Level 1 (processes 1.0 to 8.0, stores D1 to D6)"),

    ("h1", "4.5  Use Case Diagram"),
    ("body",
     "{FIG:4.5} organises the platform's behaviour into six packages "
     "around two actors, and the packages deliberately mirror the modules "
     "of section 4.1 so the reader can move between the two views without "
     "translation. The farmer drives survey and mapping, inspection and "
     "inventory, twin visualisation, harvest planning and robot execution; "
     "the robot actor participates in execution and telemetry; the "
     "monitoring package covers live tracking and mission history for "
     "both. The farmer connects to every package because the platform is "
     "single-tenant by design, with no separate administrator role."),
    ("body",
     "Reading the diagram package by package: survey and mapping covers "
     "uploading the drone survey with its mandatory detection-and-matching "
     "step; inspection and inventory covers the ripeness inspection and "
     "the snapshot review that always follows it; twin visualisation "
     "covers the mosaic and the dashboard; harvest planning covers mission "
     "planning with its eligibility filter; robot execution covers mission "
     "control with robot-state tracking; and monitoring and analytics "
     "covers live telemetry and the run history that both actors feed. "
     "Every oval is a capability the interface exposes, and every include "
     "arrow marks a step the platform performs automatically instead of "
     "leaving it to the farmer."),
    ("fig", "4.5", "diagrams/4.5-use-case-diagram.png",
     "Use case diagram of the Veraxis platform"),
    ("body",
     "The include relationships mark the mandatory sub-steps: a survey "
     "upload always runs detection and matching, an inspection always ends "
     "in a reviewable snapshot, and a planned mission always filters "
     "eligible trees before the robot executes."),

    ("h1", "4.6  Activity Diagram"),
    ("body",
     "{FIG:4.6} shows the end-to-end activity flow with its decision "
     "points. The legend distinguishes three kinds of edge: the green "
     "guard is the normal flow onward, the amber arcs are feedback and "
     "loopback cycles, and the grey arc is the early exit back to idle. "
     "Four decisions drive the shape of the flow: surveys repeat until "
     "trees are detected, the platform idles until an eligible tree is "
     "ripe, a battery check diverts the robot to dock and recharge before "
     "it resumes, and the harvest loop advances tree by tree until the "
     "mission queue is exhausted."),
    ("body",
     "Reading the flow along its loops: the survey loop repeats capture "
     "and detection until the registry reports trees, because a survey "
     "that finds nothing has nothing to add; the eligibility gate compares "
     "the latest inventory against the requested ripeness and idles the "
     "platform when nothing qualifies; the harvest loop walks the queue "
     "tree by tree, and each pass writes the post-harvest snapshot before "
     "moving on; and the battery decision sits inside that loop, so a low "
     "charge costs one diversion to dock and a recharge instead of a "
     "failed mission. Every loop in this diagram was exercised by the "
     "verification runs reported in Chapter 5."),
    ("fig", "4.6", "diagrams/4.6-activity-diagram.png",
     "Activity diagram with survey, harvest and battery decision loops"),

    ("h1", "4.7  Sequence Diagram"),
    ("body",
     "{FIG:4.7} details one mission execution across nine lifelines: the "
     "farmer, the frontend, the backend, the harvest planner, the "
     "navigation service, the state machine, the simulation engine, the "
     "event bus with its telemetry gateway, and the database. Thirteen "
     "numbered steps run in order, and the legend separates synchronous "
     "calls from the asynchronous WebSocket path. The loop frame repeats "
     "per queue item, the state machine enforces each legal transition "
     "individually, and the alternative frame at the bottom separates the "
     "next-item case from mission finalisation, which is where the run "
     "record for Chapter 5 is written."),
    ("body",
     "Reading the steps in order: steps 1 to 6 are the setup handshake, "
     "the farmer's click, the planner's ordering, the database write of "
     "the immutable mission and the status returned to the page; steps 7 "
     "to 12 form the per-item loop, where the navigator computes the leg "
     "in farm pixels, the state machine walks Moving, Scanning and "
     "Harvesting, every transition and every clock tick is persisted, and "
     "each tick is broadcast to any WebSocket client watching; and step 13 "
     "completes the item, decrements the snapshot and either returns to "
     "the loop or finalises the mission. The split matters because the "
     "loop carries no user interaction: the farmer only watches the "
     "broadcast frames while the backend works."),
    ("fig", "4.7", "diagrams/4.7-sequence-diagram.png",
     "Sequence diagram of harvest mission execution"),

    ("h1", "4.8  ER Diagram"),
    ("body",
     "{FIG:4.8} shows the sixteen core entities behind the six data "
     "stores, of the twenty-two tables in the full schema. Survey missions, "
     "images and tiles carry the drone data; the detection and tree tables "
     "hold the matching result; inspections, inspection images and coconut "
     "detections feed the inventory snapshots; and the robot tables record "
     "status, transitions, telemetry, events, runs, battery and "
     "configuration. The notation is conventional: a solid underline marks "
     "a primary key, a dotted underline a foreign key, and the colour of a "
     "table names its module. Two pointer relationships keep history "
     "immutable: each tree points at its representative observation and "
     "its current inventory snapshot, and snapshots are unique per "
     "inspection, so a new scan replaces the pointer instead of "
     "overwriting records."),
    ("body",
     "Reading the schema along its chains: one survey mission owns many "
     "images and tiles, each tile owns many detections, and matching turns "
     "those detections into the tree table with its write-once codes; the "
     "inspection chain runs from inspection to images to coconut "
     "detections to exactly one inventory snapshot; and the robot chain "
     "hangs the state transitions, telemetry, events and runs off the "
     "single robot row, with battery and configuration as one-to-one "
     "satellites. The unique constraint on snapshots per inspection and "
     "the restricted deletes on trees and inspections are what make the "
     "history tables safe to keep forever."),
    ("fig", "4.8", "diagrams/4.8-er-diagram.png",
     "Entity relationship diagram of the core schema"),

    ("h1", "4.9  Class Diagram"),
    ("body",
     "{FIG:4.9} shows the harvest robot core as implemented, in standard "
     "notation: a document mark is an attribute, a gear mark is a method, "
     "filled diamonds are composition and plain arrows are dependency. The "
     "stateless navigator produces the plan as a set of dataclasses; the "
     "simulation clock and scheduler own the wall clock; the pure engine "
     "advances the simulation context one step at a time and validates "
     "every status change through the state machine, whose only exception "
     "type is the IllegalTransition error; and the event bus fans telemetry "
     "out to the append-only service and the observe-only WebSocket "
     "gateway."),
    ("body",
     "Reading the classes against the sequence diagram: the scheduler's "
     "start, pause, resume and stop are the endpoints the HTTP layer "
     "calls; each call mutates the simulation context, whose fields mirror "
     "the robot row in the ER diagram; the engine's step consumes the "
     "context and returns events, and the state machine converts every "
     "requested transition into either a persisted change or an "
     "IllegalTransition error. The navigator sits apart from all of it "
     "because planning is pure: given a start, a dock and a list of trees "
     "it returns the same plan every time, which is what makes the "
     "determinism results of Chapter 5 possible."),
    ("fig", "4.9", "diagrams/4.9-class-diagram.png",
     "Class diagram of the harvest robot core"),
    ("body",
     "The separation in this diagram is the reason the platform is "
     "hardware-ready: the engine is a pure step function with no clock or "
     "database access, so a physical robot replaces exactly one class "
     "behind the HTTP command set and the WebSocket frame."),
]
