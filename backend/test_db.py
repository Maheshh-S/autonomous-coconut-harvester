"""Minimal database connectivity + schema check.

Run from the backend directory:  python test_db.py
Verifies that the configured DATABASE_URL is reachable and that the tables and
columns the application depends on exist.
"""
from sqlalchemy import inspect

from database.db import engine
from database.init_db import init_db


def test_database_connection_and_schema():
    # Ensure the schema (idempotent) before inspecting it.
    init_db()

    with engine.connect() as conn:
        assert conn is not None, "Failed to open a database connection"

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    for table in ("trees", "detections", "tasks"):
        assert table in tables, f"Missing expected table: {table}"

    detection_cols = {c["name"] for c in inspector.get_columns("detections")}
    assert "harvest_type" in detection_cols, "detections.harvest_type is missing"

    task_cols = {c["name"] for c in inspector.get_columns("tasks")}
    for col in ("priority", "created_at", "claimed_at"):
        assert col in task_cols, f"tasks.{col} is missing"


if __name__ == "__main__":
    test_database_connection_and_schema()
    print("Database connection and schema OK")
