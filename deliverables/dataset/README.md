# Pakiet publikacji dla dane.gov.pl – zbiór „Defibrylatory AED w Polsce”

Wygenerowany przez `python -m scripts.publish` (na żywo: `GET /api/v1/eksport/{plik}`). **Wydanie w repozytorium powstało z danych przykładowych** (`data/sample/`, rekordy fikcyjne) i próbki OSM. Po `python -m scripts.seed --reset` z dostępem do sieci pakiet obejmuje całą warstwę OpenStreetMap dla Polski.

| Plik | Zawartość | Licencja |
|---|---|---|
| `aed.csv` | rekordy wg wzorcowego zakresu danych (44 pola), CSV poziom 3: UTF-8, przecinek, CRLF, RFC 4180 | CC0-1.0 / CC-BY-4.0 (w każdym rekordzie) |
| `aed.geojson` | te same rekordy jako punkty WGS 84 | jw. |
| `aed.jsonld` | te same rekordy jako JSON-LD (schema.org) – poziom 4 | jw. |
| `aed_osm_odbl.csv`, `aed_osm_odbl.geojson` | rekordy wyłącznie z OpenStreetMap – osobny zasób, © autorzy OpenStreetMap | ODbL-1.0 |
| `aed_pochodzenie.csv` | pochodzenie: rekord–źródło, rekord nadrzędny | CC0-1.0 |
| `zrodla.csv` | zakres referencyjny źródeł: liczba rekordów, włączone, pokrycie pól wymaganych i zalecanych | CC0-1.0 |
| `slownik_danych.csv`, `aed.csvw.json` | słownik danych i metadane W3C CSVW dla `aed.csv` | CC0-1.0 |
| `metadane.jsonld` | metadane zbioru DCAT-AP-PL (pl/en) | CC0-1.0 |
| `dane_gov_pl_import.xml` | plik do automatycznego zasilania portalu (struktura wg instrukcji COI) | – |

Sprawdzenie: `python scripts/check_csv.py deliverables/dataset/*.csv`. Zgodność punkt po punkcie: `docs/tech/COMPLIANCE.md`.
