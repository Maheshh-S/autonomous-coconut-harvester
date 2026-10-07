"""Read-only health probe (deployment support).

``GET /health`` reports whether the backend's two hard runtime dependencies are
satisfied: PostgreSQL reachability (``SELECT 1`` with a short statement timeout)
and the YOLO weight singletons (presence flags only — never reloaded, no
inference). It introduces no business logic and mutates nothing; platform
health checks (Render ``healthCheckPath``) and CD gates poll it.

Shape: ``{"status": "ok"|"degraded", "database": "ok"|"unreachable: ...",
"models": {"tree": bool, "coconut": bool}}``. HTTP 200 when the app serves
(even with models missing); HTTP 503 only when the database is unreachable.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database.db import SessionLocal

router = APIRouter()


def _models_loaded() -> dict:
    """Presence flags for the import-time YOLO singletons (lazy imports)."""
    flags = {"tree": False, "coconut": False}
    try:
        from api.tree_api import tree_model

        flags["tree"] = tree_model is not None
    except Exception:
        flags["tree"] = False
    try:
        from api.coconut_api import coconut_model

        flags["coconut"] = coconut_model is not None
    except Exception:
        flags["coconut"] = False
    return flags


@router.get("/health")
def health():
    db_status = "ok"
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1")).scalar()
        finally:
            db.close()
    except SQLAlchemyError as exc:
        db_status = f"unreachable: {type(exc).__name__}"

    body = {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "models": _models_loaded(),
    }
    return JSONResponse(
        status_code=200 if db_status == "ok" else 503,
        content=body,
    )
