"""dane.gov.pl connector: find AED datasets via API 1.4 and (optionally) import CSV/JSON/GeoJSON/XLSX resources.

Real files published by municipalities are messy (Krosno, Przemyśl, Marki in 2026): rows wrapped in quotes,
coordinates in a "geometry" JSON column or with latitude/longitude swapped, no opening hours, long descriptions.
They are imported like the OSM layer: missing address/hours are warnings (to be completed by the provider), the
publishing institution becomes `dysponent_nazwa`, the resource date becomes `data_weryfikacji`.
"""
from __future__ import annotations

import json
import re
from urllib.parse import quote

import csv
import io

from .. import hours, importers, mapping, normalize as N, pipeline, schema, validate
from ..pipeline import _p
from ..store import Store, now_min
from .net import fetch

API = "https://api.dane.gov.pl/1.4"
LICENCES = {"CC0 1.0": "CC0-1.0", "CC BY 4.0": "CC-BY-4.0"}
PREFERRED = ["csv", "geojson", "json", "xlsx", "xls"]
# a dataset is about AED only if its title or description says so ("AED" alone matches e.g. "ADE" prices)
RELEVANT = re.compile(r"defibryl|\bAED\b", re.I)
RELAXED = {"wojewodztwo", "gmina", "miejscowosc", "numer_budynku", "kod_pocztowy", "godziny_dostepnosci",
           "opis_lokalizacji", "dostepny_24h", "ulica"}
_FILL = {"wojewodztwo": "mazowieckie", "kod_pocztowy": "00-000", "godziny_dostepnosci": "24/7", "dostepny_24h": False}


def _clean(s: str | None) -> str:
    return re.sub(r"</?mark>", "", s or "").strip()


def _institution(ds_id: str) -> str | None:
    try:
        body, _ = fetch(f"{API}/datasets/{ds_id}", f"dgp_ds_{ds_id}.json", timeout=20, max_age_h=24)
        rel = json.loads(body)["data"]["relationships"].get("institution", {})
        url = (rel.get("links") or {}).get("related")
        if not url:
            return None
        b2, _ = fetch(url, f"dgp_inst_{rel['data']['id']}.json", timeout=20, max_age_h=168)
        return _clean(json.loads(b2)["data"]["attributes"].get("title"))
    except Exception:  # noqa: BLE001
        return None


def search(store: Store, q: str = "defibrylator AED", do_import: bool = False) -> dict:
    found: dict[str, dict] = {}
    origin = "siec"
    errors = []
    pominiete = 0
    for term in [t for t in re.split(r"[\s,]+", q) if t] or ["defibrylator"]:
        try:
            body, origin = fetch(f"{API}/datasets?q={quote(term)}&per_page=50", f"dgp_search_{term.lower()}.json",
                                 timeout=20, max_age_h=6)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{term}: {e}")
            continue
        for d in json.loads(body).get("data", []):
            a = d.get("attributes", {})
            title, notes = _clean(a.get("title")), _clean(a.get("notes"))
            if not RELEVANT.search(title) and not RELEVANT.search(notes[:2000]):
                pominiete += 1
                continue
            found[str(d["id"])] = {
                "id": str(d["id"]), "tytul": title, "slug": a.get("slug"),
                "licencja_portalu": a.get("license_name"), "licencja": LICENCES.get(a.get("license_name")),
                "url": (d.get("links") or {}).get("self"),
                "strona": f"https://dane.gov.pl/pl/dataset/{d['id']}" + (f",{a['slug']}" if a.get("slug") else ""),
                "zasoby_url": (((d.get("relationships") or {}).get("resources") or {}).get("links") or {}).get("related"),
                "kategorie": [c.get("code") for c in a.get("categories") or [] if isinstance(c, dict)],
                "zmodyfikowano": (a.get("modified") or "")[:10] or None,
            }
    results = list(found.values())
    for ds in results:
        ds["instytucja"] = _institution(ds["id"])
    imported = []
    if do_import:
        for ds in results:
            imported.append(import_dataset(store, ds))
    for ds in results:
        store.register_source(f"dane_gov_pl:{ds['id']}", {
            "nazwa": f"{ds['tytul']} ({ds['instytucja']})" if ds.get("instytucja") else ds["tytul"],
            "typ_zrodla": "dane_gov_pl", "format": "API dane.gov.pl",
            "licencja": ds["licencja"] or ds["licencja_portalu"] or "", "czestotliwosc_aktualizacji": "irregular",
            "obszar": "", "url": ds["strona"]})
    return {"data": results, "meta": {"count": len(results), "zrodlo": origin, "bledy": errors, "importy": imported,
                                      "pominiete_niezwiazane": pominiete}}


