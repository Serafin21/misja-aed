# Test „jak jury” (Team Leader, INT-2: nd 09:15, na czystym klonie)

| # | Sprawdzenie | Oczekiwany wynik | Wynik |
|---|---|---|---|
| 1 | `git clone`, `cp .env.example .env`, `docker compose up --build` | aplikacja i API działają bez ręcznych poprawek | |
| 2 | Telefon (lub tryb mobilny przeglądarki): „Pokaż najbliższe AED” | 5 najbliższych, odległość, „dostępne teraz” | |
| 3 | Karta AED | instrukcja dostępu przy zamkniętej szafce, weryfikacja, źródło i licencja | |
| 4 | Dysponent: import `data/sample/zrodlo_gmina_przyklad.csv` | mapowanie, raport błędów z propozycjami, publikacja | |
| 5 | Deduplikacja: rekord gminy + OSM | jeden AED, dwa źródła w pochodzeniu | |
| 6 | Pobranie `aed.csv` | UTF-8, przecinek, CRLF, jeden nagłówek, true/false, daty yyyy-mm-dd | |
| 7 | `aed.geojson`, `aed_osm_odbl.csv`, `zrodla.csv`, `slownik_danych.csv`, `aed.csvw.json` | poprawne, OSM osobno z atrybucją | |
| 8 | `dane_gov_pl_import.xml` | zgodny z XSD portalu (CR-1) | |
| 9 | API: `/api/v1/aed?page=2`, filtr `dostepne_teraz` | stronicowanie z linkami, filtrowanie | |
| 10 | Zgłoszenie obywatela → moderacja | nie trafia do zbioru przed zatwierdzeniem | |
| 11 | WCAG: axe, klawiatura, czytnik ekranu, powiększenie 200% | brak błędów krytycznych | |
| 12 | Komplet plików: XLSX, logotyp JPG/PNG/PDF/SVG, księga znaku PDF, prezentacja PDF ≤10 MB, opis, AI_USAGE | wszystko w repo i w HackTribe | |
