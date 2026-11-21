# CONTRACT v1.0 – Misja AED (Ministerstwo Cyfryzacji, Departament Zarządzania Danymi)

> Wspólny plik: edytuje tylko Team Leader. Zamrożenie: sob 15:00 (po konsultacji na stoisku danych). Zmiany wyłącznie przez CR (tabela na końcu).
> Źródło prawdy dla danych: `docs/schema/` (JSON Schema, słownik danych, słowniki wartości, CSVW, przykład XML importu) i `deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx`. Wszystkie te pliki powstały z jednej definicji, więc są spójne.

## 1. Zasady

- REST API w JSON pod prefiksem `/api/v1`. Odpowiedzi list: `{"data": [...], "meta": {"count", "page", "per_page"}, "links": {"self", "next", "prev"}}` (styl JSON API – wymóg Standardu technicznego dla JSON na poziomie 3: stronicowanie, filtrowanie). Wzór: `data/sample/api_aed_strona1.json`.
- Błędy: `{"error": {"code": "...", "message": "...po polsku...", "fields": {"pole": "komunikat"}}}`; walidacja → HTTP 422.
- Formaty danych według Standardu technicznego dane.gov.pl: wartości logiczne `true`/`false`, kropka dziesiętna bez separatorów tysięcy, daty `yyyy-mm-dd`, data i czas `yyyy-mm-ddThh:mm`, jedna wartość w jednym polu, adres w osobnych polach.
- Współrzędne: WGS 84 (EPSG:4326), stopnie dziesiętne, 6 miejsc po przecinku. Strefa czasowa obliczeń „dostępne teraz”: Europe/Warsaw.
- Model A publikuje `docs/tech/openapi.json` przy każdej synchronizacji. Model B do czasu gotowości API pracuje na `data/sample/`.

## 2. Rekord AED – wzorcowy zakres danych v0.9 (44 pola, 24 wymagane)

Pełne opisy, przykłady, słowniki i mapowanie na OpenStreetMap i schema.org: `docs/schema/slownik_danych.csv` i plik XLSX.

| Pole | Obowiązkowość | Typ | Format |
|---|---|---|---|
| `id_aed` | wymagane | tekst | ^AED-PL-[0-9A-F]{10}$ |
| `id_dysponenta_aed` | zalecane | tekst | maks. 50 znaków |
| `nazwa_obiektu` | wymagane | tekst | maks. 200 znaków |
| `opis_lokalizacji` | wymagane | tekst | maks. 250 znaków |
| `pietro` | zalecane | liczba całkowita | -5…100 |
| `wewnatrz_budynku` | wymagane | logiczny | true | false |
| `wojewodztwo` | wymagane | tekst (słownik) | słownik: wojewodztwo |
| `powiat` | zalecane | tekst | – |
| `gmina` | wymagane | tekst | – |
| `miejscowosc` | wymagane | tekst | – |
| `ulica_cecha` | zalecane | tekst (słownik) | słownik: ulica_cecha |
| `ulica` | zalecane | tekst | – |
| `numer_budynku` | wymagane | tekst | maks. 10 znaków |
| `numer_lokalu` | opcjonalne | tekst | maks. 10 znaków |
| `kod_pocztowy` | wymagane | tekst | ^\d{2}-\d{3}$ |
| `teryt_terc` | zalecane | tekst | ^\d{6}$ |
| `teryt_simc` | zalecane | tekst | ^\d{7}$ |
| `szerokosc_geograficzna` | wymagane | liczba dziesiętna | 49.000000…54.900000 |
| `dlugosc_geograficzna` | wymagane | liczba dziesiętna | 14.100000…24.200000 |
| `dostep` | wymagane | tekst (słownik) | słownik: dostep |
| `godziny_dostepnosci` | wymagane | tekst | składnia opening_hours |
| `dostepny_24h` | wymagane | logiczny | true | false |
| `szafka_zamknieta` | wymagane | logiczny | true | false |
| `instrukcja_dostepu` | zalecane | tekst | maks. 250 znaków |
| `mobilny` | wymagane | logiczny | true | false |
| `status_urzadzenia` | wymagane | tekst (słownik) | słownik: status_urzadzenia |
| `tryb_pediatryczny` | zalecane | logiczny | true | false |
| `producent` | opcjonalne | tekst | – |
| `model` | opcjonalne | tekst | – |
| `data_waznosci_elektrod` | zalecane | data | yyyy-mm-dd |
| `data_ostatniego_przegladu` | zalecane | data | yyyy-mm-dd |
| `dysponent_nazwa` | wymagane | tekst | maks. 250 znaków |
| `dysponent_typ` | wymagane | tekst (słownik) | słownik: dysponent_typ |
| `dysponent_regon` | zalecane | tekst | ^\d{9}(\d{5})?$ |
| `kontakt_telefon` | zalecane | tekst | ^(\+48)?\d{9}$ |
| `kontakt_email` | zalecane | tekst | adres e-mail |
| `zrodlo_danych` | wymagane | tekst (słownik) | słownik: zrodlo_danych |
| `licencja` | wymagane | tekst (słownik) | słownik: licencja |
| `data_weryfikacji` | wymagane | data | yyyy-mm-dd |
| `metoda_weryfikacji` | wymagane | tekst (słownik) | słownik: metoda_weryfikacji |
| `data_aktualizacji` | wymagane | data i czas | yyyy-mm-ddThh:mm |
| `kompletnosc` | zalecane | liczba całkowita | 0…100 |
| `zdjecie_url` | opcjonalne | URL | https://… |
| `uwagi` | opcjonalne | tekst | maks. 500 znaków |

