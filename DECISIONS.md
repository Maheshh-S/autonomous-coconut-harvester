# DECISIONS.md

*Append‑only record of high‑level architectural choices.*

- **Backend framework**: FastAPI was selected for its async support and easy integration with Python ML code.
- **Frontend framework**: Next.js (React) provides server‑side rendering, routing, and a familiar UI stack.
- **Data storage**: PostgreSQL (Neon) via SQLAlchemy, accessed through `DATABASE_URL` in `.env`; there is no migration framework, so schema is evolved manually and ensured at startup by `backend/database/init_db.py` (idempotent `create_all` + `ALTER … IF NOT EXISTS`).
- **ML inference**: YOLO models stored under `models/` are used for tree and coconut detection.
- **Simulation**: A software robot simulator (`simulation/robot_simulator.py`) is used instead of physical hardware for early development and testing.
- **API design**: Separate routers for each domain (tree, coconut, robot, planning) to keep responsibilities isolated.
- **Infrastructure**: The `.engineering/` directory houses specs, templates, and workflows that guide AI agents and contributors.

*Add new decisions here as they are made; never delete existing entries.*
