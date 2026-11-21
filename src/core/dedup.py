"""Duplicate detection and field-by-field merge (CONTRACT §4 pt 5)."""
from __future__ import annotations

import hashlib
import math

from rapidfuzz import fuzz

from . import quality, schema

PRIORITY = {"dysponent": 0, "dane_gov_pl": 1, "inne": 2, "osm": 3, "zgloszenie_obywatela": 4}
NEAR_M = 5.0
FAR_M = 30.0
SIMILARITY = 0.6

# fields that describe the source rather than the device – never merged from lower-priority sources
_SOURCE_FIELDS = {"id_aed", "zrodlo_danych", "licencja", "data_weryfikacji", "metoda_weryfikacji",
                  "data_aktualizacji", "kompletnosc"}


def make_id(kod_zrodla: str, id_w_zrodle: str) -> str:
    return "AED-PL-" + hashlib.sha1(f"{kod_zrodla}|{id_w_zrodle}".encode()).hexdigest().upper()[:10]


def distance_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _addr(r: dict) -> str:
    return " ".join(str(r.get(f) or "") for f in ("ulica", "numer_budynku", "miejscowosc")).strip()


def similarity(a: dict, b: dict) -> float:
    s = 0.0
    if a.get("nazwa_obiektu") and b.get("nazwa_obiektu"):
        s = max(s, fuzz.token_set_ratio(a["nazwa_obiektu"].lower(), b["nazwa_obiektu"].lower()) / 100)
    if a.get("dysponent_nazwa") and b.get("nazwa_obiektu"):
        s = max(s, fuzz.token_set_ratio(a["dysponent_nazwa"].lower(), b["nazwa_obiektu"].lower()) / 100)
    if b.get("dysponent_nazwa") and a.get("nazwa_obiektu"):
        s = max(s, fuzz.token_set_ratio(b["dysponent_nazwa"].lower(), a["nazwa_obiektu"].lower()) / 100)
    aa, ab = _addr(a), _addr(b)
    if len(aa) > 3 and len(ab) > 3 and (a.get("numer_budynku") and b.get("numer_budynku")):
        s = max(s, fuzz.token_set_ratio(aa.lower(), ab.lower()) / 100)
    return s


def is_same(a: dict, b: dict) -> tuple[bool, float]:
    d = distance_m(a["szerokosc_geograficzna"], a["dlugosc_geograficzna"],
                   b["szerokosc_geograficzna"], b["dlugosc_geograficzna"])
    if d <= NEAR_M:
        return True, d
    if d <= FAR_M and similarity(a, b) >= SIMILARITY:
        return True, d
    return False, d


class GridIndex:
    """Spatial hash (~110 m cells) for candidate lookup."""

    CELL = 0.001

    def __init__(self):
        self.cells: dict[tuple[int, int], set[str]] = {}
        self.pos: dict[str, tuple[int, int]] = {}

    def _key(self, lat, lon):
        return int(math.floor(lat / self.CELL)), int(math.floor(lon / (self.CELL * 1.6)))

    def add(self, id_, lat, lon):
        self.remove(id_)
        k = self._key(lat, lon)
        self.cells.setdefault(k, set()).add(id_)
        self.pos[id_] = k

    def remove(self, id_):
        k = self.pos.pop(id_, None)
        if k is not None:
            self.cells.get(k, set()).discard(id_)

    def near(self, lat, lon):
        ky, kx = self._key(lat, lon)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                yield from self.cells.get((ky + dy, kx + dx), ())


def _rank(src: dict) -> tuple:
    rec = src["dane"]
    # lower priority value first; tie -> newest
    return PRIORITY.get(rec.get("zrodlo_danych") or "inne", 2), _neg(src.get("data_pobrania") or ""), \
        _neg(rec.get("data_aktualizacji") or "")


def _neg(s: str) -> tuple:
    return tuple(-ord(c) for c in s)


def merge(id_aed: str, sources: list[dict]) -> tuple[dict, str]:
    """Merge source records into one AED record. Returns (record, kod_zrodla of master).

    ODbL (OpenStreetMap) values are never copied into a record that has a non-ODbL source,
    so the open CC0/CC-BY layer stays free of ODbL-derived content.
    """
    ordered = sorted(sources, key=_rank)
    open_sources = [s for s in ordered if s["dane"].get("licencja") != "ODbL-1.0"]
    contributing = open_sources or ordered
    master = contributing[0]
    out = schema.empty_record()
    out.update({k: v for k, v in master["dane"].items() if k in out})
    for s in contributing[1:]:
        for k, v in s["dane"].items():
            if k in out and k not in _SOURCE_FIELDS and (out.get(k) is None or out.get(k) == "") and v not in (None, ""):
                out[k] = v
    licences = {s["dane"].get("licencja") for s in contributing}
    if "ODbL-1.0" in licences:
        out["licencja"] = "ODbL-1.0"
    elif "CC-BY-4.0" in licences:
        out["licencja"] = "CC-BY-4.0"
    else:
        out["licencja"] = "CC0-1.0"
    out["id_aed"] = id_aed
    out["data_aktualizacji"] = max((s["dane"].get("data_aktualizacji") or "") for s in contributing) or out["data_aktualizacji"]
    out["kompletnosc"] = quality.completeness(out)
    return out, master["kod_zrodla"]
