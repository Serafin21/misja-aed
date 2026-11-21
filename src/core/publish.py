"""Publication package for dane.gov.pl (technical standard: CSV level 3, GeoJSON, CSVW, XML import, DCAT-AP-PL)."""
from __future__ import annotations

import csv
import io
import json
import os
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

from . import schema
from .store import Store, now_min, today

BASE_URL = os.environ.get("AED_PUBLIC_URL", "http://localhost:8000").rstrip("/")
EXPORT_PREFIX = "/api/v1/eksport/"

FILES = ["aed.csv", "aed.geojson", "aed_osm_odbl.csv", "aed_osm_odbl.geojson", "aed_pochodzenie.csv", "zrodla.csv",
         "slownik_danych.csv", "aed.csvw.json", "dane_gov_pl_import.xml", "metadane.jsonld"]
MIME = {".csv": "text/csv; charset=utf-8", ".geojson": "application/geo+json", ".json": "application/csvm+json",
        ".xml": "application/xml; charset=utf-8", ".jsonld": "application/ld+json"}

OSM_ATTRIBUTION = "© autorzy OpenStreetMap, licencja ODbL 1.0 (https://www.openstreetmap.org/copyright)"


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
    recs = sorted(store.records.values(), key=lambda r: r["id_aed"])
    open_l = [r for r in recs if r["licencja"] != "ODbL-1.0"]
    osm_l = [r for r in recs if r["licencja"] == "ODbL-1.0"]
    return open_l, osm_l


def url(name: str) -> str:
    return f"{BASE_URL}{EXPORT_PREFIX}{name}"


DATASET = {
    "title_pl": "Defibrylatory AED w Polsce – zbiór zintegrowany",
    "title_en": "AED defibrillators in Poland – integrated dataset",
    "desc_pl": ("Ogólnopolski, otwarty zbiór lokalizacji i dostępności automatycznych defibrylatorów zewnętrznych (AED), "
                "integrujący dane od dysponentów według wzorcowego zakresu danych. Każdy rekord ma stały identyfikator, "
                "datę weryfikacji, godziny dostępności i informację o zamkniętej szafce. Pochodzenie rekordów i zakres "
                "referencyjny źródeł są opublikowane jako osobne zasoby. Dane OpenStreetMap (ODbL) są w osobnym zasobie."),
    "desc_en": ("Nationwide open dataset of automated external defibrillator (AED) locations and availability, integrating "
                "data from AED owners according to a reference data scope. Each record has a stable identifier, "
                "verification date, availability hours and locked-cabinet information. Record provenance and the "
                "reference scope of sources are published as separate resources. OpenStreetMap data (ODbL) is a separate resource."),
    "keywords_pl": ["AED", "defibrylator", "pierwsza pomoc", "ratownictwo", "zdrowie", "bezpieczeństwo"],
    "keywords_en": ["AED", "defibrillator", "first aid", "emergency", "health", "safety"],
    "category": "HEAL",
    "update_frequency": "daily",
}

