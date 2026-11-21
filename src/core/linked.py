"""JSON-LD (open data level 4): AED record as schema.org Place + MedicalDevice, mapping from the data dictionary."""
from __future__ import annotations

from . import schema

LICENCE_URI = {"CC0-1.0": "http://creativecommons.org/publicdomain/zero/1.0/",
               "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
               "ODbL-1.0": "https://opendatacommons.org/licenses/odbl/1-0/"}


def context(base_url: str) -> dict:
    ctx = {"schema": "http://schema.org/", "aed": f"{base_url}/api/v1/slownik#",
           "xsd": "http://www.w3.org/2001/XMLSchema#"}
    for r in schema.data_dictionary():
        name = r["nazwa_pola"]
        if r["schema_org"]:
            ctx[name] = r["schema_org"]
        else:
            ctx[name] = f"aed:{name}"
    for f, t in schema.field_types().items():
        if t == "date":
            ctx[f] = {"@id": ctx[f], "@type": "xsd:date"}
        elif t == "datetime":
            ctx[f] = {"@id": ctx[f], "@type": "xsd:dateTime"}
        elif t == "boolean":
            ctx[f] = {"@id": ctx[f], "@type": "xsd:boolean"}
    ctx["licencja"] = {"@id": "schema:license", "@type": "@id"}
    ctx["zdjecie_url"] = {"@id": "schema:image", "@type": "@id"}
    return ctx


def record(rec: dict, base_url: str, with_context: bool = True) -> dict:
    out = {"@id": f"{base_url}/api/v1/aed/{rec['id_aed']}", "@type": ["schema:Place", "aed:Defibrylator"]}
    if with_context:
        out = {"@context": context(base_url)} | out
    for k in schema.field_order():
        v = rec.get(k)
        if v is None:
            continue
        out[k] = LICENCE_URI.get(v, v) if k == "licencja" else v
    out["schema:geo"] = {"@type": "schema:GeoCoordinates", "schema:latitude": rec["szerokosc_geograficzna"],
                         "schema:longitude": rec["dlugosc_geograficzna"]}
    return out


def collection(recs: list[dict], base_url: str) -> dict:
    return {"@context": context(base_url), "@graph": [record(r, base_url, with_context=False) for r in recs]}
