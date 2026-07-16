"""Version 3.8.6 — Deterministic runtime-data reset.

Resets the database to a brand-new installation state while preserving the
schema and the required singleton/configuration records (the robot domain).

What this clears (runtime-generated data only):
    detections, tasks, trees, tree_observations,
    survey_missions, survey_images, survey_tiles, survey_tile_detections,
    inspections, inspection_images, coconut_detections, inventory_snapshots,
    harvest_missions, harvest_mission_items,
    robot_state_transitions, robot_telemetry, robot_events, robot_runs

What this PRESERVES (singletons / configuration, re-seeded on startup by
``init_db`` -> ``ensure_robot_domain``):
    robots, dock_stations, robot_batteries, robot_configurations

Identities/sequences for every cleared table are restarted at 1, so the first
new survey is id=1, first detected tree is id=1, and so on — exactly like a
fresh clone.

This script NEVER drops tables, NEVER recreates the schema, and NEVER touches
migrations or the singleton rows. It is safe to run at any time; it only
removes rows.

Run:  python reset_runtime.py
"""

from sqlalchemy import text

from database.db import SessionLocal
from database.init_db import init_db


# Runtime-generated tables cleared by the reset. The four singleton tables
# (robots, dock_stations, robot_batteries, robot_configurations) are deliberately
# NOT in this list — they are re-seeded idempotently on startup.
RUNTIME_TABLES = [
    "detections",
    "tasks",
    "trees",
    "tree_observations",
    "survey_missions",
    "survey_images",
    "survey_tiles",
    "survey_tile_detections",
    "inspections",
    "inspection_images",
    "coconut_detections",
    "inventory_snapshots",
    "harvest_missions",
    "harvest_mission_items",
    "robot_state_transitions",
    "robot_telemetry",
    "robot_events",
    "robot_runs",
]

# Singleton/configuration tables that must survive the reset.
SINGLETON_TABLES = [
    "robots",
    "dock_stations",
    "robot_batteries",
    "robot_configurations",
]


def reset_runtime_data() -> None:
    """Truncate all runtime tables and restart their identity sequences at 1.

    ``RESTART IDENTITY`` resets the PostgreSQL sequences backing the integer
    primary keys so the next inserted row gets id=1. ``CASCADE`` propagates the
    truncate to any child tables (within the runtime set) so FK constraints are
    satisfied without manual ordering. The singleton tables are excluded from the
    list and are therefore never touched.
    """

    db = SessionLocal()
    try:
        # Single statement: clears every runtime table and resets sequences.
        db.execute(
            text(
                "TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE".format(
                    tables=", ".join(RUNTIME_TABLES)
                )
            )
        )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    # Ensure the schema + singleton domain rows exist before resetting.
    init_db()
    reset_runtime_data()
    print("Runtime data reset. Singleton robot domain preserved.")
    print("Cleared tables:")
    for t in RUNTIME_TABLES:
        print("  -", t)
    print("Preserved singleton tables:")
    for t in SINGLETON_TABLES:
        print("  -", t)
