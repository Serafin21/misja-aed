# Liczby z pełnych danych (do prezentacji)

> Wygenerowane 21.11.2026 21:48 przez `python -m scripts.liczby` z bazy po `python -m scripts.seed --reset --osm full`. Model ról (`docs/MODEL_ROL.md`): **wspólna lista** = zbiory dostawców z dane.gov.pl (bez scalania), **warstwa pomocnicza** „Do sprawdzenia” = eksport AED OSM Polska (OpenStreetMap, ODbL-1.0, © autorzy OpenStreetMap), osobno od listy. Granice gmin: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii. Fikcyjni dostawcy prototypu (`data/dostawcy/`) **nie są liczeni** w liczbach o Polsce – są tylko w tabeli zbiorów.
> Aktualne = `data_weryfikacji` (w OSM `check_date`/`survey:date`) nie starsza niż 365 dni; brak daty = nieaktualne (CONTRACT §8).

## Wspólna lista i warstwa pomocnicza

| Wskaźnik | Wartość |
|---|---|
| Prawdziwe zbiory dostawców na liście (wzorzec / przejściowe) | **0** / **3** |
| Zbiory fikcyjnych dostawców prototypu | 5 |
| Zbiory AED w dane.gov.pl poza listą (nieczytelne albo bez wymagań) | 1 |
| AED na wspólnej liście od prawdziwych dostawców | **50** |
| AED fikcyjnych dostawców prototypu (nie liczone dalej) | 10 |
| Warstwa pomocnicza „Do sprawdzenia” (OpenStreetMap) | **18 297** |
| Gminy z co najmniej jednym AED od prawdziwego dostawcy | 3 z 2 479 |

## Wszystkie znane AED (obie warstwy, bez fikcyjnych)

| Wskaźnik | Wartość |
|---|---|
| AED znane w Polsce (lista + OpenStreetMap; warstw się nie scala) | **18 347** |
| Aktualne (sprawdzone w ostatnich 12 miesiącach) | **3 219** (18%) |
| Nieaktualne (starsza weryfikacja albo brak daty) | **15 128** (82%) |
| – w tym bez żadnej daty weryfikacji | 12 314 (67%) |
| Mediana wieku danych (rekordy z datą) | 337 dni |
| Gminy bez żadnego AED w danych | **351** z 2 479 (14%) |
| Gminy, w których wszystkie AED mają aktualne dane | 101 (4%) |
| Gminy z co najmniej jednym nieaktualnym AED | 2 027 (82%) |
| Gminy miejskie (miasta) bez AED w danych | 5 |

## Według województw (po położeniu AED w granicach PRG)

| Województwo | AED | aktualne | nieaktualne | % aktualnych | gminy | gminy bez danych |
|---|---:|---:|---:|---:|---:|---:|
| mazowieckie | 2 434 | 367 | 2 067 | 15% | 314 | 79 |
| wielkopolskie | 2 274 | 466 | 1 808 | 20% | 226 | 13 |
| śląskie | 1 728 | 315 | 1 413 | 18% | 167 | 7 |
| małopolskie | 1 706 | 359 | 1 347 | 21% | 183 | 12 |
| dolnośląskie | 1 515 | 297 | 1 218 | 20% | 169 | 19 |
| podkarpackie | 1 352 | 148 | 1 204 | 11% | 160 | 10 |
| pomorskie | 1 161 | 118 | 1 043 | 10% | 123 | 5 |
| zachodniopomorskie | 1 011 | 160 | 851 | 16% | 113 | 10 |
| łódzkie | 1 005 | 293 | 712 | 29% | 177 | 34 |
| kujawsko-pomorskie | 815 | 133 | 682 | 16% | 144 | 27 |
| lubelskie | 707 | 130 | 577 | 18% | 213 | 60 |
| warmińsko-mazurskie | 691 | 55 | 636 | 8% | 116 | 19 |
| lubuskie | 577 | 144 | 433 | 25% | 82 | 5 |
| świętokrzyskie | 545 | 103 | 442 | 19% | 102 | 12 |
| opolskie | 476 | 66 | 410 | 14% | 71 | 1 |
| podlaskie | 350 | 65 | 285 | 19% | 119 | 38 |
| **Polska** | **18 347** | **3 219** | **15 128** | **18%** | **2479** | **351** |

