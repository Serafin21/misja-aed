# HANDOFF – Model A

## 2026-11-21 19:00 – HANDOFF #6: CR od B (#14) + pod nową mapę E2

- **Zrobione:** (1) `tzdata` w `requirements.txt` (tylko Windows, Apache-2.0) i w `check_licenses.py`; (2) `GET /aed?wojewodztwo=` filtruje **po położeniu** w granicach PRG (pole rekordu tylko gdy punkt poza granicami); (3) `GET /aed/punkty` ma dodatkowo `dostep`, `wiek_danych_dni` (null = brak daty), `mobilny`, `wojewodztwo` (z położenia) – do filtrów po stronie przeglądarki; (4) `GET /aed?ids=a,b,c` (maks. 200) – rekordy w podanej kolejności, dla listy obok mapy. 66 testów.
- **CR do B:** kształt punktu: `properties: {dostepny_teraz, stan_danych, osm, dostep, wiek_danych_dni, mobilny, wojewodztwo}`.
- **Użycie AI:** Claude.

## 2026-11-21 17:10 – HANDOFF #5: obraz Docker naprawiony i sprawdzony

- **Zrobione:** `Dockerfile` kopiuje `data/granice/` (bez tego w Dockerze `/pokrycie` dawało 404, a `gminy_bez_danych` = 0). Nowy `.dockerignore` (bez `.git`, `deliverables`, `node_modules` – szybszy build). **Pierwszy pełny build i start obu obrazów (api + ui) przetestowany**: 18 039 AED, `/pokrycie`, `/aed/punkty` z gzip, UI przez nginx bez trybu demonstracyjnego.
- **Uwaga:** gdy przy pierwszym starcie kontenera nie ma sieci, a w `data/cache/` brak `aed_poland.geojson`, baza dostaje tylko próbkę OSM i nie odświeża się sama (`start.sh` seeduje tylko pustą bazę) – wtedy `POST /zrodla/osm/odswiez` albo usunięcie wolumenu.
- **Następny krok:** –

## 2026-11-21 16:45 – HANDOFF #4: decyzje TL (CR-TL-2) – uprawnienia dysponenta, /aed/punkty, granice 16 województw, LICZBY

- **Czas:** sob 15:10–16:45
- **Zrobione:**
  1. **Uprawnienia:** zgłoszenia rozpatruje moderator (wszystkie) albo dysponent – tylko dla swoich AED (`dysponent_nazwa` = organizacja konta, w demo `DEMO_DYSPONENT_NAZWA`, domyślnie „Urząd Gminy Przykładowo”). Dysponent: `scal`/`odrzuc`, gdy zgłoszenie dotyczy jego AED (wskazany `id_aed_docelowy` albo najbliższy w 30 m); `zatwierdz` – nowy rekord dostaje jego `dysponent_nazwa`, cudza nazwa → 403. `GET /zgloszenia` dla dysponenta pokazuje tylko zgłoszenia jego AED. W zgłoszeniu zapisuje się `decyzje_podjal`. `docs/CONTRACT.md` §4 pkt 6 i tabela §5 spójne z API (CONTRACT v1.2, CR-TL-2).
  2. **`GET /api/v1/aed/punkty`** – lekka warstwa mapy dla całej Polski albo `?bbox=`; gzip (18 tys. punktów: 3,2 MB → 339 KB), `ETag` + 304 przy `If-None-Match`, `Cache-Control: no-cache`, budowa 0,2 s, potem z pamięci.
  3. **Granice gmin 16 województw** (2479 gmin, 7,3 MB, nazwy plików bez polskich znaków) – uproszczenie z zachowaniem topologii (wspólny odcinek granicy upraszczany raz → bez szczelin i nakładek); AED poza wielokątami → najbliższa gmina do 1 km; indeks przestrzenny. `/pokrycie?wojewodztwo=` bez zmian. W `/statystyki` nowe `wg_wojewodztw_polozenie`; `gminy_bez_danych` liczone dla całej Polski. W `zrodla.csv` jedno źródło `prg-gugik:gminy` (2479, Polska).
  4. **`docs/tech/LICZBY.md`** (skrypt `python -m scripts.liczby`) – liczby z pełnych danych bez rekordów fikcyjnych. Import OSM zapisuje teraz powody odrzuceń.
  - Testy: 64 (14 nowych: uprawnienia dysponenta i moderatora, kształt/bbox/gzip/ETag `/aed/punkty`, topologia na danych syntetycznych, **brak szczelin w danych PRG** – w województwach śródlądowych każdy odcinek granicy gminy należy do dokładnie 2 gmin, punkt na granicy i w morzu, województwo z położenia, 16 plików granic).
