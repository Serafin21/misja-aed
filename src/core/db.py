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
-- model ról (docs/MODEL_ROL.md): pochodzenie rekordu wspólnej listy od dostawcy (bez scalania)
CREATE TABLE IF NOT EXISTS lista (id_aed TEXT PRIMARY KEY, data TEXT NOT NULL);
-- kopia robocza dostawcy (kreator plików do publikacji) – nie trafia na listę
CREATE TABLE IF NOT EXISTS robocze (
  dostawca TEXT NOT NULL, id_aed TEXT NOT NULL, data TEXT NOT NULL, updated TEXT, PRIMARY KEY (dostawca, id_aed));
CREATE TABLE IF NOT EXISTS organizacje (dostawca TEXT PRIMARY KEY, data TEXT NOT NULL);
-- dziennik zdarzeń: tylko INSERT (rozliczalność, K10)
CREATE TABLE IF NOT EXISTS dziennik (
  id INTEGER PRIMARY KEY AUTOINCREMENT, czas TEXT NOT NULL, kto TEXT NOT NULL, rola TEXT, operacja TEXT NOT NULL,
  obiekt TEXT, przed TEXT, po TEXT);
CREATE TRIGGER IF NOT EXISTS dziennik_bez_zmian BEFORE UPDATE ON dziennik BEGIN SELECT RAISE(ABORT, 'dziennik tylko do odczytu'); END;
CREATE TRIGGER IF NOT EXISTS dziennik_bez_usuwania BEFORE DELETE ON dziennik BEGIN SELECT RAISE(ABORT, 'dziennik tylko do odczytu'); END;
CREATE TABLE IF NOT EXISTS powiadomienia (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dostawca TEXT NOT NULL, typ TEXT NOT NULL, tresc TEXT NOT NULL, ref TEXT,
  czas TEXT NOT NULL, przeczytane INTEGER NOT NULL DEFAULT 0, UNIQUE (dostawca, typ, ref));
-- small persistent state (e.g. the last aggregation report)
CREATE TABLE IF NOT EXISTS stan (klucz TEXT PRIMARY KEY, data TEXT NOT NULL);
-- decyzja właściciela projektu (22.11): AED dodane w aplikacji (zatwierdzone zgłoszenia), edycje administratora,
-- przypisanie AED do konta instytucji, zdjęcia AED
CREATE TABLE IF NOT EXISTS aed_aplikacja (id_aed TEXT PRIMARY KEY, organizacja TEXT, data TEXT NOT NULL, utworzono TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS edycje (id_aed TEXT PRIMARY KEY, data TEXT NOT NULL, czas TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS przypisania (id_aed TEXT PRIMARY KEY, organizacja TEXT NOT NULL, czas TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS zdjecia_aed (id_aed TEXT PRIMARY KEY, data TEXT NOT NULL, czas TEXT NOT NULL);
-- CR-TL-8: wnioski instytucji o konto (zatwierdza administrator) i zgłoszenia nowych AED przez instytucje
CREATE TABLE IF NOT EXISTS wnioski (id TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL, utworzono TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS zgloszenia_aed (id TEXT PRIMARY KEY, status TEXT NOT NULL, organizacja TEXT NOT NULL, data TEXT NOT NULL,
  utworzono TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS konta (
  login TEXT PRIMARY KEY, rola TEXT NOT NULL, dysponent_nazwa TEXT, haslo TEXT NOT NULL, aktywne INTEGER NOT NULL DEFAULT 1,
  utworzono TEXT, utworzyl TEXT, email TEXT);
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
            cols = {r[1] for r in _conn.execute("PRAGMA table_info(konta)")}
            for c in ("podstawa", "regon", "telefon"):  # CR-TL-6 / CR-TL-8 – older databases get the new columns
                if c not in cols:
                    _conn.execute(f"ALTER TABLE konta ADD COLUMN {c} TEXT")
        return _conn


def lock() -> threading.RLock:
    return _lock


def dumps(o) -> str:
    return json.dumps(o, ensure_ascii=False)


def loads(s: str):
    return json.loads(s)
