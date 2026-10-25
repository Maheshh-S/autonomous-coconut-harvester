# -*- coding: utf-8 -*-
"""Front matter: Abstract, Contents, List of Figures, List of Tables, Abbreviation.

Prose follows the humanizer skill (.claude/skills/humanizer/SKILL.md):
no em/en dashes, no staged contrasts or closers, no stock AI vocabulary,
plain verbs, facts only from repo docs and the IRJMETS paper.
"""

ABSTRACT = (
    "Manual coconut harvesting depends on skilled climbers working at heights of "
    "15 to 25 m, and growers have no reliable record of which trees are ready for "
    "harvest. This report presents an AI-powered autonomous coconut harvesting "
    "system, a full-stack digital twin platform that converts drone survey imagery "
    "into a structured, queryable model of a plantation and drives a harvesting "
    "robot through the complete workflow. A YOLOv8 tree detector processes survey "
    "tiles laid out by a configurable flight planner. GPS proximity matching "
    "assigns each detection a permanent tree identity. A second YOLOv8 model "
    "classifies close-up coconuts as mature, potential or premature and records "
    "immutable inventory snapshots. A nearest neighbour planner composes ordered "
    "harvest missions, and a time-driven robot simulation with a frozen state "
    "machine, battery model and WebSocket telemetry executes each mission to "
    "completion. The simulated components mirror the command and telemetry "
    "contracts of real hardware, so physical devices can replace them without "
    "application changes. The system was verified end to end: identical execution "
    "traces in 100 of 100 randomised missions, no illegal state transitions, and "
    "no duplicate trees under re-survey position errors up to about 1 m."
)

CONTENTS_LINES = [
    "Title Page\ti",
    "Certificate\tii",
    "Acknowledgement\tiii",
    "Abstract\tiv",
    "Contents\tv",
    "List of Figures\tvi",
    "List of Tables\tvii",
    "Abbreviation\tviii",
    "Chapter 1\tIntroduction\t",
    "1.1 Problem Statement\t",
    "1.2 Aim & Objective\t",
    "1.3 Methodology\t",
    "1.4 Scope of the project\t",
    "1.5 Limitations\t",
    "1.6 Organization of the report\t",
    "Chapter 2\tLiterature survey\t",
    "2.1 Introduction\t",
    "2.2 Literature review\t",
    "2.3 Outcome of the literature review\t",
    "2.4 Summary\t",
    "Chapter 3\tMethodology\t",
    "3.1 Software Requirements\t",
    "3.2 Hardware Requirements\t",
    "Chapter 4\tImplementation and Flow chart\t",
    "4.1 Modules\t",
    "4.2 System Architecture\t",
    "4.3 Flow Diagram\t",
    "4.4 Data Flow Diagram\t",
    "4.5 Use Case Diagram\t",
    "4.6 Activity Diagram\t",
    "4.7 Sequence Diagram\t",
    "4.8 ER Diagram\t",
    "4.9 Class Diagram\t",
    "Chapter 5\tResults and Discussions\t",
    "5.1 Survey Image Ingestion & Tiling\t",
    "5.2 YOLO Tree & Coconut Detection\t",
    "5.3 Permanent Tree Generation & Matching\t",
    "5.4 Digital Twin Farm Viewer\t",
    "5.5 Ripeness Inspection & Inventory Snapshots\t",
    "5.6 Harvest Mission Planning\t",
    "5.7 Robot Mission Execution & Simulation\t",
    "5.8 Mission History & Analytics\t",
    "5.9 Multilingual Farmer Interface\t",
    "5.10 Verification & Performance\t",
    "Chapter 6\tConclusions and Future Scope\t",
    "6.1 Conclusions\t",
    "6.2 Future Scope of Study\t",
    "References\t",
    "Publications\t",
    "Appendix\t",
    "A. API Endpoint List\t",
    "B. Database Schema\t",
    "C. Deployment Summary\t",
    "D. Model Training Configuration\t",
]

ABBREVIATIONS = [
    ("AI", "Artificial Intelligence"),
    ("API", "Application Programming Interface"),
    ("CNN", "Convolutional Neural Network"),
    ("CPU", "Central Processing Unit"),
    ("DFD", "Data Flow Diagram"),
    ("ER", "Entity Relationship"),
    ("FSM", "Finite State Machine"),
    ("GPS", "Global Positioning System"),
    ("GPU", "Graphics Processing Unit"),
    ("HLD", "High Level Design"),
    ("HTTP", "HyperText Transfer Protocol"),
    ("IoT", "Internet of Things"),
    ("IRJMETS", "International Research Journal of Modernization in Engineering, Technology and Science"),
    ("IST", "Indian Standard Time"),
    ("JSON", "JavaScript Object Notation"),
    ("mAP", "mean Average Precision"),
    ("ML", "Machine Learning"),
    ("NN", "Nearest Neighbour"),
    ("ORM", "Object Relational Mapping"),
    ("REST", "Representational State Transfer"),
    ("RGB", "Red Green Blue"),
    ("SLAM", "Simultaneous Localisation and Mapping"),
    ("SQL", "Structured Query Language"),
    ("TSP", "Travelling Salesman Problem"),
    ("UAV", "Unmanned Aerial Vehicle"),
    ("UI", "User Interface"),
    ("UTC", "Coordinated Universal Time"),
    ("VTU", "Visvesvaraya Technological University"),
    ("WS", "WebSocket"),
    ("YOLO", "You Only Look Once"),
]

BLOCKS = [
    ("front_heading", "ABSTRACT"),
    ("body", ABSTRACT),
    ("pagebreak",),
    ("front_heading", "CONTENTS"),
    ("toc_lines", CONTENTS_LINES),
    ("pagebreak",),
    ("front_heading", "LIST OF FIGURES"),
    ("lof",),
    ("pagebreak",),
    ("front_heading", "LIST OF TABLES"),
    ("lot",),
    ("pagebreak",),
    ("front_heading", "Abbreviation"),
    ("abbr_rows", ABBREVIATIONS),
]
