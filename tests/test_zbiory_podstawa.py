"""CR-TL-5 (GET /zbiory, transitional datasets, meta.zgodnosc) and CR-TL-6 (meta.dostawca_podstawa)."""


def _login(client, login, haslo):
    return {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'login': login, 'haslo': haslo}).json()['token']}"}


def test_zbiory_statusy(client):
    j = client.get("/api/v1/zbiory").json()  # public
    by = {z["zbior_id"]: z for z in j["data"]}
    assert by["990001"]["status"] == "wzorzec" and by["990001"]["rekordy"] == 3
    assert by["990002"]["status"] == "wzorzec" and by["990002"]["nieaktualny"] is True
    assert by["990003"]["status"] == "wzorzec" and by["990003"]["rekordy"] == 2 and any("nie trafiło" in p for p in by["990003"]["problemy"])
    assert by["990004"]["status"] == "przejsciowy" and by["990004"]["rekordy"] == 3  # 1 of 4 rows without coordinates
    assert by["990005"]["status"] == "poza_lista" and by["990005"]["rekordy"] == 0 and by["990005"]["problemy"]
    assert [z["status"] for z in j["data"]] == sorted([z["status"] for z in j["data"]], key=["wzorzec", "przejsciowy", "poza_lista"].index)
    assert j["meta"]["warstwa_pomocnicza"] == {"zrodlo": "OpenStreetMap", "licencja": "ODbL-1.0", "obiekty": 3}
    assert set(j["data"][0]) >= {"zbior_id", "tytul", "dostawca", "zbior_url", "status", "nieaktualny", "rekordy", "data_danych", "licencja", "problemy"}


def test_zgodnosc_w_rekordach_i_punktach(client):
    pts = client.get("/api/v1/aed/punkty?warstwa=lista").json()["features"]
    zg = {}
    for f in pts:
        zg[f["properties"]["zgodnosc"]] = zg.get(f["properties"]["zgodnosc"], 0) + 1
    assert zg == {"wzorzec": 7, "przejsciowy": 3}
    osm = client.get("/api/v1/aed/punkty?warstwa=pomocnicza").json()["features"][0]["properties"]
    assert osm["zgodnosc"] is None
    pid = next(f["id"] for f in pts if f["properties"]["zgodnosc"] == "przejsciowy")
    m = client.get(f"/api/v1/aed/{pid}").json()["data"]["meta"]
    assert m["zgodnosc"] == "przejsciowy" and m["dostawca"] == "Gmina Przykładowa Druga" and m["warstwa"] == "lista"
    # transitional records are shown as published (only read into the field format): no hours invented, no access data
    a = client.get(f"/api/v1/aed/{pid}").json()["data"]["attributes"]
    assert a["godziny_dostepnosci"] != "24/7" and a["dostepny_24h"] is False and a["dysponent_nazwa"] == "Gmina Przykładowa Druga"
    assert a["kod_pocztowy"] and a["data_weryfikacji"] == "2026-03-10"


def test_podstawa_publikacji(client):
    m = client.get("/api/v1/aed/AED-PL-B939F7EBA4").json()["data"]["meta"]
    assert m["dostawca_podstawa"] == "wlasciciel"  # no account: template requires dysponent = provider
    adm = _login(client, "administrator", "administrator-demo")
    base = {"login": "ug.przykladowo", "dysponent_nazwa": "Urząd Gminy Przykładowo"}
    assert client.post("/api/v1/konta", headers=adm, json=base).status_code == 422  # basis required for a provider
    r = client.post("/api/v1/konta", headers=adm, json=base | {"dostawca_podstawa": "zarzadca"})
    assert r.status_code == 201 and r.json()["data"]["dostawca_podstawa"] == "zarzadca"
    assert client.get("/api/v1/konta", headers=adm).json()["data"][0]["dostawca_podstawa"] == "zarzadca"
    assert client.get("/api/v1/aed/AED-PL-B939F7EBA4").json()["data"]["meta"]["dostawca_podstawa"] == "zarzadca"
    assert client.post("/api/v1/konta", headers=adm, json=base | {"login": "x.y.z", "dostawca_podstawa": "nie_wiem"}).status_code == 422
