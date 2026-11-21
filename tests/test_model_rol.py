"""Acceptance criteria K1–K11 of the role model (docs/MODEL_ROL.md §12). K12 (WCAG) is checked in the UI (docs/a11y)."""
import csv
import io
import zipfile

import pytest

UGP = "AED-PL-B939F7EBA4"      # Urząd Gminy Przykładowo (= demo provider account "dysponent")
UCZ = "AED-PL-AED495CA3B"      # Uczelnia Testowa
MPK_DUP = "AED-PL-0000C00001"  # MPK Przykładowo – 12 m from UCZ
MPK_OLD = "AED-PL-0000C00002"  # MPK – verified > 12 months ago


def _login(client, login, haslo):
    t = client.post("/api/v1/auth/login", json={"login": login, "haslo": haslo}).json()["token"]
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture()
def dysp(client):
    return _login(client, "dysponent", "dysponent-demo")


@pytest.fixture()
def admin(client):
    return _login(client, "administrator", "administrator-demo")


def test_k1_dysponent_nie_zmieni_cudzego_rekordu(client, dysp):
    assert client.patch(f"/api/v1/aed/{UCZ}", json={"uwagi": "x"}, headers=dysp).status_code == 403
    r = client.patch(f"/api/v1/aed/{UGP}", json={"uwagi": "nowa szafka"}, headers=dysp)
    assert r.status_code == 200 and r.json()["data"]["attributes"]["uwagi"] == "nowa szafka"
    # its own change lives in the working copy; the list still shows the published data
    assert client.get(f"/api/v1/aed/{UGP}").json()["data"]["attributes"]["uwagi"] is None


def test_k2_administrator_bez_zapisu_do_aed(client, admin):
    assert client.patch(f"/api/v1/aed/{UGP}", json={"uwagi": "x"}, headers=admin).status_code == 403
    assert client.post("/api/v1/aed", json={"nazwa_obiektu": "X"}, headers=admin).status_code == 403
    f = b"nazwa;lat;lon\nA;52.2;21.0\n"
    assert client.post("/api/v1/import", files={"plik": ("a.csv", f, "text/csv")}, headers=admin,
                       data={"kod_zrodla": "x", "licencja": "CC0-1.0"}).status_code == 403
    assert client.post("/api/v1/zrodla/dane-gov-pl/szukaj", json={"q": "aed", "importuj": True}, headers=admin).status_code == 422
    # no API route lets anyone write to the list directly: every write route is either the wizard or 403
    from src.api.main import app
    writes = {(r.path, m) for r in app.routes for m in getattr(r, "methods", set()) if m in ("POST", "PATCH", "PUT", "DELETE")}
    assert not any(p.startswith("/api/v1/lista") for p, _ in writes)


def _pakiet(client, dysp):
    client.post("/api/v1/moje-aed/z-opublikowanego", headers=dysp)
    r = client.post("/api/v1/moje-aed/pakiet", headers=dysp, json={"czestotliwosc": "monthly", "csv_url": "https://gmina.example/aed.csv",
                                                                  "email": "aed@przykladowo.example"})
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(r.content))


def test_k3_pliki_dostawcy_zgodne_z_xsd(client, dysp):
    etree = pytest.importorskip("lxml.etree")
    from tests.conftest import ROOT
    z = _pakiet(client, dysp)
    names = set(z.namelist())
    assert {"aed_harvester.xml", "metadane.json", "INSTRUKCJA.txt"} <= names
    xml = z.read("aed_harvester.xml")
    xsd = etree.XMLSchema(etree.parse(str(ROOT / "docs" / "tech" / "otwarte_dane_1_13.xsd")))
    doc = etree.fromstring(xml)
    assert xsd.validate(etree.ElementTree(doc)), xsd.error_log
    txt = xml.decode()
    assert "<responsibilities>" in txt and "<terytIdent>1465011</terytIdent>" in txt and "<updateFrequency>monthly</updateFrequency>" in txt
    assert "wspolna-lista-aed" in txt
    assert all(u.startswith("https://") for u in doc.xpath("//url/text()"))
    rows = list(csv.DictReader(io.StringIO(z.read(next(n for n in names if n.endswith(".csv") and n.startswith("aed-"))).decode())))
    from src.core import schema
    assert len(rows) == 3 and list(rows[0]) == schema.field_order() and all(r["teryt_terc"] == "1465011" for r in rows)


def test_k4_kazdy_rekord_wskazuje_zrodlo(client):
    for d in client.get("/api/v1/aed?per_page=100").json()["data"]:
        m = d["meta"]
        assert m["warstwa"] == "lista" and m["dostawca"] and m["zbior_url"].startswith("https://") and m["data_danych"]


