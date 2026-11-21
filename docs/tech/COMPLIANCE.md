# Zgodność z zasadami portalu dane.gov.pl – punkt po punkcie

Podstawa: „Standard techniczny: Standardy otwartości danych” (dane.gov.pl, baza wiedzy) oraz „Instrukcja przygotowania pliku XML” COI (v1.0.6, 2025-11-21). Sprawdzanie automatyczne: `python scripts/check_csv.py deliverables/dataset/*.csv` i `pytest` (`tests/test_api_publish.py::test_exports_standard`).

## Formaty i poziomy otwartości

| Zasób | Format | Poziom | Uwagi |
|---|---|---|---|
| `aed.csv`, `aed_osm_odbl.csv`, `aed_pochodzenie.csv`, `zrodla.csv`, `slownik_danych.csv` | CSV | 3 | + `aed.csvw.json` (W3C CSVW) – droga do poziomu 4 |
| `aed.geojson`, `aed_osm_odbl.geojson` | GeoJSON (wektor) | 3 | WGS 84, punkty |
| `aed.jsonld`, `GET /aed/{id}` z `Accept: application/ld+json`, `/kontekst.jsonld` | JSON-LD (schema.org) | 4 | każde pole ma URI (schema.org albo słownik zbioru) |
| `GET /api/v1/aed` | JSON API | 3 | stronicowanie z linkami, filtrowanie, wyszukiwanie |
| `metadane.jsonld` | DCAT-AP (JSON-LD) | – | metadane zbioru pl/en |
| `dane_gov_pl_import.xml` | XML importu COI | – | automatyczne zasilanie portalu |
| `szablon.xlsx` | XLSX | 2 | **tylko szablon dla dysponentów** – nie publikujemy w nim danych |

## CSV (Standard, rozdz. 4)

| Wymóg | Realizacja | Test |
|---|---|---|
| UTF-8 (bez BOM) | `publish.to_csv` koduje UTF-8 bez BOM; `Content-Type: text/csv; charset=utf-8` | `check_csv.py` – BOM, kodowanie |
| Separator: przecinek | `csv.writer(delimiter=",")` | parser RFC 4180 w `check_csv.py` |
| Końce wierszy CRLF (RFC 4180) | `lineterminator="\r\n"`, także po ostatnim wierszu | `check_csv.py` |
| Cudzysłów przy znakach specjalnych | `QUOTE_MINIMAL` (przecinek, cudzysłów, nowa linia) | parser `strict=True` |
| Dokładnie jeden wiersz nagłówka, unikalne, niepuste nazwy | nagłówek = kolejność ze `slownik_danych.csv` | `test_exports_standard` (nagłówek = słownik danych) |
| Ta sama liczba pól w każdym wierszu | stała lista kolumn | `check_csv.py` |
| Bez pustych wierszy, legend i dopisków | eksport tylko rekordów | `check_csv.py` |
| Wartości powtarzalne wpisane w każdym wierszu | każdy rekord kompletny (np. dysponent w każdym wierszu) | – |
| Kolumny całkowicie puste | kolumny pochodzą z zakresu danych; pola opcjonalne bez wartości w danym wydaniu są zgłaszane jako informacja (kolumny są stałe, żeby schemat zbioru się nie zmieniał) | `check_csv.py` (informacja) |

## Formatowanie wartości (Standard, rozdz. 3)

| Wymóg | Realizacja |
|---|---|
| Wartości logiczne `true` / `false` | `normalize.to_bool` (TAK/NIE, 1/0…) → bool; `publish.fmt` → `true`/`false` |
| Kropka dziesiętna, bez separatorów tysięcy | `normalize.to_number`; współrzędne zawsze z 6 miejscami po przecinku |
| Daty `yyyy-mm-dd`; data i czas `yyyy-mm-ddThh:mm` | `to_date`, `to_datetime`; walidacja `format: date` |
| Jedna wartość w jednym polu | adres i współrzędne z jednego pola są rozdzielane przy imporcie |
| Adres w osobnych polach, tekst jak w źródle | `ulica_cecha, ulica, numer_budynku, numer_lokalu, kod_pocztowy, miejscowosc` – bez zmian pisowni |
| TERYT (zalecane) | pola `teryt_terc`, `teryt_simc` – przenoszone, gdy są w źródle |
| REGON 9 lub 14 cyfr; telefon 9 cyfr bez spacji i łączników | `normalize.digits`, `normalize.phone` (usuwa `+48`, spacje, łączniki); wzorce w JSON Schema |

