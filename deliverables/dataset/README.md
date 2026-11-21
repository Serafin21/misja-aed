# Wspólna lista AED – kompilacja zbiorów dostawców (przykład)

Model ról: `docs/MODEL_ROL.md`. Wspólna lista **nie jest zbiorem danych i nie ma dostawcy** – to widok łączący zbiory AED opublikowane przez ich właścicieli na dane.gov.pl. Za każdy rekord odpowiada wskazany dostawca; warunki ponownego wykorzystywania – jak w zbiorze źródłowym.

Wygenerowano z prototypu (`python -m scripts.seed --reset --lista lokalna && python -m scripts.publish`; na żywo `GET /api/v1/eksport/{plik}`). **Dostawcy są fikcyjni** (`data/dostawcy/`): Urząd Gminy Przykładowo, Uczelnia Testowa (zbiór po terminie aktualizacji), MPK Przykładowo (jeden rekord odrzucony przez walidację, jeden „do weryfikacji”, jeden możliwy duplikat z AED uczelni – oba pozostają) i Gmina Przykładowa Druga – **zbiór przejściowy** (opublikowany przed wzorcem; 3 AED pokazane bez zmian, kolumna `zgodnosc = przejsciowy`).

| Plik | Zawartość |
|---|---|
| `aed.csv` | 44 pola wzorca AED + pochodzenie: `dostawca, dostawca_regon, zbior_id, zbior_url, zasob_url, data_danych, licencja_zbioru, mozliwy_duplikat, zgodnosc` (UTF-8, przecinek, CRLF) |
| `aed.geojson`, `aed.jsonld` | te same rekordy jako punkty WGS 84 i dane powiązane (schema.org) |
| `aed_pochodzenie.csv` | rekord → dostawca, zbiór, zasób, data danych, aktualność zbioru |
| `zrodla.csv` | zbiory dostawców składające się na listę |
| `slownik_danych.csv`, `aed.csvw.json` | słownik pól i metadane CSVW |

Danych z OpenStreetMap tu nie ma (ODbL; na mapie tylko jako warstwa „Do sprawdzenia”). Pliki, które **dostawca** publikuje na swoim koncie: `deliverables/pakiet_dostawcy_przyklad/` (CSV + XML harmonizatora 1.13 + słownik + metadane + instrukcja), sprawdzenie: `python scripts/check_xml.py`.
