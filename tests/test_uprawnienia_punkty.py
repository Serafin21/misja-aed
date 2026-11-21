"""TL decisions: provider decides reports only for its own AED; GET /aed/punkty (GeoJSON, gzip, ETag)."""
import gzip
import json

import pytest

OWN = "AED-PL-B939F7EBA4"     # Urząd Gminy Przykładowo (= demo provider account)
FOREIGN = "AED-PL-AED495CA3B"  # Uczelnia Testowa


def _login(client, who):
    t = client.post("/api/v1/auth/login", json={"login": who, "haslo": f"{who}-demo"}).json()["token"]
    return {"Authorization": f"Bearer {t}"}


def _report_at(client, id_aed):
    a = client.get(f"/api/v1/aed/{id_aed}").json()["data"]["attributes"]
    return client.post("/api/v1/zgloszenia", json={"lat": a["szerokosc_geograficzna"], "lon": a["dlugosc_geograficzna"],
                                                   "opis": "AED jest na miejscu"}).json()["id"]


@pytest.fixture()
def dysp(client):
    return _login(client, "dysponent")


@pytest.fixture()
def mod(client):
    return _login(client, "moderator")


def test_dysponent_widzi_tylko_zgloszenia_swoich_aed(client, dysp, mod):
    own, foreign = _report_at(client, OWN), _report_at(client, FOREIGN)
    ids = {i["id"] for i in client.get("/api/v1/zgloszenia", headers=dysp).json()["data"]}
    assert own in ids and foreign not in ids
    ids_mod = {i["id"] for i in client.get("/api/v1/zgloszenia", headers=mod).json()["data"]}
    assert {own, foreign} <= ids_mod


def test_dysponent_scala_swoje_ale_nie_cudze(client, dysp):
    own, foreign = _report_at(client, OWN), _report_at(client, FOREIGN)
    r = client.post(f"/api/v1/zgloszenia/{foreign}/decyzja", headers=dysp, json={"decyzja": "odrzuc"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "brak_uprawnien"
    r = client.post(f"/api/v1/zgloszenia/{foreign}/decyzja", headers=dysp, json={"decyzja": "scal", "id_aed_docelowy": OWN})
    assert r.status_code == 200  # pointing at its own AED is allowed
    r = client.post(f"/api/v1/zgloszenia/{own}/decyzja", headers=dysp, json={"decyzja": "scal"})
    assert r.status_code == 200 and r.json()["meta"]["id_aed"] == OWN and r.json()["data"]["decyzje_podjal"] == "dysponent"


def test_dysponent_zatwierdza_tylko_jako_swoj(client, dysp, mod):
    zid = client.post("/api/v1/zgloszenia", json={"lat": 52.3, "lon": 21.1, "opis": "nowy AED w urzędzie"}).json()["id"]
    rekord = {"nazwa_obiektu": "Urząd – sala obsługi", "wojewodztwo": "mazowieckie", "gmina": "Warszawa",
              "miejscowosc": "Warszawa", "ulica": "Testowa", "numer_budynku": "1", "kod_pocztowy": "00-001",
              "godziny_dostepnosci": "Mo-Fr 08:00-16:00", "dostep": "publiczny", "dysponent_typ": "administracja_publiczna",
              "status_urzadzenia": "sprawny"}
    r = client.post(f"/api/v1/zgloszenia/{zid}/decyzja", headers=dysp,
                    json={"decyzja": "zatwierdz", "rekord": rekord | {"dysponent_nazwa": "Ktoś inny"}})
    assert r.status_code == 403
    r = client.post(f"/api/v1/zgloszenia/{zid}/decyzja", headers=dysp, json={"decyzja": "zatwierdz", "rekord": rekord})
    assert r.status_code == 200, r.json()
    assert client.get(f"/api/v1/aed/{r.json()['meta']['id_aed']}").json()["data"]["attributes"]["dysponent_nazwa"] == "Urząd Gminy Przykładowo"


def test_moderator_rozpatruje_kazde(client, mod):
    foreign = _report_at(client, FOREIGN)
    assert client.post(f"/api/v1/zgloszenia/{foreign}/decyzja", headers=mod, json={"decyzja": "odrzuc"}).status_code == 200


def test_punkty_ksztalt(client):
    r = client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "identity"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/geo+json")
    fc = r.json()
    assert fc["type"] == "FeatureCollection" and fc["meta"]["count"] == len(fc["features"]) == 7
    f = fc["features"][0]
    assert set(f) == {"type", "id", "geometry", "properties"} and f["geometry"]["type"] == "Point"
    assert set(f["properties"]) == {"dostepny_teraz", "stan_danych", "osm", "dostep", "wiek_danych_dni", "mobilny", "wojewodztwo", "gmina_teryt"}
    assert any(x["properties"]["dostep"] == "prywatny" for x in fc["features"])
    assert sum(x["properties"]["osm"] for x in fc["features"]) == 2


def test_punkty_bbox(client):
    fc = client.get("/api/v1/aed/punkty?bbox=19.9,50.0,20.0,50.1").json()
    assert fc["meta"]["count"] == 2
    assert client.get("/api/v1/aed/punkty?bbox=1,2,3").status_code == 422


def test_punkty_gzip_i_etag(client):
    r = client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip" and "Accept-Encoding" in r.headers["vary"]
    etag = r.headers["etag"]
    assert json.loads(r.content if r.content[:1] == b"{" else gzip.decompress(r.content))["meta"]["count"] == 7
    r304 = client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip", "If-None-Match": etag})
    assert r304.status_code == 304 and not r304.content
    # a change that affects the points (stan_danych) changes the ETag; others (e.g. uwagi) keep it
    client.patch(f"/api/v1/aed/{OWN}", json={"uwagi": "zmiana"})
    assert client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip", "If-None-Match": etag}).status_code == 304
    assert client.patch(f"/api/v1/aed/{OWN}", json={"data_weryfikacji": "2020-01-01"}).status_code == 200
    assert client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip", "If-None-Match": etag}).status_code == 200


def test_aed_po_ids_w_kolejnosci(client):
    j = client.get(f"/api/v1/aed?ids={FOREIGN},{OWN},NIE-MA").json()
    assert [d["id"] for d in j["data"]] == [FOREIGN, OWN] and j["meta"]["count"] == 2
    assert client.get("/api/v1/aed?ids=" + ",".join(f"X{i}" for i in range(201))).status_code == 422


def test_filtr_wojewodztwa_po_polozeniu(client):
    # OSM sample record in Gdańsk has no "wojewodztwo" field – found by location
    ids = {d["id"] for d in client.get("/api/v1/aed?wojewodztwo=pomorskie").json()["data"]}
    assert "AED-PL-9778083B54" in ids
