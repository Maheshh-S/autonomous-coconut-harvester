from sqlalchemy import text

from database.db import engine
from database.models import Base


def init_db():
    # Create any tables that do not yet exist.
    Base.metadata.create_all(bind=engine)

    # create_all does not add columns to existing tables, so evolve the schema
    # idempotently. This is the project's manual migration step (see DECISIONS.md:
    # "migrations will be manual").
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE detections ADD COLUMN IF NOT EXISTS harvest_type VARCHAR"
            )
        )

        # SurveyTile (Feature 3): create_all only adds the table, it never
        # alters an existing one. Reconcile a table that may have been created
        # by an earlier model revision (which used a `tile_order` column) with
        # the current grid-based schema.
        conn.execute(
            text("ALTER TABLE survey_tiles DROP COLUMN IF EXISTS tile_order")
        )
        conn.execute(
            text("ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS grid_row INTEGER")
        )
        conn.execute(
            text("ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS grid_col INTEGER")
        )
        conn.execute(
            text(
                "ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP"
            )
        )

        # Tree (Feature 6 — Permanent Tree Matching & Digital Twin Foundation).
        # Extend the legacy `trees` table with the permanent-tree metadata without
        # disturbing the existing `drone_api.register_tree` columns.
        conn.execute(
            text("ALTER TABLE trees ADD COLUMN IF NOT EXISTS tree_code VARCHAR")
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS first_seen_mission_id INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS last_seen_mission_id INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS times_seen INTEGER DEFAULT 1"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS last_matching_confidence FLOAT"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS availability VARCHAR DEFAULT 'ACTIVE'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR DEFAULT 'DETECTED'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS last_box_w INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS last_box_h INTEGER"
            )
        )

        # Tree (Feature 9 — Inventory Builder & Inventory Snapshot). Pointer to the
        # tree's latest InventorySnapshot; create_all never alters an existing table.
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS current_inventory_id INTEGER"
            )
        )

        # Tree (Version 2 — Digital Twin Farm Viewer, §V2.5). Pointer to the tree's
        # representative TreeObservation. The `tree_observations` table itself is
        # created by create_all (new model); only this pointer needs an ALTER.
        conn.execute(
            text(
                "ALTER TABLE trees ADD COLUMN IF NOT EXISTS current_observation_id INTEGER"
            )
        )

        # SurveyTile (Version 2 — §V2.5, Decision 4). Persisted tile metadata used
        # by the Digital Twin: capture order, tile-centre GPS, and image pixel
        # dimensions. Written during survey processing; nullable for pre-V2 rows.
        conn.execute(
            text(
                "ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS capture_order INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS center_gps_lat FLOAT"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS center_gps_lon FLOAT"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS image_width INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE survey_tiles ADD COLUMN IF NOT EXISTS image_height INTEGER"
            )
        )

        # InventorySnapshot (Feature 11 — Robot Mission Execution). Post-harvest
        # snapshots are written with no originating Inspection, so inspection_id
        # must be nullable. The UNIQUE(inspection_id) constraint still allows many
        # NULL rows (Postgres treats NULLs as distinct).
        conn.execute(
            text(
                "ALTER TABLE inventory_snapshots ALTER COLUMN inspection_id DROP NOT NULL"
            )
        )

        # HarvestMissionItem (Feature 11 — Robot Mission Execution). Records the
        # coconuts actually harvested from each tree when its item completes.
        conn.execute(
            text(
                "ALTER TABLE harvest_mission_items ADD COLUMN IF NOT EXISTS "
                "harvested INTEGER"
            )
        )

        # --- Hot-path indexes (hardening). CREATE INDEX IF NOT EXISTS is additive
        # and idempotent: it only speeds up the project's dominant read queries and
        # never changes schema semantics or row data. Backed by the same indexes on
        # the SQLAlchemy models (Index(...) in __table_args__) so fresh databases
        # get them at create_all time, while existing databases get them here.
        # trees: filtered by last_seen/first_seen (permanent-trees) and joined by
        # current_observation_id (Digital Twin tree overlay).
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_trees_last_seen_mission_id "
            "ON trees (last_seen_mission_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_trees_first_seen_mission_id "
            "ON trees (first_seen_mission_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_trees_current_observation_id "
            "ON trees (current_observation_id)"
        ))
        # survey_missions / robot_runs: ORDER BY created_at / finished_at lists.
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_survey_missions_created_at "
            "ON survey_missions (created_at)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_robot_runs_finished_at "
            "ON robot_runs (finished_at)"
        ))
        # telemetry / events: composite (robot, mission, sim_time) serves the
        # history endpoints' filtered + ordered time-series reads in one index.
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_robot_telemetry_robot_mission_time "
            "ON robot_telemetry (robot_id, mission_id, sim_time)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_robot_events_robot_mission_time "
            "ON robot_events (robot_id, mission_id, sim_time)"
        ))

    # Backfill the immutable public `tree_code` for any legacy/Feature-6 trees that
    # were created before the column existed, so every permanent tree has one.
    # Using the row id keeps codes unique, monotonic, and stable across reboots.
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE trees SET tree_code = 'TREE-' || LPAD(id::text, 4, '0') "
                "WHERE tree_code IS NULL"
            )
        )

        # Version 3.7.1 — Mission History analytics refinement. create_all created the
        # `robot_runs` table at V3.7; this ALTER evolves the existing table to carry the
        # transparent Mission Score breakdown (JSON string). Idempotent.
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE robot_runs ADD COLUMN IF NOT EXISTS "
                    "score_breakdown TEXT"
                )
            )

        # Version 3.1 — Robot Domain Foundation. create_all above already created the
        # `robots` / `dock_stations` / `robot_batteries` / `robot_configurations`
        # tables; seed the singleton domain rows idempotently so the robot exists on
        # first boot (init_db runs on every startup).
        from api.robot_domain import ensure_robot_domain
        from database.db import SessionLocal

        seed_db = SessionLocal()
        try:
            ensure_robot_domain(seed_db)
        finally:
            seed_db.close()


if __name__ == "__main__":
    init_db()
    print("Schema ensured")
