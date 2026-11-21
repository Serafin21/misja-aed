"""CR-TL-8: trusted institution accounts (request → approval), "Zgłoś AED" only after login with administrator approval,
address instead of coordinates (reverse geocoding), photo metadata removed (K14)."""
import base64
import struct

from src.core import geocode, zdjecia


def _login(client, login, haslo):
    return client.post("/api/v1/auth/login", json={"login": login, "haslo": haslo})


def _h(r):
    return {"Authorization": f"Bearer {r.json()['token']}"}


ADMIN = ("administrator", "administrator-demo")
WNIOSEK = {"nazwa_instytucji": "Fundacja Serce Przykładowe", "regon": "999000066", "podstawa": "weryfikujacy",
           "email_sluzbowy": "aed@fundacja.example", "telefon": "+48 120 000 000", "login": "fundacja.serce", "haslo": "Bezpieczne-haslo-1"}

# a tiny JPEG with an EXIF (APP1) segment carrying a GPS marker
def _seg(marker, data):
    return b"\xff" + bytes([marker]) + struct.pack(">H", len(data) + 2) + data


JPEG = (b"\xff\xd8" + _seg(0xE0, b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00") + _seg(0xE1, b"Exif\x00\x00GPS-50.06-19.94")
        + _seg(0xFE, b"comment") + _seg(0xDA, b"\x01\x01\x00\x00\x3f\x00") + b"\x12\x34\x56" + b"\xff\xd9")
FOTO = "data:image/jpeg;base64," + base64.b64encode(JPEG).decode()


def _aed(**kw):
    d = {"nazwa_obiektu": "Siedziba Fundacji Serce", "ulica": "ul. Floriańska", "numer_budynku": "3", "kod_pocztowy": "31-019",
         "miejscowosc": "Kraków", "szerokosc": 50.0628, "dlugosc": 19.9397, "opis_lokalizacji": "hol na parterze, przy recepcji",
         "dostep": "publiczny", "dostepny_24h": False, "godziny": "pn-pt 8-16", "szafka_zamknieta": True,
         "instrukcja_dostepu": "kod do szafki podaje dyspozytor 112", "zdjecie": FOTO}
    d.update(kw)
    return d


def _konto(client):
    assert client.post("/api/v1/konta/wnioski", json=WNIOSEK).json()["status"] == "oczekuje"
    adm = _h(_login(client, *ADMIN))
    wid = client.get("/api/v1/konta/wnioski?status=oczekuje", headers=adm).json()["data"][0]["id"]
    assert client.post(f"/api/v1/konta/wnioski/{wid}/decyzja", headers=adm, json={"decyzja": "zatwierdz"}).status_code == 200
    return _h(_login(client, WNIOSEK["login"], WNIOSEK["haslo"])), adm


def test_wniosek_zatwierdzenie_logowanie(client):
    r = client.post("/api/v1/konta/wnioski", json=WNIOSEK)
    assert r.status_code == 201 and r.json()["status"] == "oczekuje" and "haslo" not in r.json()["data"]
    r = _login(client, WNIOSEK["login"], WNIOSEK["haslo"])
    assert r.status_code == 403 and r.json()["error"]["code"] == "konto_oczekuje"  # not active before approval
    assert client.post("/api/v1/konta/wnioski", json=WNIOSEK).status_code == 409
    assert client.post("/api/v1/konta/wnioski", json=WNIOSEK | {"login": "inna", "podstawa": "nie_wiem"}).status_code == 422
    assert client.post("/api/v1/konta/wnioski", json=WNIOSEK | {"login": "inna2", "nazwa_instytucji": "nie wiem"}).status_code == 422
    adm = _h(_login(client, *ADMIN))
    assert client.get("/api/v1/konta/wnioski").status_code == 401
    w = client.get("/api/v1/konta/wnioski", headers=adm).json()["data"][0]
    assert w["status"] == "oczekuje" and w["regon"] == "999000066" and w["podstawa"] == "weryfikujacy"
    assert client.post(f"/api/v1/konta/wnioski/{w['id']}/decyzja", headers=adm, json={"decyzja": "zatwierdz"}).json()["data"]["status"] == "zatwierdzony"
    r = _login(client, WNIOSEK["login"], WNIOSEK["haslo"])
    assert r.status_code == 200 and r.json()["rola"] == "dysponent" and r.json()["dysponent_nazwa"] == "Fundacja Serce Przykładowe"
    k = next(k for k in client.get("/api/v1/konta", headers=adm).json()["data"] if k["login"] == "fundacja.serce")
    assert k["aktywne"] and k["dostawca_podstawa"] == "weryfikujacy"
    log = client.get("/api/v1/dziennik", headers=adm).json()["data"]
    assert any(e["operacja"] == "konto:wniosek_zatwierdzony" and e["kto"] == "administrator" for e in log)


def test_wniosek_odrzucony(client):
    client.post("/api/v1/konta/wnioski", json=WNIOSEK)
    adm = _h(_login(client, *ADMIN))
    wid = client.get("/api/v1/konta/wnioski", headers=adm).json()["data"][0]["id"]
    assert client.post(f"/api/v1/konta/wnioski/{wid}/decyzja", headers=adm, json={"decyzja": "odrzuc"}).status_code == 422  # reason required
    assert client.post(f"/api/v1/konta/wnioski/{wid}/decyzja", headers=adm, json={"decyzja": "odrzuc", "uzasadnienie": "REGON nie pasuje"}).status_code == 200
    assert _login(client, WNIOSEK["login"], WNIOSEK["haslo"]).status_code == 401
    assert client.post(f"/api/v1/konta/wnioski/{wid}/decyzja", headers=adm, json={"decyzja": "zatwierdz"}).status_code == 409


def test_pracownik_instytucji(client):
    inst, adm = _konto(client)
    r = client.post("/api/v1/konta/ja/uzytkownicy", headers=inst, json={"login": "fundacja.jan"})
    assert r.status_code == 201
    r2 = _login(client, "fundacja.jan", r.json()["haslo_jednorazowe"])
    assert r2.status_code == 200 and r2.json()["dysponent_nazwa"] == "Fundacja Serce Przykładowe"
    assert client.post("/api/v1/konta/ja/uzytkownicy", headers=adm, json={"login": "x.y"}).status_code == 403


def test_zglos_aed_walidacja(client):
    assert client.post("/api/v1/zgloszenia-aed", json=_aed()).status_code == 401
    inst, adm = _konto(client)
    no_photo = _aed()
    del no_photo["zdjecie"]
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=no_photo).status_code == 422
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(zdjecie="")).status_code == 422
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(szafka_zamknieta="nie_wiem")).status_code == 422
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(dostep="nieznany")).status_code == 422
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(opis_lokalizacji="nie wiem")).status_code == 422
    r = client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(instrukcja_dostepu=None))
    assert r.status_code == 422 and "instrukcja_dostepu" in r.json()["error"]["fields"]
    r = client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(godziny=None))
    assert r.status_code == 422 and "godziny" in r.json()["error"]["fields"]
    r = client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(godziny="czasem rano"))
    assert r.status_code == 422 and "godziny" in r.json()["error"]["fields"]
    # the administrator may report too – the submission goes to the same approval queue
    assert client.post("/api/v1/zgloszenia-aed", headers=adm, json=_aed()).status_code == 201
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(organizacja="Inna")).status_code == 403


