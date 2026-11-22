"""Export of the COMMON LIST (docs/MODEL_ROL.md §7): a compilation of providers' datasets, not a dataset of its own.

Every record carries its provider, dataset, resource and the reuse conditions of the source dataset. No OpenStreetMap
data (K5). The per-provider files for dane.gov.pl (CSV + harvester XML 1.13) are made by the wizard: src/core/dostawcy.py.
"""
from __future__ import annotations

import csv
import io
import json
import os
from pathlib import Path

from . import schema
from .store import Store

BASE_URL = os.environ.get("AED_PUBLIC_URL", "http://localhost:8000").rstrip("/")
EXPORT_PREFIX = "/api/v1/eksport/"

FILES = ["aed.csv", "aed.geojson", "aed.jsonld", "aed_pochodzenie.csv", "zrodla.csv", "slownik_danych.csv", "aed.csvw.json"]
MIME = {".csv": "text/csv; charset=utf-8", ".geojson": "application/geo+json", ".json": "application/csvm+json",
        ".xml": "application/xml; charset=utf-8", ".jsonld": "application/ld+json"}
MIME_BY_NAME = {"aed.jsonld": "application/ld+json"}
KOMPILACJA = ("Kompilacja zbiorów dostawców AED opublikowanych w dane.gov.pl (wspólna lista AED). Za każdy rekord odpowiada "
              "wskazany dostawca; warunki ponownego wykorzystywania – jak w zbiorze źródłowym (kolumna licencja_zbioru).")
# provenance columns appended to the 44 fields of the standard
PROV_COLS = ["dostawca", "dostawca_regon", "zbior_id", "zbior_url", "zasob_url", "data_danych", "licencja_zbioru", "mozliwy_duplikat", "zgodnosc"]


