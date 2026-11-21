# Liczby z pełnych danych (do prezentacji)

> Wygenerowane 21.11.2026 16:37 przez `python -m scripts.liczby` z bazy po `python -m scripts.seed --reset --osm full`. Źródło AED: eksport AED OSM Polska (OpenStreetMap, ODbL-1.0, © autorzy OpenStreetMap). Granice gmin: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii. Rekordy przykładowe (fikcyjne) z `data/sample/` **nie są liczone**.
> Aktualne = `data_weryfikacji` (w OSM `check_date`/`survey:date`) nie starsza niż 365 dni; brak daty = nieaktualne (CONTRACT §8).

## Najważniejsze

| Wskaźnik | Wartość |
|---|---|
| AED w Polsce (OpenStreetMap, po deduplikacji) | **18 033** |
| Aktualne (sprawdzone w ostatnich 12 miesiącach) | **3 148** (17%) |
| Nieaktualne (starsza weryfikacja albo brak daty) | **14 885** (83%) |
| – w tym bez żadnej daty weryfikacji | 12 169 (67%) |
| Mediana wieku danych (rekordy z datą) | 334 dni |
| Gminy bez żadnego AED w danych | **351** z 2 479 (14%) |
| Gminy, w których wszystkie AED mają aktualne dane | 101 (4%) |
| Gminy z co najmniej jednym nieaktualnym AED | 2 027 (82%) |
| Gminy miejskie (miasta) bez AED w danych | 5 |

## Według województw (po położeniu AED w granicach PRG)

| Województwo | AED | aktualne | nieaktualne | % aktualnych | gminy | gminy bez danych |
|---|---:|---:|---:|---:|---:|---:|
| mazowieckie | 2 358 | 360 | 1 998 | 15% | 314 | 79 |
| wielkopolskie | 2 246 | 456 | 1 790 | 20% | 226 | 13 |
| śląskie | 1 709 | 314 | 1 395 | 18% | 167 | 7 |
| małopolskie | 1 679 | 354 | 1 325 | 21% | 183 | 12 |
| dolnośląskie | 1 496 | 289 | 1 207 | 19% | 169 | 19 |
| podkarpackie | 1 293 | 146 | 1 147 | 11% | 160 | 10 |
| pomorskie | 1 151 | 118 | 1 033 | 10% | 123 | 5 |
| zachodniopomorskie | 1 003 | 157 | 846 | 16% | 113 | 10 |
| łódzkie | 998 | 291 | 707 | 29% | 177 | 34 |
| kujawsko-pomorskie | 807 | 131 | 676 | 16% | 144 | 27 |
| lubelskie | 701 | 128 | 573 | 18% | 213 | 60 |
| warmińsko-mazurskie | 683 | 54 | 629 | 8% | 116 | 19 |
| lubuskie | 571 | 140 | 431 | 25% | 82 | 5 |
| świętokrzyskie | 521 | 82 | 439 | 16% | 102 | 12 |
| opolskie | 468 | 64 | 404 | 14% | 71 | 1 |
| podlaskie | 349 | 64 | 285 | 18% | 119 | 38 |
| **Polska** | **18 033** | **3 148** | **14 885** | **17%** | **2479** | **351** |

## Import OpenStreetMap: co weszło, co odrzucone i dlaczego

- Obiektów w eksporcie: **18 297** (import 2026-11-21 16:35).
- Nowe rekordy: 18 032; scalone z rekordem dysponenta: 1; połączone jako duplikaty w samym OSM (≤ 5 m od innego punktu i prawie ta sama nazwa): 242.
- **Odrzucone: 22** (0%). Powody:

| Powód odrzucenia | Liczba |
|---|---:|
| nazwa_obiektu: Tekst dłuższy niż 200 znaków. | 20 |
| opis_lokalizacji: Tekst dłuższy niż 250 znaków. | 1 |
| id_dysponenta_aed: Tekst dłuższy niż 50 znaków. | 1 |

Wszystkie odrzucenia dotyczą zbyt długich tekstów (limity z wzorcowego zakresu danych). Takie rekordy dałoby się przyjąć po skróceniu tekstu – do decyzji.

## Jakość danych OSM (czego brakuje do wzorcowego zakresu)

| Pole | Wypełnione | Odsetek |
|---|---:|---:|
| godziny dostępności | 6 726 | 37% |
| w tym całodobowo (24/7) | 4 101 | 23% |
| adres (miejscowość i numer budynku) | 97 | 1% |
| data weryfikacji | 5 864 | 33% |
| dostęp „prywatny” (nie dla świadka zdarzenia) | 3 004 | 17% |

## Miasta (gminy miejskie) bez AED w danych

Wojcieszów (dolnośląskie), Golub-Dobrzyń (kujawsko-pomorskie), Nieszawa (kujawsko-pomorskie), Radymno (podkarpackie), Wojkowice (śląskie)