- **Liczby (z LICZBY.md):** 18 033 AED; aktualne 3 148 (17%), nieaktualne 14 885, w tym 12 169 bez żadnej daty; 351 z 2479 gmin bez AED w danych (najwięcej: mazowieckie 79, lubelskie 60, podlaskie 38); odrzucone 22 z 18 297 – wszystkie za długie teksty (nazwa > 200 znaków: 20).
- **Jak uruchomić:** `python -m scripts.seed --reset --osm full && uvicorn src.api.main:app`; `python -m scripts.build_granice` (sieć, ok. 4 min) albo `--offline`; `python -m scripts.liczby`; `pytest`.
- **CR do B – kształt `GET /api/v1/aed/punkty`:**
  ```json
  {"type": "FeatureCollection",
   "features": [{"type": "Feature", "id": "AED-PL-B939F7EBA4",
                 "geometry": {"type": "Point", "coordinates": [21.0139, 52.2437]},
                 "properties": {"dostepny_teraz": true, "stan_danych": "aktualne", "osm": false}}],
   "meta": {"count": 18039, "liczone_na": "2026-11-21T16:40", "prog_aktualnosci_dni": 365,
            "atrybucja_osm": "© autorzy OpenStreetMap (ODbL)"}}
  ```
  `dostepny_teraz`: true / false / null (godzin nie da się odczytać); `stan_danych`: `aktualne` / `nieaktualne`; `osm`: true = warstwa ODbL (pokaż atrybucję). Nagłówki: `Content-Type: application/geo+json`, `Content-Encoding: gzip` (przeglądarka rozpakowuje sama), `ETag`; `fetch` z domyślnym cache przeglądarki sam wyśle `If-None-Match`. Zastępuje `GET /aed?per_page=500` na mapie; szczegóły po kliknięciu z `GET /aed/{id}`. Kolejka moderacji: dysponent może dostać 403 `brak_uprawnien` – pokaż komunikat z `error.message`.
- **Założenia:** obiekty OSM ≤ 5 m od siebie z prawie tą samą nazwą (242) są traktowane jako duplikat w OSM i łączone (zachowanie z wcześniejszego kodu).
- **Znane błędy / do decyzji TL:** 22 odrzucone rekordy OSM można przyjąć po skróceniu tekstu; 242 łączenia duplikatów OSM warto przejrzeć (czasem to dwa urządzenia w jednym budynku).
- **Użycie AI:** kod, testy i dokumentacja z Claude, przegląd człowieka.
- **Następny krok:** B – mapa na `/aed/punkty` i tryb „aktualność danych”.

## 2026-11-21 15:00 – HANDOFF #3: CR-TL-1 (tryb „aktualność danych”), pełny OSM, porządki

