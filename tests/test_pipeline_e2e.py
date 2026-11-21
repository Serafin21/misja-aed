"""Dirty owner files -> unified records equal to data/sample/aed_ujednolicone.csv."""
import csv

import pytest

from src.core import importers, mapping, pipeline
from tests.conftest import ROOT

SAMPLE = ROOT / "data" / "sample"
CASES = [
    ("zrodlo_gmina_przyklad.csv", dict(kod_zrodla="dysponent:gmina-przykladowo", licencja="CC0-1.0",
     dysponent_nazwa="Urząd Gminy Przykładowo", dysponent_typ="administracja_publiczna", status_urzadzenia="sprawny",
     data_weryfikacji="2026-11-21")),
    ("zrodlo_uczelnia_przyklad.json", dict(kod_zrodla="dysponent:uczelnia-testowa", licencja="CC0-1.0",
     dysponent_nazwa="Uczelnia Testowa", dysponent_typ="uczelnia", status_urzadzenia="sprawny",
     data_weryfikacji="2026-11-20")),
]
# fields added later by the owner in the form (not present in the source files) or generated
NOT_IN_SOURCE = {"id_aed", "data_aktualizacji", "instrukcja_dostepu", "kompletnosc"}


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        return f"{v:.6f}"
    return str(v)


@pytest.mark.parametrize("fname,defaults", CASES)
def test_e2e(fname, defaults):
    expected = {r["nazwa_obiektu"]: r for r in csv.DictReader(open(SAMPLE / "aed_ujednolicone.csv", encoding="utf-8"))}
    rows, fmt_info = importers.read_any(fname, (SAMPLE / fname).read_bytes())
    m = mapping.propose(rows)
    res = pipeline.process_rows(rows, m, defaults)
    assert all(r["poprawny"] for r in res)
    for r in res:
        rec = r["rekord"]
        exp = expected[rec["nazwa_obiektu"]]
        diffs = {k: (fmt(rec[k]), exp[k]) for k in exp if k not in NOT_IN_SOURCE and fmt(rec[k]) != exp[k]}
        assert diffs == {}, diffs


def test_detected_format_gmina():
    _, info = importers.read_any("g.csv", (SAMPLE / "zrodlo_gmina_przyklad.csv").read_bytes())
    assert info["separator"] == ";" and info["przecinek_dziesietny"] is True and info["kodowanie"] == "UTF-8"


def test_mapping_proposal_gmina():
    rows, _ = importers.read_any("g.csv", (SAMPLE / "zrodlo_gmina_przyklad.csv").read_bytes())
    m = mapping.propose(rows)
    assert m["Adres"] == mapping.ADDRESS and m["Współrzędne"] == mapping.COORDS
    assert m["Całą dobę"] == "dostepny_24h" and m["Zamknięta szafka"] == "szafka_zamknieta"