def test_k5_lista_bez_osm(client):
    rows = list(csv.DictReader(io.StringIO(client.get("/api/v1/eksport/aed.csv").text)))
    assert rows and all(r["zrodlo_danych"] != "osm" and r["licencja"] != "ODbL-1.0" and r["dostawca"] for r in rows)
    assert all(d["meta"]["warstwa"] == "lista" for d in client.get("/api/v1/aed?per_page=100").json()["data"])
    pom = client.get("/api/v1/aed?warstwa=pomocnicza").json()["data"]
    assert pom and all(d["meta"]["warstwa"] == "pomocnicza" and "OpenStreetMap" in d["meta"]["atrybucja"] for d in pom)


def test_k6_duplikaty_nie_sa_scalane(client):
    a = client.get(f"/api/v1/aed/{UCZ}").json()["data"]
    b = client.get(f"/api/v1/aed/{MPK_DUP}").json()["data"]
    assert a["meta"]["dostawca"] != b["meta"]["dostawca"]  # both visible, each with its own provider
    assert MPK_DUP in a["meta"]["mozliwe_duplikaty"] and UCZ in b["meta"]["mozliwe_duplikaty"]
    from src.core import dziennik
    assert any(p["typ"] == "duplikat" for p in dziennik.powiadomienia("Uczelnia Testowa"))
    assert any(p["typ"] == "duplikat" for p in dziennik.powiadomienia("MPK Przykładowo sp. z o.o."))


def test_k7_zgloszenie_do_dostawcy_bez_zmiany_danych(client, dysp):
    before = client.get(f"/api/v1/aed/{UGP}").json()["data"]["attributes"]
    z = client.post("/api/v1/zgloszenia", json={"lat": 52.24, "lon": 21.01, "opis": "Szafka zamknięta, dzwonić 600 700 800 albo a@b.pl",
                                                "id_aed": UGP, "typ": "brak_dostepu", "email": "mieszkaniec@example.org"}).json()
    assert z["data"]["dostawca"] == "Urząd Gminy Przykładowo" and "[telefon usunięty]" in z["data"]["opis"] and "[e-mail usunięty]" in z["data"]["opis"]
    q = client.get("/api/v1/zgloszenia", headers=dysp).json()["data"]
    assert z["id"] in {i["id"] for i in q} and "email" not in q[0]["attributes"]
    r = client.post(f"/api/v1/zgloszenia/{z['id']}/decyzja", json={"decyzja": "przyjete"}, headers=dysp)
    assert r.status_code == 200
    assert client.get(f"/api/v1/aed/{UGP}").json()["data"]["attributes"] == before
    from src.core import db
    from src.core.store import get_store
    row = get_store().conn.execute("SELECT data FROM zgloszenia WHERE id=?", (z["id"],)).fetchone()
    assert "email" not in db.loads(row["data"])  # RODO: deleted when closed
    # another provider cannot see or decide it
    other = client.post("/api/v1/zgloszenia", json={"lat": 50.06, "lon": 19.91, "opis": "brak AED", "id_aed": UCZ, "typ": "brak"}).json()
    assert client.post(f"/api/v1/zgloszenia/{other['id']}/decyzja", json={"decyzja": "przyjete"}, headers=dysp).status_code == 403


def test_k8_aed_bez_dostawcy_do_administratora(client, admin, dysp):
    n = client.get("/api/v1/aed").json()["meta"]["count"]
    z = client.post("/api/v1/zgloszenia", json={"lat": 52.30, "lon": 21.05, "opis": "AED w sklepie przy rondzie", "typ": "nowe"}).json()
    assert "administrator" in z["meta"]["trafia_do"]
    assert z["id"] in {i["id"] for i in client.get("/api/v1/zgloszenia", headers=admin).json()["data"]}
    assert z["id"] not in {i["id"] for i in client.get("/api/v1/zgloszenia", headers=dysp).json()["data"]}
    assert client.post(f"/api/v1/zgloszenia/{z['id']}/decyzja", json={"decyzja": "zatwierdz"}, headers=admin).status_code == 422
    assert client.post(f"/api/v1/zgloszenia/{z['id']}/decyzja", json={"decyzja": "zaproszenie"}, headers=admin).status_code == 200
    assert client.get("/api/v1/aed").json()["meta"]["count"] == n  # never on the list


