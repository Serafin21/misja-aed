# Przepływ danych: import → mapowanie → normalizacja → walidacja → deduplikacja → publikacja

## 1. Import (`POST /api/v1/import`)
Plik + `kod_zrodla` (np. `dysponent:gmina-przykladowo`) + `licencja`. Opcjonalne wartości domyślne dla kolumn, których brak w pliku: `dysponent_nazwa`, `dysponent_typ`, `status_urzadzenia`, `data_weryfikacji`, `metoda_weryfikacji` (CR-4).
Wynik: `wykryty_format` (format, separator, kodowanie, przecinek dziesiętny), podgląd 5 wierszy, `mapowanie_proponowane`.

## 2. Mapowanie (`POST /import/{id}/mapowanie`)
`{"mapowanie": {"Kolumna w pliku": "pole" | ["pole1", "pole2"] | null}}` – lista oznacza pole złożone:
adres w jednym polu → `ulica_cecha, ulica, numer_budynku, kod_pocztowy, miejscowosc`; współrzędne w jednym polu → `szerokosc_geograficzna, dlugosc_geograficzna`. Brak treści = użyj propozycji. Mapowanie zapamiętuje się dla `kod_zrodla`, więc kolejny plik od tego samego dysponenta mapuje się sam.

## 3. Normalizacja
| Wejście | Wynik |
|---|---|
| `TAK`, `nie`, `1`, `x` | `true` / `false` |
| `52,2437` | `52.2437` (6 miejsc po przecinku) |
| `21.11.2026` | `2026-11-21` |
| `ul. Królewska 27, 00-060 Warszawa` | `ul.` / `Królewska` / `27` / `00-060` / `Warszawa` |
| `pn-pt 8-16`, `pn-pt 10-19, sob 10-14`, `całodobowo` | `Mo-Fr 08:00-16:00`, `Mo-Fr 10:00-19:00; Sa 10:00-14:00`, `24/7` |
| OSM `access=yes / customers / private` | `publiczny / ograniczony / prywatny` |
Uzupełnienia, gdy pola brak (w raporcie jako `informacja`, do sprawdzenia przez dysponenta): `dostepny_24h` z godzin; `wewnatrz_budynku` i `pietro` z opisu lokalizacji („kapsuła na elewacji”, „I piętro”, „parter”); `dostep` z godzin (cały tydzień → publiczny); `wojewodztwo` z kodu pocztowego; `gmina` = miejscowość; `powiat` dla miast na prawach powiatu.

## 4. Walidacja
`docs/schema/aed.schema.json` (24 pola wymagane z 44) + reguły dodatkowe. Raport: `wiersz, pole, poziom (blad | ostrzezenie | informacja), wartosc_zrodlowa, propozycja, komunikat`, oraz `brakujace_pola_wymagane`, `duplikaty`. Wiersz z poziomem `blad` nie wchodzi do zbioru.

## 5. Deduplikacja i scalanie (`POST /import/{id}/zatwierdz`)
- Ten sam AED: odległość ≤ 5 m **albo** ≤ 30 m i podobieństwo nazwy lub adresu ≥ 0,6.
- Dwa rekordy z tego samego źródła to różne urządzenia (np. dwa AED w jednym budynku). Wyjątek: ≤ 5 m i prawie ta sama nazwa (≥ 0,9) – wtedy to ten sam wiersz pod nowym identyfikatorem.
- Priorytet: `dysponent > dane_gov_pl > inne > osm > zgloszenie_obywatela`; przy remisie najnowszy. Scalanie pole po polu, ale tylko między źródłami spoza ODbL (CR-5).
- Wynik: liczby `dodane, zaktualizowane, scalone, odrzucone`; pochodzenie w `aed_pochodzenie.csv` (`rekord_nadrzedny`).

## 6. Inne wejścia
- **Formularz:** `POST /aed`, `PATCH /aed/{id}` – ta sama walidacja, błędy 422 z komunikatami przy polach.
- **Zgłoszenie obywatela:** `POST /zgloszenia` → status `do_weryfikacji`, poza zbiorem. Moderator uzupełnia adres i zatwierdza (`POST /zgloszenia/{id}/decyzja`).
- **Paszport AED (QR):** `POST /aed/{id}/potwierdzenia` – liczba potwierdzeń i odsetek „jest na miejscu” w `GET /aed/{id}`.
- **OSM:** `POST /zrodla/osm/odswiez` albo `python -m scripts.seed` (sieć → cache → próbka).
- **dane.gov.pl:** `POST /zrodla/dane-gov-pl/szukaj {"q": "defibrylator AED", "importuj": true}` – wyszukiwanie w API 1.4, rejestracja zbiorów jako źródeł, import zasobów CSV, GeoJSON i JSON.

## 7. Publikacja
`python -m scripts.publish` → `deliverables/dataset/` albo na żywo `GET /api/v1/eksport/{plik}`. Szczegóły zgodności: `COMPLIANCE.md`.
