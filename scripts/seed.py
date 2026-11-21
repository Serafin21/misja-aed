"""Seed the database: common list from providers' datasets (docs/MODEL_ROL.md) + OSM helper layer (cache or sample).

Usage: python -m scripts.seed [--reset] [--osm sample|full|none] [--dgp auto|none]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.core import db  # noqa: E402
from src.core.connectors import osm  # noqa: E402
from src.core.store import reset_store  # noqa: E402

SAMPLE = ROOT / "data" / "sample"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="usuń bazę przed seedem")
    ap.add_argument("--osm", default="auto", choices=["auto", "sample", "full", "none"],
                    help="warstwa pomocnicza „Do sprawdzenia”: auto/full = sieć → cache data/cache → próbka; sample = tylko próbka")
    ap.add_argument("--lista", default="auto", choices=["auto", "lokalna", "none"],
                    help="wspólna lista: auto = zbiory dostawców (fikcyjni w data/dostawcy + oznaczone w dane.gov.pl); lokalna = bez sieci")
    ap.add_argument("--dgp", default=None, choices=["auto", "none"], help="(dawna opcja) = --lista auto/lokalna")
    a = ap.parse_args(argv)
    if a.dgp:
        a.lista = "auto" if a.dgp == "auto" else "lokalna"
    if a.reset and db.DB_PATH.exists():
        for suffix in ("", "-wal", "-shm"):
            p = Path(str(db.DB_PATH) + suffix)
            if p.exists():
                p.unlink()
    st = reset_store(db.connect(db.DB_PATH))
    # model ról (docs/MODEL_ROL.md): the list comes ONLY from providers' datasets; OSM is a separate helper layer
    if a.osm != "none":
        mode = "sample" if a.osm == "sample" else None
        res = osm.refresh(st, mode)
        print(f"Warstwa pomocnicza OSM ({res['zrodlo']}): {res['dodane'] + res['zaktualizowane']} punktów")
    if a.lista != "none":
        from src.core import dostawcy
        r = dostawcy.agreguj(st, online=None if a.lista == "auto" else False)
        for z in r["zbiory"]:
            print(f"Zbiór {z['zbior_id']} ({z.get('dostawca')}): {z['status']}, na liście {z['wlaczone']}, odrzucone {z['odrzucone']}"
                  + (", NIEAKTUALNY" if z.get("nieaktualny") else ""))
    print(f"Wspólna lista: {len(st.lista)} AED · warstwa pomocnicza: {len(st.records) - len(st.lista)} punktów")


if __name__ == "__main__":
    main()
