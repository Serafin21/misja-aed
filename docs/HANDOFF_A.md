# HANDOFF – Model A

## 2026-11-21 13:40 – P3 + F1 + F2 + F3 (rdzeń gotowy przed SYNC #1)

- **Czas:** sob 13:05–13:40
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
