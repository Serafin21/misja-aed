import csv
import io
import json
import xml.dom.minidom

from scripts.check_csv import check
from tests.conftest import ROOT


def test_list_and_paging(client):
    r = client.get("/api/v1/aed?per_page=3")
    j = r.json()
    assert r.status_code == 200 and j["meta"]["count"] == 7 and len(j["data"]) == 3
    assert j["links"]["next"] and j["links"]["prev"] is None
    assert j["data"][0]["type"] == "aed"


def test_filters(client):
    assert client.get("/api/v1/aed?wojewodztwo=małopolskie").json()["meta"]["count"] == 2
    assert client.get("/api/v1/aed?bbox=19.9,50.0,20.0,50.1").json()["meta"]["count"] == 2
    assert client.get("/api/v1/aed?warstwa=osm").json()["meta"]["count"] == 2


def test_nearest(client):
    j = client.get("/api/v1/aed/najblizsze?lat=52.2437&lon=21.0139&limit=2").json()
    assert j["data"][0]["id"] == "AED-PL-B939F7EBA4" and j["data"][0]["attributes"]["odleglosc_m"] == 0
    d = [x["attributes"]["odleglosc_m"] for x in j["data"]]
    assert d == sorted(d)


def test_private_never_available(client):
    j = client.get("/api/v1/aed/AED-PL-4AF9A8418D").json()
    assert j["data"]["meta"]["dostepny_teraz"] is False


def test_detail_with_provenance(client):
    j = client.get("/api/v1/aed/AED-PL-B939F7EBA4").json()
    kody = {p["kod_zrodla"] for p in j["data"]["meta"]["pochodzenie"]}
    assert kody == {"dysponent:gmina-przykladowo", "osm"}


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
    # re-import of the same owner file updates the existing records – no duplicates
    assert res["zaktualizowane"] == 3 and res["dodane"] == 0
    assert client.get("/api/v1/aed").json()["meta"]["count"] == 7


def test_auth(client, monkeypatch):
    assert client.post("/api/v1/aed", json={}, headers={"Authorization": "Bearer zly.token"}).status_code == 401
    from src.api import auth
    monkeypatch.setattr(auth, "AUTH_MODE", "wymagane")
    assert client.post("/api/v1/aed", json={}).status_code == 401


def test_ui_contract_shapes(client):
    """Shapes the UI (Model B) relies on: CR-B1, B2, B3, B4, B5, B9."""
    a = client.get("/api/v1/aed?per_page=1").json()["data"][0]["attributes"]
    assert "dostepny_teraz" in a
    d = client.get("/api/v1/aed/AED-PL-B939F7EBA4").json()
    assert d["pochodzenie"] and "liczba" in d["potwierdzenia"]
    z = client.post("/api/v1/zgloszenia", json={"lat": 52.24372, "lon": 21.01395, "opis": "AED w holu"}).json()
    assert z["status"] == "do_weryfikacji" and z["id"]
    lst = client.get("/api/v1/zgloszenia").json()["data"]
    assert lst[0]["type"] == "zgloszenie" and lst[0]["meta"]["mozliwy_duplikat"] == "AED-PL-B939F7EBA4"
    r = client.post(f"/api/v1/zgloszenia/{z['id']}/decyzja", json={"decyzja": "scal"}).json()
    assert r["data"]["status"] == "scalone"
    s = client.get("/api/v1/statystyki").json()["data"]
    assert {"liczba_aed", "liczba_dysponentow", "wg_wojewodztw", "wg_zrodel", "kompletnosc_rozklad", "zweryfikowane_12m_proc"} <= set(s)
    e = client.get("/api/v1/eksport").json()["data"]
    assert {"plik", "format", "licencja", "rozmiar_b", "opis"} <= set(e[0])
    m = client.get("/api/v1/miejsca?q=krak").json()["data"]
    assert m[0]["nazwa"] == "Kraków" and 50 < m[0]["lat"] < 50.1


def test_form_422(client, auth):
    r = client.post("/api/v1/aed", json={"nazwa_obiektu": "X"}, headers=auth)
    assert r.status_code == 422 and "kod_pocztowy" in r.json()["error"]["fields"]


def test_citizen_report_moderation(client):
    t = client.post("/api/v1/auth/login", json={"login": "moderator", "haslo": "moderator-demo"}).json()["token"]
    h = {"Authorization": f"Bearer {t}"}
    z = client.post("/api/v1/zgloszenia", json={"lat": 52.2401, "lon": 21.0203, "opis": "AED w aptece przy rynku, za ladą"}).json()
    zid = z["data"]["id"]
    assert client.get("/api/v1/aed").json()["meta"]["count"] == 7  # not in dataset before moderation
    r = client.post(f"/api/v1/zgloszenia/{zid}/decyzja", json={"decyzja": "zatwierdz"}, headers=h)
    assert r.status_code == 422  # missing address
    rek = {"nazwa_obiektu": "Apteka przy Rynku", "miejscowosc": "Warszawa", "numer_budynku": "1", "kod_pocztowy": "00-001",
           "ulica": "Rynek", "dostep": "ograniczony", "godziny_dostepnosci": "Mo-Sa 08:00-20:00",
           "dysponent_nazwa": "Apteka przy Rynku", "dysponent_typ": "handel_uslugi"}
    r = client.post(f"/api/v1/zgloszenia/{zid}/decyzja", json={"decyzja": "zatwierdz", "rekord": rek}, headers=h)
    assert r.status_code == 200
    assert client.get("/api/v1/aed").json()["meta"]["count"] == 8


def test_passport(client):
    r = client.post("/api/v1/aed/AED-PL-B939F7EBA4/potwierdzenia", json={"jest_na_miejscu": True, "szafka_dostepna": True})
    assert r.status_code == 201 and r.json()["data"]["liczba"] == 1


def test_exports_standard(client, tmp_path):
    for name in ["aed.csv", "aed_osm_odbl.csv", "aed_pochodzenie.csv", "zrodla.csv", "slownik_danych.csv"]:
        r = client.get(f"/api/v1/eksport/{name}")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        p = tmp_path / name
        p.write_bytes(r.content)
        hard = [e for e in check(str(p)) if not e.startswith("informacja")]
        assert hard == [], (name, hard)
    rows = list(csv.reader(io.StringIO(client.get("/api/v1/eksport/aed.csv").text, newline="")))
    from src.core import schema
    assert rows[0] == schema.field_order()
    assert all(r[schema.field_order().index("licencja")] != "ODbL-1.0" for r in rows[1:])
    gj = client.get("/api/v1/eksport/aed.geojson").json()
    assert gj["type"] == "FeatureCollection" and len(gj["features"]) == 5
    xml.dom.minidom.parseString(client.get("/api/v1/eksport/dane_gov_pl_import.xml").content)
    meta = json.loads(client.get("/api/v1/eksport/metadane.jsonld").content)
    assert meta["@type"] == "dcat:Dataset" and {t["@language"] for t in meta["dct:title"]} == {"pl", "en"}


def test_template(client):
    assert client.get("/api/v1/szablon.csv").content.startswith(b"id_dysponenta_aed,")
    assert client.get("/api/v1/szablon.xlsx").content[:2] == b"PK"
