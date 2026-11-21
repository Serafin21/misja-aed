"""GET /aed/punkty (GeoJSON, gzip, ETag), /aed?ids, area filter. Roles and permissions: tests/test_model_rol.py."""
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


def test_punkty_ksztalt(client):
    r = client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "identity"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/geo+json")
    fc = r.json()
    assert fc["type"] == "FeatureCollection" and fc["meta"]["count"] == len(fc["features"]) == 13  # list 10 + helper 3
    f = fc["features"][0]
    assert set(f) == {"type", "id", "geometry", "properties"} and f["geometry"]["type"] == "Point"
    assert set(f["properties"]) >= {"dostepny_teraz", "stan_danych", "osm", "warstwa", "zbior_nieaktualny", "duplikat", "dostep",
                                    "wiek_danych_dni", "mobilny", "wojewodztwo", "gmina_teryt"}
    assert any(x["properties"]["dostep"] == "prywatny" for x in fc["features"])
    assert sum(x["properties"]["warstwa"] == "pomocnicza" for x in fc["features"]) == 3
    assert client.get("/api/v1/aed/punkty?warstwa=lista").json()["meta"]["count"] == 10


def test_punkty_bbox(client):
    fc = client.get("/api/v1/aed/punkty?bbox=19.9,50.0,20.0,50.1").json()
    assert fc["meta"]["count"] == 4
    assert client.get("/api/v1/aed/punkty?bbox=1,2,3").status_code == 422


def test_punkty_gzip_i_etag(client):
    r = client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip" and "Accept-Encoding" in r.headers["vary"]
    etag = r.headers["etag"]
    assert json.loads(r.content if r.content[:1] == b"{" else gzip.decompress(r.content))["meta"]["count"] == 13
    r304 = client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip", "If-None-Match": etag})
    assert r304.status_code == 304 and not r304.content
    # a change that affects the points (stan_danych) changes the ETag; others (e.g. uwagi) keep it
    from src.core.store import get_store
    st = get_store()
    items = [(dict(st.records[i]), dict(p)) for i, p in st.lista.items()]
    items[0][0]["uwagi"] = "zmiana bez wpływu na mapę"
    st.replace_list(items)  # new aggregation, same points
    assert client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip", "If-None-Match": etag}).status_code == 304
    items[0][0]["data_weryfikacji"] = "2020-01-01" if items[0][0]["data_weryfikacji"] != "2020-01-01" else "2026-11-20"
    st.replace_list(items)
    assert client.get("/api/v1/aed/punkty", headers={"Accept-Encoding": "gzip", "If-None-Match": etag}).status_code == 200


def test_aed_po_ids_w_kolejnosci(client):
    j = client.get(f"/api/v1/aed?ids={FOREIGN},{OWN},NIE-MA").json()
    assert [d["id"] for d in j["data"]] == [FOREIGN, OWN] and j["meta"]["count"] == 2
    assert client.get("/api/v1/aed?ids=" + ",".join(f"X{i}" for i in range(201))).status_code == 422


def test_filtr_wojewodztwa_po_polozeniu(client):
    # OSM sample record in Gdańsk has no "wojewodztwo" field – found by location
    ids = {d["id"] for d in client.get("/api/v1/aed?wojewodztwo=pomorskie&warstwa=wszystkie").json()["data"]}
    assert "AED-PL-9778083B54" in ids