- **Czas:** sob 14:30–15:00
- **Zrobione:** CR-TL-1 dopisana do `docs/CONTRACT.md` (§8, wersja 1.1). API: `meta.stan_danych` (`aktualne` ≤ 365 dni od `data_weryfikacji`, inaczej i przy braku daty `nieaktualne`) i `meta.wiek_danych_dni` w każdym rekordzie; filtr `GET /aed?stan_danych=`; nowy `GET /pokrycie?wojewodztwo=` – GeoJSON 144 gmin kujawsko-pomorskiego (PRG GUGiK przez WFS, uproszczone do 431 KB, `data/granice/`, skrypt `scripts/build_granice.py`) z `teryt, gmina, liczba_aed, aktualne, nieaktualne, stan`; `/statystyki` + `aktualne`, `nieaktualne`, `gminy_bez_danych`. Licencja i atrybucja PRG w `zrodla.csv` (źródło `prg-gugik:gminy-kujawsko-pomorskie`). **Poprawka:** OSM bez `check_date` dostawał dzisiejszą datę weryfikacji – teraz pole jest puste (inaczej cała mapa byłaby „aktualna”). Pełny import OSM Polska: 18 297 obiektów → 18 057 rekordów, 22 odrzucone; `deliverables/dataset/` przebudowany. `.gitignore` (+ `git rm -r --cached` dla `__pycache__/`, baza i `data/cache/` poza repo). 50 testów (15 nowych: próg 0/364/365/366 dni, brak i błędna data, OSM bez daty, filtr, `/pokrycie`, przypisanie do gminy, statystyki, `zrodla`).
- **Wyniki na pełnych danych:** 3 154 AED aktualne, 14 885 nieaktualne (17%). Kujawsko-pomorskie: 27 gmin bez danych, 113 nieaktualne, 4 aktualne.
- **Jak uruchomić:** `python -m scripts.seed --reset --osm full && uvicorn src.api.main:app` → `/api/v1/pokrycie`; `pytest`.
- **Założenia:** stan gminy = `nieaktualne`, gdy choć jeden AED w gminie jest nieaktualny (ostrożnie: zachęca do weryfikacji); AED przypisany do gminy po położeniu, nie po polu `gmina`. PRG: dane PZGiK bez opłat i ograniczeń (art. 40a ust. 2 pkt 1 Pgik). Dla źródła referencyjnego pokrycie pól w `zrodla.csv` = 0 (nie dotyczy rekordu AED).
- **CR do B:** ekran mapy – przełącznik trybów „dostępność / aktualność danych”; w trybie aktualności warstwa gmin z `GET /pokrycie` (kolor wg `stan`, legenda, atrybucja z `meta.atrybucja`) i punkty wg `meta.stan_danych`. Liczniki do E7/E8: `aktualne`, `nieaktualne`, `gminy_bez_danych`.
- **Znane błędy:** granice uproszczone niezależnie dla każdej gminy – na styku mogą być wąskie szczeliny (AED w szczelinie nie trafia do żadnej gminy). Docker dalej niezbudowany w tym środowisku.
- **Użycie AI:** kod, testy i dokumentacja z Claude, przegląd człowieka.
- **Następny krok:** granice dla kolejnych województw (`--woj`), UI trybu „aktualność danych” (B).

## 2026-11-21 13:30 – HANDOFF #2: CR od B, JSON-LD, docs/tech, utwardzenie

- **Czas:** sob 13:25–13:30
- **Zrobione:** CR-B1…B9 wdrożone (`dostepny_teraz` w atrybutach; `pochodzenie` i `potwierdzenia` na górnym poziomie karty; `POST /zgloszenia` → `{id, status}`; `GET /zgloszenia` w stylu JSON API z `mozliwy_duplikat`; decyzja `scal`; `GET /miejsca?q=`; `GET /eksport` z formatem, licencją i rozmiarem; klucze statystyk jak u B; `/api/docs`). Usługa `ui` w compose (port 80). JSON-LD (poziom 4) z nagłówkiem `Link`, limit anonimowych zgłoszeń, `docs/tech/` (ARCHITECTURE, DATA_PIPELINE, COMPLIANCE, RUN), pakiet `deliverables/dataset/`, kontrola licencji. 35 testów; czysty klon zielony na Pythonie 3.12 i 3.13.
- **Jak uruchomić:** `docs/tech/RUN.md`.
- **Założenia:** `AED_AUTH_MODE=demo` – żądanie bez tokenu działa jako konto demo, bo UI jeszcze nie wysyła tokenu.
- **CR do B:** wysyłać `Authorization` po logowaniu; w imporcie dosyłać `dysponent_nazwa` i `dysponent_typ`; `zatwierdz` zgłoszenia wymaga `rekord` z adresem (inaczej 422 z polami).
- **Znane błędy:** obraz Docker nie zbudowany (Docker Hub zablokowany w moim środowisku), `compose config` poprawny.
- **Użycie AI:** kod, testy i dokumentacja z Claude (Opus), przegląd człowieka.
- **Następny krok:** SYNC #1, pełny OSM na Macu, P10.

