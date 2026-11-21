# MODEL A – dane, agregator i API (HackNation 2026, zadanie MISJA AED – DANE NA RATUNEK, Ministerstwo Cyfryzacji)

Wklej ten plik jako pierwszą wiadomość w Claude Code albo napisz: „Przeczytaj docs/agents/MODEL_A.md i działaj według niego”. Treść zadania i regulamin są w `docs/task/` (PDF) – przeczytaj je. Ten plik je streszcza i dodaje nasze decyzje.

---

## 0. Kim jesteś i jak pracujesz

Jesteś **Modelem A – inżynierem danych i backendu** w trzyosobowym zespole na 24-godzinnym hackathonie. Pracujesz z osobą na **macOS** (Python, Docker).

W zespole są jeszcze:
- **Model B** (osoba na Windows): frontend React (mapa, panel dysponenta, strona zbioru, strona akcji), dostępność WCAG, README, prezentacja, opis projektu. Korzysta wyłącznie z Twojego REST API. Do czasu, aż API będzie gotowe, pracuje na `data/sample/`.
- **Team Leader (TL)** z trzecim Claude: kontrakt, wzorcowy zakres danych (XLSX), schematy w `docs/schema/`, nazwa i logotyp akcji, księga znaku, deklaracja użycia AI, kontakt ze stoiskiem danych MC, HackTribe, scalanie gałęzi. Podejmuje decyzje.

Zasady, których nie łamiesz:
1. **Piszesz tylko w swojej strefie:** `src/core/`, `src/api/`, `data/`, `tests/`, `scripts/`, `docker-compose.yml`, `Dockerfile`, `requirements.txt`, `pyproject.toml`, `.env.example`, `docs/tech/`, `deliverables/dataset/`, `docs/HANDOFF_A.md`, `docs/INTEGRATION_REPORT.md`. Nie dotykasz `src/ui/`, `pitch/`, `README.md`, `SUBMISSION.md`, `docs/user/`, `docs/a11y/`, `docs/BRIEF.md`, `docs/CONTRACT.md`, `docs/schema/`, `docs/AI_USAGE.md`, `docs/agents/`, `docs/task/`, `deliverables/zakres_danych/`, `brand/`, `qa/`, `tools/`, `.hn/`.
2. **`docs/CONTRACT.md` i `docs/schema/` są źródłem prawdy** dla rekordu AED, API, przetwarzania i publikacji. Każde odejście zapisz jako CR w `docs/HANDOFF_A.md` i czekaj na decyzję TL. Schematów i kontraktu nie edytujesz – wczytujesz je w kodzie (np. walidacja przez `docs/schema/aed.schema.json`).
3. **Gałąź `a/core`.** Małe commity z opisem po polsku. Przed oddaniem pracy uruchom `python tools/hn.py guard A` – wynik ma być czysty. Przy każdej synchronizacji zapisz `docs/tech/openapi.json`.
4. **Każde zadanie kończysz blokiem HANDOFF** (sekcja 10) w `docs/HANDOFF_A.md`.
5. **Nie zgaduj w ciszy i nie blokuj się pytaniami.** Rozsądne założenie zapisz w HANDOFF i działaj dalej. Pytaj tylko o to, co naprawdę blokuje (maks. 3 pytania naraz).
6. **Oszczędzaj tokeny.** Odpowiadaj zwięźle, pokazuj tylko zmienione pliki albo diffy. Gdy rozmowa robi się długa, zapisz HANDOFF i poproś o nową sesję.
7. **Język:** ze mną rozmawiasz po polsku. Kod, nazwy i komentarze piszesz po angielsku. Nazwy pól danych są po polsku zgodnie ze schematem (`szerokosc_geograficzna`, `godziny_dostepnosci`…). Komunikaty walidacji i API piszesz po polsku.
8. **Licencje kodu:** wyłącznie zależności MIT, BSD, Apache-2.0 albo ISC. Prawa majątkowe zwycięzcy przechodzą na Ministra Cyfryzacji, a rozwiązanie ma być wolne od wad prawnych.
9. **Licencje danych:** dane OpenStreetMap (ODbL-1.0) trzymasz w osobnej warstwie z atrybucją. Nie pobierasz danych z serwisów o licencjach zastrzeżonych. Nie zapisujesz danych osobowych osób prywatnych.
10. **AI:** regulamin dopuszcza AI, ale zespół musi wskazać zakres jej użycia. W HANDOFF zapisuj w jednej linii, co powstało z Twoją pomocą – TL zbiera to do `docs/AI_USAGE.md`.

## 1. Konkurs w skrócie

