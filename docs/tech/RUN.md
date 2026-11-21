# Jak uruchomić (tekst dla README – Model B)

## Docker (zalecane, jedna komenda)
```bash
cp .env.example .env              # opcjonalnie: hasła kont demo
docker compose up --build         # aplikacja: http://localhost, API: http://localhost/api/v1, docs: http://localhost/api/docs
docker compose up --build api     # samo API: http://localhost:8000/api/v1/docs
```
Przy pierwszym starcie baza wypełnia się danymi przykładowymi i warstwą OpenStreetMap: z sieci, z cache w `data/cache/` albo z próbki, gdy nie ma sieci.

## Bez Dockera (Python 3.12+)
```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt pytest==9.1.1 httpx==0.28.1
python -m scripts.seed --reset                          # dane przykładowe + OSM (sieć → cache → próbka)
uvicorn src.api.main:app --reload                       # http://localhost:8000/api/v1/docs
```

## Przydatne polecenia
| Polecenie | Co robi |
|---|---|
| `pytest` | testy (normalizacja, walidacja, deduplikacja, import end-to-end, API, eksport zgodny ze Standardem) |
| `python -m scripts.publish` | pakiet dla dane.gov.pl → `deliverables/dataset/` |
| `python scripts/check_csv.py deliverables/dataset/*.csv` | sprawdzenie CSV wg Standardu technicznego |
| `python -m scripts.seed --reset --osm sample` | szybki start tylko na próbce (bez sieci) |
| `python -m scripts.seed --reset --osm full` | pełna warstwa OSM dla Polski (ok. 18 tys. AED, 12 s; plik zostaje w `data/cache/`) |
| `python -m scripts.build_granice` | granice gmin z PRG (GUGiK) dla 16 województw → `data/granice/` (pobrania w `data/cache/prg/`; `--offline` bez sieci) |
| `python -m scripts.liczby` | `docs/tech/LICZBY.md` – liczby do prezentacji (po `seed --osm full`) |
| `python scripts/export_openapi.py` | `docs/tech/openapi.json` |
| `python scripts/check_licenses.py` | licencje zależności |

## Konta demo
`POST /api/v1/auth/login` z `{"login": "admin", "haslo": "admin123"}` (hasło: `ADMIN_PASSWORD` w `.env` – zmień przed udostępnieniem strony). Konta instytucji zakłada administrator (panel) albo powstają z zatwierdzonego wniosku (`POST /api/v1/konta/wnioski`). Token przekazujesz w nagłówku `Authorization: Bearer <token>`; każdy zapis wymaga zalogowania.

## Najważniejsze adresy dla interfejsu
- Mapa (zalecane): `GET /api/v1/aed/punkty` – cała Polska w jednym żądaniu (339 KB gzip, `ETag`), opcjonalnie `?bbox=`; szczegóły rekordu po kliknięciu z `GET /api/v1/aed/{id}`. Pełne rekordy z filtrami: `GET /api/v1/aed?bbox=…&per_page=1000`.
- Najbliższe: `GET /api/v1/aed/najblizsze?lat=..&lon=..&limit=5&tylko_dostepne_teraz=true`.
- Szczegóły i Paszport AED: `GET /api/v1/aed/{id}`, `POST /api/v1/aed/{id}/potwierdzenia`.
- Kreator importu: `POST /import` → `POST /import/{id}/mapowanie` → `POST /import/{id}/zatwierdz`.
- Słowniki do formularzy: `GET /api/v1/slowniki`.
- Wyszukiwanie miejscowości (bez geokodowania): `GET /api/v1/miejsca?q=krak`.
- Moderacja: `GET /api/v1/zgloszenia` (z `meta.mozliwy_duplikat`), `POST /zgloszenia/{id}/decyzja` z `zatwierdz` (wymaga `rekord` z adresem), `odrzuc` albo `scal`.
- Strona zbioru: `GET /api/v1/eksport`, `GET /api/v1/zrodla`, `GET /api/v1/statystyki`.
- Mapa w trybie „aktualność danych” (CR-TL-1): `GET /api/v1/pokrycie?wojewodztwo=kujawsko-pomorskie` (GeoJSON gmin; kolor wg `properties.stan`: `brak_danych` / `nieaktualne` / `aktualne`), punkty: `meta.stan_danych` i `meta.wiek_danych_dni` w każdym rekordzie, filtr `GET /api/v1/aed?stan_danych=nieaktualne`.
