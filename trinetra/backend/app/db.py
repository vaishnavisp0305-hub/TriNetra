"""SQLite storage. Swap DB_PATH for a SQLAlchemy/PostgreSQL engine in production."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.getenv("TRINETRA_DB", "storage/trinetra.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    filename TEXT,
    width INTEGER, height INTEGER,
    preprocess_ms REAL,
    latency_ms REAL,
    n_det INTEGER DEFAULT 0,
    demo INTEGER DEFAULT 0,
    detections_json TEXT DEFAULT '[]',
    operator TEXT, log TEXT, verified_at TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL REFERENCES scans(id),
    det_id TEXT, cls TEXT, confidence REAL, risk TEXT,
    status TEXT CHECK (status IN ('confirmed','rejected')),
    x REAL, y REAL, w REAL, h REAL,
    edited INTEGER DEFAULT 0, manual INTEGER DEFAULT 0,
    created_at TEXT
);
"""


@contextmanager
def session():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init() -> None:
    with session() as c:
        c.executescript(SCHEMA)
