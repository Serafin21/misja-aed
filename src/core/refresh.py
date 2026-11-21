"""Refreshing: aggregation of providers' datasets into the common list (P5) + the OSM helper layer "Do sprawdzenia".

- every night at AED_ODSWIEZANIE (default "03:30" Europe/Warsaw; "wylaczone" turns it off),
- once at start-up when the database only has the OSM sample (e.g. the first start had no network),
- on demand: POST /api/v1/zrodla/odswiez (moderator) – runs in the background, GET /api/v1/zrodla/odswiezanie shows progress.
"""
from __future__ import annotations

import os
import threading
import time
import traceback
from datetime import datetime, timedelta

from .store import TZ, Store, now_min

_lock = threading.Lock()
STATUS: dict = {"w_toku": False, "ostatnie": None, "wynik": None, "blad": None, "nastepne": None, "harmonogram": None}


def run(store: Store, powod: str = "na żądanie") -> dict:
    """Refresh OSM and dane.gov.pl now (blocking). Returns the result; only one refresh at a time."""
    if not _lock.acquire(blocking=False):
        return {"status": "w_toku"}
    try:
        STATUS.update(w_toku=True, blad=None, start=now_min(), powod=powod)
        from .connectors import osm
        wynik: dict = {}
        before = len(store.records)
        try:
            r = osm.refresh(store)
            wynik["osm"] = {k: r[k] for k in ("dodane", "zaktualizowane", "scalone", "odrzucone", "zrodlo", "liczba_obiektow")}
        except Exception as e:  # noqa: BLE001
            wynik["osm"] = {"blad": str(e)}
        try:
            from . import dostawcy
            a = dostawcy.agreguj(store)
            wynik["lista"] = {"rekordy": a["rekordy"], "zbiory": [{k: z.get(k) for k in ("zbior_id", "tytul", "dostawca", "status", "wlaczone", "odrzucone", "nieaktualny")}
                                                                for z in a["zbiory"]]}
        except Exception as e:  # noqa: BLE001
            wynik["lista"] = {"blad": str(e)}
        wynik["rekordy_przed"], wynik["rekordy_po"] = before, len(store.records)
        STATUS.update(ostatnie=now_min(), wynik=wynik)
        return {"status": "zakonczone", "wynik": wynik}
    except Exception as e:  # noqa: BLE001
        STATUS["blad"] = f"{e}"
        traceback.print_exc()
        return {"status": "blad", "blad": str(e)}
    finally:
        STATUS["w_toku"] = False
        _lock.release()


def run_in_background(store: Store, powod: str = "na żądanie") -> bool:
    if STATUS["w_toku"]:
        return False
    threading.Thread(target=run, args=(store, powod), daemon=True, name="aed-odswiezanie").start()
    return True


def _next_run(hhmm: str, now: datetime) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    t = now.replace(hour=h, minute=m, second=0, microsecond=0)
    return t if t > now else t + timedelta(days=1)


def start_scheduler(get_store) -> None:
    """Background thread: refresh every night; at start-up too if the OSM layer is only the sample."""
    when = os.environ.get("AED_ODSWIEZANIE", "03:30").strip().lower()
    if when in ("wylaczone", "nie", "off", ""):
        STATUS["harmonogram"] = "wyłączone"
        return
    try:
        _next_run(when, datetime.now(TZ))
    except ValueError:
        when = "03:30"
    STATUS["harmonogram"] = f"codziennie o {when}"

    def loop():
        st = get_store()
        osm_n = sum(1 for srcs in st.sources.values() for s in srcs if s["kod_zrodla"] == "osm")
        if osm_n < 1000 or not st.lista:
            time.sleep(5)
            run(st, "start: w bazie tylko próbka OpenStreetMap")
        while True:
            nxt = _next_run(when, datetime.now(TZ))
            STATUS["nastepne"] = nxt.strftime("%Y-%m-%dT%H:%M")
            time.sleep(max(30.0, (nxt - datetime.now(TZ)).total_seconds()))
            run(get_store(), "harmonogram nocny")

    threading.Thread(target=loop, daemon=True, name="aed-harmonogram").start()
