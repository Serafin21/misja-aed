"""SQLite persistence with an in-memory cache of merged AED records (fast reads for the whole OSM layer)."""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path

from .schema import ROOT

DB_PATH = Path(os.environ.get("AED_DB", ROOT / "data" / "aed.sqlite3"))

DDL = """
CREATE TABLE IF NOT EXISTS aed (
  id_aed TEXT PRIMARY KEY, data TEXT NOT NULL, lat REAL, lon REAL, licencja TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS pochodzenie (
  kod_zrodla TEXT NOT NULL, id_w_zrodle TEXT NOT NULL, id_aed TEXT NOT NULL, licencja_zrodla TEXT,
  data_pobrania TEXT, dane TEXT NOT NULL, PRIMARY KEY (kod_zrodla, id_w_zrodle));
CREATE INDEX IF NOT EXISTS ix_poch_aed ON pochodzenie(id_aed);
CREATE TABLE IF NOT EXISTS zrodla (kod_zrodla TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS importy (id TEXT PRIMARY KEY, data TEXT NOT NULL, created TEXT);
CREATE TABLE IF NOT EXISTS mapowania (kod_zrodla TEXT PRIMARY KEY, mapowanie TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS zgloszenia (id TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL, created TEXT);
CREATE TABLE IF NOT EXISTS potwierdzenia (
  id INTEGER PRIMARY KEY AUTOINCREMENT, id_aed TEXT NOT NULL, data TEXT NOT NULL, created TEXT);
CREATE INDEX IF NOT EXISTS ix_potw_aed ON potwierdzenia(id_aed);
"""

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None


def connect(path: Path | str | None = None) -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None or path is not None:
            p = Path(path or DB_PATH)
            p.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(str(p), check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.executescript(DDL)
        return _conn


def lock() -> threading.RLock:
    return _lock


def dumps(o) -> str:
    return json.dumps(o, ensure_ascii=False)


def loads(s: str):
    return json.loads(s)
