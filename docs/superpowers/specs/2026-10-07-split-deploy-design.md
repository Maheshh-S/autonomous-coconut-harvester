# Split Deployment Design — Veraxis (Vercel + Render + Neon)

- Date: 2026-10-07. Status: approved by owner. Implementation: phased, each phase verified before the next; no commits without explicit approval.
- Goal: a live namesake deployment (personal use; graded demo stays on localhost, which must remain byte-identical in behavior).

## 1. Architecture

```
Browser ──https──▶ Vercel (Next.js 16, static/client) ──https/wss──▶ Render (FastAPI Docker) ──▶ Neon Postgres
```

- Frontend on Vercel (Root Directory `frontend/`), backend as one Render Docker web service, database stays on existing Neon. No model server (weights total ~12.5 MB, ride in-image). No Postgres-in-scope. No auth (still frozen out).
- Why split (not one VPS): zero server babysitting, Vercel speaks Next.js natively, resume-polish URL. Why not serverless backend: import-time torch+YOLO, stateful scheduler thread, long-lived WS `/ws/robot` are hostile to it.

## 2. Backend container

- `Dockerfile.backend` (repo root): `python:3.14-slim`, `pip install -r requirements.txt` (torch CPU via ultralytics, unpinned — drift risk noted), `COPY backend/`, `COPY models/tree_model/tree_detector.pt models/coconut_model/coconut_detector.pt` (build prerequisite: files present locally, gitignored so copied out-of-band — never committed). `CMD uvicorn main:app --host 0.0.0.0 --port $PORT`, workdir `/app/backend` (existing `sys.path` bootstrap supports it).
- Persistent disk: none on free tier — `uploads/` is ephemeral. Accepted: demo self-heals via reseed (§5). DB rows persist on Neon.
- Env: `DATABASE_URL` (Neon pooled; matches PgBouncer-tuned engine in `db.py`), `CORS_ORIGINS=https://<vercel-app>`. Platform health check → `GET /health`.
- Cold-start expectation: torch import + dual YOLO + ~30-statement `init_db()` ≈ 1–2 min first boot; Render free sleeps after 15 min idle — first visitor waits, WS drops on sleep. Expected, documented, not fought.

## 3. Frontend on Vercel

- Project Root Directory `frontend/`; env `NEXT_PUBLIC_API_BASE_URL=https://<render-host>` (baked at `next build`; backend URL change = frontend rebuild — accepted).
- No rewrites/proxy: all 10 pages are `"use client"`, browser calls backend directly; `wss://` derives from `https` base automatically. Only `layout.tsx` is server-side and touches just the locale cookie (frontend-origin, never sent to FastAPI).
- `npm run i18n:check` runs in build. Zero code changes expected.

## 4. Health + logging

- New `backend/api/health_api.py`: `GET /health` → `{status, database: ok/fail via SELECT 1 (short timeout), models: {tree, coconut} flags from loaded singletons}`; non-200 only on DB failure. One-router-per-domain convention; mount in `main.py`.
- Logging: uvicorn access logs + one middleware line per request (method/path/status/ms). No JSON framework, no shipping.

## 5. Self-healing demo (bake + reseed)

- Bundle `demo_images/farm_view_demo-images/` (8 PNGs) into the image (read-only layer survives sleep). New `POST /admin/seed-demo`: copies baked images into `uploads/`, runs the standard survey pipeline (planner + YOLO + matching — same code path, deterministic grid/GPS dedup so the same permanent trees return).
- After a Render sleep: one call, ~1 min, demo mission back. New user uploads stay ephemeral (re-uploadable). Local dev untouched unless the endpoint is called.

## 6. CI (`.github/workflows/ci.yml`, static gates only)

- Backend: `py_compile` + import wiring check. Frontend: `tsc --noEmit`, `eslint`, `next build` (dummy API URL), `i18n:check`. Docker: build both images on main (no push on PR).
- Playwright stays an attended local gate (needs weights + seeded missions + browsers; `verify_*.js` throw on empty DB).

## 7. Sequence + verification gates

1. `/health` → `curl localhost:8000/health` green against local stack.
2. Dockerfiles → local `docker compose` smoke: boot vs Neon, one survey upload, twin renders.
3. Render deploy → live `/health` green.
4. Vercel deploy → click survey/twin/robot/history, 0 console errors.
5. CI green on push. 6. Logging + doc reconciliation (`CURRENT.md` V5 reality, resume infra claims true, vault notes).
- Local-regression check runs before every phase gate: `tsc`, `next build`, existing verify harnesses — localhost behavior identical.

## 8. Readiness (owner provides)

Render free slot (Docker), Vercel project slot + GitHub access, `.env` values at hand (never shared), `models/*.pt` in build context, HEAD pushed. Reseed approach: bake + reseed (chosen over object storage / DB blobs).
