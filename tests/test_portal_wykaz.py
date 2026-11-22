"""CR-TL-9 pkt 5: with PORTAL_API the common list is the portal's "Wykaz AED – wykaz zbiorczy" (GET /aed-aggregated)."""
import csv
import io
import json

from src.core import dostawcy, schema


def _csv(rows):
    cols = ["Lp.", *dostawcy.PORTAL_PROVIDER_COLS, *schema.field_order(), "Możliwy duplikat"]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    for i, r in enumerate(rows, 1):
        w.writerow({"Lp.": i, **r})
    return buf.getvalue().encode()


def _row(provider, id_aed, lat, dup=""):
    return {"Nazwa dostawcy": provider, "Typ instytucji": "Samorząd", "Link do zasobu źródłowego": f"https://mcod.local/pl/dataset/1/resource/{id_aed}",
            "Data aktualizacji zasobu": "2026-11-21", "id_aed": id_aed, "nazwa_obiektu": f"AED {id_aed}", "opis_lokalizacji": "hol",
            "miejscowosc": "Warszawa", "numer_budynku": "1", "kod_pocztowy": "00-001", "teryt_terc": "1465011",
            "szerokosc_geograficzna": lat, "dlugosc_geograficzna": "21.0154", "dostep": "publiczny", "godziny_dostepnosci": "24/7",
            "dostepny_24h": "true", "dysponent_nazwa": provider, "licencja": "CC0-1.0", "data_weryfikacji": "2026-11-02",
            "kontakt_email": "aed@x.example", "Możliwy duplikat": dup}


def test_lista_z_wykazu_zbiorczego_portalu(client, monkeypatch):
    api = "http://api.mcod.local/1.4"
    csv_bytes = _csv([_row("Urząd Miasta Testowo", "AED-PL-P000000001", "52.2401", "tak: AED-PL-P000000002"),
                      _row("Fundacja Serce", "AED-PL-P000000002", "52.2402", "tak: AED-PL-P000000001"),
                      _row("Fundacja Serce", "AED-PL-P000000003", "")])  # no coordinates → not on the map
    answers = {f"{api}/aed-aggregated": json.dumps({"data": {"type": "aggregated_aed", "id": 1, "attributes": {
        "resource_id": 7, "csv_url": "http://api.mcod.local/media/wykaz.csv"}}}).encode(),
        "http://api.mcod.local/media/wykaz.csv": csv_bytes}
    monkeypatch.setattr(dostawcy, "_portal_get", lambda url, timeout=30: answers[url])
    monkeypatch.setenv("PORTAL_API", api)
    adm = {"Authorization": "Bearer " + client.post("/api/v1/auth/login", json={"login": "admin", "haslo": "admin123"}).json()["token"]}
    r = client.post("/api/v1/admin/agregacja", headers=adm).json()["data"]
    assert r["rekordy"] == 2 and {z["dostawca"] for z in r["zbiory"]} == {"Urząd Miasta Testowo", "Fundacja Serce"}
    a = client.get("/api/v1/aed/AED-PL-P000000001").json()["data"]
    assert a["meta"]["warstwa"] == "lista" and a["meta"]["dostawca"] == "Urząd Miasta Testowo"
    assert a["meta"]["zbior_url"].endswith("/resource/AED-PL-P000000001") and a["meta"]["mozliwe_duplikaty"] == ["AED-PL-P000000002"]
    lista = client.get("/api/v1/aed?per_page=100").json()
    assert lista["meta"]["count"] == 2  # only the portal's list; the fictional local providers are not read
    monkeypatch.delenv("PORTAL_API")
    client.post("/api/v1/admin/agregacja", headers=adm)
    assert client.get("/api/v1/aed?per_page=100").json()["meta"]["count"] == 10  # without PORTAL_API – the previous path


def test_znak_umowny_z_portalu_to_brak_wartosci(client, monkeypatch):
    """Zasady dane.gov.pl: portal wpisuje w puste komórki wykazu zbiorczego znak umowny „-” – aplikacja czyta go jako brak."""
    api = "http://api.mcod.local"
    row = _row("Urząd Miasta Testowo", "AED-PL-P000000009", "52.2401", "-")
    row |= {"pietro": "-", "numer_lokalu": "-", "kontakt_telefon": "-", "instrukcja_dostepu": "-"}
    answers = {f"{api}/aed-aggregated": json.dumps({"csv_url": "http://api.mcod.local/media/w.csv"}).encode(),
               "http://api.mcod.local/media/w.csv": _csv([row])}
    monkeypatch.setattr(dostawcy, "_portal_get", lambda url, timeout=30: answers[url])
    monkeypatch.setenv("PORTAL_API", api)
    adm = {"Authorization": "Bearer " + client.post("/api/v1/auth/login", json={"login": "admin", "haslo": "admin123"}).json()["token"]}
    assert client.post("/api/v1/admin/agregacja", headers=adm).json()["data"]["rekordy"] == 1
    a = client.get("/api/v1/aed/AED-PL-P000000009").json()["data"]
    attrs = a["attributes"]
    assert attrs["pietro"] is None and attrs["numer_lokalu"] is None and attrs["kontakt_telefon"] is None and attrs["instrukcja_dostepu"] is None
    assert a["meta"]["mozliwe_duplikaty"] == []
