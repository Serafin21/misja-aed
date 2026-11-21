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
pip install -r requirements-dev.txt
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
| `python scripts/export_openapi.py` | `docs/tech/openapi.json` |
| `python scripts/check_licenses.py` | licencje zależności |

## Konta demo
`POST /api/v1/auth/login` z `{"login": "dysponent", "haslo": "dysponent-demo"}` albo `moderator` / `moderator-demo` (zmiana w `.env`). Token przekazujesz w nagłówku `Authorization: Bearer <token>`. W trybie `AED_AUTH_MODE=demo` (domyślnym na czas prezentacji) żądanie bez tokenu działa jako konto demo, a błędny token zawsze daje 401. Po podłączeniu logowania w UI ustaw `AED_AUTH_MODE=wymagane`.

## Najważniejsze adresy dla interfejsu
- Mapa: `GET /api/v1/aed?bbox=minLon,minLat,maxLon,maxLat&per_page=1000` (warstwa w `meta.warstwa`: `otwarta` | `osm`).
- Najbliższe: `GET /api/v1/aed/najblizsze?lat=..&lon=..&limit=5&tylko_dostepne_teraz=true`.
- Szczegóły i Paszport AED: `GET /api/v1/aed/{id}`, `POST /api/v1/aed/{id}/potwierdzenia`.
- Kreator importu: `POST /import` → `POST /import/{id}/mapowanie` → `POST /import/{id}/zatwierdz`.
- Słowniki do formularzy: `GET /api/v1/slowniki`.
- Wyszukiwanie miejscowości (bez geokodowania): `GET /api/v1/miejsca?q=krak`.
- Moderacja: `GET /api/v1/zgloszenia` (z `meta.mozliwy_duplikat`), `POST /zgloszenia/{id}/decyzja` z `zatwierdz` (wymaga `rekord` z adresem), `odrzuc` albo `scal`.
- Strona zbioru: `GET /api/v1/eksport`, `GET /api/v1/zrodla`, `GET /api/v1/statystyki`.
