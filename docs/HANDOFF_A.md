# HANDOFF – Model A

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
