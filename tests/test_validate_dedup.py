import json

from src.core import dedup, validate
from tests.conftest import ROOT


def sample_records():
    fc = json.loads((ROOT / "data/sample/aed_ujednolicone.geojson").read_text(encoding="utf-8"))
    return [f["properties"] for f in fc["features"]]


def test_sample_records_valid():
    for r in sample_records():
        assert not validate.has_errors(validate.validate_record(r)), r["id_aed"]


def test_validation_messages_pl():
    r = sample_records()[0] | {"kod_pocztowy": "00060", "szerokosc_geograficzna": 60.0, "dostep": "tak"}
    probs = {p["pole"]: p["komunikat"] for p in validate.validate_record(r)}
    assert "wzorzec" in probs["kod_pocztowy"]
    assert "Polski" in probs["szerokosc_geograficzna"]
    assert "słownika" in probs["dostep"]


def test_id_format():
    assert dedup.make_id("osm", "node/900000002") == "AED-PL-9778083B54"


def test_dedup_rules():
    a = {"szerokosc_geograficzna": 52.2437, "dlugosc_geograficzna": 21.0139, "nazwa_obiektu": "Urząd Gminy Przykładowo"}
    near = {"szerokosc_geograficzna": 52.24372, "dlugosc_geograficzna": 21.01395, "nazwa_obiektu": "AED"}
    mid_same = {"szerokosc_geograficzna": 52.2438, "dlugosc_geograficzna": 21.0141, "nazwa_obiektu": "Urząd Gminy Przykładowo – hol"}
    mid_other = {"szerokosc_geograficzna": 52.2438, "dlugosc_geograficzna": 21.0141, "nazwa_obiektu": "Apteka Centrum"}
    assert dedup.is_same(a, near)[0]
    assert dedup.is_same(a, mid_same)[0]
    assert not dedup.is_same(a, mid_other)[0]


def test_merge_priority_and_odbl_isolation(store):
    open_rec = sample_records()[0]
    osm_rec = dict(open_rec) | {"zrodlo_danych": "osm", "licencja": "ODbL-1.0", "instrukcja_dostepu": "z OSM",
                                "id_aed": "AED-PL-0000000000"}
    store.upsert_source("osm", "node/1", osm_rec)
    res = store.upsert_source("dysponent:x", "1", open_rec)
    assert res["status"] == "scalone"
    merged = store.records[res["id_aed"]]
    assert merged["licencja"] == "CC0-1.0" and merged["zrodlo_danych"] == "dysponent"
    assert merged["instrukcja_dostepu"] is None  # ODbL values never leak into the open layer
    prov = store.provenance(res["id_aed"])
    assert [p["rekord_nadrzedny"] for p in prov] == [True, False]
    assert res["id_aed"] == dedup.make_id("osm", "node/1")  # id stays stable
