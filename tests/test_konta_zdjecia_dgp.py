"""Accounts of institutions, report photos, background refresh, cleaning of real dane.gov.pl files."""
import base64

from src.core.connectors import dane_gov_pl as dgp

JPEG = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 200 + b"\xff\xd9").decode()


def _login(client, login, haslo):
    r = client.post("/api/v1/auth/login", json={"login": login, "haslo": haslo})
    return r, {"Authorization": f"Bearer {r.json().get('token', '')}"}


def test_konto_instytucji_pelny_cykl(client):
    _, mod = _login(client, "moderator", "moderator-demo")
    r = client.post("/api/v1/konta", headers=mod, json={"login": "uczelnia.testowa", "dysponent_nazwa": "Uczelnia Testowa"})
    assert r.status_code == 201
    haslo = r.json()["haslo_jednorazowe"]
    assert r.json()["data"]["liczba_aed"] == 2 and "haslo" not in r.json()["data"]  # its AED on the common list
    assert client.post("/api/v1/konta", headers=mod, json={"login": "uczelnia.testowa", "dysponent_nazwa": "Xyz"}).status_code == 409
    assert client.post("/api/v1/konta", headers=mod, json={"login": "Zły Login!", "dysponent_nazwa": "Xyz"}).status_code == 422
    r, uh = _login(client, "uczelnia.testowa", haslo)
    assert r.status_code == 200 and r.json()["rola"] == "dysponent" and r.json()["dysponent_nazwa"] == "Uczelnia Testowa"
    assert _login(client, "uczelnia.testowa", "zle-haslo")[0].status_code == 401
    assert client.get("/api/v1/konta/ja", headers=uh).json()["data"]["dysponent_nazwa"] == "Uczelnia Testowa"
    assert client.get("/api/v1/konta", headers=uh).status_code == 403  # only the moderator manages accounts
    # the institution handles reports about ITS AED (Uczelnia Testowa: AED-PL-AED495CA3B), not the gmina's
    a = client.get("/api/v1/aed/AED-PL-AED495CA3B").json()["data"]["attributes"]
    zid = client.post("/api/v1/zgloszenia", json={"lat": a["szerokosc_geograficzna"], "lon": a["dlugosc_geograficzna"], "opis": "szafka zamknięta",
                                                  "id_aed": "AED-PL-AED495CA3B", "typ": "brak_dostepu"}).json()["id"]
    assert zid in {i["id"] for i in client.get("/api/v1/zgloszenia", headers=uh).json()["data"]}
    assert client.post(f"/api/v1/zgloszenia/{zid}/decyzja", headers=uh, json={"decyzja": "przyjete"}).status_code == 200
    # own password, then blocking the account stops its token at once
    assert client.post("/api/v1/konta/ja/haslo", headers=uh, json={"stare": haslo, "nowe": "nowe-haslo-123"}).status_code == 200
    assert _login(client, "uczelnia.testowa", "nowe-haslo-123")[0].status_code == 200
    assert client.patch("/api/v1/konta/uczelnia.testowa", headers=mod, json={"aktywne": False}).status_code == 200
    assert client.get("/api/v1/konta/ja", headers=uh).status_code == 401
    r = client.post("/api/v1/konta/uczelnia.testowa/reset-hasla", headers=mod)
    assert r.status_code == 200 and r.json()["haslo_jednorazowe"] != haslo


