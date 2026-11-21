"""Prototype data (docs/MODEL_ROL.md §11): datasets of 3 FICTIONAL providers, shaped like dane.gov.pl API 1.4 answers.

Usage: python -m scripts.build_dostawcy   → data/dostawcy/<slug>/{dataset.json, resources.json, aed.csv}

Scenarios for the acceptance criteria:
- Urząd Gminy Przykładowo – up-to-date dataset, 3 AED (Warszawa);
- Uczelnia Testowa – dataset past its update deadline (K9: "zbiór nieaktualny"), 2 AED (Kraków);
- MPK Przykładowo – one AED 12 m from an AED of Uczelnia Testowa (K6: possible duplicate, not merged), one AED verified
  more than 12 months ago (K9: "rekord do weryfikacji") and one record breaking the standard (P5: left out, reported).
All names, REGON numbers, phones and e-mails are fictional.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.core import coverage, quality, schema  # noqa: E402
from src.core.dostawcy import KEYWORD, LOCAL, PORTAL, slug  # noqa: E402
from src.core.publish import to_csv  # noqa: E402

SAMPLE = json.loads((ROOT / "data" / "sample" / "aed_ujednolicone.geojson").read_text(encoding="utf-8"))
BY_ID = {f["properties"]["id_aed"]: f["properties"] for f in SAMPLE["features"]}


def rec(base: str | None = None, common: dict | None = None, **kw) -> dict:
    r = dict(BY_ID[base]) if base else schema.empty_record()
    r.update(common or {})
    r.update(kw)
    t = coverage.index().teryt(r["dlugosc_geograficzna"], r["szerokosc_geograficzna"])
    r["teryt_terc"] = r.get("teryt_terc") or t
    r["zrodlo_danych"], r["metoda_weryfikacji"] = "dysponent", r.get("metoda_weryfikacji") or "wizja_lokalna"
    r["kompletnosc"] = quality.completeness(r)
    return r


PROVIDERS = [
    {"id": 990001, "nazwa": "Urząd Gminy Przykładowo", "regon": "999000011", "freq": "monthly", "modified": "2026-11-02",
     "data_date": "2026-11-02", "licencja": "CC0 1.0", "email": "aed@przykladowo.example",
     "records": [rec(i, dysponent_regon="999000011", kontakt_email="aed@przykladowo.example", metoda_weryfikacji="wizja_lokalna")
                 for i in ("AED-PL-B939F7EBA4", "AED-PL-D6AADC75B3", "AED-PL-CBD53ED4AA")]},
    {"id": 990002, "nazwa": "Uczelnia Testowa", "regon": "999000022", "freq": "quarterly", "modified": "2025-06-30",
     "data_date": "2025-06-30", "licencja": "CC BY 4.0", "email": "bhp@uczelnia-testowa.example",
     "records": [rec(i, dysponent_regon="999000022", kontakt_email="bhp@uczelnia-testowa.example", licencja="CC-BY-4.0")
                 for i in ("AED-PL-AED495CA3B", "AED-PL-9FBD911D8A")]},
]
_ucz = BY_ID["AED-PL-AED495CA3B"]
_mpk = dict(dysponent_nazwa="MPK Przykładowo sp. z o.o.", dysponent_typ="transport", dysponent_regon="999000033",
            kontakt_email="dyspozytornia@mpk-przykladowo.example", kontakt_telefon="+48120000000", licencja="CC0-1.0",
            wojewodztwo="małopolskie", powiat="Kraków", gmina="Kraków", miejscowosc="Kraków", dostep="publiczny",
            status_urzadzenia="sprawny", mobilny=False, tryb_pediatryczny=None, pietro=None, numer_lokalu=None,
            teryt_simc=None, producent=None, model=None, data_waznosci_elektrod=None, data_ostatniego_przegladu=None,
            zdjecie_url=None, uwagi=None, instrukcja_dostepu=None, data_aktualizacji="2026-11-15T10:00")
PROVIDERS.append({
    "id": 990003, "nazwa": "MPK Przykładowo sp. z o.o.", "regon": "999000033", "freq": "monthly", "modified": "2026-11-15",
    "data_date": "2026-11-15", "licencja": "CC0 1.0", "email": "dyspozytornia@mpk-przykladowo.example",
    "records": [
        # 12 m from the Uczelnia Testowa AED (shared bus stop at the faculty) → possible duplicate (K6)
        rec(None, _mpk, id_aed="AED-PL-0000C00001", id_dysponenta_aed="MPK-AED-01", nazwa_obiektu="Przystanek Uczelnia Testowa (wiata)",
            opis_lokalizacji="w szafce na wiacie przystanku, od strony uczelni", wewnatrz_budynku=False,
            ulica_cecha="ul.", ulica="Testowa", numer_budynku="30", kod_pocztowy="30-059",
            szerokosc_geograficzna=round(_ucz["szerokosc_geograficzna"] + 0.0001, 6), dlugosc_geograficzna=round(_ucz["dlugosc_geograficzna"] + 0.0001, 6),
            godziny_dostepnosci="24/7", dostepny_24h=True, szafka_zamknieta=False, data_weryfikacji="2026-10-30"),
        # verified more than 12 months ago → "rekord do weryfikacji" (K9)
        rec(None, _mpk, id_aed="AED-PL-0000C00002", id_dysponenta_aed="MPK-AED-02", nazwa_obiektu="Zajezdnia autobusowa Przykładowo",
            opis_lokalizacji="portiernia przy bramie głównej", wewnatrz_budynku=True,
            ulica_cecha="ul.", ulica="Przykładowa", numer_budynku="1", kod_pocztowy="30-100",
            szerokosc_geograficzna=50.0480, dlugosc_geograficzna=19.9600,
            godziny_dostepnosci="24/7", dostepny_24h=True, szafka_zamknieta=True,
            instrukcja_dostepu="klucz u portiera, portiernia czynna całą dobę", data_weryfikacji="2025-03-12"),
        # breaks the standard: no coordinates → left out of the map, provider gets a validation report (P5)
        rec(None, _mpk, id_aed="AED-PL-0000C00003", id_dysponenta_aed="MPK-AED-03", nazwa_obiektu="Tramwaj nr 3001",
            opis_lokalizacji="w kabinie motorniczego", wewnatrz_budynku=True,
            ulica_cecha="ul.", ulica="Przykładowa", numer_budynku="1", kod_pocztowy="30-100",
            szerokosc_geograficzna=50.0481, dlugosc_geograficzna=19.9601, mobilny=True,
            godziny_dostepnosci="24/7", dostepny_24h=True, szafka_zamknieta=False, data_weryfikacji="2026-10-30"),
    ]})


def main():
    for p in PROVIDERS:
        s = slug(p["nazwa"])
        d = LOCAL / s
        d.mkdir(parents=True, exist_ok=True)
        recs = p["records"]
        if p["id"] == 990003:  # the broken record: remove the coordinates in the published CSV
            recs = [dict(r, szerokosc_geograficzna=None, dlugosc_geograficzna=None) if r["id_aed"] == "AED-PL-0000C00003" else r for r in recs]
        title = f"Defibrylatory AED – {p['nazwa']}"
        ds = {"data": {"type": "dataset", "id": str(p["id"]), "attributes": {
            "title": title, "slug": f"defibrylatory-aed-{s}", "notes": f"Zbiór FIKCYJNY (prototyp HackNation 2026): defibrylatory AED, których właścicielem jest {p['nazwa']}.",
            "keywords": [KEYWORD, "AED", "defibrylator"], "categories": [{"code": "HEAL"}], "update_frequency": p["freq"],
            "modified": f"{p['modified']}T08:00:00Z", "license_name": p["licencja"],
            "institution": {"title": p["nazwa"], "regon": p["regon"], "email": p["email"]}},
            "links": {"self": f"{PORTAL}/pl/dataset/{p['id']},defibrylatory-aed-{s}"}}}
        res = {"data": [{"type": "resource", "id": str(p["id"] * 10), "attributes": {
            "title": f"{title} – CSV", "format": "csv", "data_date": p["data_date"],
            "file_url": f"https://dane.gov.pl/media/resources/fikcyjne/aed-{s}.csv", "_plik_prototypu": "aed.csv"}}]}
        (d / "dataset.json").write_text(json.dumps(ds, ensure_ascii=False, indent=1), encoding="utf-8")
        (d / "resources.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        (d / "aed.csv").write_bytes(to_csv(recs, schema.field_order()))
        print(f"{d.relative_to(ROOT)}: {len(recs)} AED")


if __name__ == "__main__":
    main()
