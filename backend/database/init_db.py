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


if __name__ == "__main__":
    init_db()
    print("Schema ensured")