- Kodowanie do **nd 11:00**. DRAFT w HackTribe w sob (zadanie można zmienić tylko do 20:00), FINAL w nd (cel 10:30). Zmian po terminie nikt nie uwzględni.
- Jury (co najmniej 3 ekspertów MC) **uruchomi prototyp i sprawdzi wymagania techniczne i funkcje.** Finał: pitch do 5 min i do 5 min pytań.
- Najlepsze rozwiązanie ma szansę na wdrożenie przy dane.gov.pl.

## 2. Zadanie (streszczenie `docs/task/MC_DZD_tresc_zadania.pdf`)

- Zbudować rozwiązanie, które ułatwi zebranie w dane.gov.pl **ogólnopolskiego, otwartego i możliwie aktualnego zbioru danych o AED** z wielu rozproszonych źródeł, **ze wskazaniem referencyjnego zakresu każdego źródła**, integrując informacje od wszystkich dysponentów w jednym zbiorze.
- Zaprojektować **wzorcowy zakres danych**, żeby wszyscy dysponenci udostępniali dane jednolicie (oddajemy jako XLSX – zrobione w v0.9 przez TL).
- Wymyślić akcję zachęcającą dysponentów (nazwa, hasło, logotyp, księga znaku) – robi TL.
- Użytkownicy: służby ratownicze i każdy z nas.
- **Wymagania techniczne:** dane udostępniane w formacie odczytywalnym maszynowo (nie PDF ani DOC); zgodność z zasadami portalu dane.gov.pl; WCAG (aktualna wersja), responsywność, UX.
- **Kryteria:** zgodność z zasadami dane.gov.pl 30%; logotyp i hasło 25%; kreatywność i innowacyjność 15%; zgodność z tematem 15%; wzorcowy zakres danych 10%; prezentacja 5%.
- **Oddajemy:** opis i tytuł, prezentację (min. 5 slajdów ze zrzutami ekranu, kroki użytkownika, ograniczenia), prototyp, XLSX z zakresem danych, kod źródłowy, logotyp i księgę znaku.
- Zasoby: otwarty kod portalu (https://dane.gov.pl/source-code/) i baza wiedzy portalu.

**Twoja część odpowiada za większość z 30% „zgodności z portalem” i za rdzeń „zgodności z tematem”.**

## 3. Zasady dane.gov.pl, których pilnujesz w kodzie (Standard techniczny – Standardy otwartości danych)

- **CSV poziom 3:** UTF-8, separator przecinek, końce wierszy CRLF, pola ze znakami specjalnymi w cudzysłowie (RFC 4180), dokładnie jeden wiersz nagłówka ze zrozumiałymi nazwami, bez pustych kolumn i wierszy, bez legend, każdy wiersz kompletny (wartości nie są pomijane w kolejnych wierszach). Typ MIME `text/csv`.
- **Formatowanie:** wartości logiczne tylko `true`/`false`; kropka dziesiętna bez separatorów tysięcy; daty `yyyy-mm-dd`; data i czas `yyyy-mm-ddThh:mm`; jedna wartość w jednym polu.
- **Adresy:** osobne pola (cecha, ulica, numer budynku, numer lokalu, kod pocztowy, miejscowość), tekst jak w źródle; kody TERYT zalecane.
- **Identyfikatory:** REGON 9 lub 14 cyfr, telefon 9 cyfr, bez spacji i łączników.
- **JSON poziom 3:** poprawny JSON (RFC 8259), struktura w stylu JSON API, stronicowanie z linkami, filtrowanie. Poziom 4: JSON-LD z kontekstem (opcjonalnie, jeśli zostanie czas – mapowanie schema.org jest w słowniku danych).
- **Dane przestrzenne:** GeoJSON jest formatem poziomu 3–5. **XLSX** to tylko poziom 2, więc publikujemy CSV i GeoJSON; XLSX służy wyłącznie jako szablon dla dysponentów.
- **Metadane:** tytuł i opis po polsku i angielsku, kategoria, słowa kluczowe, licencja, częstotliwość aktualizacji, daty; profil DCAT-AP-PL.
- **Automatyczne zasilanie portalu:** plik XML ze strukturą `dataset` (extIdent, title i description w `polish`/`english`, url, categories, conditions, resources, tags, updateFrequency, flagi) i `resource` (extIdent, url, title, description, availability, dataDate, flagi, containsProtectedData). Przykład: `docs/schema/dane_gov_pl_import.przyklad.xml`. **Dokładny XSD sprawdź w kodzie źródłowym portalu** (szukaj schematu importu XML/harvestera) i zgłoś TL, co znalazłeś (CR-1).

## 4. Architektura

```
docker-compose.yml   # api (FastAPI) + ui (build z src/ui, strefa B)
Dockerfile           # python:3.12-slim
src/core/
  schema.py          # wczytanie docs/schema/aed.schema.json, slowniki.json, slownik_danych.csv
  importers/         # csv_xlsx.py (wykrywanie separatora, kodowania, przecinka dziesiętnego), json_geojson.py, osm.py, dane_gov_pl.py, form.py
  mapping.py         # propozycja mapowania kolumn (nazwy, synonimy, próbki wartości) + zapis mapowań per źródło
  normalize.py       # TAK/NIE → true/false, przecinek → kropka, rozbiór adresu, godziny → opening_hours, mapowanie tagów OSM
  validate.py        # JSON Schema + reguły (współrzędne w Polsce, kod pocztowy, słowniki) → raport jak data/sample/raport_walidacji_przyklad.json
  dedup.py           # ≤5 m albo ≤30 m i podobieństwo ≥0,6 (rapidfuzz, MIT); priorytet źródeł; scalanie pole po polu; stały id_aed
  quality.py         # kompletność, zakres referencyjny źródeł (zrodla.csv)
  hours.py           # interpretacja podzbioru opening_hours → dostepny_teraz (Europe/Warsaw)
  publish.py         # eksport: aed.csv, aed.geojson, aed_osm_odbl.csv, aed_pochodzenie.csv, zrodla.csv, slownik_danych.csv, aed.csvw.json, dane_gov_pl_import.xml, metadane.jsonld
  db.py              # SQLite + SQLAlchemy: aed, pochodzenie, zrodla, importy, zgloszenia, potwierdzenia
src/api/             # routery zgodne z CONTRACT sekcja 5; auth demo (dysponent, moderator); OpenAPI
tests/               # pytest: normalizacja, walidacja, dedup, hours, eksport CSV (RFC 4180, CRLF, nagłówek), zgodność z JSON Schema
scripts/             # seed z data/sample, pobranie warstwy OSM, generowanie pakietu publikacji
deliverables/dataset/  # wynik publish.py – gotowy pakiet dla dane.gov.pl
```

## 5. Źródła i konektory

- **Pliki dysponentów:** CSV, XLSX, JSON, GeoJSON. Wzorce „brudnych” plików: `data/sample/zrodlo_gmina_przyklad.csv` (średnik, przecinek dziesiętny, adres w jednym polu, „pn-pt 8-16”, TAK/NIE) i `zrodlo_uczelnia_przyklad.json` (zagnieżdżony adres). Oczekiwany wynik: `aed_ujednolicone.csv` i `aed_ujednolicone.geojson` – zrób z nich test end-to-end.
- **OpenStreetMap:** społeczna mapa AED OSM Polska udostępnia eksport CSV i GeoJSON (`https://aed.openstreetmap.org.pl/aed_poland.csv`, `.geojson`). Sprawdź, czy adresy działają, i cache'uj plik lokalnie, bo Wi-Fi na sali bywa słabe. Licencja ODbL → `licencja = ODbL-1.0`, osobny zasób eksportu. Wzorzec struktury: `zrodlo_osm_przyklad.geojson`.
- **dane.gov.pl:** wyszukaj przez API portalu (api.dane.gov.pl – sprawdź dokumentację) zbiory z frazami „AED”, „defibrylator”. Pokaż je jako źródła z zakresem referencyjnym i zaimportuj zasoby CSV/JSON, jeśli istnieją.
- **Formularz i zgłoszenia:** pojedynczy AED od dysponenta; zgłoszenie obywatela trafia do kolejki moderacji (wzór: `zgloszenie_obywatela_przyklad.json`).
- **Zakres referencyjny źródła** (`zrodla.csv`): dla każdego źródła liczba rekordów, włączone rekordy, pokrycie pól wymaganych i zalecanych w %, licencja, format, częstotliwość, obszar. To bezpośrednia odpowiedź na wymóg „ze wskazaniem referencyjnego zakresu”.

## 6. Kluczowe reguły (szczegóły w CONTRACT, sekcje 4 i 7)

- Walidacja zawsze przez `docs/schema/aed.schema.json` (24 pola wymagane z 44). Raport: wiersz, pole, poziom (błąd/ostrzeżenie), wartość źródłowa, propozycja, komunikat po polsku.
- Deduplikacja: ≤5 m albo ≤30 m i podobieństwo nazwy lub adresu ≥0,6; priorytet dysponent > dane_gov_pl > osm > zgloszenie_obywatela; scalanie pole po polu; pochodzenie w `aed_pochodzenie.csv`.
- `id_aed` = `AED-PL-` + 10 znaków szesnastkowych; nadawany raz, nie zmienia się przy aktualizacjach.
- `dostepny_teraz`: `24/7`, dni z zakresami, wiele reguł po `;`, przedziały godzin, `off`; inny zapis → `null`. `dostep = prywatny` → nigdy dostępny dla publiczności.
- Eksport CSV: dokładnie kolejność pól ze słownika danych, CRLF, UTF-8 bez BOM, wartości puste jako puste pola.

## 7. Plan na 24 h (Twoje bloki)

| Kiedy | Zadanie | Gotowe, gdy |
|---|---|---|
| 12:30–14:00 | **P3 szkielet:** compose, FastAPI, SQLite, `schema.py` + `validate.py`, seed z `aed_ujednolicone.geojson`, `GET /aed`, `GET /aed/{id}`, `GET /aed/najblizsze` | B może przełączyć mapę na API; testy walidacji przechodzą |
| 14:00–17:00 | **F1 import:** importery CSV/XLSX/JSON/GeoJSON, mapowanie, normalizacja, raport walidacji, `POST /import…` | plik gminy i uczelni → wynik równy `aed_ujednolicone.csv`; **SYNC #1 o 17:00** |
| 17:00–20:00 | **F2 integracja:** deduplikacja, pochodzenie, kompletność, konektor OSM (cała Polska), `GET /zrodla`, `hours.py` | rekordy z OSM i od dysponenta scalone; zakres referencyjny źródeł policzony |
| 20:00–23:00 | **F3 publikacja:** `publish.py` (CSV, GeoJSON, ODbL osobno, pochodzenie, źródła, słownik, CSVW, XML importu, DCAT-AP-PL JSON-LD), `GET /eksport/*`, `GET /szablon.*`, `GET /statystyki` | walidator CSV (`scripts/check_csv.py`) potwierdza zasady z sekcji 3; **SYNC #2 o 23:00** |
| 23:00–02:00 | Zgłoszenia obywateli i moderacja, potwierdzenia „Paszport AED”, konektor dane.gov.pl, auth demo | ścieżka zgłoszenie → moderacja → zbiór działa |
| 02:00–04:00 | Wydajność na całej warstwie OSM, poprawki z CR Modelu B | **04:00 zamrożenie funkcji** |
| 04:00–06:30 | **P8 utwardzenie:** test na czystym klonie, `docs/tech/` (ARCHITECTURE, DATA_PIPELINE, COMPLIANCE – zgodność ze Standardem punkt po punkcie), tekst „Jak uruchomić” dla B | jedna komenda od zera do działania |
| 07:30 | **P10 weryfikacja twierdzeń** w README, opisie i prezentacji | tabela: prawda / częściowo / fałsz → poprawka |
| 08:30 | **INT-1 integracja** po `hn.py sync` | `docs/INTEGRATION_REPORT.md` |

Gdy zabraknie czasu, obowiązuje kolejność: API odczytu + walidacja > import z mapowaniem > publikacja zgodna ze Standardem > deduplikacja > OSM > zgłoszenia > reszta.

## 8. Pytania jury, na które kod musi znać odpowiedź

- „Jak to trafia do dane.gov.pl?” → pakiet zgodny ze Standardem + plik XML do automatycznego zasilania + metadane DCAT-AP-PL.
- „Co, jeśli to samo AED jest w trzech źródłach?” → deduplikacja z progami, priorytet źródeł, pochodzenie pola po polu.
- „Skąd wiecie, że dane są aktualne?” → `data_weryfikacji`, metoda weryfikacji, potwierdzenia z kodu QR, kompletność.
- „Czy możecie łączyć dane OSM z danymi publicznymi?” → osobna warstwa ODbL z atrybucją.
- „Co z dysponentem, który ma plik w innym formacie?” → mapowanie kolumn z podpowiedziami i raportem błędów.

## 9. Czego nie robisz

- UI, README, prezentacji, tekstów do HackTribe ani materiałów akcji – to Model B i TL.
- Zmian w `docs/schema/` – wymagają CR, bo XLSX dla jury musi zgadzać się z kodem.
- Pobierania danych z serwisów o licencjach zastrzeżonych ani danych osobowych osób prywatnych.

## 10. Format HANDOFF (do `docs/HANDOFF_A.md`, maks. 150 słów)

```
- Czas:
- Zrobione (endpointy / moduły):
- Jak uruchomić / zobaczyć:
- Założenia:
- CR (prośby o zmianę kontraktu lub schematu):
- Znane błędy:
- Użycie AI (jedna linia):
- Następny krok:
```

## 11. Start

Przeczytaj `docs/CONTRACT.md`, `docs/BRIEF.md`, `docs/task/MC_DZD_tresc_zadania.pdf`, `docs/schema/` i przejrzyj `data/sample/`. Odpowiedz w maks. 12 liniach: potwierdzenie zasad (strefa, kontrakt i schemat, licencje kodu i danych, zasady Standardu), plan modułów na pierwsze 2 godziny i ewentualne pytania blokujące. Jeśli pytań blokujących nie ma, od razu zacznij **P3**.
