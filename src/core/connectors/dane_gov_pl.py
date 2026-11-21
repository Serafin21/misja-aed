"""dane.gov.pl connector: find AED datasets via API 1.4 and (optionally) import CSV/JSON/GeoJSON resources."""
from __future__ import annotations

import json
import re
from urllib.parse import quote

from .. import importers, mapping, pipeline
from ..store import Store
from .net import fetch

API = "https://api.dane.gov.pl/1.4"
LICENCES = {"CC0 1.0": "CC0-1.0", "CC BY 4.0": "CC-BY-4.0"}
PREFERRED = ["csv", "geojson", "json", "xlsx"]


def _clean(s: str | None) -> str:
    return re.sub(r"</?mark>", "", s or "").strip()


def search(store: Store, q: str = "defibrylator AED", do_import: bool = False) -> dict:
    found: dict[str, dict] = {}
    origin = "siec"
    errors = []
    for term in [t for t in re.split(r"[\s,]+", q) if t] or ["defibrylator"]:
        try:
            body, origin = fetch(f"{API}/datasets?q={quote(term)}&per_page=50", f"dgp_search_{term.lower()}.json",
                                 timeout=20, max_age_h=6)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{term}: {e}")
            continue
        for d in json.loads(body).get("data", []):
            a = d.get("attributes", {})
            found[str(d["id"])] = {
                "id": str(d["id"]), "tytul": _clean(a.get("title")), "slug": a.get("slug"),
                "licencja_portalu": a.get("license_name"), "licencja": LICENCES.get(a.get("license_name")),
                "url": (d.get("links") or {}).get("self"),
                "zasoby_url": (((d.get("relationships") or {}).get("resources") or {}).get("links") or {}).get("related"),
                "kategorie": [c.get("code") for c in a.get("categories") or [] if isinstance(c, dict)],
            }
    results = list(found.values())
    imported = []
    if do_import:
        for ds in results:
            imported.append(import_dataset(store, ds))
    for ds in results:
        store.register_source(f"dane_gov_pl:{ds['id']}", {
            "nazwa": ds["tytul"], "typ_zrodla": "dane_gov_pl", "format": "API dane.gov.pl",
            "licencja": ds["licencja"] or ds["licencja_portalu"] or "", "czestotliwosc_aktualizacji": "irregular",
            "obszar": "", "url": ds["url"]})
    return {"data": results, "meta": {"count": len(results), "zrodlo": origin, "bledy": errors, "importy": imported}}


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
        if a.get("format") not in PREFERRED:
            continue
        url = a.get("file_url") or a.get("download_url")
        try:
            data, _ = fetch(url, f"dgp_file_{r['id']}.{a['format']}", timeout=60, max_age_h=24)
            rows, fmt = importers.read_any(url, data)
        except Exception as e:  # noqa: BLE001
            continue
        m = mapping.propose(rows)
        defaults = {"kod_zrodla": kod, "licencja": ds["licencja"], "zrodlo_danych": "dane_gov_pl",
                    "metoda_weryfikacji": "import_automatyczny"}
        results = pipeline.process_rows(rows, m, defaults, first_row=2)
        counts = {"dodane": 0, "zaktualizowane": 0, "scalone": 0, "odrzucone": 0}
        for x in results:
            if not x["poprawny"]:
                counts["odrzucone"] += 1
                continue
            counts[store.upsert_source(kod, x["id_w_zrodle"], x["rekord"], commit=False)["status"]] += 1
        store.commit()
        store.register_source(kod, {"odrzucone": counts["odrzucone"], "format": a["format"].upper()})
        return {"kod_zrodla": kod, "status": "zaimportowano", "zasob": r["id"], "format": a["format"], "mapowanie": m} | counts
    return {"kod_zrodla": kod, "status": "pominieto", "powod": "Brak zasobu CSV/JSON/GeoJSON do odczytu."}