def test_k9_zbior_nieaktualny_i_rekord_do_weryfikacji(client):
    ucz = client.get(f"/api/v1/aed/{UCZ}").json()["data"]["meta"]
    assert ucz["zbior_nieaktualny"] is True and ucz["stan_danych"] == "aktualne"  # fresh record in an outdated dataset
    old = client.get(f"/api/v1/aed/{MPK_OLD}").json()["data"]["meta"]
    assert old["zbior_nieaktualny"] is False and old["stan_danych"] == "nieaktualne"  # record to verify in an up-to-date dataset
    pts = {f["id"]: f["properties"] for f in client.get("/api/v1/aed/punkty").json()["features"]}
    assert pts[UCZ]["zbior_nieaktualny"] and not pts[MPK_OLD]["zbior_nieaktualny"] and pts[MPK_OLD]["stan_danych"] == "nieaktualne"
    from src.core.dostawcy import dataset_nieaktualny
    from datetime import date
    assert not dataset_nieaktualny("2026-10-01", "monthly", date(2026, 11, 30))       # 31 + 30 days not yet passed
    assert dataset_nieaktualny("2026-09-01", "monthly", date(2026, 11, 30))


def test_k10_dziennik_zdarzen(client, dysp, admin):
    client.patch(f"/api/v1/aed/{UGP}", json={"uwagi": "przegląd 2026"}, headers=dysp)
    log = client.get(f"/api/v1/dziennik?obiekt={UGP}", headers=admin).json()["data"]
    e = log[0]
    assert e["kto"] == "dysponent" and e["operacja"] == "kreator:zmien" and e["czas"]
    assert e["przed"]["uwagi"] is None and e["po"]["uwagi"] == "przegląd 2026"
    assert client.get("/api/v1/dziennik", headers=dysp).status_code == 403
    from src.core.store import get_store
    import sqlite3
    with pytest.raises(sqlite3.DatabaseError):
        get_store().conn.execute("UPDATE dziennik SET kto='ktos'")
    with pytest.raises(sqlite3.DatabaseError):
        get_store().conn.execute("DELETE FROM dziennik")


def test_k11_kreator_konczy_sie_pobraniem(client, dysp):
    from src.api.main import app
    paths = {r.path for r in app.routes}
    assert "/api/v1/moje-aed/pakiet" in paths
    assert not any("opublikuj" in p or "publikuj" in p for p in paths)
    z = _pakiet(client, dysp)
    assert "Publikujecie je SAMI" in z.read("INSTRUKCJA.txt").decode()


def test_agregacja_odrzuca_rekord_niezgodny_i_raportuje(client, admin):
    r = client.post("/api/v1/admin/agregacja", headers=admin).json()["data"]
    mpk = next(z for z in r["zbiory"] if z["dostawca"] == "MPK Przykładowo sp. z o.o.")
    assert mpk["wlaczone"] == 2 and mpk["odrzucone"] == 1 and "szerokosc_geograficzna" in mpk["problemy_rekordow"][0]["problemy"][0]
    assert client.get("/api/v1/aed/AED-PL-0000C00003").status_code == 404
    from src.core import dziennik
    assert any(p["typ"] == "walidacja" for p in dziennik.powiadomienia("MPK Przykładowo sp. z o.o."))


def test_luki_i_mierniki(client, admin):
    j = client.get("/api/v1/admin/luki?wojewodztwo=pomorskie", headers=admin).json()
    gd = next(g for g in j["data"] if g["gmina"] == "Gdańsk")
    assert gd["do_sprawdzenia"] >= 1  # OSM points show where to send the campaign
    s = client.get("/api/v1/statystyki").json()["data"]
    assert s["liczba_dostawcow"] == 3 and s["liczba_aed"] == 7 and s["warstwa_pomocnicza"] == 3 and s["zbiory_nieaktualne"] == 1
    assert 0 < s["gminy_z_dostawca_proc"] < 1


def test_kreator_dodaje_tylko_wlasne_i_uzupelnia_teryt(client, dysp):
    rec = {"nazwa_obiektu": "Biblioteka gminna", "opis_lokalizacji": "hol, przy szatni", "wewnatrz_budynku": True,
           "miejscowosc": "Warszawa", "ulica": "Testowa", "numer_budynku": "5", "kod_pocztowy": "00-001",
           "szerokosc_geograficzna": 52.2297, "dlugosc_geograficzna": 21.0122, "dostep": "publiczny",
           "godziny_dostepnosci": "Mo-Fr 08:00-18:00", "szafka_zamknieta": False, "mobilny": False, "status_urzadzenia": "sprawny",
           "dysponent_typ": "administracja_publiczna", "dysponent_nazwa": "Ktoś Inny", "licencja": "CC0-1.0",
           "metoda_weryfikacji": "wizja_lokalna"}
    r = client.post("/api/v1/aed", json=rec, headers=dysp)
    assert r.status_code == 201, r.json()
    a = r.json()["data"]
    assert a["attributes"]["dysponent_nazwa"] == "Urząd Gminy Przykładowo" and a["attributes"]["teryt_terc"] == "1465011"
    assert a["meta"]["zgodny_ze_wzorcem"], a["meta"]["problemy"]
    assert client.delete(f"/api/v1/moje-aed/{a['id']}", headers=dysp).status_code == 200
