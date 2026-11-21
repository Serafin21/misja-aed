"""Place search for the map: voivodeships and gminy (PRG, offline) + localities, streets and addresses (GUGiK UUG).

Query forms:
- "małopol", "kraków", "wieliczka"  → voivodeships and gminy from the PRG boundaries (prefix match, no Polish letters
  needed), then localities (also villages) from the GUGiK geocoder;
- "Kraków, Floriańska" / "Kraków Floriańska" → street;  "Kraków, Floriańska 3" → address point;
- "Floriańska" alone → the street in the gmina at the map centre (`blisko`), when the map is zoomed in there.
The geocoder (https://services.gugik.gov.pl/uug/, free, official address points PRG) is optional: without network the
offline part still works. Results are cached in memory.
"""
from __future__ import annotations

import json
import re
import unicodedata
import urllib.parse
import urllib.request
from functools import lru_cache

from . import coverage

UUG = "https://services.gugik.gov.pl/uug/"
UA = "MisjaAED-prototyp/1.0"
TIMEOUT_S = 4
TYP_KOLEJNOSC = {"wojewodztwo": 0, "gmina": 1, "miejscowosc": 2, "ulica": 3, "adres": 4}
RODZAJ_OPIS = {"miejska": "miasto", "wiejska": "gmina wiejska", "miejsko-wiejska": "gmina miejsko-wiejska"}


def norm(t: str) -> str:
    """Lowercase, no Polish letters, single spaces: 'Łódź ' → 'lodz'."""
    t = unicodedata.normalize("NFKD", (t or "").replace("ł", "l").replace("Ł", "L"))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s,.-]", " ", t)).strip()


def _bbox_of(feats: list[dict]) -> list[float]:
    return [round(min(f["_bbox"][0] for f in feats), 5), round(min(f["_bbox"][1] for f in feats), 5),
            round(max(f["_bbox"][2] for f in feats), 5), round(max(f["_bbox"][3] for f in feats), 5)]


@lru_cache(maxsize=1)
def _offline_index() -> tuple[tuple, ...]:
    """(norm name, item) for every voivodeship and gmina with boundaries."""
    out = []
    for woj in coverage.boundary_files():
        fc = coverage.gminy(woj)
        bb = _bbox_of(fc["features"])
        out.append((norm(woj), {"typ": "wojewodztwo", "nazwa": woj, "opis": "województwo", "wojewodztwo": woj,
                                "bbox": bb, "lat": round((bb[1] + bb[3]) / 2, 5), "lon": round((bb[0] + bb[2]) / 2, 5)}))
        for f in fc["features"]:
            p = f["properties"]
            bb = _bbox_of([f])
            out.append((norm(p["gmina"]), {
                "typ": "gmina", "nazwa": p["gmina"], "opis": f"{RODZAJ_OPIS.get(p.get('rodzaj'), 'gmina')}, {woj}",
                "teryt": p["teryt"], "wojewodztwo": woj, "rodzaj": p.get("rodzaj"),
                "bbox": bb, "lat": round((bb[1] + bb[3]) / 2, 5), "lon": round((bb[0] + bb[2]) / 2, 5)}))
    return tuple(out)


def _offline(q: str) -> list[dict]:
    nq = norm(q)
    hits = []
    for name, item in _offline_index():
        if name == nq:
            score = 0
        elif name.startswith(nq):
            score = 1
        elif any(w.startswith(nq) for w in re.split(r"[ -]", name)):  # "Mazowiecki" in "Tomaszów Mazowiecki"
            score = 2
        else:
            continue
        # cities before rural gminy of the same name (e.g. gmina miejska Chełm before gmina wiejska Chełm)
        rank = (score, TYP_KOLEJNOSC[item["typ"]], 0 if item.get("rodzaj") == "miejska" else 1, len(name))
        hits.append((rank, item))
    hits.sort(key=lambda x: x[0])
    return [dict(i) for _, i in hits]


@lru_cache(maxsize=512)
def _uug(address: str) -> tuple[str, tuple]:
    """GUGiK geocoder → (type, results). Empty on any error (offline)."""
    url = UUG + "?" + urllib.parse.urlencode({"request": "GetAddress", "address": address, "srid": "4326"})
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            j = json.loads(r.read().decode("utf-8"))
    except Exception:
        return "", ()
    res = j.get("results") or {}
    return j.get("type") or "", tuple(res[k] for k in sorted(res, key=lambda k: int(k)))