# ---------- cleaning real-world files ----------
def _unwrap(rows: list[dict]) -> list[dict]:
    """Rows saved as one quoted field each ("lon,lat,""name"",…") → parse the inner CSV."""
    if not rows or len(rows[0]) != 1:
        return rows
    header = next(iter(rows[0]))
    if "," not in header and ";" not in header:
        return rows
    sep = ";" if header.count(";") > header.count(",") else ","
    text = "\n".join([header] + [str(next(iter(r.values())) or "") for r in rows])
    reader = csv.reader(io.StringIO(text), delimiter=sep, skipinitialspace=True)
    cols = [c.strip() for c in next(reader)]
    return [dict(zip(cols, [v.strip() for v in vals])) for vals in reader if any(v.strip() for v in vals)]


def _geometry(rows: list[dict]) -> list[dict]:
    """A 'geometry' column (GeoJSON point, {lat,long} object or WKT POINT) → latitude/longitude columns."""
    key = next((k for k in (rows[0] if rows else {}) if k.lower() in ("geometry", "geom", "wkt", "the_geom")), None)
    if not key:
        return rows
    for r in rows:
        v, lat, lon = r.get(key), None, None
        try:
            g = json.loads(v) if isinstance(v, str) and v.strip().startswith("{") else v
            if isinstance(g, dict):
                c = g.get("coordinates", g)
                if isinstance(c, dict):
                    lat, lon = float(c.get("lat")), float(c.get("long") or c.get("lon") or c.get("lng"))
                elif isinstance(c, (list, tuple)) and len(c) >= 2:
                    lon, lat = float(c[0]), float(c[1])
            elif isinstance(v, str) and "POINT" in v.upper():
                x, y = re.findall(r"-?\d+(?:\.\d+)?", v)[:2]
                lon, lat = float(x), float(y)
        except (TypeError, ValueError, json.JSONDecodeError):
            pass
        if lat is not None:
            r["szerokosc_geograficzna"], r["dlugosc_geograficzna"] = lat, lon
    return rows


def _fix_mapping(rows: list[dict], m: dict) -> dict:
    """Name column with one repeated value ("Defibrylator") and a location column → use the location as the name."""
    by_target = {t: c for c, t in m.items() if isinstance(t, str)}
    name_col, loc_col = by_target.get("nazwa_obiektu"), by_target.get("opis_lokalizacji")
    if name_col and loc_col and len(rows) >= 3 and len({r.get(name_col) for r in rows}) <= 2:
        m = dict(m)
        m[name_col], m[loc_col] = None, "nazwa_obiektu"  # the constant ("Defibrylator") says nothing about the place
    return m


_ADDR_NO_NUMBER = re.compile(r"^\s*(?P<ulica>[^,]+?)\s*,\s*(?P<kod>\d{2}-\d{3})\s+(?P<miasto>.+?)\s*$")


def _record(row: dict, m: dict, defaults: dict, rownum: int) -> tuple[dict, list[dict]]:
    row = {k: re.sub(r",\s*,", ",", v).strip() if isinstance(v, str) else v for k, v in row.items()}  # "nr 4, , 38-400"
    rec, probs = pipeline.transform(row, m, defaults, rownum)
    # "ul. Jasna, 38-400 Krosno" (no house number): keep street, postcode and town; the number is a warning
    for p in [p for p in probs if p["poziom"] == "blad" and p["pole"] == "numer_budynku" and p.get("wartosc_zrodlowa")]:
        mm = _ADDR_NO_NUMBER.match(str(p["wartosc_zrodlowa"]))
        if mm:
            rec["ulica_cecha"], rec["ulica"] = N.street(mm["ulica"])
            rec["kod_pocztowy"], rec["miejscowosc"] = mm["kod"], mm["miasto"]
            rec["wojewodztwo"] = rec.get("wojewodztwo") or N.woj_from_postal(mm["kod"])
            p["poziom"] = "ostrzezenie"
            p["komunikat"] = "Adres bez numeru budynku – uzupełni dysponent."
    lat, lon = rec.get("szerokosc_geograficzna"), rec.get("dlugosc_geograficzna")
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and 14 <= lat <= 24.5 and 49 <= lon <= 55:
        rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"] = lon, lat
        probs.append(_p(rownum, "szerokosc_geograficzna", "informacja", f"{lat}, {lon}", f"{lon}, {lat}",
                        "Zamieniono miejscami szerokość i długość geograficzną."))
    if not rec.get("dostep"):
        rec["dostep"] = "publiczny"
        probs.append(_p(rownum, "dostep", "informacja", None, "publiczny",
                        "Brak informacji o dostępie – przyjęto „publiczny” (zbiór publikowany przez samorząd; sprawdź)."))
    if rec.get("dostepny_24h") is None:
        rec["dostepny_24h"] = hours.is_24_7(rec.get("godziny_dostepnosci"))
    if not rec.get("opis_lokalizacji"):
        rec["opis_lokalizacji"] = "Brak opisu w zbiorze – sprawdź na miejscu"
    pipeline.truncate(rec, probs, rownum)
    filled = dict(rec)
    for f in RELAXED:
        if filled.get(f) in (None, ""):
            filled[f] = _FILL.get(f, "x")
            probs.append(_p(rownum, f, "ostrzezenie", None, None, "Brak w zbiorze z dane.gov.pl – uzupełni dysponent."))
    for pr in validate.validate_record(filled):
        probs.append(_p(rownum, pr["pole"], pr["poziom"], rec.get(pr["pole"]) if pr["pole"] else None, None, pr["komunikat"]))
    return rec, probs


