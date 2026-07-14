# Frontend — Autonomous Coconut Harvester

React/Next.js UI for the Autonomous Coconut Harvester. It is **presentation
only**: every business rule (detection, planning, task de‑duplication, robot
flow) lives in the FastAPI backend. This app renders data and sends requests.

## Stack
- **Next.js 16** (App Router) + **React 19** + **Tailwind 4**
- **Leaflet** (via `react-leaflet` + `leaflet`) for the plantation map
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
| `/` | `app/page.tsx` | Upload a drone/tree image and run detection |
| `/trees` | `app/trees/page.tsx` | Tree dashboard (summary from `GET /trees/summary`) |
| `/trees/[treeId]` | `app/trees/[treeId]/page.tsx` | Single‑tree detail + coconut upload |
| `/map` | `app/map/page.tsx` | Plantation map (`GET /plantation/map`) |
| `/robot` | `app/robot/page.tsx` | Robot task polling/completion (`/robot/next_task`, `/robot/complete_task`) |

## Components (`components/`)
- `DroneUploader.tsx` – upload + tree detection, draws detected boxes.
- `CoconutUploader.tsx` – upload a coconut photo, shows detected coconuts.
- `MapView.tsx` / `MapWrapper.tsx` – Leaflet map (client‑only via `dynamic`).
- `leafletFix.ts` – fixes default Leaflet marker icon paths under bundlers.

## Notes
- Upload previews use native `<img>` with `blob:` URLs (dynamic, not static
  assets), so `next/image` is intentionally not used there.
- Navigation is rendered inline in `app/layout.tsx` (no separate navbar
  component).