def _line_bbox(wkt: str | None) -> list[float] | None:
    nums = [float(x) for x in re.findall(r"-?\d+\.\d+", wkt or "")]
    if len(nums) < 4:
        return None
    xs, ys = nums[0::2], nums[1::2]
    return [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)]


def _remote(address: str, gminy_seen: set[str]) -> list[dict]:
    typ, results = _uug(address)
    out = []
    for r in results:
        try:
            lat, lon = round(float(r["y"]), 6), round(float(r["x"]), 6)
        except (KeyError, TypeError, ValueError):
            continue
        if typ == "city":
            woj, commune, county = r.get("voivodeship") or "", r.get("commune") or "", r.get("county") or ""
            # a city that is a gmina of its own is already listed (with exact boundaries)
            if norm(r.get("city")) == norm(commune) and norm(commune) in gminy_seen:
                continue
            out.append({"typ": "miejscowosc", "nazwa": r.get("city"), "opis": f"miejscowość, gm. {commune}, pow. {county}, {woj}",
                        "wojewodztwo": woj or None, "lat": lat, "lon": lon, "bbox": None})
        elif typ == "street":
            out.append({"typ": "ulica", "nazwa": f"{r.get('street')}, {r.get('city')}", "opis": "ulica",
                        "lat": lat, "lon": lon, "bbox": _line_bbox(r.get("geometry_wkt"))})
        elif typ == "address":
            if str(r.get("accuracy")) not in ("1", "1.0"):
                continue  # UUG adds similar addresses (other streets) – keep exact matches only
            street = f"{r.get('street')} {r.get('number')}" if r.get("street") else r.get("number")
            out.append({"typ": "adres", "nazwa": f"{street}, {r.get('city')}", "opis": f"adres, {r.get('code') or ''}".strip(", "),
                        "lat": lat, "lon": lon, "bbox": None})
    return out


def search(q: str, limit: int = 8, blisko: tuple[float, float] | None = None, online: bool = True) -> list[dict]:
    q = (q or "").strip()
    if len(norm(q)) < 2:
        return []
    out: list[dict] = []
    has_digit = bool(re.search(r"\d", q))
    parts = [p.strip() for p in re.split(r",", q) if p.strip()]
    if len(parts) == 1 and not has_digit:
        out += _offline(q)
    seen = {norm(i["nazwa"]) for i in out if i["typ"] == "gmina"}
    if online and len(norm(q)) >= 3:
        out += _remote(q, seen)  # localities (villages too), "Kraków, Floriańska", "Kraków, Floriańska 3"
        m = re.match(r"^(.*\D)\s+(\d+\w?(/\d+\w?)?)\s*$", q)
        if has_digit and not any(i["typ"] == "adres" for i in out) and m:
            # no such house number → show the street itself
            out += [i | {"opis": f"ulica (nie znaleziono numeru {m.group(2)})"} for i in _remote(m.group(1).strip(" ,"), seen)
                    if i["typ"] == "ulica"]
        if len(parts) == 1 and not has_digit:
            if not out and " " in q:  # "Kraków Floriańska" without a comma → try city + street
                city, street = q.split(" ", 1)
                out += _remote(f"{city}, {street}", seen)
            if blisko and not any(i["typ"] in ("gmina", "miejscowosc") and norm(i["nazwa"]) == norm(q) for i in out):
                t = coverage.index().teryt(blisko[1], blisko[0])  # street in the gmina at the map centre
                g = next((i for _, i in _offline_index() if i.get("teryt") == t), None)
                if g:
                    out += [i | {"opis": f"ulica w gminie {g['nazwa']}"} for i in _remote(f"{g['nazwa']}, {q}", seen)
                            if i["typ"] == "ulica"]
    # unique by (type, name)
    uniq, keys = [], set()
    for i in out:
        k = (i["typ"], i["nazwa"], round(i["lat"], 3), round(i["lon"], 3))
        if k not in keys:
            keys.add(k)
            uniq.append(i)
    return uniq[:limit]
