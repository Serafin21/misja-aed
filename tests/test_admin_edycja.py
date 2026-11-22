"""Owner's decision 22.11 (MODEL_ROL v1.4): one built-in admin account, the administrator edits / deletes / assigns any AED,
institutions report new AED and changes, every submission is approved by the administrator and is on the map at once."""
from test_konta_zgloszenia_aed import _aed


def _h(client, login, haslo):
    r = client.post("/api/v1/auth/login", json={"login": login, "haslo": haslo})
    assert r.status_code == 200, r.json()
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _instytucja(client, adm, nazwa="Urząd Gminy Przykładowo", login="ug.przykladowo"):
    r = client.post("/api/v1/konta", headers=adm, json={"login": login, "dysponent_nazwa": nazwa, "dostawca_podstawa": "wlasciciel"})
    assert r.status_code == 201
    return _h(client, login, r.json()["haslo_jednorazowe"])


def test_konto_admin_i_zalozenie_instytucji(client):
    adm = _h(client, "admin", "admin123")
    assert client.get("/api/v1/konta/ja", headers=adm).json()["data"]["rola"] == "administrator"
    inst = _instytucja(client, adm)
    me = client.get("/api/v1/konta/ja", headers=inst).json()["data"]
    assert me["rola"] == "dysponent" and me["dysponent_nazwa"] == "Urząd Gminy Przykładowo"
    # its AED from its dataset are in its list at once (provider name = account organisation)
    assert len(client.get("/api/v1/moje-urzadzenia", headers=inst).json()["data"]) == 3
    assert client.post("/api/v1/konta", headers=adm, json={"login": "admin", "dysponent_nazwa": "X", "dostawca_podstawa": "wlasciciel"}).status_code == 422


def test_admin_edytuje_konto(client):
    adm = _h(client, "admin", "admin123")
    _instytucja(client, adm)
    r = client.patch("/api/v1/konta/ug.przykladowo", headers=adm, json={"nowy_login": "ug.nowy", "haslo": "Nowe-haslo-123",
                                                                       "telefon": "+48 120 000 001", "email": "nowy@ug.example"})
    assert r.status_code == 200 and r.json()["data"]["login"] == "ug.nowy" and r.json()["data"]["telefon"] == "+48 120 000 001"
    assert client.post("/api/v1/auth/login", json={"login": "ug.przykladowo", "haslo": "Nowe-haslo-123"}).status_code == 401
    inst = _h(client, "ug.nowy", "Nowe-haslo-123")
    # rename the institution: its AED follow (assignments, app AED, submissions)
    client.put("/api/v1/admin/aed/AED-PL-AED495CA3B/przypisanie", headers=adm, json={"organizacja": "Urząd Gminy Przykładowo"})
    client.patch("/api/v1/konta/ug.nowy", headers=adm, json={"dysponent_nazwa": "Urząd Gminy Przykładowo Nowa"})
    inst = _h(client, "ug.nowy", "Nowe-haslo-123")
    ids = [d["id"] for d in client.get("/api/v1/moje-urzadzenia", headers=inst).json()["data"]]
    assert ids == ["AED-PL-AED495CA3B"]
    assert client.patch("/api/v1/konta/ug.nowy", headers=adm, json={"aktywne": False}).status_code == 200
    assert client.get("/api/v1/konta/ja", headers=inst).status_code == 401
    assert client.delete("/api/v1/konta/ug.nowy", headers=adm).status_code == 200
    assert client.patch("/api/v1/konta/ug.nowy", headers=adm, json={"aktywne": True}).status_code == 404
    assert any(e["operacja"] == "konto:usuniecie" for e in client.get("/api/v1/dziennik", headers=adm).json()["data"])