## JSON i API (Standard, rozdz. 5)

- Poprawny JSON (RFC 8259) – FastAPI/`json`.
- Struktura w stylu JSON API: `data[] {type, id, attributes, meta}`, `meta {count, page, per_page}`, `links {self, first, last, next, prev}`.
- Filtrowanie: `bbox`, `wojewodztwo`, `gmina`, `dostep`, `dostepne_teraz`, `q`, `warstwa`, `zrodlo_danych`; stronicowanie `page`, `per_page` (≤ 1000).
- Poziom 4: kontekst JSON-LD w nagłówku HTTP `Link: <…/kontekst.jsonld>; rel="http://www.w3.org/ns/json-ld#context"` przy odpowiedziach `/aed`; rekord jako JSON-LD po `Accept: application/ld+json`.
- Opis interfejsu: OpenAPI `docs/tech/openapi.json`, dokumentacja interaktywna `/api/v1/docs`.
- Błędy: `{"error": {"code", "message" (po polsku), "fields"}}`, walidacja → HTTP 422.

## Metadane (Standard, rozdz. 8; DCAT-AP-PL)

`metadane.jsonld`: `dct:title` i `dct:description` pl/en, `dcat:keyword` pl/en, `dcat:theme` HEAL, `dct:accrualPeriodicity` DAILY, `dct:issued`, `dct:modified`, `dct:language`, `dct:spatial` POL, `dct:publisher`, `dcat:contactPoint`, `dct:conformsTo` (słownik danych), dystrybucje z `dct:license`, `dcat:mediaType`, `dct:format` (słowniki EU Publications Office).

## Plik XML do automatycznego zasilania (instrukcja COI)

`dane_gov_pl_import.xml`: `<p:datasets>` → `dataset status="published"` (`extIdent` ≤ 36 znaków i stały, `title`/`description` pl+en w limitach 300/1000, `url`, `categories/category`, `conditions`, `resources`, `tags`, `updateFrequency`, flagi `hasDynamicData`, `hasHighValueData`, `hasHighValueDataFromEuropeanCommissionList`, `hasResearchData`) → `resource` (`extIdent`, `url`, `title`, `description`, `availability`, `dataDate`, `specialSigns`, flagi, `containsProtectedData=false`). Test: plik jest poprawnym XML. **Do potwierdzenia (CR-1):** URI przestrzeni nazw `p`, XSD, składnia `<tags>`.

## Licencje

- **Dane:** `aed.csv`/`aed.geojson`/`aed.jsonld` – CC0-1.0 (lub CC-BY-4.0, jeśli dysponent tak wskaże; licencja w każdym rekordzie). Dane OpenStreetMap (ODbL-1.0) **wyłącznie** w osobnych zasobach `aed_osm_odbl.*` z atrybucją „© autorzy OpenStreetMap”; wartości z OSM nie są kopiowane do rekordów CC0 (CR-5).
- **Kod:** zależności uruchomieniowe wyłącznie MIT / BSD / Apache-2.0 / PSF – `python scripts/check_licenses.py` (wynik: 0 pozycji spoza listy). Narzędzia testowe (pytest, httpx) w `pyproject.toml` → `test` – nie trafiają do obrazu Docker.
- **Dane osobowe:** brak – zgłoszenie obywatela nie zawiera kontaktu, telefonów i e-maili z OSM nie importujemy, `containsProtectedData=false`.

## Znane odstępstwa i ograniczenia

- Warstwa OSM: pola adresowe wymagane przez zakres danych mogą być puste, bo OSM ich zwykle nie ma (CR-3).
- „Dostępne teraz” obsługuje podzbiór składni opening_hours; inny zapis → `null` i komunikat „Sprawdź godziny na miejscu”.
- Województwo uzupełniane z kodu pocztowego to przybliżenie (oznaczone w raporcie importu jako `informacja`).
