# Frontend — Autonomous Coconut Harvester

React/Next.js UI for the Autonomous Coconut Harvester. It is **presentation
only**: every business rule (detection, planning, task de‑duplication, robot
flow) lives in the FastAPI backend. This app renders data and sends requests.

## Stack
- **Next.js 16** (App Router) + **React 19** + **Tailwind 4**
- **Playwright** for end‑to‑end tests

## Scripts
```bash
npm install      # install dependencies
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm run lint     # ESLint (0 errors expected; dynamic blob <img> previews may warn)
npm run test:e2e # Playwright end-to-end tests
```

## Talking to the backend
All API calls go through the thin wrapper `lib/api/detection.ts`, which targets
the backend at `http://localhost:8000` (see `API_BASE_URL` in that file). The
backend must be running for the pages to load live data.

## Pages (`app/`)
| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Home — project entrance (pipeline overview, link to Dashboard) |
| `/dashboard` | `app/dashboard/page.tsx` | Operational overview (counts, farm summary, charts) |
| `/survey` | `app/survey/page.tsx` | Survey Mission image ingestion + inspection/inventory/harvest |
| `/map` | `app/map/page.tsx` | Digital Twin farm viewer (survey mission tiles) |
| `/robot` | `app/robot/page.tsx` | Robot simulation + harvest-mission execution |
| `/robot/history` | `app/robot/history/page.tsx` | Mission History & Analytics |
| `/trees` | `app/trees/page.tsx` | Tree dashboard (summary from `GET /trees/summary`) |
| `/trees/[treeId]` | `app/trees/[treeId]/page.tsx` | Single‑tree detail + coconut upload |

## Components (`components/`)
- `CoconutUploader.tsx` – upload a coconut photo, shows detected coconuts.
- `FarmMosaic` / `OverlayLayer` / `FarmViewer` / `TreeDetailsDrawer` – Digital Twin viewer.
- `DashboardFarmCard` – dashboard farm summary card.
- `robot/` – `RobotLayer`, `RobotMarker`, `RobotPathLayer`, `RobotStatusCard`, `SimulationControls`.

## Notes
- Upload previews use native `<img>` with `blob:` URLs (dynamic, not static
  assets), so `next/image` is intentionally not used there.
- Navigation is rendered inline in `app/layout.tsx` (no separate navbar
  component).