def test_zglos_aed_zatwierdzenie_od_razu_na_mapie(client):
    inst, adm = _konto(client)
    r = client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed())
    assert r.status_code == 201
    zid = r.json()["id"]
    q = client.get("/api/v1/admin/zgloszenia-aed?status=oczekuje", headers=adm).json()["data"]
    assert q[0]["id"] == zid and q[0]["nadawca_login"] == "fundacja.serce" and q[0]["organizacja"] == "Fundacja Serce Przykładowe"
    assert q[0]["godziny"] == "Mo-Fr 08:00-16:00" and q[0]["teryt_terc"] == "1261011"
    foto = client.get(q[0]["zdjecie_url"])  # signed link; metadata removed on the server (K14)
    assert foto.status_code == 200 and foto.headers["content-type"] == "image/jpeg"
    assert b"Exif" not in foto.content and b"GPS" not in foto.content and b"comment" not in foto.content and b"JFIF" in foto.content
    assert client.get(q[0]["zdjecie_url"].split("?")[0] + "?t=zly").status_code == 403
    # the administrator never edits fields
    assert client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm,
                       json={"decyzja": "zatwierdz", "nazwa_obiektu": "Inna nazwa"}).status_code == 403
    assert client.put(f"/api/v1/zgloszenia-aed/{zid}", headers=adm, json=_aed(nazwa_obiektu="Inna")).status_code == 403
    assert client.patch(f"/api/v1/admin/zgloszenia-aed/{zid}", headers=adm, json={"nazwa_obiektu": "Inna"}).status_code == 403
    assert client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=inst, json={"decyzja": "zatwierdz"}).status_code == 403
    r = client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm, json={"decyzja": "zatwierdz", "komentarz": "Komplet"})
    assert r.status_code == 200 and r.json()["data"]["status"] == "zatwierdzone"
    id_aed = r.json()["data"]["id_aed"]
    mine = client.get("/api/v1/moje-zgloszenia", headers=inst).json()["data"][0]
    assert mine["status"] == "zatwierdzone" and mine["decyzja"] == "zatwierdz" and mine["kto"] == "administrator" and mine["kiedy"]
    # owner's decision (22.11): approved = on the map at once, in the institution's list, with the cleaned photo
    a = client.get(f"/api/v1/aed/{id_aed}").json()["data"]
    assert a["attributes"]["metoda_weryfikacji"] == "zdjecie" and a["attributes"]["teryt_terc"] == "1261011"
    assert a["meta"]["warstwa"] == "lista" and a["meta"]["dostawca"] == "Fundacja Serce Przykładowe"
    assert a["attributes"]["dysponent_nazwa"] == "Fundacja Serce Przykładowe"
    ph = client.get(a["attributes"]["zdjecie_url"])
    assert ph.status_code == 200 and b"Exif" not in ph.content
    assert id_aed in [x["id"] for x in client.get("/api/v1/aed/punkty?warstwa=lista").json()["features"]]
    mine_dev = client.get("/api/v1/moje-urzadzenia", headers=inst).json()["data"]
    assert [d["id"] for d in mine_dev] == [id_aed]
    notes = client.get("/api/v1/moje-aed/powiadomienia", headers=inst).json()["data"]
    assert any(n["typ"] == "zgloszenie_aed" and "zatwierdzone" in n["tresc"] for n in notes)