def test_zdjecie_w_zgloszeniu(client):
    _, mod = _login(client, "moderator", "moderator-demo")
    r = client.post("/api/v1/zgloszenia", json={"lat": 52.3, "lon": 21.0, "opis": "AED w holu", "zdjecie": f"data:image/jpeg;base64,{JPEG}",
                                                "godziny_dostepnosci": "Mo-Fr 08:00-16:00", "szafka_zamknieta": True})
    assert r.status_code == 201 and r.json()["data"]["ma_zdjecie"] and "zdjecie" not in r.json()["data"]
    item = next(i for i in client.get("/api/v1/zgloszenia", headers=mod).json()["data"] if i["id"] == r.json()["id"])
    url = item["attributes"]["zdjecie_url"]
    assert item["attributes"]["godziny_dostepnosci"] == "Mo-Fr 08:00-16:00"
    img = client.get(url)
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg" and img.content.startswith(b"\xff\xd8")
    assert client.get(url.split("?")[0] + "?t=zly").status_code == 403
    bad = client.post("/api/v1/zgloszenia", json={"lat": 52.3, "lon": 21.0, "opis": "x x x",
                                                  "zdjecie": "data:image/png;base64," + base64.b64encode(b"nie obrazek").decode()})
    assert bad.status_code == 422
    big = client.post("/api/v1/zgloszenia", json={"lat": 52.3, "lon": 21.0, "opis": "x x x",
                                                  "zdjecie": "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"0" * 1_600_000).decode()})
    assert big.status_code == 413


def test_odswiezanie_na_zadanie(client, monkeypatch):
    from src.core import refresh
    calls = []
    monkeypatch.setattr(refresh, "run_in_background", lambda st, powod: calls.append(powod) or True)
    _, mod = _login(client, "moderator", "moderator-demo")
    _, dysp = _login(client, "dysponent", "dysponent-demo")
    assert client.post("/api/v1/zrodla/odswiez", headers=dysp).status_code == 403
    r = client.post("/api/v1/zrodla/odswiez", headers=mod)
    assert r.status_code == 202 and calls and r.json()["data"]["uruchomiono"]
    s = client.get("/api/v1/zrodla/odswiezanie").json()["data"]
    assert {"w_toku", "ostatnie", "nastepne", "harmonogram"} <= set(s)


def test_czyszczenie_plikow_samorzadow():
    # Marki: every row one quoted field, latitude and longitude swapped
    rows = [{"Długość geograficzna,Szerokość geograficzna, Nazwa, Lokalizacja, Adres, Numer Id":
             '52.326697, 21.107557,"Defibrylator","Urząd Miasta Marki ","Al. Piłsudskiego 95, 05-270 Marki","1"'}] * 3
    u = dgp._unwrap(rows)
    assert u[0]["Lokalizacja"] == "Urząd Miasta Marki" and u[0]["Adres"].startswith("Al.")
    from src.core import mapping
    m = dgp._fix_mapping(u, mapping.propose(u))
    assert m.get("Lokalizacja") == "nazwa_obiektu"  # constant "Defibrylator" is not a name
    rec, probs = dgp._record(u[0], m, {"kod_zrodla": "dane_gov_pl:1", "licencja": "CC0-1.0", "zrodlo_danych": "dane_gov_pl",
                                       "dysponent_nazwa": "Urząd Miasta Marki", "dysponent_typ": "administracja_publiczna",
                                       "status_urzadzenia": "nieznany", "data_weryfikacji": "2024-02-19"}, 2)
    assert 52 < rec["szerokosc_geograficzna"] < 53 and 21 < rec["dlugosc_geograficzna"] < 22
    assert not [p for p in probs if p["poziom"] == "blad"], probs
    # Przemyśl: coordinates in a GeoJSON-like "geometry" column
    g = dgp._geometry([{"geometry": '{"type":"Point","coordinates":{"lat":"49.78","long":"22.77"}}'}, {"geometry": "POINT(22.7 49.7)"}])
    assert g[0]["szerokosc_geograficzna"] == 49.78 and g[1]["dlugosc_geograficzna"] == 22.7
    # Krosno: address without a house number is a warning, not a rejection
    rec, probs = dgp._record({"Adres": "ul. Jasna, , 38-400 Krosno", "Nazwa": "Basen", "lat": "49.71", "lon": "21.72"},
                             {"Adres": ["ulica_cecha", "ulica", "numer_budynku", "kod_pocztowy", "miejscowosc"],
                              "Nazwa": "nazwa_obiektu", "lat": "szerokosc_geograficzna", "lon": "dlugosc_geograficzna"},
                             {"kod_zrodla": "dane_gov_pl:2", "licencja": "CC0-1.0", "zrodlo_danych": "dane_gov_pl",
                              "dysponent_nazwa": "Urząd Miasta Krosna", "dysponent_typ": "administracja_publiczna",
                              "status_urzadzenia": "nieznany", "data_weryfikacji": "2024-02-19"}, 3)
    assert rec["miejscowosc"] == "Krosno" and rec["wojewodztwo"] == "podkarpackie"
    assert not [p for p in probs if p["poziom"] == "blad"], [p for p in probs if p["poziom"] == "blad"]


def test_filtr_zbiorow_niezwiazanych():
    assert dgp.RELEVANT.search("Defibrylatory zlokalizowane w Mieście Krosno")
    assert dgp.RELEVANT.search("Lokalizacja defibrylatorów (AED)")
    assert not dgp.RELEVANT.search("Ceny ofertowe mieszkań dewelopera AD Progress")
    assert not dgp.RELEVANT.search("Zestawienie aktywnych ADE w BAE")
