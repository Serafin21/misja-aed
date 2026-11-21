"""Download municipality (gmina) boundaries from PRG (GUGiK WFS), simplify and save as GeoJSON in data/granice/.

Usage: python -m scripts.build_granice [--woj 04] [--tolerancja 0.0006]

Source: Państwowy Rejestr Granic (PRG), usługa WFS GUGiK „AdministrativeBoundaries”, warstwa A03_Granice_gmin.
Dane PZGiK udostępniane bez opłat i bez ograniczeń (art. 40a ust. 2 pkt 1 ustawy Prawo geodezyjne i kartograficzne).
Atrybucja: „Źródło: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii”.
The server reprojects to WGS 84 (EPSG:4326, axis order lat lon), so no pyproj is needed.
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
WFS = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
NS = {"gml": "http://www.opengis.net/gml/3.2", "ms": "http://mapserver.gis.umn.edu/mapserver",
      "wfs": "http://www.opengis.net/wfs/2.0"}
WOJ = {"02": "dolnośląskie", "04": "kujawsko-pomorskie", "06": "lubelskie", "08": "lubuskie", "10": "łódzkie",
       "12": "małopolskie", "14": "mazowieckie", "16": "opolskie", "18": "podkarpackie", "20": "podlaskie",
       "22": "pomorskie", "24": "śląskie", "26": "świętokrzyskie", "28": "warmińsko-mazurskie",
       "30": "wielkopolskie", "32": "zachodniopomorskie"}
# 7th digit of TERYT TERC: 1 miejska, 2 wiejska, 3 miejsko-wiejska, 4/5 miasto/obszar wiejski gminy m-w, 8/9 dzielnice
RODZAJ = {"1": "miejska", "2": "wiejska", "3": "miejsko-wiejska", "4": "miasto w gminie miejsko-wiejskiej",
          "5": "obszar wiejski gminy miejsko-wiejskiej", "8": "dzielnica", "9": "delegatura"}


def fetch(woj: str) -> bytes:
    flt = ('<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsLike wildCard="*" singleChar="." '
           f'escapeChar="!"><fes:ValueReference>JPT_KOD_JE</fes:ValueReference><fes:Literal>{woj}*</fes:Literal>'
           '</fes:PropertyIsLike></fes:Filter>')
    q = urllib.parse.urlencode({"SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
                                "TYPENAMES": "ms:A03_Granice_gmin", "SRSNAME": "urn:ogc:def:crs:EPSG::4326", "FILTER": flt})
    req = urllib.request.Request(f"{WFS}?{q}", headers={"User-Agent": "misja-aed/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def _perp(p, a, b) -> float:
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return ((x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2) ** 0.5


def simplify(pts: list, tol: float) -> list:
    """Douglas–Peucker (iterative)."""
    if len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        s, e = stack.pop()
        best, idx = 0.0, -1
        for i in range(s + 1, e):
            d = _perp(pts[i], pts[s], pts[e])
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    return [p for p, k in zip(pts, keep) if k]


def ring(pos_list: str, tol: float) -> list | None:
    v = [float(x) for x in pos_list.split()]
    pts = [(round(v[i + 1], 5), round(v[i], 5)) for i in range(0, len(v), 2)]  # lat lon -> lon lat
    # split closed ring in two halves so DP keeps its shape, then close it again
    mid = len(pts) // 2
    out = simplify(pts[: mid + 1], tol)[:-1] + simplify(pts[mid:], tol)
    if out[0] != out[-1]:
        out.append(out[0])
    return [list(p) for p in out] if len(out) >= 4 else None


def to_geojson(gml: bytes, woj: str, tol: float) -> dict:
    root = ET.fromstring(gml)
    feats = []
    for m in root.iter(f"{{{NS['ms']}}}A03_Granice_gmin"):
        teryt = m.findtext("ms:JPT_KOD_JE", namespaces=NS)
        polys = []
        for poly in m.iter(f"{{{NS['gml']}}}Polygon"):
            ext = poly.find("gml:exterior/gml:LinearRing/gml:posList", NS)
            r = ring(ext.text, tol) if ext is not None else None
            if not r:
                continue
            holes = [h for h in (ring(i.text, tol) for i in poly.findall("gml:interior/gml:LinearRing/gml:posList", NS)) if h]
            polys.append([r] + holes)
        if not polys:
            continue
        geom = {"type": "Polygon", "coordinates": polys[0]} if len(polys) == 1 else {"type": "MultiPolygon", "coordinates": polys}
        feats.append({"type": "Feature", "properties": {
            "teryt": teryt, "gmina": m.findtext("ms:JPT_NAZWA_", namespaces=NS), "wojewodztwo": WOJ[woj],
            "rodzaj": RODZAJ.get(teryt[-1], "")}, "geometry": geom})
    feats.sort(key=lambda f: f["properties"]["teryt"])
    return {"type": "FeatureCollection", "name": f"gminy_{woj}",
            "metadata": {"zrodlo": "Państwowy Rejestr Granic (PRG) – GUGiK, usługa WFS AdministrativeBoundaries, warstwa A03_Granice_gmin",
                         "atrybucja": "Źródło: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii",
                         "licencja": "dane PZGiK udostępniane bez opłat i ograniczeń (art. 40a ust. 2 pkt 1 ustawy Prawo geodezyjne i kartograficzne)",
                         "uproszczenie": f"Douglas–Peucker, tolerancja {tol}° (ok. {round(tol * 111_000)} m), współrzędne do 5 miejsc",
                         "uklad": "WGS 84 (EPSG:4326)", "data_pobrania": date.today().isoformat(), "liczba_gmin": len(feats)},
            "features": feats}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--woj", default="04", choices=sorted(WOJ), help="kod TERYT województwa (04 = kujawsko-pomorskie)")
    ap.add_argument("--tolerancja", type=float, default=0.0006, help="tolerancja uproszczenia w stopniach")
    ap.add_argument("--plik-gml", help="użyj pobranego wcześniej pliku GML zamiast sieci")
    a = ap.parse_args(argv)
    gml = Path(a.plik_gml).read_bytes() if a.plik_gml else fetch(a.woj)
    fc = to_geojson(gml, a.woj, a.tolerancja)
    out = ROOT / "data" / "granice" / f"gminy_{a.woj}_{WOJ[a.woj]}.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: {len(fc['features'])} gmin, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
