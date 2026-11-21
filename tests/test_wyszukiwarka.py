"""Place search: offline PRG part, parsing of GUGiK geocoder answers (mocked), /miejsca, gmina in /aed/punkty."""
from src.core import geocode


def test_norm():
    assert geocode.norm("  Łódź ") == "lodz" and geocode.norm("Kraków") == "krakow"


def test_offline_miasta_gminy_wojewodztwa():
    r = geocode.search("krak", online=False)
    assert r[0]["typ"] == "gmina" and r[0]["nazwa"] == "Kraków" and r[0]["teryt"] == "1261011"
    assert r[0]["bbox"][0] < 19.94 < r[0]["bbox"][2]
    assert geocode.search("lodz", online=False)[0]["nazwa"] == "Łódź"  # without Polish letters
    w = geocode.search("małopolskie", online=False)[0]
    assert w["typ"] == "wojewodztwo" and w["bbox"][1] < 50.0 < w["bbox"][3]
    chelm = [i for i in geocode.search("Chełm", online=False) if i["nazwa"] == "Chełm"]
    assert chelm[0]["rodzaj"] == "miejska" and chelm[1]["rodzaj"] == "wiejska"  # city first


def test_geokoder_gugik_parsowanie(monkeypatch):
    answers = {
        "Kraków, Floriańska": ("street", ({"street": "Floriańska", "city": "Kraków", "x": "19.9404", "y": "50.0636",
                                           "geometry_wkt": "LINESTRING(19.9391 50.0620,19.9413 50.0648)"},)),
        "Kraków, Floriańska 3": ("address", ({"street": "Floriańska", "number": "3", "city": "Kraków", "code": "31-019",
                                              "x": "19.9394", "y": "50.0622", "accuracy": "1"},
                                             {"street": "Ariańska", "number": "3", "city": "Kraków", "x": "19.9", "y": "50.1",
                                              "accuracy": "0.6"})),
        "Wieliczka": ("city", ({"city": "Wieliczka", "commune": "Wieliczka", "county": "wielicki", "voivodeship": "małopolskie",
                                "x": "20.04", "y": "49.98"},
                               {"city": "Wieliczka", "commune": "Skawina", "county": "krakowski", "voivodeship": "małopolskie",
                                "x": "19.67", "y": "49.95"})),
    }
    monkeypatch.setattr(geocode, "_uug", lambda a: answers.get(a, ("", ())))
    u = geocode.search("Kraków, Floriańska")
    assert u[0]["typ"] == "ulica" and u[0]["bbox"] == [19.9391, 50.062, 19.9413, 50.0648]
    a = geocode.search("Kraków, Floriańska 3")
    assert [i["nazwa"] for i in a] == ["Floriańska 3, Kraków"]  # the inexact "Ariańska 3" is dropped
    a2 = geocode.search("Kraków, Floriańska 999")  # no such number → the street
    assert a2[0]["typ"] == "ulica" and "999" in a2[0]["opis"]
    w = geocode.search("Wieliczka")
    assert [i["typ"] for i in w] == ["gmina", "miejscowosc"]  # town = gmina (with boundaries) + the village in Skawina
    assert "Skawina" in w[1]["opis"]
    # street name alone → searched in the gmina at the map centre (Kraków)
    s = geocode.search("Floriańska", blisko=(50.06, 19.94))
    assert s and s[0]["typ"] == "ulica" and "Kraków" in s[0]["opis"]


def test_api_miejsca_i_punkty(client):
    j = client.get("/api/v1/miejsca?q=pomorskie").json()["data"]
    assert j[0]["typ"] == "wojewodztwo" and j[0]["liczba_aed"] >= 1  # sample OSM record in Gdańsk, by location
    g = client.get("/api/v1/miejsca?q=Warszawa").json()["data"][0]
    assert g["typ"] == "gmina" and g["liczba_aed"] >= 3
    assert client.get("/api/v1/miejsca?q=krak&blisko=x").status_code == 422
    pts = client.get("/api/v1/aed/punkty").json()["features"]
    assert sum(1 for p in pts if p["properties"]["gmina_teryt"] == g["teryt"]) == g["liczba_aed"]
