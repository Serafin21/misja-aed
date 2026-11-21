# BRIEF – Misja AED: dane na ratunek (Ministerstwo Cyfryzacji, Departament Zarządzania Danymi)

> Plik wspólny: edytuje tylko Team Leader, modele czytają. Źródło: treść zadania i regulamin w `docs/task/` (PDF). Wersja z sob 12:15.

## Zadanie w jednym zdaniu
Rozwiązanie, które ułatwi zebranie w portalu dane.gov.pl **ogólnopolskiego, otwartego i aktualnego zbioru danych o defibrylatorach AED** z wielu rozproszonych źródeł, z **wzorcowym zakresem danych** dla wszystkich dysponentów oraz **akcją promocyjną** (nazwa, hasło, logotyp, księga znaku), która zachęci dysponentów do udostępniania danych.

## Dlaczego
3 marca w centrum Warszawy świadkowie zawału szukali defibrylatora. Kilka urządzeń w okolicy było zamkniętych na klucz. Nie ma dziś kompletnej mapy AED, a dane są rozproszone, niepełne i często niezweryfikowane. Przy zatrzymaniu krążenia liczy się każda minuta, a AED może użyć każdy, jeśli wie, gdzie jest najbliższe dostępne i działające urządzenie.

## Użytkownicy
- **Służby ratownicze i dyspozytorzy 112:** szybka informacja o najbliższym dostępnym AED i o tym, jak się do niego dostać.
- **Każdy z nas:** świadek zdarzenia z telefonem.
- **Dysponenci AED:** urzędy, szkoły, uczelnie, szpitale, służby (PSP, OSP), transport, firmy, NGO. To ich akcja ma przekonać do udostępniania danych.
- **Zespół dane.gov.pl (MC):** publikuje i utrzymuje zbiór.

## Kryteria oceny (przykładowe, z treści zadania)
| Kryterium | Waga | Co pokażemy | Właściciel |
|---|---|---|---|
| Zgodność z zasadami działania portalu dane.gov.pl | 30% | formaty i formatowanie wg Standardu technicznego (CSV poziom 3, GeoJSON, API JSON ze stronicowaniem), metadane pl/en i DCAT-AP-PL, plik XML do automatycznego zasilania, słownik danych, CSVW, licencje | A + TL |
| Logotyp i hasło | 25% | nazwa akcji, hasło, logotyp (JPG, PNG, PDF, SVG), księga znaku PDF | TL (+ ten czat), decyzje zespołu |
| Kreatywność i innowacyjność | 15% | „Paszport AED” z kodem QR do potwierdzania, zakres referencyjny źródeł, automatyczna deduplikacja z pochodzeniem, odznaka dla dysponentów | wszyscy |
| Zgodność z tematem | 15% | „najbliższe dostępne teraz AED”, informacja o zamkniętej szafce i instrukcja dostępu, dane od dysponentów | A + B |
| Wzorcowy zakres danych | 10% | XLSX v0.9 → v1.0 (44 pola, słowniki, zasady formatu, metadane zbioru) | TL |
| Prezentacja kompletnego rozwiązania | 5% | min. 5 slajdów ze zrzutami ekranu, kroki użytkownika, lista ograniczeń | B |

## Wymagania formalne – lista oddania
- [ ] Szczegółowy opis i tytuł projektu (`pitch/opis_projektu.md` → PDF i tekst w HackTribe) – B
- [ ] Prezentacja: min. 5 slajdów z dowodami spełnienia wymagań technicznych (zrzuty ekranu), opis funkcji z krokami użytkownika, lista ograniczeń (`pitch/prezentacja.pdf`, maks. 10 MB) – B
- [ ] Prototyp (działający, uruchamiany według README) – A + B
- [ ] Wzorcowy zakres danych w XLSX (`deliverables/zakres_danych/`) – TL
- [ ] Kod źródłowy (repozytorium) – A + B
- [ ] Logotyp w JPG, PNG, PDF i formacie otwartym (SVG) oraz księga znaku PDF (`brand/`) – TL
- [ ] Zakres wykorzystania AI (`docs/AI_USAGE.md`, wymóg §2 ust. 8 regulaminu zadania) – TL

## Wymagania techniczne
- Dane udostępniane przez rozwiązanie wyłącznie w formatach odczytywalnych maszynowo (nie PDF, nie DOC) – wyjątek: logotyp i księga znaku.
- Zgodność z zasadami działania portalu dane.gov.pl.
- Zgodność z aktualną wersją WCAG (2.2, poziom AA), responsywność (komputer i telefon), zasady UX.
- AI dopuszczalna, jeśli finalna praca jest efektem analizy i pracy człowieka i autorskim rozwiązaniem zespołu. Zespół musi wskazać zakres użycia AI. Decyzje twórcze (nazwa, hasło, logotyp, zakres danych) podejmuje i dopracowuje zespół.