def test_admin_edytuje_usuwa_przypisuje_aed(client):
    adm = _h(client, "admin", "admin123")
    lst = client.get("/api/v1/admin/aed?q=uczelnia", headers=adm).json()
    assert lst["meta"]["count"] >= 2 and {"id_aed", "organizacja", "warstwa", "edytowane"} <= set(lst["data"][0])
    aid = "AED-PL-AED495CA3B"
    r = client.patch(f"/api/v1/admin/aed/{aid}", headers=adm, json={"pola": {"opis_lokalizacji": "parter, wypożyczalnia, koniec korytarza",
                                                                             "godziny_dostepnosci": "pn-pt 7-20"}})
    assert r.status_code == 200 and r.json()["data"]["attributes"]["godziny_dostepnosci"] == "Mo-Fr 07:00-20:00"
    assert client.patch(f"/api/v1/admin/aed/{aid}", headers=adm, json={"pola": {"id_aed": "X"}}).status_code == 422
    assert client.patch(f"/api/v1/admin/aed/{aid}", headers=adm, json={"pola": {"dostep": "byle jak"}}).status_code == 422
    # the edit survives a new aggregation of the providers' datasets
    client.post("/api/v1/admin/agregacja", headers=adm)
    assert client.get(f"/api/v1/aed/{aid}").json()["data"]["attributes"]["opis_lokalizacji"] == "parter, wypożyczalnia, koniec korytarza"
    assert client.get("/api/v1/admin/aed?q=AED495CA3B", headers=adm).json()["data"][0]["edytowane"] is True
    # an OSM point (helper layer) can be edited and deleted too
    osm = client.get("/api/v1/admin/aed?warstwa=pomocnicza", headers=adm).json()["data"][0]["id_aed"]
    assert client.delete(f"/api/v1/admin/aed/{osm}", headers=adm).status_code == 200
    assert client.get(f"/api/v1/aed/{osm}").status_code == 404
    client.post("/api/v1/admin/agregacja", headers=adm)
    assert client.get(f"/api/v1/aed/{osm}").status_code == 404
    # institutions only via approval, never directly
    inst = _instytucja(client, adm)
    assert client.patch(f"/api/v1/admin/aed/{aid}", headers=inst, json={"pola": {"nazwa_obiektu": "X"}}).status_code == 403
    # assignment: the AED appears in the institution's list and residents' reports go to it
    assert client.put(f"/api/v1/admin/aed/{osm}/przypisanie", headers=adm, json={"organizacja": "Urząd Gminy Przykładowo"}).status_code == 404
    osm2 = client.get("/api/v1/admin/aed?warstwa=pomocnicza", headers=adm).json()["data"][0]["id_aed"]
    client.put(f"/api/v1/admin/aed/{osm2}/przypisanie", headers=adm, json={"organizacja": "Urząd Gminy Przykładowo"})
    assert osm2 in [d["id"] for d in client.get("/api/v1/moje-urzadzenia", headers=inst).json()["data"]]
    a = client.get(f"/api/v1/aed/{osm2}").json()["data"]["attributes"]
    r = client.post("/api/v1/zgloszenia", json={"lat": a["szerokosc_geograficzna"], "lon": a["dlugosc_geograficzna"], "opis": "Szafka zniszczona",
                                                "id_aed": osm2, "typ": "awaria"})
    assert r.json()["meta"]["trafia_do"] == "Urząd Gminy Przykładowo"
    assert any(z["attributes"]["id_aed"] == osm2 for z in client.get("/api/v1/zgloszenia", headers=inst).json()["data"])


def test_zmiana_aed_przez_instytucje_po_zatwierdzeniu(client):
    adm = _h(client, "admin", "admin123")
    inst = _instytucja(client, adm)
    aid = "AED-PL-B939F7EBA4"  # Urząd Gminy Przykładowo's AED from its dataset
    a = client.get(f"/api/v1/aed/{aid}").json()["data"]["attributes"]
    body = _aed(typ="zmiana", id_aed=aid, nazwa_obiektu=a["nazwa_obiektu"], szerokosc=a["szerokosc_geograficzna"],
                dlugosc=a["dlugosc_geograficzna"], opis_lokalizacji="parter, recepcja, za ladą")
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=body | {"id_aed": "AED-PL-AED495CA3B"}).status_code == 403  # not its AED
    zid = client.post("/api/v1/zgloszenia-aed", headers=inst, json=body).json()["id"]
    dev = next(d for d in client.get("/api/v1/moje-urzadzenia", headers=inst).json()["data"] if d["id"] == aid)
    assert dev["zgloszenie"]["status"] == "oczekuje"
    assert client.get(f"/api/v1/aed/{aid}").json()["data"]["attributes"]["opis_lokalizacji"] != "parter, recepcja, za ladą"  # not before approval
    q = client.get("/api/v1/admin/zgloszenia-aed", headers=adm).json()["data"][0]
    assert q["typ"] == "zmiana" and q["obecne"]["nazwa_obiektu"] == a["nazwa_obiektu"]
    assert client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm, json={"decyzja": "odrzuc"}).status_code == 422
    client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm, json={"decyzja": "zatwierdz"})
    b = client.get(f"/api/v1/aed/{aid}").json()["data"]["attributes"]
    assert b["opis_lokalizacji"] == "parter, recepcja, za ladą" and b["zdjecie_url"].endswith(f"/aed/{aid}/zdjecie")
    # second change without a photo: the AED already has one
    nophoto = dict(body, opis_lokalizacji="parter, recepcja, po lewej")
    del nophoto["zdjecie"]
    assert client.post("/api/v1/zgloszenia-aed", headers=inst, json=nophoto).status_code == 201