RESOURCES = [
    ("aed-csv", "aed.csv", "Defibrylatory AED – CSV", "AED defibrillators – CSV",
     "Rekordy według wzorcowego zakresu danych (UTF-8, przecinek, CRLF, RFC 4180). Licencje CC0-1.0 i CC-BY-4.0.",
     "Records in the reference data scope (UTF-8, comma, CRLF, RFC 4180). Licences CC0-1.0 and CC-BY-4.0.", True),
    ("aed-geojson", "aed.geojson", "Defibrylatory AED – GeoJSON", "AED defibrillators – GeoJSON",
     "Te same rekordy jako punkty WGS 84 (EPSG:4326).", "The same records as WGS 84 (EPSG:4326) points.", True),
    ("aed-osm-odbl-csv", "aed_osm_odbl.csv", "Defibrylatory AED z OpenStreetMap – CSV (ODbL)",
     "AED defibrillators from OpenStreetMap – CSV (ODbL)",
     f"Rekordy pochodzące wyłącznie z OpenStreetMap, niepokryte danymi dysponentów. {OSM_ATTRIBUTION}.",
     f"Records originating only from OpenStreetMap, not covered by owner data. {OSM_ATTRIBUTION}.", True),
    ("aed-osm-odbl-geojson", "aed_osm_odbl.geojson", "Defibrylatory AED z OpenStreetMap – GeoJSON (ODbL)",
     "AED defibrillators from OpenStreetMap – GeoJSON (ODbL)", f"Warstwa OSM jako punkty WGS 84. {OSM_ATTRIBUTION}.",
     f"OSM layer as WGS 84 points. {OSM_ATTRIBUTION}.", True),
    ("aed-pochodzenie", "aed_pochodzenie.csv", "Pochodzenie rekordów AED", "AED record provenance",
     "Jeden wiersz na parę rekord–źródło: kod źródła, identyfikator w źródle, licencja, data pobrania, rekord nadrzędny.",
     "One row per record–source pair: source code, id in source, licence, retrieval date, master record.", True),
    ("aed-zrodla", "zrodla.csv", "Zakres referencyjny źródeł danych AED", "Reference scope of AED data sources",
     "Dla każdego źródła: liczba rekordów, rekordy włączone, pokrycie pól wymaganych i zalecanych, licencja, obszar.",
     "For each source: record count, included records, coverage of required and recommended fields, licence, area.", True),
    ("aed-slownik", "slownik_danych.csv", "Słownik danych – wzorcowy zakres danych AED", "Data dictionary – AED reference data scope",
     "Opis 44 pól: typ, format, przykład, obowiązkowość, słownik, tag OSM, schema.org.",
     "Description of 44 fields: type, format, example, obligation, code list, OSM tag, schema.org.", False),
    ("aed-csvw", "aed.csvw.json", "Metadane CSVW dla aed.csv", "CSVW metadata for aed.csv",
     "Opis tabeli w standardzie W3C CSV on the Web.", "Table description in the W3C CSV on the Web standard.", False),
]


def pochodzenie_csv(store: Store) -> bytes:
    cols = ["id_aed", "kod_zrodla", "id_w_zrodle", "licencja_zrodla", "data_pobrania", "rekord_nadrzedny"]
    return to_csv(store.all_provenance(), cols)


ZRODLA_COLS = ["kod_zrodla", "nazwa", "typ_zrodla", "format", "licencja", "czestotliwosc_aktualizacji", "liczba_rekordow",
               "rekordy_wlaczone", "pokrycie_pol_wymaganych_proc", "pokrycie_pol_zalecanych_proc", "obszar"]


def import_xml(store: Store) -> bytes:
    """Automatic-feed XML (dataset + resources). Namespace/XSD pending confirmation (CR-1)."""
    d = today()
    res_xml = []
    for ext, name, tpl, ten, dpl, den, dynamic in RESOURCES:
        res_xml.append(f"""      <resource status="published">
        <extIdent>{ext}</extIdent>
        <url>{escape(url(name))}</url>
        <title><polish>{escape(tpl)}</polish><english>{escape(ten)}</english></title>
        <description><polish>{escape(dpl)}</polish><english>{escape(den)}</english></description>
        <availability>local</availability>
        <dataDate>{d}</dataDate>
        <specialSigns><specialSign>X</specialSign></specialSigns>
        <hasDynamicData>{'true' if dynamic else 'false'}</hasDynamicData>
        <hasHighValueData>false</hasHighValueData>
        <hasHighValueDataFromEuropeanCommissionList>false</hasHighValueDataFromEuropeanCommissionList>
        <hasResearchData>false</hasResearchData>
        <containsProtectedData>false</containsProtectedData>
      </resource>""")
    tags = "".join(f'<tag lang="pl">{escape(t)}</tag>' for t in DATASET["keywords_pl"]) + \
        "".join(f'<tag lang="en">{escape(t)}</tag>' for t in DATASET["keywords_en"])
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- Plik XML do automatycznego zasilania dane.gov.pl – struktura wg instrukcji COI „Instrukcja przygotowania
     pliku XML” (v1.0.6, 2025-11-21): dataset (extIdent ≤36, title/description pl+en ≤300/≤1000, url, categories,
     conditions, resources, tags, updateFrequency, flagi) i resource (+ availability, dataDate, specialSigns,
     containsProtectedData). URI przestrzeni nazw „p”, XSD i składnia <tags>: do potwierdzenia (CR-1).
     Wygenerowano: {now_min()} -->
