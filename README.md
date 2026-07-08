# Autonomous Coconut Harvesting

## 1. CURRENT IMPLEMENTED FLOW

- The upload flow in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/DroneUploader.tsx sends an image to /detect/trees in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py.
- The backend response from /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py contains detected box coordinates, confidence values, and an annotated image, and the frontend overlays those boxes in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/DroneUploader.tsx.
- When a detected box is selected, /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/DroneUploader.tsx builds GPS values from the box position and posts them to /drone/tree_detected in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py.
- That backend route in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py creates or reuses a tree record and returns a tree_id, which the frontend uses to route to /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/trees/[treeId]/page.tsx.
- The tree detail page in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/trees/[treeId]/page.tsx loads summary data from /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/lib/api/detection.ts and renders the tree detail view; it also mounts /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/CoconutUploader.tsx for coconut-related input.
- The robot page in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/robot/page.tsx only calls /robot/next_task and /robot/complete_task in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/robot_api.py; it does not navigate to a tree detail page.

## 2. INTENDED FULL SYSTEM FLOW

- The repository also contains supporting modules such as /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/perception/detect_coconut.py, /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/perception/drone_scan.py, /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/mapping/coverage_path.py, /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/detection_api.py, /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/harvest_planner.py, /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/planner_api.py, and /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/simulation/robot_simulator.py.
- These files indicate a larger end-to-end concept: drone image intake, tree detection, tree registration, coconut detection, task generation, and robot execution.
- The current snapshot does not show that larger pipeline fully wired in the UI and backend flow; the visible implementation is the narrower path above.

## 3. Current repo limitations / mismatches

- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/Navbar.tsx is empty in this snapshot; navigation is currently handled in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/layout.tsx.
- The current snapshot shows the /drone/tree_detected route in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py, while the tree-detection functionality is implemented in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py.
- The earlier shorthand references to /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/droneapi.py and /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/treeapi.py do not match the current filenames on disk, so they should not be treated as separate current modules.
- The robot flow in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/robot/page.tsx is limited to fetching and completing tasks; it does not navigate to the tree detail page in this snapshot.
- The tree-detection endpoint in /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py returns boxes and annotations, but the actual tree persistence step is handled separately by /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py.

## 4. Corrected Mermaid diagrams

### Implemented flow

```mermaid
flowchart LR
    A[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/DroneUploader.tsx] --> B[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py]
    B --> C[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/DroneUploader.tsx]
    C --> D[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py]
    D --> E[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/trees/[treeId]/page.tsx]
    E --> F[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/CoconutUploader.tsx]
```

### Intended broader flow

```mermaid
flowchart LR
    A[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/perception/drone_scan.py] --> B[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py]
    B --> C[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py]
    C --> D[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/detection_api.py]
    D --> E[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/harvest_planner.py]
    E --> F[/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/simulation/robot_simulator.py]
```

## 5. Viva Q&A with full file paths only

- Q: Which file handles tree detection from uploaded images? A: /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py
- Q: Which file contains the /drone/tree_detected route? A: /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py
- Q: Which file renders the tree detail page? A: /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/trees/[treeId]/page.tsx
- Q: Which file contains the robot task fetch and complete flow? A: /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/robot_api.py
- Q: Which file currently holds the app navigation links? A: /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/layout.tsx
- Q: Which file is currently empty for navbar content? A: /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/Navbar.tsx

## 6. PPT bullets with full file paths only, max 6 lines per slide

### Slide 1 - Current implemented flow

- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/DroneUploader.tsx
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/tree_api.py
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/drone_api.py
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/trees/[treeId]/page.tsx

### Slide 2 - Current robot and navigation state

- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/robot/page.tsx
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/robot_api.py
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/app/layout.tsx
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/frontend/components/Navbar.tsx

### Slide 3 - Repo limitations and intended direction

- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/perception/detect_coconut.py
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/perception/drone_scan.py
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/backend/api/harvest_planner.py
- /Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/simulation/robot_simulator.py