def test_zgloszenie_administratora_i_przypomnienia(client):
    adm = _h(client, "admin", "admin123")
    r = client.post("/api/v1/zgloszenia-aed", headers=adm, json=_aed(organizacja="Urząd Gminy Przykładowo"))
    zid = r.json()["id"]
    assert client.get("/api/v1/moje-zgloszenia", headers=adm).json()["data"][0]["id"] == zid
    assert client.get("/api/v1/admin/zgloszenia-aed", headers=adm).json()["data"][0]["nadawca_rola"] == "administrator"
    aid = client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm, json={"decyzja": "zatwierdz"}).json()["data"]["id_aed"]
    inst = _instytucja(client, adm)
    assert aid in [d["id"] for d in client.get("/api/v1/moje-urzadzenia", headers=inst).json()["data"]]
    feats = {f["id"]: f["properties"] for f in client.get("/api/v1/aed/punkty").json()["features"]}
    assert feats[aid]["nazwa"] == "Siedziba Fundacji Serce" and feats[aid]["warstwa"] == "lista"
    # reminders: AED of the institution not checked for a year
    client.patch(f"/api/v1/admin/aed/{aid}", headers=adm, json={"pola": {"data_weryfikacji": "2024-01-10"}})
    n = client.get("/api/v1/moje-aed/powiadomienia", headers=inst).json()
    assert n["meta"]["przypomnienia"] >= 1 and any(x["typ"] == "przypomnienie" and "2024-01-10" in x["tresc"] for x in n["data"])


def test_login_dowolny_i_haslo_od_admina(client):
    adm = _h(client, "admin", "admin123")
    r = client.post("/api/v1/konta", headers=adm, json={"login": "UG Kraków", "haslo": "tajne-haslo", "dysponent_nazwa": "Urząd Gminy Kraków",
                                                        "dostawca_podstawa": "wlasciciel"})
    assert r.status_code == 201 and r.json()["data"]["login"] == "ug.kraków" and r.json()["haslo_jednorazowe"] == "tajne-haslo"
    h = _h(client, "UG Kraków", "tajne-haslo")  # case and spaces do not matter, Polish letters work (token is encoded)
    assert client.get("/api/v1/konta/ja", headers=h).json()["data"]["login"] == "ug.kraków"
    r = client.post("/api/v1/konta", headers=adm, json={"login": "aed@szkola.example.pl", "dysponent_nazwa": "Szkoła", "dostawca_podstawa": "wlasciciel"})
    assert r.status_code == 201 and len(r.json()["haslo_jednorazowe"]) >= 10
    assert _h(client, "AED@Szkola.example.pl", r.json()["haslo_jednorazowe"])
    assert client.post("/api/v1/konta", headers=adm, json={"login": "ab", "dysponent_nazwa": "Xyz", "dostawca_podstawa": "wlasciciel"}).status_code == 422


def test_podglad_hasla_i_haslo_za_krotkie(client):
    adm = _h(client, "admin", "admin123")
    r = client.post("/api/v1/konta", headers=adm, json={"login": "UM Krosno", "haslo": "abc", "dysponent_nazwa": "Urząd Miasta Krosna",
                                                        "dostawca_podstawa": "wlasciciel"})
    assert r.status_code == 201 and r.json()["haslo_wygenerowane"] is True and r.json()["haslo_jednorazowe"] != "abc"
    gen = r.json()["haslo_jednorazowe"]
    v = client.get("/api/v1/konta/um.krosno/haslo", headers=adm).json()["data"]
    assert v == {"login": "um.krosno", "haslo": gen, "uwaga": None}
    # after the administrator sets a new one, and after the institution changes its own – the view follows
    client.patch("/api/v1/konta/um.krosno", headers=adm, json={"haslo": "Nowe-haslo-1"})
    assert client.get("/api/v1/konta/um.krosno/haslo", headers=adm).json()["data"]["haslo"] == "Nowe-haslo-1"
    inst = _h(client, "um.krosno", "Nowe-haslo-1")
    assert client.post("/api/v1/konta/ja/haslo", headers=inst, json={"stare": "Nowe-haslo-1", "nowe": "Moje-wlasne-123"}).status_code == 200
    assert client.get("/api/v1/konta/um.krosno/haslo", headers=adm).json()["data"]["haslo"] == "Moje-wlasne-123"
    assert client.get("/api/v1/konta/um.krosno/haslo", headers=inst).status_code == 403
    assert client.get("/api/v1/konta/admin/haslo", headers=adm).json()["data"]["haslo"] == "admin123"
    assert any(e["operacja"] == "konto:podglad_hasla" for e in client.get("/api/v1/dziennik", headers=adm).json()["data"])
    r = client.post("/api/v1/konta", headers=adm, json={"login": "szkola5", "haslo": "Dobre-haslo-9", "dysponent_nazwa": "Szkoła 5",
                                                        "dostawca_podstawa": "wlasciciel"})
    assert r.json()["haslo_wygenerowane"] is False and r.json()["haslo_jednorazowe"] == "Dobre-haslo-9"


