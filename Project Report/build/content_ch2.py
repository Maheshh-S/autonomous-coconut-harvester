# -*- coding: utf-8 -*-
"""Chapter 2 LITERATURE SURVEY (humanizer-compliant prose, no figures per D19).

Table order follows the ranked selection in ../AllFindsPaper.md (2026-10-25):
base papers locked at [1]-[2], then best-verified papers by relevance.
Reference numbering plan for Part 6: table entries [1]..[12]; the IRJMETS
paper's 10 technical references follow as [13]..[22] cited from Chapter 3.
"""

LIT_ROWS = [
    ("1",
     "Samfford S. Cabaluna, Maria Fe P. Bahinting, Leah A. Alindayo (2024)",
     "Computer-Vision-Based Detection and Monitoring System for Mature "
     "Coconut Fruits with a Web Dashboard Visualization Platform; IJACSA, "
     "Vol. 15, Issue 11",
     "YOLOv8-based computer-vision system monitors and detects mature "
     "coconut fruits and presents the results on a web dashboard.",
     "Reported high detection accuracy, but validated in laboratory "
     "conditions only."),
    ("2",
     "Dr. Amitha I C, Fathima Fiza C P, Aswin Ratheesh D K, Rena Haris V P, "
     "K Muhsin (2025)",
     "PickPerfect: Coconut Maturity Detector and Harvester; International "
     "Journal of Novel Research and Development (IJNRD2504302)",
     "CNN classifier grades coconuts by maturity from colour, texture and "
     "size, integrated with a mechanical harvester.",
     "Selects only mature coconuts for harvesting, but needs controlled "
     "image capture and manual support."),
    ("3",
     "Snehit T. Shiju, Sneha George, T. Jemima Jebaseeli (2025)",
     "Automated Coconut Maturity Detection and Timeline Prediction using "
     "YOLOv8-based Computer Vision; Grenze International Journal of "
     "Engineering and Technology, Vol. 16, Issue 36",
     "YOLOv8n trained on a three-class maturity dataset (Mature, Potential, "
     "Premature) with a harvest-timeline prediction stage; evaluated on a "
     "held-out test set of 155 images and 1,952 instances.",
     "76.1 percent mAP@0.5 overall; the Mature class is hardest because it "
     "overlaps visually with Potential under canopy lighting."),
    ("4",
     "A. A. Luthfie, Alamsyah (2025)",
     "Identifying Coconut Maturity Levels Using CNN and YOLOv8 Deep "
     "Learning Algorithms; Journal of Information System Exploration and "
     "Research, Vol. 3, No. 2",
     "Compares CNN and YOLOv8 pipelines for coconut maturity "
     "identification.",
     "Reports 90.5 percent mAP with 99.3 percent precision and 94.2 percent "
     "recall for the YOLOv8 model."),
    ("5",
     "Yuxing Fu, Hongcheng Zheng, Zongbin Wang, Jinyang Huang, Wei Fu (2025)",
     "Detection of multi-class coconut clusters for robotic picking under "
     "occlusion conditions; IJABE, Vol. 18, No. 1, pp. 267-278",
     "Multi-class coconut-cluster detection designed for a robotic picking "
     "workflow under occlusion between bunches.",
     "Improves cluster detection for robotic picking scenarios, but "
     "real-time onboard execution remains a challenge."),
    ("6",
     "Rajesh Kannan Megalingam et al. (2021)",
     "Amaran: An Unmanned Robotic Coconut Tree Climber and Harvester; "
     "IEEE/ASME Transactions on Mechatronics, Vol. 26, pp. 288-299",
     "Ring-shaped unmanned climber with a robotic arm and cutter, wireless "
     "and smartphone control, tested on trees up to 15.2 m with trunk "
     "circumference 0.66 to 0.92 m and inclination up to 30 degrees.",
     "Demonstrates combined climbing and harvesting on a real plantation, "
     "but the harvest decision is made by a human operator."),
    ("7",
     "Hongcheng Zheng, Yuxing Fu, Zongbin Wang, Xinjie Yin, Yuyang Xia, "
     "Wei Fu (2024)",
     "Design and experiment of coconut picking robot with climbing; Smart "
     "Agricultural Technology, Vol. 9 (Elsevier)",
     "STM32-based picking robot that integrates climbing and picking "
     "functions for tall coconut trees.",
     "Experiments show integrated climbing and picking, but the robot lacks "
     "autonomous AI vision support."),
    ("8",
     "Rajesh Kannan Megalingam, Akhil Thirutheri, Sakthiprasad "
     "Kuttankulangara Manoharan (2024)",
     "Robotic Tree Climbers and Strategies: A Survey; International Journal "
     "of Intelligent Robotics and Applications (Springer)",
     "Surveys tree-climbing robot designs, climbing strategies, stability, "
     "payload and autonomy.",
     "Maps the design space and shows that fully autonomous climbing with "
     "harvesting remains an open problem."),
    ("9",
     "Rajesh Kannan Megalingam, K. M. Sakthiprasad, M. M. Sreekanth, Gedela "
     "Vamsy Vivek (2017)",
     "A Survey on Robotic Coconut Tree Climbers: Existing Methods and "
     "Techniques; IOP Conference Series: Materials Science and Engineering, "
     "Vol. 225, 012201",
     "Reviews existing coconut-tree climbing methods, mechanical designs "
     "and their limitations.",
     "Establishes the case for robotic automation of the climb, which "
     "earlier manual and semi-manual devices only partly removed."),
    ("10",
     "Mukul Kumar, Gopinath Bej, H. S. Pandey (2023)",
     "Status and Scope of Automated Coconut Harvester in India: A Review; "
     "Journal of Experimental Agriculture International, Vol. 45, No. 5, "
     "pp. 1-15",
     "Reviews existing harvesting methods and automated harvester designs "
     "for the Indian coconut economy.",
     "Identifies labour shortage, cost and reliability as the barriers to "
     "deployment and sets the scope for smart harvesting systems."),
    ("11",
     "A. P. Dubey, Rathod et al. (2016)",
     "Autonomous Control and Implementation of Coconut Tree Climbing and "
     "Harvesting Robot; Procedia Computer Science, Vol. 85, pp. 755-766",
     "Low-cost climbing and harvesting robot automated with an Arduino-Uno "
     "microcontroller and motor-driver circuitry.",
     "Reduced manual climbing effort but required manual supervision."),
    ("12",
     "Sengun, Aksoy, Sertel, Fransson (2025)",
     "Comparative Analysis of YOLOv8 and YOLOv11 on Tree Detection Using "
     "UAV RGB and Laser Scanning Data; ISPRS Annals, Vol. X-2/W2 "
     "(UAV-g 2025)",
     "Benchmarks YOLOv8 against YOLOv11 for UAV-based tree detection on "
     "RGB and laser-scanning data at multiple scales.",
     "YOLOv8 outperformed YOLOv11 at every model scale at 640 px; higher "
     "resolution lifts recall and strict-IoU accuracy."),
]

