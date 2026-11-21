import io

from openpyxl import load_workbook

from src.core import importers, mapping, pipeline


def test_template_roundtrip(client, auth):
    """Owner downloads the XLSX template, fills one row, uploads it → valid record."""
    wb = load_workbook(io.BytesIO(client.get("/api/v1/szablon.xlsx").content))
    ws = wb["dane"]
    header = [c.value for c in ws[1]]
    row = {"nazwa_obiektu": "Szkoła Podstawowa nr 999", "opis_lokalizacji": "Parter, przy portierni",
           "wewnatrz_budynku": "true", "wojewodztwo": "małopolskie", "gmina": "Kraków", "miejscowosc": "Kraków",
           "ulica": "Szkolna", "numer_budynku": "3", "kod_pocztowy": "31-001", "szerokosc_geograficzna": 50.0614,
           "dlugosc_geograficzna": 19.9372, "dostep": "ograniczony", "godziny_dostepnosci": "Mo-Fr 07:00-17:00",
           "dostepny_24h": "false", "szafka_zamknieta": "false", "mobilny": "false", "status_urzadzenia": "sprawny",
           "dysponent_nazwa": "Szkoła Podstawowa nr 999", "dysponent_typ": "szkola_placowka_oswiatowa",
           "licencja": "CC0-1.0", "data_weryfikacji": "2026-11-21", "metoda_weryfikacji": "deklaracja_dysponenta"}
    for i, h in enumerate(header, start=1):
        if h in row:
            ws.cell(2, i, row[h])
    buf = io.BytesIO()
    wb.save(buf)
    r = client.post("/api/v1/import", headers=auth, data={"kod_zrodla": "dysponent:sp999", "licencja": "CC0-1.0"},
                    files={"plik": ("szablon.xlsx", buf.getvalue(), "application/octet-stream")})
    assert r.status_code == 200 and r.json()["wykryty_format"]["format"] == "XLSX"
    m = r.json()["mapowanie_proponowane"]
    assert all(m[h] == h for h in row)
    rep = client.post(f"/api/v1/import/{r.json()['import_id']}/mapowanie", json={}, headers=auth).json()
    assert rep["bledy"] == 0, rep["problemy"]
    assert client.post(f"/api/v1/import/{r.json()['import_id']}/zatwierdz", headers=auth).json()["dodane"] == 1


def test_dirty_cp1250_csv_with_comma_separator():
    data = ("Nazwa obiektu,Ulica,Nr,Kod,Miasto,Lat,Lon,Godziny otwarcia,Dostępny 24h\r\n"
            "Urząd Miasta,ul. Rynek,1,33-100,Tarnów,\"50,0123\",\"20,9876\",pon-pt 7.30-15.30,nie\r\n").encode("cp1250")
    rows, fmt = importers.read_any("x.csv", data)
    assert fmt["kodowanie"] == "CP1250" and fmt["separator"] == ","
    m = mapping.propose(rows)
    res = pipeline.process_rows(rows, m, {"kod_zrodla": "dysponent:tarnow", "dysponent_typ": "administracja_publiczna",
                                          "dysponent_nazwa": "Urząd Miasta Tarnowa"})
    rec = res[0]["rekord"]
    assert rec["szerokosc_geograficzna"] == 50.0123 and rec["ulica"] == "Rynek" and rec["ulica_cecha"] == "ul."
    assert rec["godziny_dostepnosci"] == "Mo-Fr 07:30-15:30" and rec["wojewodztwo"] == "małopolskie"
    # the file has no location description – the only blocking error, reported in Polish
    errors = {p["pole"] for p in res[0]["problemy"] if p["poziom"] == "blad"}
    assert errors == {"opis_lokalizacji"}


def test_jsonld(client):
    j = client.get("/api/v1/aed/AED-PL-B939F7EBA4", headers={"Accept": "application/ld+json"}).json()
    assert j["@context"]["nazwa_obiektu"] == "schema:name" and j["licencja"].startswith("http://creativecommons.org")
    g = client.get("/api/v1/eksport/aed.jsonld").json()
    assert len(g["@graph"]) == 7  # the common list only


def test_rate_limit(client, monkeypatch):
    from src.api import main
    monkeypatch.setattr(main, "RATE", 2)
    main._hits.clear()
    codes = [client.post("/api/v1/aed/AED-PL-B939F7EBA4/potwierdzenia", json={"jest_na_miejscu": True}).status_code
             for _ in range(3)]
    assert codes == [201, 201, 429]
    main._hits.clear()
