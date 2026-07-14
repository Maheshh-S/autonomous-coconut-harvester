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


if __name__ == "__main__":
    init_db()
    print("Schema ensured")