def fmt(v, field: str | None = None) -> str:
    """Format a value per the dane.gov.pl standard."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        return f"{v:.6f}" if field in ("szerokosc_geograficzna", "dlugosc_geograficzna") else repr(v)
    return str(v)


def to_csv(rows: list[dict], columns: list[str]) -> bytes:
    buf = io.StringIO(newline="")
    w = csv.writer(buf, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    w.writerow(columns)
    for r in rows:
        w.writerow([fmt(r.get(c), c) for c in columns])
    return buf.getvalue().encode("utf-8")  # UTF-8 without BOM


def to_geojson(records: list[dict], attribution: str | None = None) -> bytes:
    order = schema.field_order()
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": r["id_aed"],
         "geometry": {"type": "Point", "coordinates": [r["dlugosc_geograficzna"], r["szerokosc_geograficzna"]]},
         "properties": {k: r.get(k) for k in order}} for r in records]}
    if attribution:
        fc["attribution"] = attribution
    return json.dumps(fc, ensure_ascii=False, indent=1).encode("utf-8")


def layers(store: Store) -> tuple[list[dict], list[dict]]:
    """(common list records with provenance, helper layer – never exported)."""
    recs = sorted(store.records.values(), key=lambda r: r["id_aed"])
    lista, pom = [], []
    for r in recs:
        p = store.lista.get(r["id_aed"])
        if p and p.get("aplikacja"):
            continue  # CR-TL-9: added in the prototype, not from a provider's list in dane.gov.pl – never exported
        if p:
            lista.append(r | {"dostawca": p["dostawca"], "dostawca_regon": p.get("regon"), "zbior_id": p["zbior_id"],
                              "zbior_url": p["zbior_url"], "zasob_url": p["zasob_url"], "data_danych": p.get("data_danych"),
                              "licencja_zbioru": p.get("licencja_zbioru"), "mozliwy_duplikat": ";".join(p.get("mozliwe_duplikaty") or []),
                              "zgodnosc": p.get("zgodnosc", "wzorzec")})
        else:
            pom.append(r)
    return lista, pom


def pochodzenie_csv(store: Store) -> bytes:
    cols = ["id_aed", "dostawca", "dostawca_regon", "zbior_id", "zbior_tytul", "zbior_url", "zasob_id", "zasob_url", "data_danych",
            "zbior_zmodyfikowany", "czestotliwosc", "zbior_nieaktualny", "licencja_zbioru"]
    rows = [{"id_aed": i} | p | {"dostawca_regon": p.get("regon")} for i, p in sorted(store.lista.items()) if not p.get("aplikacja")]
    return to_csv(rows, cols)


ZRODLA_COLS = ["kod_zrodla", "nazwa", "typ_zrodla", "format", "licencja", "czestotliwosc_aktualizacji", "liczba_rekordow",
               "rekordy_wlaczone", "pokrycie_pol_wymaganych_proc", "pokrycie_pol_zalecanych_proc", "obszar"]


def csvw(name: str = "aed.csv") -> bytes:
    doc = json.loads((schema.SCHEMA_DIR / "aed.csvw.json").read_text(encoding="utf-8"))
    doc["url"] = name
    doc.setdefault("dialect", {"encoding": "utf-8", "delimiter": ",", "header": True, "lineTerminators": ["\r\n"]})
    doc["dc:description"] = KOMPILACJA
    cols = doc.get("tableSchema", {}).get("columns")
    if isinstance(cols, list):
        cols.extend({"name": c, "titles": c, "datatype": "string", "dc:description": "pochodzenie rekordu (wspólna lista)"} for c in PROV_COLS)
    return json.dumps(doc, ensure_ascii=False, indent=2).encode("utf-8")


def build(store: Store, name: str) -> bytes:
    lista, _ = layers(store)
    order = schema.field_order()
    if name == "aed.csv":
        return to_csv(lista, order + PROV_COLS)
    if name == "aed.geojson":
        fc = json.loads(to_geojson(lista))
        for f, r in zip(fc["features"], lista):
            f["properties"].update({c: r.get(c) for c in PROV_COLS})
        fc["description"] = KOMPILACJA
        return json.dumps(fc, ensure_ascii=False, indent=1).encode("utf-8")
    if name == "aed.jsonld":
        from . import linked
        return json.dumps(linked.collection(lista, BASE_URL), ensure_ascii=False, indent=1).encode("utf-8")
    if name == "aed_pochodzenie.csv":
        return pochodzenie_csv(store)
    if name == "zrodla.csv":
        return to_csv([z for z in store.sources_scope() if z["kod_zrodla"].startswith("dostawca:")], ZRODLA_COLS)
    if name == "slownik_danych.csv":
        rows = schema.data_dictionary()
        return to_csv(rows, list(rows[0].keys()))
    if name == "aed.csvw.json":
        return csvw()
    raise KeyError(name)


_INFO = {
    "aed.csv": ("Wspólna lista AED – CSV (kompilacja zbiorów dostawców)", "CSV"),
    "aed.geojson": ("Wspólna lista AED – GeoJSON", "GEOJSON"),
    "aed.jsonld": ("Wspólna lista AED – JSON-LD (schema.org)", "JSON-LD"),
    "aed_pochodzenie.csv": ("Pochodzenie rekordów: dostawca, zbiór, zasób, data danych", "CSV"),
    "zrodla.csv": ("Zbiory dostawców składające się na listę", "CSV"),
    "slownik_danych.csv": ("Słownik pól – wzorzec AED", "CSV"),
    "aed.csvw.json": ("Metadane CSVW dla aed.csv", "JSON"),
}


def resource_info(name: str) -> dict:
    t, f = _INFO.get(name, (name, Path(name).suffix.lstrip(".").upper()))
    return {"tytul": t, "opis": t + ". " + KOMPILACJA if name.startswith("aed") else t, "format": f,
            "licencja": "jak w zbiorze źródłowym" if name in ("aed.csv", "aed.geojson", "aed.jsonld") else "CC0-1.0"}


def template_csv() -> bytes:
    return to_csv([], [f for f in schema.field_order() if f not in ("id_aed", "kompletnosc", "data_aktualizacji")])


def write_package(store: Store, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name in FILES:
        p = out_dir / name
        p.write_bytes(build(store, name))
        paths.append(p)
    return paths