**Kompletność** = odsetek wypełnionych pól wymaganych i zalecanych (0–100), liczona przy każdym zapisie.

## 3. Zasoby towarzyszące

- `aed_pochodzenie.csv`: `id_aed, kod_zrodla, id_w_zrodle, licencja_zrodla, data_pobrania, rekord_nadrzedny` – jeden wiersz na parę rekord–źródło. Dzięki temu w rekordzie AED każde pole ma jedną wartość.
- `zrodla.csv` – **zakres referencyjny źródeł** (wymóg „ze wskazaniem ich referencyjnego zakresu”): `kod_zrodla, nazwa, typ_zrodla, format, licencja, czestotliwosc_aktualizacji, liczba_rekordow, rekordy_wlaczone, pokrycie_pol_wymaganych_proc, pokrycie_pol_zalecanych_proc, obszar`.
- `slownik_danych.csv` i `aed.csvw.json` (metadane CSVW – droga do poziomu 4 otwartości).
- Rekordy z licencją ODbL-1.0 (OpenStreetMap) trafiają do **osobnego zasobu** `aed_osm_odbl.csv` z uznaniem autorstwa i nie mieszają się z zasobem `aed.csv` (CC0-1.0 / CC-BY-4.0). Na mapie pokazujemy obie warstwy z atrybucją „© autorzy OpenStreetMap”.

## 4. Przetwarzanie: import → mapowanie → normalizacja → walidacja → deduplikacja → publikacja

1. **Import:** CSV (wykrywanie separatora, kodowania i przecinka dziesiętnego), XLSX, JSON, GeoJSON; formularz pojedynczego AED; zgłoszenie obywatela; konektory: OpenStreetMap (eksport AED OSM Polska, CSV/GeoJSON), wyszukiwarka API dane.gov.pl (zbiory z frazą AED/defibrylator).
2. **Mapowanie kolumn:** automatyczna propozycja na podstawie nazw i przykładowych wartości, poprawiana przez użytkownika. Wzór raportu: `data/sample/raport_walidacji_przyklad.json`.
3. **Normalizacja:** `TAK/NIE`, `tak/nie`, `1/0` → `true/false`; przecinek dziesiętny → kropka; adres w jednym polu → cecha, ulica, numer, kod, miejscowość; zapisy godzin („pn-pt 8-16”, „całodobowo”) → składnia opening_hours (`Mo-Fr 08:00-16:00`, `24/7`); OSM `access`: `yes` → publiczny, `customers`/`permissive` → ograniczony, `private`/`no` → prywatny; `indoor` → `wewnatrz_budynku`.
4. **Walidacja:** JSON Schema (`docs/schema/aed.schema.json`), współrzędne w granicach Polski, kod pocztowy, słowniki, daty. Wynik dla każdego wiersza: błąd, ostrzeżenie albo poprawny, z propozycją poprawki.
5. **Deduplikacja:** ten sam AED, gdy odległość ≤ 5 m albo odległość ≤ 30 m i podobieństwo nazwy lub adresu ≥ 0,6. Priorytet źródeł: dysponent > dane_gov_pl > osm > zgloszenie_obywatela. Scalanie pole po polu: wartość z najwyższego priorytetu, przy remisie najnowsza. Rekord dostaje stały `id_aed` przy pierwszym włączeniu; pochodzenie trafia do `aed_pochodzenie.csv`.
6. **Zgłoszenia obywateli** mają status `do_weryfikacji` i nie trafiają do zbioru, dopóki nie zatwierdzi ich moderator albo dysponent.

## 5. Endpointy

