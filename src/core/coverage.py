"""CR-TL-1: data freshness (stan_danych) and coverage of municipalities (gminy) for the map's second mode.

- stan_danych: "aktualne" when data_weryfikacji is at most 365 days old, otherwise (also with no date) "nieaktualne".
- Coverage: AED are assigned to gminy by point-in-polygon against simplified PRG boundaries in data/granice/
  (pure Python, no GIS dependencies; boundaries simplified with shared topology, so there are no gaps; a point in no
  polygon – e.g. on the coast – goes to the nearest gmina within 1 km). A gmina's stan: brak_danych (0 AED) / nieaktualne (any AED out of date) / aktualne.
"""
from __future__ import annotations

import json
import math
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
WOJ_KOD = {"02": "dolnośląskie", "04": "kujawsko-pomorskie", "06": "lubelskie", "08": "lubuskie", "10": "łódzkie",
           "12": "małopolskie", "14": "mazowieckie", "16": "opolskie", "18": "podkarpackie", "20": "podlaskie",
           "22": "pomorskie", "24": "śląskie", "26": "świętokrzyskie", "28": "warmińsko-mazurskie",
           "30": "wielkopolskie", "32": "zachodniopomorskie"}
NAJBLIZSZA_GMINA_M = 1000  # AED outside every polygon (coast, rounding) → nearest gmina if its border is this close
_CELL = 0.1


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
    """wojewodztwo name -> boundary file (gminy_<TERYT>_<nazwa>.geojson). Read once per process."""
    return dict(_boundary_files())


@lru_cache(maxsize=1)
def _boundary_files() -> tuple[tuple[str, Path], ...]:
    files = sorted(GRANICE.glob("gminy_*_*.geojson"))
    return tuple((WOJ_KOD[p.stem.split("_")[1]], p) for p in files if p.stem.split("_")[1] in WOJ_KOD)


def gminy(wojewodztwo: str) -> dict | None:
    p = boundary_files().get(wojewodztwo.lower())
    return _load(str(p)) if p else None


class _Index:
    """All loaded gminy in a coarse grid; point → TERYT with a nearest-gmina fallback for points in no polygon."""

    def __init__(self, files: tuple[str, ...]):
        self.feats = [f for p in files for f in _load(p)["features"]]
        self.grid: dict[tuple[int, int], list[dict]] = {}
        for f in self.feats:
            a, b, c, d = f["_bbox"]
            for i in range(int(a // _CELL), int(c // _CELL) + 1):
                for j in range(int(b // _CELL), int(d // _CELL) + 1):
                    self.grid.setdefault((i, j), []).append(f)
        self.cache: dict[tuple[float, float], str | None] = {}

    def teryt(self, x: float, y: float) -> str | None:
        k = (x, y)
        if k not in self.cache:
            self.cache[k] = self._locate(x, y)
        return self.cache[k]

    def _locate(self, x: float, y: float) -> str | None:
        cell = (int(x // _CELL), int(y // _CELL))
        for f in self.grid.get(cell, ()):
            if _in_feature(x, y, f):
                return f["properties"]["teryt"]
        # not inside any polygon: nearest gmina border within NAJBLIZSZA_GMINA_M
        kx = 111_320 * math.cos(math.radians(y))
        best, best_d = None, NAJBLIZSZA_GMINA_M
        seen = set()
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for f in self.grid.get((cell[0] + di, cell[1] + dj), ()):
                    if id(f) in seen:
                        continue
                    seen.add(id(f))
                    for poly in f["_polys"]:
                        for ring in poly:
                            for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                                d = _seg_dist_m(x, y, x1, y1, x2, y2, kx)
                                if d < best_d:
                                    best, best_d = f["properties"]["teryt"], d
        return best


def _seg_dist_m(x, y, x1, y1, x2, y2, kx) -> float:
    ky = 110_574
    px, py, ax, ay, bx, by = x * kx, y * ky, x1 * kx, y1 * ky, x2 * kx, y2 * ky
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


@lru_cache(maxsize=4)
def _index(files: tuple[str, ...]) -> _Index:
    return _Index(files)


def index() -> _Index:
    return _index(tuple(str(p) for _, p in _boundary_files()))


def gmina_teryt(rec: dict) -> str | None:
    """TERYT TERC of the gmina containing the AED (by location, not by the gmina field)."""
    return index().teryt(rec["dlugosc_geograficzna"], rec["szerokosc_geograficzna"])


def wojewodztwo_z_polozenia(rec: dict) -> str | None:
    t = gmina_teryt(rec)
    return WOJ_KOD.get(t[:2]) if t else None


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


def counts_by_gmina(records, today: date | None = None) -> dict[str, list[int]]:
    """TERYT → [aktualne, nieaktualne] for every AED that lies in a loaded gmina."""
    today = today or _today()
    idx = index()
    out: dict[str, list[int]] = {}
    for r in records:
        t = idx.teryt(r["dlugosc_geograficzna"], r["szerokosc_geograficzna"])
        if t:
            out.setdefault(t, [0, 0])[0 if stan_danych(r, today) == AKTUALNE else 1] += 1
    return out


def coverage(records, wojewodztwo: str, today: date | None = None, counts: dict | None = None) -> dict | None:
    """GeoJSON FeatureCollection of gminy with AED counts and stan; None when no boundaries for the voivodeship."""
    fc = gminy(wojewodztwo)
    if fc is None:
        return None
    counts = counts if counts is not None else counts_by_gmina(records, today)
    out = []
    for f in fc["features"]:
        akt, nie = counts.get(f["properties"]["teryt"], (0, 0))
        n = akt + nie
        stan = "brak_danych" if n == 0 else NIEAKTUALNE if nie else AKTUALNE
        out.append({"type": "Feature", "id": f["properties"]["teryt"],
                    "properties": {**f["properties"], "liczba_aed": n, "aktualne": akt, "nieaktualne": nie, "stan": stan},
                    "geometry": f["geometry"]})
    return {"type": "FeatureCollection", "features": out, "metadata": fc.get("metadata", {})}