## Nasze rozwiązanie w 6 elementach
1. **Wzorcowy zakres danych:** jeden schemat, z którego powstają XLSX, słownik danych CSV, JSON Schema, CSVW i szablony dla dysponentów (`docs/schema/`).
2. **Agregator:** import z wielu źródeł (pliki dysponentów CSV/XLSX/JSON/GeoJSON, formularz, OpenStreetMap, zbiory w dane.gov.pl), mapowanie kolumn, normalizacja, walidacja, deduplikacja z pochodzeniem, kompletność, zakres referencyjny każdego źródła.
3. **Publikacja w dane.gov.pl:** CSV i GeoJSON zgodne ze Standardem technicznym, API JSON, metadane pl/en, DCAT-AP-PL, plik XML do automatycznego zasilania portalu.
4. **Panel dysponenta:** szablon do pobrania, kreator importu z raportem błędów, formularz pojedynczego AED, odznaka „udostępniam dane”.
5. **Mapa i lista dla każdego:** najbliższe AED, filtr „dostępne teraz”, instrukcja dostępu (zamknięta szafka!), widok listy jako dostępna alternatywa mapy, „Paszport AED” z kodem QR do potwierdzania, że urządzenie jest na miejscu.
6. **Akcja promocyjna:** nazwa, hasło, logotyp, księga znaku, materiały (odznaka dysponenta, naklejka z kodem QR).

## Źródła danych (kontekst)
- Społeczna mapa AED OpenStreetMap Polska z eksportem CSV i GeoJSON (licencja ODbL: uznanie autorstwa i ta sama licencja dla baz pochodnych). Warstwa „Defibrylatory” w geoportal.gov.pl korzysta z tych danych na podstawie porozumienia GUGiK z OSM Polska. **Wniosek: OSM to osobna warstwa z atrybucją, nie miesza się z danymi CC0.**
- Mapy fundacji i lokalne bazy (np. mapa AED fundacji używana przez krakowskie pogotowie) – zwykle na licencjach zastrzeżonych: tylko za zgodą.
- Rejestry dysponentów: urzędy, szkoły, uczelnie, szpitale, PSP i OSP (także AED w pojazdach), transport.
- Istniejące zbiory w dane.gov.pl – do wyszukania przez API portalu.

## Propozycje akcji do wyboru i dopracowania przez zespół
Nazwy: „Mapa Serc”, „Minuta dla AED”, „Daj znać, gdzie AED”, „AED w danych”, „Serce w sieci”.
Hasła: „Udostępnij AED – zyskaj minuty”, „Jedno AED. Jeden wiersz danych. Jedno uratowane życie.”, „Dane, które ratują życie”, „Twój defibrylator na mapie Polski”.
Kierunek logotypu: serce + błyskawica (symbolika AED) połączone z pinezką mapy lub siatką danych; zieleń bezpieczeństwa i biel. **Nie kopiujemy 1:1 znaku ISO 7010 E010** – logotyp ma być autorski.

## Pytania na stoisko danych (MC DZD)
1. Jaki jest aktualny schemat XSD i przestrzeń nazw pliku XML do automatycznego zasilania? Czy oczekujecie tej ścieżki publikacji?
2. Jaką kategorię i warunki ponownego wykorzystania przewidujecie dla zbioru AED?
3. Czy portal przyjmie dane OpenStreetMap (ODbL) jako osobny zasób?
4. Czy znacie istniejące zbiory AED w portalu albo listę dysponentów, od których zaczynamy?
5. Co konkretnie sprawdzacie w kryterium „zgodność z zasadami działania portalu”?
6. Czy zakres danych ma obejmować dane techniczne urządzenia (ważność elektrod, przegląd)?

## Decyzje
- Stos: backend Python 3.12 + FastAPI + SQLite; frontend React + Vite + TypeScript, Leaflet (bez react-leaflet, które ma licencję Hippocratic), Mantine; `docker compose up`.
- Tylko zależności MIT, BSD, Apache-2.0 albo ISC. Prawa majątkowe zwycięzcy przechodzą na Ministra Cyfryzacji, a rozwiązanie ma być wolne od wad prawnych.
- Dane w prototypie: przykładowe (fikcyjne) i publicznie dostępne na zgodnych licencjach; żadnych danych osobowych osób prywatnych.

## Ograniczenia (wstępna lista do prezentacji)
- Brak krajowego rejestru AED: kompletność zależy od dysponentów; prototyp działa na danych przykładowych i otwartych.
- Dane OSM wymagają licencji ODbL, więc są osobnym zasobem.
- Kody TERYT uzupełniamy, gdy są w źródle; automatyczne geokodowanie poza zakresem prototypu.
- „Dostępne teraz” interpretuje podzbiór składni godzin otwarcia.
- Schemat XSD pliku XML importu do potwierdzenia z zespołem dane.gov.pl.