def import_dataset(store: Store, ds: dict) -> dict:
    kod = f"dane_gov_pl:{ds['id']}"
    if not ds.get("licencja"):
        return {"kod_zrodla": kod, "status": "pominieto", "powod": f"Licencja {ds.get('licencja_portalu')} spoza słownika."}
    try:
        body, _ = fetch(ds["zasoby_url"], f"dgp_res_{ds['id']}.json", timeout=20, max_age_h=6)
        res = json.loads(body).get("data", [])
    except Exception as e:  # noqa: BLE001
        return {"kod_zrodla": kod, "status": "blad", "powod": str(e)}
    res.sort(key=lambda r: PREFERRED.index(r["attributes"].get("format")) if r["attributes"].get("format") in PREFERRED else 99)
    for r in res:
        a = r["attributes"]
        url = a.get("file_url") or a.get("download_url")
        if a.get("format") not in PREFERRED or not url:
            continue
        try:
            data, _ = fetch(url, f"dgp_file_{r['id']}.{a['format']}", timeout=60, max_age_h=24)
            rows, fmt = importers.read_any(url, data)
        except Exception:  # noqa: BLE001
            continue
        rows = _geometry(_unwrap(rows))
        if not rows:
            continue
        m = _fix_mapping(rows, mapping.propose(rows))
        defaults = {"kod_zrodla": kod, "licencja": ds["licencja"], "zrodlo_danych": "dane_gov_pl",
                    "metoda_weryfikacji": "import_automatyczny", "status_urzadzenia": "nieznany",
                    "dysponent_nazwa": ds.get("instytucja") or ds["tytul"], "dysponent_typ": "administracja_publiczna",
                    "data_weryfikacji": (a.get("data_date") or a.get("modified") or ds.get("zmodyfikowano") or "")[:10] or None}
        counts = {"dodane": 0, "zaktualizowane": 0, "scalone": 0, "odrzucone": 0}
        powody: dict[str, int] = {}
        seen: dict[str, int] = {}
        for i, row in enumerate(rows):
            rec, probs = _record(row, m, defaults, i + 2)
            errs = [p for p in probs if p["poziom"] == "blad"]
            if errs:
                counts["odrzucone"] += 1
                k = f"{errs[0]['pole']}: {errs[0]['komunikat']}"
                powody[k] = powody.get(k, 0) + 1
                continue
            sid = pipeline.source_id(rec, row, i)
            seen[sid] = seen.get(sid, 0) + 1
            sid = sid if seen[sid] == 1 else f"{sid} #{seen[sid]}"
            counts[store.upsert_source(kod, sid, rec, commit=False)["status"]] += 1
        store.commit()
        store.register_source(kod, {"odrzucone": counts["odrzucone"], "format": a["format"].upper(),
                                    "obszar": ds.get("instytucja") or "", "data_importu": now_min(),
                                    "wynik_importu": counts | {"wiersze": len(rows)}, "odrzucone_powody": powody})
        return {"kod_zrodla": kod, "status": "zaimportowano", "zasob": r["id"], "format": a["format"], "wiersze": len(rows),
                "mapowanie": m, "odrzucone_powody": powody} | counts
    return {"kod_zrodla": kod, "status": "pominieto",
            "powod": "Brak pliku CSV/JSON/GeoJSON/XLSX do pobrania (np. tylko link do zewnętrznego portalu)."}
