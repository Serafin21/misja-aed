"""CR-TL-1: stan_danych (365-day threshold, missing date), filter, /pokrycie, statistics."""
from datetime import date, timedelta

import pytest

from src.core import coverage

DZIS = date(2026, 11, 21)


@pytest.mark.parametrize("dni,stan", [(0, "aktualne"), (364, "aktualne"), (365, "aktualne"),
                                      (366, "nieaktualne"), (2000, "nieaktualne")])
def test_prog_365_dni(dni, stan):
    rec = {"data_weryfikacji": (DZIS - timedelta(days=dni)).isoformat()}
    assert coverage.stan_danych(rec, DZIS) == stan
    assert coverage.wiek_danych_dni(rec, DZIS) == dni


@pytest.mark.parametrize("wartosc", [None, "", "nie wiem", "2026-13-45"])
def test_brak_lub_bledna_data_to_nieaktualne(wartosc):
    rec = {"data_weryfikacji": wartosc}
    assert coverage.stan_danych(rec, DZIS) == "nieaktualne"
    assert coverage.wiek_danych_dni(rec, DZIS) is None


def test_osm_bez_check_date_nie_dostaje_dzisiejszej_daty():
    from src.core.connectors import osm
    feat = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [18.0, 53.1]},
            "properties": {"@osm_type": "node", "@osm_id": 1, "emergency": "defibrillator"}}
    rec, _ = osm.to_record(feat)
    assert rec["data_weryfikacji"] is None
    assert not any(p["poziom"] == "blad" for p in osm.check(rec, "node/1"))
    feat["properties"]["check_date"] = "2026-05-01"
    assert osm.to_record(feat)[0]["data_weryfikacji"] == "2026-05-01"


def test_meta_i_filtr_stan_danych(client):
    j = client.get("/api/v1/aed?per_page=100").json()
    for item in j["data"]:
        m = item["meta"]
        assert m["stan_danych"] in ("aktualne", "nieaktualne")
        assert m["wiek_danych_dni"] is None or isinstance(m["wiek_danych_dni"], int)
    total = j["meta"]["count"]
    akt = client.get("/api/v1/aed?stan_danych=aktualne").json()
    nie = client.get("/api/v1/aed?stan_danych=nieaktualne").json()
    assert akt["meta"]["count"] + nie["meta"]["count"] == total
    assert all(i["meta"]["stan_danych"] == "aktualne" for i in akt["data"])
    assert client.get("/api/v1/aed?stan_danych=stare").status_code == 422


def test_pokrycie_kujawsko_pomorskie(client):
    r = client.get("/api/v1/pokrycie?wojewodztwo=kujawsko-pomorskie")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/geo+json")
    fc = r.json()
    assert fc["type"] == "FeatureCollection" and len(fc["features"]) == 144
    p = fc["features"][0]["properties"]
    assert set(p) >= {"teryt", "gmina", "liczba_aed", "aktualne", "nieaktualne", "stan"}
    assert all(f["properties"]["stan"] in ("brak_danych", "nieaktualne", "aktualne") for f in fc["features"])
    assert sum(fc["meta"]["gminy_wg_stanu"].values()) == 144
    assert "Państwowy Rejestr Granic" in fc["meta"]["atrybucja"]
    assert client.get("/api/v1/pokrycie?wojewodztwo=atlantyda").status_code == 404


def test_przypisanie_do_gminy_i_stan_gminy():
    # Toruń city centre and an AED verified long ago / never
    torun = {"szerokosc_geograficzna": 53.0103, "dlugosc_geograficzna": 18.6040}
    fresh = torun | {"data_weryfikacji": DZIS.isoformat()}
    old = torun | {"data_weryfikacji": None}
    fc = coverage.coverage([fresh], "kujawsko-pomorskie", DZIS)
    g = next(f for f in fc["features"] if f["properties"]["liczba_aed"])
    assert g["properties"]["gmina"] == "Toruń" and g["properties"]["stan"] == "aktualne"
    fc = coverage.coverage([fresh, old], "kujawsko-pomorskie", DZIS)
    g = next(f for f in fc["features"] if f["properties"]["liczba_aed"])
    assert (g["properties"]["aktualne"], g["properties"]["nieaktualne"], g["properties"]["stan"]) == (1, 1, "nieaktualne")
    assert sum(f["properties"]["stan"] == "brak_danych" for f in fc["features"]) == 143


def test_granice_16_wojewodztw():
    files = coverage.boundary_files()
    assert len(files) == 16
    assert sum(len(coverage.gminy(w)["features"]) for w in files) == 2479


def test_statystyki_liczniki(client):
    d = client.get("/api/v1/statystyki").json()["data"]
    assert d["aktualne"] + d["nieaktualne"] == d["liczba_aed"]
    # sample data: 7 AED in 4 gminy (Warszawa, Kraków, Gdańsk, …) → all other gminy of Poland have no data
    assert 2470 <= d["gminy_bez_danych"] < 2479
    assert sum(d["wg_wojewodztw_polozenie"].values()) == d["liczba_aed"]


def test_zrodla_zawiera_prg(client):
    rows = client.get("/api/v1/zrodla").json()["data"]
    prg = next(r for r in rows if r["kod_zrodla"] == "prg-gugik:gminy")
    assert prg["liczba_rekordow"] == 2479 and "GUGiK" in prg["nazwa"] and prg["licencja"] and prg["obszar"] == "Polska"
