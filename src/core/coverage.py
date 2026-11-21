"""CR-TL-1: data freshness (stan_danych) and coverage of municipalities (gminy) for the map's second mode.

- stan_danych: "aktualne" when data_weryfikacji is at most 365 days old, otherwise (also with no date) "nieaktualne".
- Coverage: AED are assigned to gminy by point-in-polygon against simplified PRG boundaries in data/granice/
  (pure Python, no GIS dependencies). A gmina's stan: brak_danych (0 AED) / nieaktualne (any AED out of date) / aktualne.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from .schema import ROOT
from .store import TZ

PROG_DNI = 365
AKTUALNE, NIEAKTUALNE = "aktualne", "nieaktualne"
STANY_DANYCH = (AKTUALNE, NIEAKTUALNE)
STANY_GMINY = ("brak_danych", NIEAKTUALNE, AKTUALNE)
GRANICE = ROOT / "data" / "granice"


def _today() -> date:
    return datetime.now(TZ).date()


def wiek_danych_dni(rec: dict, today: date | None = None) -> int | None:
    """Days since data_weryfikacji; None when the date is missing or unreadable."""
    raw = rec.get("data_weryfikacji")
    if not raw:
        return None
    try:
        d = date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None
    return ((today or _today()) - d).days


def stan_danych(rec: dict, today: date | None = None) -> str:
    wiek = wiek_danych_dni(rec, today)
    return AKTUALNE if wiek is not None and wiek <= PROG_DNI else NIEAKTUALNE


# ---------- boundaries ----------
@lru_cache(maxsize=None)
def _load(path: str) -> dict:
    fc = json.loads(Path(path).read_text(encoding="utf-8"))
    for f in fc["features"]:
        polys = f["geometry"]["coordinates"]
        polys = [polys] if f["geometry"]["type"] == "Polygon" else polys
        xs = [x for p in polys for x, _ in p[0]]
        ys = [y for p in polys for _, y in p[0]]
        f["_polys"], f["_bbox"] = polys, (min(xs), min(ys), max(xs), max(ys))
    return fc


def boundary_files() -> dict[str, Path]:
    """wojewodztwo name -> boundary file (gminy_<TERYT>_<nazwa>.geojson)."""
    return {p.stem.split("_", 2)[2]: p for p in sorted(GRANICE.glob("gminy_*_*.geojson"))}


def gminy(wojewodztwo: str) -> dict | None:
    p = boundary_files().get(wojewodztwo.lower())
    return _load(str(p)) if p else None


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_feature(x: float, y: float, f: dict) -> bool:
    a, b, c, d = f["_bbox"]
    if not (a <= x <= c and b <= y <= d):
        return False
    return any(_in_ring(x, y, p[0]) and not any(_in_ring(x, y, h) for h in p[1:]) for p in f["_polys"])


def coverage(records, wojewodztwo: str, today: date | None = None) -> dict | None:
    """GeoJSON FeatureCollection of gminy with AED counts and stan; None when no boundaries for the voivodeship."""
    fc = gminy(wojewodztwo)
    if fc is None:
        return None
    today = today or _today()
    feats = fc["features"]
    a = min(f["_bbox"][0] for f in feats); b = min(f["_bbox"][1] for f in feats)
    c = max(f["_bbox"][2] for f in feats); d = max(f["_bbox"][3] for f in feats)
    counts = {f["properties"]["teryt"]: [0, 0] for f in feats}  # [aktualne, nieaktualne]
    for r in records:
        x, y = r["dlugosc_geograficzna"], r["szerokosc_geograficzna"]
        if not (a <= x <= c and b <= y <= d):
            continue
        for f in feats:
            if _in_feature(x, y, f):
                counts[f["properties"]["teryt"]][0 if stan_danych(r, today) == AKTUALNE else 1] += 1
                break
    out = []
    for f in feats:
        akt, nie = counts[f["properties"]["teryt"]]
        n = akt + nie
        stan = "brak_danych" if n == 0 else NIEAKTUALNE if nie else AKTUALNE
        out.append({"type": "Feature", "id": f["properties"]["teryt"],
                    "properties": {**f["properties"], "liczba_aed": n, "aktualne": akt, "nieaktualne": nie, "stan": stan},
                    "geometry": f["geometry"]})
    return {"type": "FeatureCollection", "features": out, "metadata": fc.get("metadata", {})}
