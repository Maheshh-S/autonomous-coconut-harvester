# Split Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Veraxis live on Vercel (frontend) + Render (backend Docker) + Neon (DB) without changing localhost behavior.

**Architecture:** Additive-only changes: one health router, two Dockerfiles, one reseed endpoint, one CI workflow, one middleware. No existing route, schema, contract, or UI flow changes.

**Tech Stack:** FastAPI + uvicorn, Next.js 16, Docker, GitHub Actions, Render (Docker runtime, free), Vercel (Hobby), Neon Postgres.

## Global Constraints

- Localhost behavior identical after every task (verify with `verify_v26.js` / `tsc` / `next build` where touched).
- Never commit without explicit owner approval (repo rule overrides the skill's per-task commit steps — stage, report, wait).
- `.env` contents are never printed, pasted, or committed; `models/*.pt` never committed.
- No measured-accuracy claims anywhere, ever.

---

### Task 1: Phase 0 doc reconciliation

**Files:**
- Modify: `CURRENT.md` (header + V4.0.4/V5.0/V5.1 status lines)
- Modify: `AGENTS.md:57` (legacy-dirs sentence)

**Interfaces:** Consumes: `git log` reality (HEAD `b3dc66e`, V5.1 committed). Produces: truthful status baseline later phases cite.

- [ ] **Step 1: Fix `CURRENT.md` header.** Replace "Committed through V4.0.4 … Only V5.0 not yet committed" with committed-through-V5.1 reality (commits `961be7b` V4.0.4, `34c38aa` V5.0, `1c77165` V5.1, plus this spec `b3dc66e`). Keep the do-not-commit rule for *future* work, not V5.
- [ ] **Step 2: Fix `AGENTS.md:57`.** Change "Folders that no longer exist … have been removed" to "superseded but retained for reference (`mapping/`, `perception/`, root `simulation/`); nothing outside `backend/` is imported" — matching `README.md:202` + `CURRENT.md` V3.8.2/V3.8.5.
- [ ] **Step 3: Verify.** Run: `grep -n "not yet committed" CURRENT.md` Expected: no stale V5 lines. Report diff, wait for commit approval.

### Task 2: `GET /health` router

**Files:**
- Create: `backend/api/health_api.py` (router with `GET /health`: `SELECT 1` via `SessionLocal` with short timeout → `database: ok/fail`; model flags via `try: from api.tree_api import tree_model` / `coconut_model` presence booleans — no reload, no inference)
- Modify: `backend/main.py` (one `include_router` line, grouped with the other router includes)

**Interfaces:** Consumes: `database.db.SessionLocal`, existing loaded model singletons. Produces: `GET /health` → `{"status": "ok"|"degraded", "database": ..., "models": {"tree": bool, "coconut": bool}}`, non-200 only when DB unreachable.

- [ ] **Step 1: Write router.** Follow `dashboard_api.py` read-only pattern (no writes, no state machine touches).
- [ ] **Step 2: Mount + compile.** Run: `venv/bin/python -m py_compile backend/api/health_api.py backend/main.py` Expected: clean.
- [ ] **Step 3: Live-verify against owner's running backend.** Run: `curl -s localhost:8000/health` Expected: `status ok`, both models true. If backend not running, report and wait — do not start servers unattended.
- [ ] **Step 4: Report + wait for commit approval.**

### Task 3: Backend Docker image + local compose smoke

**Files:**
- Create: `Dockerfile.backend` (repo root): `python:3.14-slim`, `COPY requirements.txt`, `pip install`, `COPY backend/`, `COPY models/tree_model/tree_detector.pt models/coconut_model/coconut_detector.pt` (exact subpaths the code resolves), `WORKDIR /app/backend`, `CMD uvicorn main:app --host 0.0.0.0 --port $PORT` (default 8000).
- Create: `.dockerignore` (`venv/`, `__pycache__/`, `uploads/`, `runs/`, `frontend/node_modules`, `.git`, `models/*/train|valid|test` dataset dirs — weights only).
- Create: `compose.yml` (dev-smoke only): backend service (build, `env_file: .env`, volume `./models:/app/models` alternative documented, port 8000, `healthcheck: curl -f /health`).

**Interfaces:** Consumes: Task 2 `/health`. Produces: bootable image; compose smoke proven against Neon.

- [ ] **Step 1: Write the three files.** No app-code changes.
- [ ] **Step 2: Build.** Run: `docker build -f Dockerfile.backend -t veraxis-backend:local .` Expected: success (torch CPU wheel is the slow layer — normal).
- [ ] **Step 3: Boot vs Neon.** Run: `docker compose up --build` (uses owner's `.env`, untouched). Expected: `/health` green within ~2 min cold start.
- [ ] **Step 4: Smoke.** One survey image upload via local frontend pointed at container (env override only), twin renders. Then `docker compose down`. Report + wait for approval. Localhost stack untouched throughout.

### Task 4: Bake + reseed endpoint

**Files:**
- Modify: `Dockerfile.backend` (add `COPY demo_images/farm_view_demo-images/ /app/demo_seed/`).
- Create: endpoint in `backend/api/survey_api.py` or new `backend/api/seed_api.py`: `POST /admin/seed-demo` — copies baked images into `uploads/survey/`, runs existing `create_survey_mission` + tile + detect + match pipeline functions directly (no duplicated logic; calls the same internals the upload route uses).

**Interfaces:** Consumes: existing survey pipeline internals + Task 3 image. Produces: one-call demo restore (~1 min).

- [ ] **Step 1: Implement calling existing pipeline functions only.** No new matching/detection code.
- [ ] **Step 2: Verify locally.** Run against local backend: `curl -X POST localhost:8000/admin/seed-demo`, then `GET /mission/{id}/tiles` returns 8 tiles; twin renders. Expected: same permanent trees deduped (GPS match), new mission id.
- [ ] **Step 3: Report + wait for approval.**

### Task 5: Render + Vercel deploy (owner-assisted)

**Files:** None (dashboard work). Possibly `render.yaml` Blueprint codifying service + `healthCheckPath: /health` + env (secrets via dashboard, never in file).

- [ ] **Step 1 (owner):** Create Render Docker web service from repo, free plan; set `DATABASE_URL` (Neon pooled) + `CORS_ORIGINS=https://<vercel-app>` in dashboard.
- [ ] **Step 2 (agent):** Verify `https://<render-host>/health` green; note cold-start time.
- [ ] **Step 3 (owner):** Create Vercel project, Root Directory `frontend/`, env `NEXT_PUBLIC_API_BASE_URL=https://<render-host>`; deploy.
- [ ] **Step 4 (agent+owner):** Click-through survey/twin/robot/history on live URL, 0 console errors. Document live URLs.

### Task 6: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml` — jobs: backend `py_compile` + `python -c "import main"` (with dummy `DATABASE_URL`; documented honest limit), frontend `tsc --noEmit` + `eslint` + `next build` (dummy API URL) + `npm run i18n:check`, docker builds (no push on PR).

- [ ] **Step 1: Write workflow.** No app-code changes.
- [ ] **Step 2: Verify green on push** (owner pushes or approves). Expected: all jobs pass.

### Task 7: Logging + reconciliation

**Files:**
- Modify: backend (uvicorn log config + one middleware line per request: method/path/status/ms).
- Modify: `CURRENT.md` (phases recorded), `PROJECT_RESUME_BRIEF.md` (infra claims now true), vault `Brief.md`/`State.md` (live URLs, cold-start numbers).

- [ ] **Step 1: Logging, verify one line per request in compose logs.**
- [ ] **Step 2: Docs + vault update. Report + wait for commit approval.**
