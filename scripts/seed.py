"""Seed the database: sample unified records (with stable ids) + OSM layer (cache or sample).

Usage: python -m scripts.seed [--reset] [--osm sample|full|none]
"""
from __future__ import annotations

import argparse
import csv
import json
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
                    help="auto/full = sieć → cache data/cache → próbka; sample = tylko próbka")
    a = ap.parse_args(argv)
    if a.reset and db.DB_PATH.exists():
        for suffix in ("", "-wal", "-shm"):
            p = Path(str(db.DB_PATH) + suffix)
            if p.exists():
                p.unlink()
    st = reset_store(db.connect(db.DB_PATH))
    prov = {}
    with open(SAMPLE / "aed_pochodzenie.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["rekord_nadrzedny"] == "true":
                prov[r["id_aed"]] = r
    with open(SAMPLE / "zrodla.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["kod_zrodla"] == "zgloszenia":
                continue
            st.register_source(r["kod_zrodla"], {k: r[k] for k in ("nazwa", "typ_zrodla", "format", "licencja",
                                                                     "czestotliwosc_aktualizacji", "obszar")})
    fc = json.loads((SAMPLE / "aed_ujednolicone.geojson").read_text(encoding="utf-8"))
    n = 0
    for feat in fc["features"]:
        rec = dict(feat["properties"])
        p = prov.get(rec["id_aed"])
        kod, sid = (p["kod_zrodla"], p["id_w_zrodle"]) if p else ("seed", rec["id_aed"])
        st.upsert_source(kod, sid, rec, data_pobrania=p["data_pobrania"] if p else None, force_id=rec["id_aed"], commit=False)
        n += 1
    st.commit()
    print(f"Seed: {n} rekordów z aed_ujednolicone.geojson")
    if a.osm != "none":
        # auto/full: network -> local cache -> sample fallback (see connectors/osm.py)
        mode = "sample" if a.osm == "sample" else None
        res = osm.refresh(st, mode)
        print(f"OSM ({res['zrodlo']}): {res}")
    print(f"Razem w bazie: {len(st.records)} AED")


if __name__ == "__main__":
    main()