<p:datasets xmlns:p="urn:do-weryfikacji:dane.gov.pl:import">
  <dataset status="published">
    <extIdent>aed-polska</extIdent>
    <title><polish>{escape(DATASET['title_pl'])}</polish><english>{escape(DATASET['title_en'])}</english></title>
    <description><polish>{escape(DATASET['desc_pl'])}</polish><english>{escape(DATASET['desc_en'])}</english></description>
    <url>{escape(BASE_URL)}/</url>
    <categories><category>{DATASET['category']}</category></categories>
    <conditions><!-- warunki ponownego wykorzystania: do decyzji dostawcy (CR-2) --></conditions>
    <resources>
{chr(10).join(res_xml)}
    </resources>
    <tags>{tags}</tags>
    <updateFrequency>{DATASET['update_frequency']}</updateFrequency>
    <hasDynamicData>true</hasDynamicData>
    <hasHighValueData>false</hasHighValueData>
    <hasHighValueDataFromEuropeanCommissionList>false</hasHighValueDataFromEuropeanCommissionList>
    <hasResearchData>false</hasResearchData>
  </dataset>
</p:datasets>
"""
    return xml.encode("utf-8")


def dcat(store: Store) -> bytes:
    open_l, osm_l = layers(store)
    mod = max((r["data_aktualizacji"] for r in store.records.values()), default=now_min())
    lic = {"aed.csv": "http://creativecommons.org/publicdomain/zero/1.0/", "aed.geojson": "http://creativecommons.org/publicdomain/zero/1.0/",
           "aed_osm_odbl.csv": "https://opendatacommons.org/licenses/odbl/1-0/", "aed_osm_odbl.geojson": "https://opendatacommons.org/licenses/odbl/1-0/"}
    fmt_uri = {".csv": "CSV", ".geojson": "GEOJSON", ".json": "JSON"}
    doc = {
        "@context": {"dcat": "http://www.w3.org/ns/dcat#", "dct": "http://purl.org/dc/terms/",
                     "foaf": "http://xmlns.com/foaf/0.1/", "vcard": "http://www.w3.org/2006/vcard/ns#",
                     "xsd": "http://www.w3.org/2001/XMLSchema#", "adms": "http://www.w3.org/ns/adms#"},
        "@id": f"{BASE_URL}/zbior/aed-polska", "@type": "dcat:Dataset",
        "dct:identifier": "aed-polska",
        "dct:title": [{"@value": DATASET["title_pl"], "@language": "pl"}, {"@value": DATASET["title_en"], "@language": "en"}],
        "dct:description": [{"@value": DATASET["desc_pl"], "@language": "pl"}, {"@value": DATASET["desc_en"], "@language": "en"}],
        "dcat:keyword": [{"@value": k, "@language": "pl"} for k in DATASET["keywords_pl"]] +
                        [{"@value": k, "@language": "en"} for k in DATASET["keywords_en"]],
        "dcat:theme": {"@id": "http://publications.europa.eu/resource/authority/data-theme/HEAL"},
        "dct:accrualPeriodicity": {"@id": "http://publications.europa.eu/resource/authority/frequency/DAILY"},
        "dct:issued": {"@value": "2026-11-22", "@type": "xsd:date"},
        "dct:modified": {"@value": mod, "@type": "xsd:dateTime"},
        "dct:language": {"@id": "http://publications.europa.eu/resource/authority/language/POL"},
        "dct:spatial": {"@id": "http://publications.europa.eu/resource/authority/country/POL"},
        "dct:publisher": {"@type": "foaf:Agent", "foaf:name": "Ministerstwo Cyfryzacji (propozycja – do potwierdzenia)"},
        "dcat:contactPoint": {"@type": "vcard:Organization", "vcard:fn": "Zespół zbioru AED",
                              "vcard:hasEmail": "mailto:aed@example.org"},
        "dct:conformsTo": {"@id": f"{BASE_URL}{EXPORT_PREFIX}slownik_danych.csv"},
        "adms:version": "0.9",
        "dcat:distribution": [],
    }
    for ext, name, tpl, ten, dpl, den, _ in RESOURCES:
        dist = {"@type": "dcat:Distribution", "@id": url(name), "dct:identifier": ext,
                "dct:title": [{"@value": tpl, "@language": "pl"}, {"@value": ten, "@language": "en"}],
                "dct:description": [{"@value": dpl, "@language": "pl"}, {"@value": den, "@language": "en"}],
                "dcat:accessURL": {"@id": url(name)}, "dcat:downloadURL": {"@id": url(name)},
                "dcat:mediaType": MIME[Path(name).suffix].split(";")[0],
                "dct:format": {"@id": f"http://publications.europa.eu/resource/authority/file-type/{fmt_uri.get(Path(name).suffix, 'JSON')}"},
                "dct:license": {"@id": lic.get(name, "http://creativecommons.org/publicdomain/zero/1.0/")}}
        doc["dcat:distribution"].append(dist)
    doc["dcat:distribution"].append({"@type": "dcat:Distribution", "@id": f"{BASE_URL}/api/v1/aed",
                                     "dct:title": [{"@value": "API JSON (stronicowanie, filtrowanie)", "@language": "pl"},
                                                   {"@value": "JSON API (paging, filtering)", "@language": "en"}],
                                     "dcat:accessURL": {"@id": f"{BASE_URL}/api/v1/aed"},
                                     "dcat:mediaType": "application/vnd.api+json"})
    return json.dumps(doc, ensure_ascii=False, indent=2).encode("utf-8")


def csvw(name: str = "aed.csv") -> bytes:
    doc = json.loads((schema.SCHEMA_DIR / "aed.csvw.json").read_text(encoding="utf-8"))
    doc["url"] = name
    doc.setdefault("dialect", {"encoding": "utf-8", "delimiter": ",", "header": True, "lineTerminators": ["\r\n"]})
    doc["dc:license"] = {"@id": "http://creativecommons.org/publicdomain/zero/1.0/"}
    return json.dumps(doc, ensure_ascii=False, indent=2).encode("utf-8")


def build(store: Store, name: str) -> bytes:
    open_l, osm_l = layers(store)
    order = schema.field_order()
    if name == "aed.csv":
        return to_csv(open_l, order)
    if name == "aed.geojson":
        return to_geojson(open_l)
    if name == "aed_osm_odbl.csv":
        return to_csv(osm_l, order)
    if name == "aed_osm_odbl.geojson":
        return to_geojson(osm_l, OSM_ATTRIBUTION)
    if name == "aed_pochodzenie.csv":
        return pochodzenie_csv(store)
    if name == "zrodla.csv":
        return to_csv(store.sources_scope(), ZRODLA_COLS)
    if name == "slownik_danych.csv":
        rows = schema.data_dictionary()
        return to_csv(rows, list(rows[0].keys()))
    if name == "aed.csvw.json":
        return csvw()
    if name == "dane_gov_pl_import.xml":
        return import_xml(store)
    if name == "metadane.jsonld":
        return dcat(store)
    raise KeyError(name)


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


_ = datetime