| Metoda i ścieżka | Kto | Opis |
|---|---|---|
| `GET /aed` | publiczny | filtry: `bbox`, `wojewodztwo`, `gmina`, `dostep`, `dostepne_teraz`, `q`, `page`, `per_page` |
| `GET /aed/{id_aed}` | publiczny | rekord + pochodzenie + liczba potwierdzeń |
| `GET /aed/najblizsze?lat=&lon=&limit=5&tylko_dostepne_teraz=` | publiczny | posortowane po `odleglosc_m`; pole `dostepny_teraz` (true/false/null, gdy godzin nie da się zinterpretować) |
| `POST /import` | dysponent | multipart: plik + `kod_zrodla` + `licencja` → `{import_id, wykryty_format, mapowanie_proponowane}` |
| `POST /import/{id}/mapowanie` | dysponent | `{mapowanie}` → raport walidacji |
| `POST /import/{id}/zatwierdz` | dysponent | włączenie poprawnych wierszy → liczby: dodane, zaktualizowane, scalone, odrzucone |
| `POST /aed`, `PATCH /aed/{id_aed}` | dysponent, moderator | formularz pojedynczego AED; 422 z komunikatami przy polach |
| `POST /zgloszenia` | publiczny | zgłoszenie obywatela (`lat`, `lon`, `opis`, opcjonalnie zdjęcie) |
| `GET /zgloszenia`, `POST /zgloszenia/{id}/decyzja` | moderator | weryfikacja zgłoszeń |
| `POST /aed/{id_aed}/potwierdzenia` | publiczny | „Paszport AED” z kodu QR: `{jest_na_miejscu, szafka_dostepna, komentarz}` |
| `GET /zrodla` | publiczny | zakres referencyjny źródeł (jak `zrodla.csv`) |
| `POST /zrodla/osm/odswiez`, `POST /zrodla/dane-gov-pl/szukaj` | moderator | konektory |
| `GET /eksport/{plik}` | publiczny | `aed.csv`, `aed.geojson`, `aed_osm_odbl.csv`, `aed_pochodzenie.csv`, `zrodla.csv`, `slownik_danych.csv`, `aed.csvw.json`, `dane_gov_pl_import.xml`, `metadane.jsonld` |
| `GET /szablon.csv`, `GET /szablon.xlsx` | publiczny | pusty szablon zgodny z zakresem danych, dla dysponentów |
| `GET /statystyki` | publiczny | liczby według województw i źródeł, rozkład kompletności, odsetek zweryfikowanych w ostatnich 12 miesiącach |
| `POST /auth/login` | – | konta demo: `dysponent`, `moderator` (hasła w `.env`) |

## 6. Publikacja w dane.gov.pl

- Pakiet w `deliverables/dataset/` (generuje Model A): CSV poziom 3 (UTF-8, przecinek, CRLF, RFC 4180, jeden wiersz nagłówka), GeoJSON (format przestrzenny poziomu 3–5), API JSON, CSVW, zasoby towarzyszące z sekcji 3.
- Plik XML importu do automatycznego zasilania portalu: struktura `dataset` + `resources` według instrukcji COI; przykład w `docs/schema/dane_gov_pl_import.przyklad.xml`. **XSD i przestrzeń nazw do potwierdzenia** w kodzie źródłowym portalu lub na stoisku danych (CR-1).
- Metadane zbioru także w DCAT-AP-PL (JSON-LD): tytuł i opis pl/en, wydawca, kategoria, słowa kluczowe, licencja, częstotliwość, daty `issued`/`modified`, punkt kontaktowy.
- Kategoria `HEAL` i warunki ponownego wykorzystania – do potwierdzenia z zespołem dane.gov.pl (CR-2).

## 7. „Dostępne teraz”

Serwer interpretuje podzbiór składni opening_hours: `24/7`; dni `Mo Tu We Th Fr Sa Su` z zakresami (`Mo-Fr`); kilka reguł rozdzielonych `;`; przedziały `HH:MM-HH:MM`; `off`. Inny zapis → `dostepny_teraz: null` i komunikat „Sprawdź godziny na miejscu”. Rekord z `dostep = prywatny` nigdy nie jest „dostępny teraz” dla publiczności; z `mobilny = true` – pokazujemy z oznaczeniem „urządzenie w pojeździe”.

## Rejestr zmian (CR)

| CR | Kto prosi | Zmiana | Decyzja | Wersja |
|---|---|---|---|---|
| CR-1 | Team Leader | Schemat XSD i przestrzeń nazw pliku XML importu | do potwierdzenia na stoisku danych | – |
| CR-2 | Team Leader | Kategoria zbioru i warunki ponownego wykorzystania | do potwierdzenia na stoisku danych | – |
