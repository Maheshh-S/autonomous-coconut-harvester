# AGENTS.md

## Mission
Create an autonomous system that detects coconut trees, plans harvesting tasks, and coordinates a robot to collect the fruit.

## Read Order
1. AGENTS.md
2. CURRENT.md (project status)
3. Relevant specification in `.engineering/specs/` (planned — not yet created)
4. Relevant architecture/ADR document in `knowledge/` (planned — not yet created)
5. Source code (`frontend/`, `backend/`)

## Repository Layout
- `.engineering/` – stores governance, prompts, specs, templates, workflows, and review artefacts (specs not yet populated).
- `knowledge/` – design decisions, ADRs, and external references (to be created as decisions are made).
- `development/` – experimental scripts, notebooks, and tooling not shipped with the product.
- `frontend/` – React/Next.js UI components and pages.
- `backend/` – FastAPI services, database models, and perception modules.

## Engineering Workflow
**Understand → Plan → Implement → Verify → Update documentation → Commit**

## Tool Usage
**Context7**
- Use only for official documentation of external libraries and frameworks.

**codebase-memory**
- Use for repo‑wide understanding, architecture queries, dependency graphs, and navigating code.

**Playwright**
- Use after any UI change to exercise the frontend and confirm expected behavior.

## Golden Rules
- The repository is the single source of truth.
- Reuse existing code before creating new modules.
- Search the codebase first; never implement something you cannot locate.
- Do not duplicate business logic anywhere.
- Do not duplicate API definitions; keep them single‑source.
- Frontend should handle only presentation; all business rules live in the backend.
- When architecture changes, update the corresponding ADR in `knowledge/`.
- Ask for clarification if requirements are ambiguous or conflict.
- Prefer modifying existing code over building new systems.

*End of document.*