## 2026-11-21 13:20 – P3 + F1 + F2 + F3 (rdzeń gotowy przed SYNC #1)

- **Czas:** sob 13:05–13:20
- **Zrobione:** `GET /aed` (bbox, wojewodztwo, gmina, dostep, dostepne_teraz, q, warstwa, stronicowanie), `/aed/{id}`, `/aed/najblizsze`, `POST /import` → `/mapowanie` → `/zatwierdz`, `POST/PATCH /aed`, zgłoszenia + moderacja, potwierdzenia (Paszport AED), `/zrodla`, konektory OSM i dane.gov.pl, `/eksport/*` (10 plików), `/szablon.csv|xlsx`, `/statystyki`, `/auth/login`. 30 testów, w tym end-to-end gmina+uczelnia → `aed_ujednolicone.csv`.
- **Jak uruchomić:** `pip install -r requirements.txt && python -m scripts.seed --reset && uvicorn src.api.main:app` → http://localhost:8000/api/v1/docs; `docker compose up --build`; `python -m scripts.publish`; `pytest`.
- **Założenia:** `id_aed` = SHA-1(`kod_zrodla|id_w_zrodle`); SQLite bez SQLAlchemy; telefonów i e-maili z OSM nie importujemy.
- **CR:** CR-1 – COI nie podaje URI ani XSD; dodałem wymagane `specialSigns`. CR-3 – warstwa OSM bez adresów (pola wymagane puste). CR-4 – dodatkowe pola importu i `meta` w odpowiedziach. CR-5 – wartości ODbL nie trafiają do rekordów CC0.
- **Znane błędy:** Docker nieprzetestowany (brak demona).
- **Użycie AI:** kod, testy i dokumentacja techniczna z Claude (Opus), przegląd człowieka.
- **Następny krok:** `docs/tech/`, realny OSM na Macu.

### CR – szczegóły dla TL
- **CR-1 (ustalenia):** wg „Instrukcji przygotowania pliku XML” COI (v1.0.6, 2025-11-21): korzeń `<p:datasets>`, `dataset`/`resource` z atrybutem `status`, `extIdent` ≤ 36 znaków i niezmienny, `title`/`description` pl+en (≤ 300 / ≤ 1000 znaków), `availability` = `local|remote`, w `resource` **wymagane `<specialSigns><specialSign>`** (brak w naszym przykładzie – dodałem `X` jak w przykładzie COI). URI przestrzeni nazw, XSD i składni `<tags>` instrukcja nie podaje → pytanie na stoisko.
- **CR-3:** OSM rzadko ma adres. W `aed_osm_odbl.*` pola wymagane (województwo, gmina, miejscowość, nr budynku, kod, dysponent, godziny) mogą być puste – walidator obniża je do ostrzeżeń. Nie zgadujemy adresów; geokodowanie (PRG/TERYT) poza prototypem. Decyzja: akceptujemy jako „warstwa uzupełniająca”?
- **CR-4 (rozszerzenie, niełamiące):** `POST /import` przyjmuje opcjonalnie `dysponent_nazwa, dysponent_typ, status_urzadzenia, data_weryfikacji, metoda_weryfikacji, nazwa_zrodla, czestotliwosc_aktualizacji, obszar` (wartości domyślne dla brakujących kolumn). Każdy element listy ma `meta` (`dostepny_teraz`, `warstwa`, `odleglosc_m`, komunikaty). Nowe: `GET /slowniki`, `GET /health`, `GET /eksport`, `aed_osm_odbl.geojson`, parametr `promien_m`.
- **CR-5:** scalanie pole po polu tylko między źródłami spoza ODbL. Rekord OSM pokrywający AED od dysponenta trafia tylko do `aed_pochodzenie.csv` – jego wartości nie są kopiowane do `aed.csv` (inaczej `aed.csv` byłby bazą pochodną ODbL).