def test_zglos_aed_do_poprawy_i_ponownie(client):
    inst, adm = _konto(client)
    zid = client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed()).json()["id"]
    assert client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm, json={"decyzja": "do_poprawy"}).status_code == 422
    r = client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm,
                    json={"decyzja": "do_poprawy", "komentarz": "Zdjęcie nie pokazuje urządzenia."})
    assert r.json()["data"]["status"] == "do_poprawy"
    mine = client.get("/api/v1/moje-zgloszenia", headers=inst).json()["data"][0]
    assert mine["status"] == "do_poprawy" and mine["komentarz"] == "Zdjęcie nie pokazuje urządzenia." and mine["kto"] == "administrator"
    # the form sends back the hours as the server stored them ("Mo-Fr 08:00-16:00")
    r = client.put(f"/api/v1/zgloszenia-aed/{zid}", headers=inst, json=_aed(opis_lokalizacji="hol na parterze, szafka na lewo od windy",
                                                                           godziny="Mo-Fr 08:00-16:00"))
    assert r.status_code == 200 and r.json()["data"]["status"] == "oczekuje" and len(r.json()["data"]["historia"]) == 1
    assert client.get("/api/v1/admin/zgloszenia-aed", headers=adm).json()["meta"]["count"] == 1


def test_odwrotne_geokodowanie(client, monkeypatch):
    monkeypatch.setenv("AED_GEOKODER", "gugik")
    monkeypatch.setattr(geocode, "_uug_reverse", lambda lat, lon: ({
        "city": "Kraków", "street": "Rynek Główny", "number": "1", "code": "31-042", "x": "19.93649", "y": "50.06145", "distance": "36.8",
        "jednostka": "{Polska,małopolskie,Kraków,Kraków}"},))
    d = client.get("/api/v1/miejsca/odwrotnie?lat=50.0614&lon=19.937").json()["data"]
    assert d["ulica"] == "Rynek Główny" and d["numer_budynku"] == "1" and d["kod_pocztowy"] == "31-042" and d["miejscowosc"] == "Kraków"
    assert d["gmina"] == "Kraków" and d["teryt_terc"] == "1261011" and d["odleglosc_m"] == 37
    monkeypatch.setenv("AED_GEOKODER", "brak")  # offline: gmina and TERYT from PRG still work
    d = client.get("/api/v1/miejsca/odwrotnie?lat=50.0614&lon=19.937").json()["data"]
    assert d["ulica"] is None and d["teryt_terc"] == "1261011"
    assert client.get("/api/v1/miejsca/odwrotnie?lat=10&lon=19").status_code == 422


def test_metadane_png_webp():
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + zdjecia._crc(t, d)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", b"\x00" * 13) + chunk(b"tEXt", b"GPS\x0050.0") + chunk(b"IDAT", b"x") + chunk(b"IEND", b"")
    out = zdjecia.bez_metadanych("image/png", png)
    assert b"tEXt" not in out and b"IDAT" in out and out.endswith(chunk(b"IEND", b""))
    body = b"WEBP" + b"VP8X" + struct.pack("<I", 10) + bytes([0x0C]) + b"\x00" * 9 + b"VP8 " + struct.pack("<I", 2) + b"ab" \
        + b"EXIF" + struct.pack("<I", 3) + b"GPS\x00"
    out = zdjecia.bez_metadanych("image/webp", b"RIFF" + struct.pack("<I", len(body)) + body)
    assert b"EXIF" not in out and b"VP8 " in out and out[20] & 0x0C == 0 and struct.unpack("<I", out[4:8])[0] == len(out) - 8
