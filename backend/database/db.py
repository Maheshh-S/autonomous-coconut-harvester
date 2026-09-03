import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load the project-root .env explicitly so configuration does not depend on the
# process working directory.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Please configure your PostgreSQL connection string."
    )

# Neon is a serverless Postgres that pauses/drops idle compute connections, so a
# pooled socket left idle (e.g. while a long survey-processing request holds other
# connections) can time out on the next query ("could not receive data from server:
# Operation timed out"). Tune the pool to validate, recycle, and fail fast instead.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # ping the pooled connection before each query; transparently
                          # recycle a dead/stale Neon socket and retry
    pool_recycle=300,     # recycle connections ~5 min, before Neon's idle-drop window
    pool_size=10,
    max_overflow=20,
    connect_args={"connect_timeout": 10},  # fail fast on connect, do not hang
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)