def test_zatwierdzanie_z_listy(client):
    adm = _h(client, "admin", "admin123")
    client.post("/api/v1/konta/wnioski", json={"nazwa_instytucji": "Fundacja X", "regon": "999000077", "podstawa": "weryfikujacy",
                                               "email_sluzbowy": "a@x.example", "telefon": "+48 120 000 002", "login": "fundacja.x", "haslo": "Haslo-12345"})
    k = next(k for k in client.get("/api/v1/konta", headers=adm).json()["data"] if k["login"] == "fundacja.x")
    assert k["oczekuje"] and k["wniosek_id"]
    assert client.post(f"/api/v1/konta/wnioski/{k['wniosek_id']}/decyzja", headers=adm, json={"decyzja": "zatwierdz"}).status_code == 200
    k = next(k for k in client.get("/api/v1/konta", headers=adm).json()["data"] if k["login"] == "fundacja.x")
    assert k["aktywne"] and k["wniosek_id"] is None
    inst = _instytucja(client, adm)
    aid = "AED-PL-B939F7EBA4"
    a = client.get(f"/api/v1/aed/{aid}").json()["data"]["attributes"]
    zid = client.post("/api/v1/zgloszenia-aed", headers=inst, json=_aed(typ="zmiana", id_aed=aid, szerokosc=a["szerokosc_geograficzna"],
                                                                         dlugosc=a["dlugosc_geograficzna"])).json()["id"]
    rows = client.get("/api/v1/admin/aed?oczekujace=true", headers=adm).json()["data"]
    assert [r["id_aed"] for r in rows] == [aid] and rows[0]["zgloszenie"]["id"] == zid


def test_aed_z_prototypu_oznaczone_i_poza_eksportem(client):
    """CR-TL-9 pkt 6: AED dodane w prototypie mają status „nieopublikowane_w_dane_gov_pl” i nie trafiają do eksportu."""
    adm = _h(client, "admin", "admin123")
    zid = client.post("/api/v1/zgloszenia-aed", headers=adm, json=_aed()).json()["id"]
    aid = client.post(f"/api/v1/admin/zgloszenia-aed/{zid}/decyzja", headers=adm, json={"decyzja": "zatwierdz"}).json()["data"]["id_aed"]
    m = client.get(f"/api/v1/aed/{aid}").json()["data"]["meta"]
    assert m["status_publikacji"] == "nieopublikowane_w_dane_gov_pl" and "nie pochodzą z wykazu" in m["opis_statusu_publikacji"]
    pts = {f["id"]: f["properties"] for f in client.get("/api/v1/aed/punkty").json()["features"]}
    assert pts[aid]["status_publikacji"] == "nieopublikowane_w_dane_gov_pl" and pts["AED-PL-B939F7EBA4"]["status_publikacji"] is None
    for plik in ("aed.csv", "aed_pochodzenie.csv", "aed.geojson", "aed.jsonld"):
        assert aid not in client.get(f"/api/v1/eksport/{plik}").text, plik
    assert "AED-PL-B939F7EBA4" in client.get("/api/v1/eksport/aed.csv").text


def test_admin_bez_hasla_w_ustawieniach(monkeypatch):
    import importlib

    from src.api import auth
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    try:
        assert "admin" not in importlib.reload(auth).DEMO  # no default password in the code
    finally:
        monkeypatch.setenv("ADMIN_PASSWORD", "admin123")
        importlib.reload(auth)
