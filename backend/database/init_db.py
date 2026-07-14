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


if __name__ == "__main__":
    init_db()
    print("Schema ensured")
