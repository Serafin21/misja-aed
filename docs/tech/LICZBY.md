# Liczby z pełnych danych (do prezentacji)

> Wygenerowane 21.11.2026 18:13 przez `python -m scripts.liczby` z bazy po `python -m scripts.seed --reset --osm full`. Źródła AED: eksport AED OSM Polska (OpenStreetMap, ODbL-1.0, © autorzy OpenStreetMap) i zbiory AED samorządów z dane.gov.pl. Granice gmin: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii. Rekordy przykładowe (fikcyjne) z `data/sample/` **nie są liczone**.
> Aktualne = `data_weryfikacji` (w OSM `check_date`/`survey:date`) nie starsza niż 365 dni; brak daty = nieaktualne (CONTRACT §8).

## Najważniejsze

| Wskaźnik | Wartość |
|---|---|
| AED w Polsce (OpenStreetMap + zbiory samorządów, po deduplikacji) | **18 074** |
| Aktualne (sprawdzone w ostatnich 12 miesiącach) | **3 148** (17%) |
| Nieaktualne (starsza weryfikacja albo brak daty) | **14 926** (83%) |
| – w tym bez żadnej daty weryfikacji | 12 159 (67%) |
| Mediana wieku danych (rekordy z datą) | 338 dni |
| Gminy bez żadnego AED w danych | **351** z 2 479 (14%) |
| Gminy, w których wszystkie AED mają aktualne dane | 101 (4%) |
| Gminy z co najmniej jednym nieaktualnym AED | 2 027 (82%) |
| Gminy miejskie (miasta) bez AED w danych | 5 |

## Według województw (po położeniu AED w granicach PRG)

| Województwo | AED | aktualne | nieaktualne | % aktualnych | gminy | gminy bez danych |
|---|---:|---:|---:|---:|---:|---:|
| mazowieckie | 2 373 | 360 | 2 013 | 15% | 314 | 79 |
| wielkopolskie | 2 247 | 456 | 1 791 | 20% | 226 | 13 |
| śląskie | 1 711 | 314 | 1 397 | 18% | 167 | 7 |
| małopolskie | 1 684 | 355 | 1 329 | 21% | 183 | 12 |
| dolnośląskie | 1 498 | 289 | 1 209 | 19% | 169 | 19 |
| podkarpackie | 1 306 | 145 | 1 161 | 11% | 160 | 10 |
| pomorskie | 1 152 | 118 | 1 034 | 10% | 123 | 5 |
| zachodniopomorskie | 1 004 | 157 | 847 | 16% | 113 | 10 |
| łódzkie | 998 | 291 | 707 | 29% | 177 | 34 |
| kujawsko-pomorskie | 808 | 131 | 677 | 16% | 144 | 27 |
| lubelskie | 701 | 128 | 573 | 18% | 213 | 60 |
| warmińsko-mazurskie | 683 | 54 | 629 | 8% | 116 | 19 |
| lubuskie | 571 | 140 | 431 | 25% | 82 | 5 |
| świętokrzyskie | 521 | 82 | 439 | 16% | 102 | 12 |
| opolskie | 468 | 64 | 404 | 14% | 71 | 1 |
| podlaskie | 349 | 64 | 285 | 18% | 119 | 38 |
| **Polska** | **18 074** | **3 148** | **14 926** | **17%** | **2479** | **351** |

## Import OpenStreetMap: co weszło, co odrzucone i dlaczego

- Obiektów w eksporcie: **18 297** (import 2026-11-21 18:12).
- Nowe rekordy: 18 054; scalone z rekordem dysponenta: 1; połączone jako duplikaty w samym OSM (≤ 5 m od innego punktu i prawie ta sama nazwa): 242.
- **Odrzucone: 0** (0%). Zbyt długie nazwy i opisy są skracane (z adnotacją w raporcie), a nie odrzucane.

## Zbiory AED samorządów z dane.gov.pl (prawdziwe dane od dysponentów)

| Zbiór | Wiersze | Nowe AED | Połączone z OSM | Odrzucone | Licencja |
|---|---:|---:|---:|---:|---|
| [Defibrylatory zlokalizowane w Mieście Krosno (Urząd Miasta Krosna)](https://dane.gov.pl/pl/dataset/3624,defibrylatory-zlokalizowane-w-miescie-krosno) | 21 | 7 | 14 | 0 | CC0-1.0 |
| [Lokalizacja defibrylatorów (AED) (Urząd m.st. Warszawy)](https://dane.gov.pl/pl/dataset/39512,lokalizacja-defibryzatorow-aed) | – | – | – | – | CC-BY-4.0 (brak pliku do pobrania – tylko link do portalu miasta) |
| [Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu (Urząd Miejski w Przemyślu)](https://dane.gov.pl/pl/dataset/4581,lokalizacje-aed-automatycznych-defibrylatorow-zewn) | 21 | 5 | 16 | 0 | CC0-1.0 |
| [Defibrylatory zlokalizowane na terenie Miasta Marki (Urząd Miasta Marki)](https://dane.gov.pl/pl/dataset/4955,defibrylatory-zlokalizowane-na-terenie-miasta-markI) | 8 | 7 | 1 | 0 | CC-BY-4.0 |

AED z zestawów samorządów mają pierwszeństwo przed OpenStreetMap przy scalaniu (CONTRACT §4). Brakujące godziny i numery budynków są ostrzeżeniami do uzupełnienia przez dysponenta.

## Jakość danych (czego brakuje do wzorcowego zakresu)

| Pole | Wypełnione | Odsetek |
|---|---:|---:|
| godziny dostępności | 6 737 | 37% |
| w tym całodobowo (24/7) | 4 105 | 23% |
| adres (miejscowość i numer budynku) | 136 | 1% |
| data weryfikacji | 5 915 | 33% |
| dostęp „prywatny” (nie dla świadka zdarzenia) | 3 005 | 17% |

## Miasta (gminy miejskie) bez AED w danych

Wojcieszów (dolnośląskie), Golub-Dobrzyń (kujawsko-pomorskie), Nieszawa (kujawsko-pomorskie), Radymno (podkarpackie), Wojkowice (śląskie)
