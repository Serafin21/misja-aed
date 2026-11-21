"""Download municipality (gmina) boundaries from PRG (GUGiK WFS), simplify WITH TOPOLOGY and save GeoJSON in data/granice/.

Usage: python -m scripts.build_granice [--woj all|04|14 ...] [--tolerancja 0.0006] [--offline]

Source: Państwowy Rejestr Granic (PRG), usługa WFS GUGiK „AdministrativeBoundaries”, warstwa A03_Granice_gmin.
Dane PZGiK udostępniane bez opłat i bez ograniczeń (art. 40a ust. 2 pkt 1 ustawy Prawo geodezyjne i kartograficzne).
Atrybucja: „Źródło: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii”.

The server reprojects to WGS 84 (EPSG:4326, axis order lat lon), so no pyproj is needed. Downloads are cached in
data/cache/prg/ (outside the repository).

Topology-preserving simplification (no gaps or overlaps between neighbours): all rings of ALL requested voivodeships are
split into arcs at junction vertices (vertices with other than two distinct neighbours), every arc is simplified ONCE
(Douglas–Peucker) and the same simplified arc is reused by both gminy that share it. Rings without junctions (enclaves,
islands) are split at their lexicographically smallest and largest vertex, which is the same for the enclave and the
hole around it. Every arc with interior vertices keeps at least its farthest vertex, so no ring collapses.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache" / "prg"
OUT = ROOT / "data" / "granice"
WFS = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
NS = {"gml": "http://www.opengis.net/gml/3.2", "ms": "http://mapserver.gis.umn.edu/mapserver"}
WOJ = {"02": "dolnośląskie", "04": "kujawsko-pomorskie", "06": "lubelskie", "08": "lubuskie", "10": "łódzkie",
       "12": "małopolskie", "14": "mazowieckie", "16": "opolskie", "18": "podkarpackie", "20": "podlaskie",
       "22": "pomorskie", "24": "śląskie", "26": "świętokrzyskie", "28": "warmińsko-mazurskie",
       "30": "wielkopolskie", "32": "zachodniopomorskie"}
# 7th digit of TERYT TERC
RODZAJ = {"1": "miejska", "2": "wiejska", "3": "miejsko-wiejska", "4": "miasto w gminie miejsko-wiejskiej",
          "5": "obszar wiejski gminy miejsko-wiejskiej", "8": "dzielnica", "9": "delegatura"}
ATRYBUCJA = "Źródło: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii"


# ---------- download ----------
def fetch(woj: str) -> bytes:
    flt = ('<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsLike wildCard="*" singleChar="." '
           f'escapeChar="!"><fes:ValueReference>JPT_KOD_JE</fes:ValueReference><fes:Literal>{woj}*</fes:Literal>'
           '</fes:PropertyIsLike></fes:Filter>')
    q = urllib.parse.urlencode({"SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
                                "TYPENAMES": "ms:A03_Granice_gmin", "SRSNAME": "urn:ogc:def:crs:EPSG::4326", "FILTER": flt})
    req = urllib.request.Request(f"{WFS}?{q}", headers={"User-Agent": "misja-aed/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def load_gml(woj: str, offline: bool) -> bytes:
    p = CACHE / f"gminy_{woj}.xml"
    if not p.exists():
        if offline:
            raise SystemExit(f"Brak {p} (tryb --offline).")
        CACHE.mkdir(parents=True, exist_ok=True)
        p.write_bytes(fetch(woj))
    return p.read_bytes()


def parse(gml: bytes) -> list[dict]:
    """→ [{teryt, gmina, polys: [[ring, hole, ...], ...]}], rings as lists of (lon, lat) without the closing point."""
    out = []
    for m in ET.fromstring(gml).iter(f"{{{NS['ms']}}}A03_Granice_gmin"):
        polys = []
        for poly in m.iter(f"{{{NS['gml']}}}Polygon"):
            rings = [poly.find("gml:exterior/gml:LinearRing/gml:posList", NS)] + \
                poly.findall("gml:interior/gml:LinearRing/gml:posList", NS)
            pr = []
            for el in rings:
                if el is None:
                    continue
                v = [float(x) for x in el.text.split()]
                pts = [(round(v[i + 1], 6), round(v[i], 6)) for i in range(0, len(v), 2)]  # lat lon -> lon lat
                dedup = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
                if dedup and dedup[0] == dedup[-1]:
                    dedup.pop()
                if len(dedup) >= 3:
                    pr.append(dedup)
            if pr:
                polys.append(pr)
        if polys:
            out.append({"teryt": m.findtext("ms:JPT_KOD_JE", namespaces=NS),
                        "gmina": m.findtext("ms:JPT_NAZWA_", namespaces=NS), "polys": polys})
    return out


# ---------- simplification ----------
def _perp(p, a, b) -> float:
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return ((x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2) ** 0.5


def simplify(pts: list, tol: float) -> list:
    """Douglas–Peucker (iterative). An arc with interior vertices keeps at least the farthest one."""
    n = len(pts)
    if n < 3:
        return list(pts)
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack, first = [(0, n - 1)], True
    while stack:
        s, e = stack.pop()
        best, idx = -1.0, -1
        for i in range(s + 1, e):
            d = _perp(pts[i], pts[s], pts[e])
            if d > best:
                best, idx = d, i
        if idx > 0 and (best > tol or first):
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
        first = False
    return [p for p, k in zip(pts, keep) if k]


def topo_simplify(features: list[dict], tol: float) -> None:
    """Replace every ring in place by its topology-preserving simplification."""
    nb: dict[tuple, set] = {}
    for f in features:
        for poly in f["polys"]:
            for ring in poly:
                n = len(ring)
                for i, p in enumerate(ring):
                    s = nb.setdefault(p, set())
                    s.add(ring[i - 1]); s.add(ring[(i + 1) % n])
    cache: dict[tuple, list] = {}

    def arc_simpl(arc: list) -> list:
        fwd = arc[0] < arc[-1] or (arc[0] == arc[-1] and tuple(arc) <= tuple(reversed(arc)))
        key = tuple(arc if fwd else arc[::-1])
        if key not in cache:
            cache[key] = simplify(list(key), tol)
        s = cache[key]
        return s if fwd else s[::-1]

    for f in features:
        for poly in f["polys"]:
            for k, ring in enumerate(poly):
                n = len(ring)
                nodes = [i for i, p in enumerate(ring) if len(nb[p]) != 2]
                if len(nodes) < 2:
                    extra = {ring.index(min(ring)), ring.index(max(ring))}
                    nodes = sorted(set(nodes) | extra)
                out = []
                for j, a in enumerate(nodes):
                    b = nodes[(j + 1) % len(nodes)]
                    arc = ring[a:b + 1] if b > a else ring[a:] + ring[:b + 1]
                    out.extend(arc_simpl(arc)[:-1])
                poly[k] = out


def to_feature(f: dict, woj: str) -> dict:
    def rnd(ring):
        pts = [[round(x, 5), round(y, 5)] for x, y in ring]
        pts = [p for i, p in enumerate(pts) if p != pts[i - 1]] if len(pts) > 1 else pts  # drop duplicates made by rounding
        return pts + pts[:1]
    polys = [[rnd(ring) for ring in poly] for poly in f["polys"]]
    geom = {"type": "Polygon", "coordinates": polys[0]} if len(polys) == 1 else {"type": "MultiPolygon", "coordinates": polys}
    return {"type": "Feature", "properties": {"teryt": f["teryt"], "gmina": f["gmina"], "wojewodztwo": WOJ[woj],
                                              "rodzaj": RODZAJ.get(f["teryt"][-1], "")}, "geometry": geom}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--woj", default="all", help="all albo kody TERYT województw rozdzielone przecinkami (04 = kujawsko-pomorskie)")
    ap.add_argument("--tolerancja", type=float, default=0.0006, help="tolerancja uproszczenia w stopniach (0.0006 ≈ 65 m)")
    ap.add_argument("--offline", action="store_true", help="tylko pliki z data/cache/prg/")
    a = ap.parse_args(argv)
    codes = sorted(WOJ) if a.woj == "all" else [c.strip() for c in a.woj.split(",")]
    feats_by_woj = {c: parse(load_gml(c, a.offline)) for c in codes}
    allf = [f for fs in feats_by_woj.values() for f in fs]
    topo_simplify(allf, a.tolerancja)
    OUT.mkdir(parents=True, exist_ok=True)
    for c, fs in feats_by_woj.items():
        fs.sort(key=lambda f: f["teryt"])
        fc = {"type": "FeatureCollection", "name": f"gminy_{c}",
              "metadata": {"zrodlo": "Państwowy Rejestr Granic (PRG) – GUGiK, usługa WFS AdministrativeBoundaries, warstwa A03_Granice_gmin",
                           "atrybucja": ATRYBUCJA,
                           "licencja": "dane PZGiK udostępniane bez opłat i ograniczeń (art. 40a ust. 2 pkt 1 ustawy Prawo geodezyjne i kartograficzne)",
                           "uproszczenie": f"z zachowaniem topologii (wspólne odcinki granic upraszczane raz), Douglas–Peucker, "
                                           f"tolerancja {a.tolerancja}° (ok. {round(a.tolerancja * 111_000)} m), współrzędne do 5 miejsc",
                           "uklad": "WGS 84 (EPSG:4326)", "data_pobrania": date.today().isoformat(), "liczba_gmin": len(fs)},
              "features": [to_feature(f, c) for f in fs]}
        slug = WOJ[c].translate(str.maketrans("ąćęłńóśźż", "acelnoszz"))  # ASCII file names (macOS/Windows safe)
        out = OUT / f"gminy_{c}_{slug}.geojson"
        out.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{out.relative_to(ROOT)}: {len(fs)} gmin, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