## Import OpenStreetMap: co weszło, co odrzucone i dlaczego

- Obiektów w eksporcie: **18 297** (import 2026-11-21 21:47).
- Rekordy warstwy pomocniczej: 18 297 (OSM nie jest scalany z listą dostawców).
- **Odrzucone: 0** (0%). Zbyt długie nazwy i opisy są skracane (z adnotacją w raporcie), a nie odrzucane.

## Zbiory dostawców (ostatnia agregacja: 2026-11-21 21:47)

| Zbiór | Dostawca | Status | Na liście | Odrzucone | Licencja |
|---|---|---|---:|---:|---|
| [Defibrylatory AED – MPK Przykładowo sp. z o.o.](https://dane.gov.pl/pl/dataset/990003,defibrylatory-aed-mpk-przykladowo-sp-z-o-o) | MPK Przykładowo sp. z o.o. (fikcyjny) | wzorzec | 2 | 1 | CC0-1.0 |
| [Defibrylatory AED – Uczelnia Testowa](https://dane.gov.pl/pl/dataset/990002,defibrylatory-aed-uczelnia-testowa) | Uczelnia Testowa (fikcyjny) | wzorzec | 2 | 0 | CC-BY-4.0 |
| [Defibrylatory AED – Urząd Gminy Przykładowo](https://dane.gov.pl/pl/dataset/990001,defibrylatory-aed-urzad-gminy-przykladowo) | Urząd Gminy Przykładowo (fikcyjny) | wzorzec | 3 | 0 | CC0-1.0 |
| [Wykaz defibrylatorów – Gmina Przykładowa Druga](https://dane.gov.pl/pl/dataset/990004,wykaz-defibrylatorow-gmina-przykladowa-druga) | Gmina Przykładowa Druga (fikcyjny) | przejściowy | 3 | 1 | CC-BY-4.0 |
| [Defibrylatory zlokalizowane w Mieście Krosno](https://dane.gov.pl/pl/dataset/3624,defibrylatory-zlokalizowane-w-miescie-krosno) | Urząd Miasta Krosna | przejściowy | 21 | 0 | CC0-1.0 |
| [Defibrylatory zlokalizowane na terenie Miasta Marki](https://dane.gov.pl/pl/dataset/4955,defibrylatory-zlokalizowane-na-terenie-miasta-markI) | Urząd Miasta Marki | przejściowy | 8 | 0 | CC-BY-4.0 |
| [Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu](https://dane.gov.pl/pl/dataset/4581,lokalizacje-aed-automatycznych-defibrylatorow-zewn) | Urząd Miejski w Przemyślu | przejściowy | 21 | 0 | CC0-1.0 |
| [Lokalizacje AED – Miasto Przykładowe](https://dane.gov.pl/pl/dataset/990005,lokalizacje-aed-miasto-przykladowe) | Miasto Przykładowe (fikcyjny) | poza listą | 0 | 0 | CC-BY-4.0 |
| [Lokalizacja defibrylatorów (AED)](https://dane.gov.pl/pl/dataset/39512,lokalizacja-defibryzatorow-aed) | Urząd m.st. Warszawy | poza listą | 0 | 0 | CC-BY-4.0 |

Rekordy zbiorów przejściowych są pokazane tak, jak je opublikowano (bez uzupełniania), z etykietą „Zbiór przejściowy”. Warstwa OSM nie jest scalana z listą – punkt OSM obok AED dostawcy zostaje osobnym punktem „Do sprawdzenia”.

## Jakość danych (czego brakuje do wzorcowego zakresu)

| Pole | Wypełnione | Odsetek |
|---|---:|---:|
| godziny dostępności | 6 777 | 37% |
| w tym całodobowo (24/7) | 4 136 | 23% |
| adres (miejscowość i numer budynku) | 138 | 1% |
| data weryfikacji | 6 033 | 33% |
| dostęp „prywatny” (nie dla świadka zdarzenia) | 3 092 | 17% |

## Miasta (gminy miejskie) bez AED w danych

Wojcieszów (dolnośląskie), Golub-Dobrzyń (kujawsko-pomorskie), Nieszawa (kujawsko-pomorskie), Radymno (podkarpackie), Wojkowice (śląskie)