BLOCKS = [
    ("chapter", "2", "LITERATURE SURVEY"),

    ("h1", "2.1  Introduction"),
    ("body",
     "This chapter reviews the published work the project stands on. The "
     "survey covers three areas: computer-vision detection of coconut trees "
     "and ripeness, mechanical and robotic coconut harvesting, and the "
     "detector benchmarking that guides model choice. Every entry was "
     "verified against the publisher's record, and the entries are ordered "
     "by relevance to this project, with the two base papers first."),
    ("body",
     "Two published papers were studied in depth as base papers because they "
     "come closest to this work: a YOLOv8-based monitoring system that "
     "presents coconut maturity results on a web dashboard, and a "
     "deep-learning maturity detector paired with a mechanical harvester. "
     "They are analysed in section 2.2 after the survey table."),

    ("h1", "2.2  Literature review"),
    ("body",
     "Table 2.1 summarises the twelve studies [1] to [12] reviewed for this "
     "project in the department's survey format: authors and year, title and "
     "journal, the methodology implemented, and the reported outcome with "
     "its limitation. The two base papers follow the table."),
    ("table", "lit", "Literature survey of twelve studies",
     ["Sl. No", "Author, Year", "Title, Journal", "Methodology / Technique",
      "Outcome (Advantages / Limitations)"],
     [list(r) for r in LIT_ROWS],
     [0.45, 1.05, 1.7, 1.5, 1.35]),

    ("h2", "2.2.1  Base Paper I: Cabaluna et al. (2024) [1]"),
    ("body",
     "This study builds a YOLOv8 detector that monitors and detects mature "
     "coconut fruits and presents the results on a web dashboard for "
     "growers. It is the closest published system to the monitoring layer "
     "of this project, and it is the reason the dashboard idea appears "
     "here with detection rather than as a separate product."),
    ("bullets", [
        ("Key points: ",
         "YOLOv8-based detection and monitoring of mature coconut fruits; "
         "dashboard visualisation for decision support; high reported "
         "detection accuracy."),
        ("Limitations: ",
         "tested only in laboratory conditions; no field deployment; "
         "detection is not connected to a permanent plantation record or to "
         "harvest execution."),
        ("Gaps: ",
         "larger on-tree datasets; drone-based or distant-angle detection; "
         "real-time deployment; integration with robotic harvesters or "
         "mobile applications."),
    ]),

    ("h2", "2.2.2  Base Paper II: PickPerfect (2025) [2]"),
    ("body",
     "PickPerfect proposes a CNN-based vision model that grades coconuts by "
     "maturity from close-range images and pairs the classifier with a "
     "mechanical harvester. It is the closest published combination of "
     "perception and harvesting hardware."),
    ("bullets", [
        ("Key points: ",
         "classifies coconut maturity stages by analysing colour, texture "
         "and size; includes a mechanical harvesting system with adjustable "
         "arms; improves efficiency by selecting only mature coconuts."),
        ("Limitations: ",
         "requires controlled conditions for accurate image capture; the "
         "mechanical system needs manual support and is not fully automated."),
        ("Gaps: ",
         "needs real-time field deployment and testing; requires integration "
         "with mobile apps and IoT systems; further improvement needed for "
         "fully automated harvesting."),
    ]),

    ("h1", "2.3  Outcome of the literature review"),
    ("body",
     "The survey shows progress along three lines. Vision systems for "
     "coconut ripeness now report strong results, from the dashboard-"
     "delivered YOLOv8 detector [1] and the maturity graders [2], [3], [4] "
     "to occlusion-aware cluster detection aimed at robotic picking [5]. "
     "Climbing and harvesting mechanisms have advanced from the Arduino-"
     "based climber [11] to the field-tested Amaran climber-harvester [6] "
     "and STM32-controlled picking robots [7], while dedicated surveys of "
     "tree-climbing robots [8], [9] and a review of the Indian context [10] "
     "record why deployment still lags. On the detector side, a controlled "
     "benchmark on UAV imagery supports the choice of YOLOv8 for tree "
     "detection over newer alternatives [12]."),
    ("body",
     "The same survey exposes the gap this project targets. Every detection "
     "study stops at classification: none assigns a detection a permanent "
     "identity, maintains a per-tree inventory across surveys, or turns the "
     "counts into an executable harvest plan. The harvesting robots assume "
     "that decision is made elsewhere and are demonstrated as mechanical "
     "prototypes without a software platform around them. The base papers "
     "make the pattern concrete: PickPerfect needs controlled capture "
     "conditions and manual support [2], and the Cabaluna system is "
     "validated in laboratory conditions without field deployment [1]."),
    ("body",
     "The proposed system connects the strands. It keeps detection output as "
     "permanent, GPS-tagged tree records, turns close-up ripeness scans into "
     "immutable inventory snapshots, composes ordered harvest missions from "
     "that inventory, and executes them on a simulated robot whose command "
     "and telemetry contracts mirror real hardware. A dashboard, run "
     "analytics and a seven-language interface wrap the complete pipeline."),

    ("h1", "2.4  Summary"),
    ("body",
     "Twelve verified studies and two base papers were reviewed. Vision "
     "models already grade coconuts reliably on close-range images, and "
     "climbing and cutting mechanisms exist, but the two lines have not "
     "been joined: no published system carries detections into a persistent "
     "per-tree inventory and then into planned, supervised robot "
     "execution. The rest of this report presents that connecting layer "
     "and the experiments that verify it."),
]
