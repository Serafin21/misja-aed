import csv
import io

from scripts.check_csv import check
from tests.conftest import ROOT


def test_list_and_paging(client):
    r = client.get("/api/v1/aed?per_page=3")
    j = r.json()
    assert r.status_code == 200 and j["meta"]["count"] == 7 and len(j["data"]) == 3
    assert j["links"]["next"] and j["links"]["prev"] is None
    assert j["data"][0]["type"] == "aed"


def test_filters(client):
    # list: Uczelnia Testowa 2 + MPK 2 (Kraków), Urząd Gminy Przykładowo 3 (Warszawa)
    assert client.get("/api/v1/aed?wojewodztwo=małopolskie").json()["meta"]["count"] == 4
    assert client.get("/api/v1/aed?bbox=19.9,50.0,20.0,50.1").json()["meta"]["count"] == 4
    assert client.get("/api/v1/aed?warstwa=pomocnicza").json()["meta"]["count"] == 3
    assert client.get("/api/v1/aed?warstwa=wszystkie").json()["meta"]["count"] == 10


def test_nearest(client):
    j = client.get("/api/v1/aed/najblizsze?lat=52.2437&lon=21.0139&limit=2").json()
    assert j["data"][0]["id"] == "AED-PL-B939F7EBA4" and j["data"][0]["attributes"]["odleglosc_m"] == 0
    d = [x["attributes"]["odleglosc_m"] for x in j["data"]]
    assert d == sorted(d)


def test_private_never_available(client):
    j = client.get("/api/v1/aed/AED-PL-4AF9A8418D").json()
    assert j["data"]["meta"]["dostepny_teraz"] is False


def test_detail_with_provenance(client):
    """K4: every record of the list shows its provider, dataset and resource links and the data date."""
    m = client.get("/api/v1/aed/AED-PL-B939F7EBA4").json()["data"]["meta"]
    assert m["warstwa"] == "lista" and m["dostawca"] == "Urząd Gminy Przykładowo"
    assert m["zbior_url"].startswith("https://dane.gov.pl/") and m["zasob_url"].startswith("https://") and m["data_danych"]


def test_import_flow(client, auth):
    f = (ROOT / "data/sample/zrodlo_gmina_przyklad.csv").read_bytes()
    r = client.post("/api/v1/import", files={"plik": ("g.csv", f, "text/csv")}, headers=auth,
                    data={"kod_zrodla": "dysponent:gmina-przykladowo", "licencja": "CC0-1.0",
                          "dysponent_nazwa": "Urząd Gminy Przykładowo", "dysponent_typ": "administracja_publiczna",
                          "status_urzadzenia": "sprawny"})
    assert r.status_code == 200
    iid = r.json()["import_id"]
    rep = client.post(f"/api/v1/import/{iid}/mapowanie", json={}, headers=auth).json()
    assert rep["wiersze"] == 3 and rep["bledy"] == 0
    res = client.post(f"/api/v1/import/{iid}/zatwierdz", headers=auth).json()
    # goes to the provider's working copy – the common list does not change until the files are published (P2, P3)
    assert res["dodane"] == 3 and "kopii roboczej" in res["komunikat"]
    assert client.get("/api/v1/aed").json()["meta"]["count"] == 7
    assert client.get("/api/v1/moje-aed", headers=auth).json()["meta"]["w_kopii_roboczej"] == 3


def test_auth(client):
    assert client.post("/api/v1/aed", json={}, headers={"Authorization": "Bearer zly.token"}).status_code == 401
    assert client.post("/api/v1/aed", json={}).status_code == 401  # §9: every write needs a logged-in user


def test_ui_contract_shapes(client):
    """Shapes the UI (Model B) relies on: CR-B1, B2, B3, B4, B5, B9."""
    a = client.get("/api/v1/aed?per_page=1").json()["data"][0]["attributes"]
    assert "dostepny_teraz" in a
    d = client.get("/api/v1/aed/AED-PL-B939F7EBA4").json()
    assert d["pochodzenie"] and "liczba" in d["potwierdzenia"]
    z = client.post("/api/v1/zgloszenia", json={"lat": 52.24372, "lon": 21.01395, "opis": "AED w holu", "id_aed": "AED-PL-B939F7EBA4", "typ": "awaria"}).json()
    assert z["status"] == "do_weryfikacji" and z["id"] and z["data"]["dostawca"] == "Urząd Gminy Przykładowo"
    s = client.get("/api/v1/statystyki").json()["data"]
    assert {"liczba_aed", "liczba_dysponentow", "wg_wojewodztw", "wg_zrodel", "kompletnosc_rozklad", "zweryfikowane_12m_proc"} <= set(s)
    e = client.get("/api/v1/eksport").json()["data"]
    assert {"plik", "format", "licencja", "rozmiar_b", "opis"} <= set(e[0])
    m = client.get("/api/v1/miejsca?q=krak").json()["data"]
    assert m[0]["nazwa"] == "Kraków" and 50 < m[0]["lat"] < 50.1


def test_form_422(client, auth):  # the wizard validates against the standard
    r = client.post("/api/v1/aed", json={"nazwa_obiektu": "X"}, headers=auth)
    assert r.status_code == 422 and "kod_pocztowy" in r.json()["error"]["fields"]


def test_passport(client):
    r = client.post("/api/v1/aed/AED-PL-B939F7EBA4/potwierdzenia", json={"jest_na_miejscu": True, "szafka_dostepna": True})
    assert r.status_code == 201 and r.json()["data"]["liczba"] == 1


def test_exports_standard(client, tmp_path):
    for name in ["aed.csv", "aed_pochodzenie.csv", "zrodla.csv", "slownik_danych.csv"]:
        r = client.get(f"/api/v1/eksport/{name}")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        p = tmp_path / name
        p.write_bytes(r.content)
        hard = [e for e in check(str(p)) if not e.startswith("informacja")]
        assert hard == [], (name, hard)
    rows = list(csv.reader(io.StringIO(client.get("/api/v1/eksport/aed.csv").text, newline="")))
    from src.core import schema
    from src.core.publish import PROV_COLS
    assert rows[0] == schema.field_order() + PROV_COLS  # compilation: every record carries its provider and dataset (§7)
    assert len(rows) == 8 and all(r[schema.field_order().index("licencja")] != "ODbL-1.0" for r in rows[1:])
    gj = client.get("/api/v1/eksport/aed.geojson").json()
    assert gj["type"] == "FeatureCollection" and len(gj["features"]) == 7 and "Kompilacja" in gj["description"]
    for gone in ("aed_osm_odbl.csv", "dane_gov_pl_import.xml", "metadane.jsonld"):  # the list is not a dataset of its own
        assert client.get(f"/api/v1/eksport/{gone}").status_code == 404


def test_template(client):
    assert client.get("/api/v1/szablon.csv").content.startswith(b"id_dysponenta_aed,")
    assert client.get("/api/v1/szablon.xlsx").content[:2] == b"PK"
