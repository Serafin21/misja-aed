# Prezentacja – „AED w danych” (treść slajdów, v1)

> Wymagania formalne (treść zadania, pkt 4): min. 5 slajdów z dowodami realizacji wymagań technicznych (zrzuty ekranu), opis funkcjonalności z krokami użytkownika, lista ograniczeń. PDF ≤ 10 MB.
> Liczby: `docs/tech/LICZBY.md` (pełne dane OSM, 21.11.2026 16:37, bez rekordów fikcyjnych). Zgodność: `docs/tech/COMPLIANCE.md`.
> `[ZRZUT: …]` – miejsca na zrzuty ekranu (ekran, adres URL). Robimy je na prawdziwym API, w przeglądarce 1280 px (mobilne: 390 px), powiększenie 100%.
> Zasada znaku: hasło zawsze z nazwą akcji albo z podtytułem.

---

## Slajd 1 – AED w danych

**AED w danych**
**Dane prosto z serca**
Masz AED? Udostępnij je na dane.gov.pl

Ogólnopolski, otwarty zbiór danych o defibrylatorach AED dla portalu dane.gov.pl – z wielu źródeł, w jednym wzorcowym zakresie, z mapą „dostępne teraz” i akcją dla dysponentów.

Zespół [NAZWA ZESPOŁU] · HackNation 2026 · zadanie Ministerstwa Cyfryzacji „Misja AED – dane na ratunek”

[ZRZUT: logotyp pionowy, plik brand/logo.png]

---

## Slajd 2 – Problem: AED jest, ale nie wiemy, czy da się go użyć

3 marca w centrum Warszawy świadkowie zatrzymania krążenia szukali defibrylatora. Kilka urządzeń było zamkniętych na klucz. Nie ma kompletnej mapy AED – dane są rozproszone, niepełne i często niezweryfikowane.

Co pokazują dane, które dziś da się zebrać (OpenStreetMap, cała Polska, 21.11.2026):

| | |
|---|---|
| AED w danych | **18 033** |
| sprawdzone w ostatnich 12 miesiącach | **3 148 (17%)** |
| bez żadnej daty weryfikacji | **12 169 (67%)** |
| z godzinami dostępności | **37%** |
| z adresem (miejscowość i numer budynku) | **1%** |
| gminy bez żadnego AED w danych | **351 z 2 479** |

Wniosek: potrzebne są dane od dysponentów – w jednym formacie i z datą weryfikacji.

[ZRZUT: mapa „Aktualność danych”, cała Polska – http://localhost/mapa?tryb=dane]

---

## Slajd 3 – Rozwiązanie w 6 elementach

1. **Wzorcowy zakres danych** – 44 pola (24 wymagane): godziny dostępności w zapisie maszynowym, zamknięta szafka i instrukcja dostępu, data i metoda weryfikacji, urządzenie w pojeździe.
2. **Agregator źródeł** – pliki dysponentów (CSV, XLSX, JSON, GeoJSON) i OpenStreetMap: dopasowanie kolumn, normalizacja, walidacja, deduplikacja, pochodzenie każdego rekordu, zakres referencyjny każdego źródła.
3. **Publikacja dla dane.gov.pl** – CSV, GeoJSON, JSON-LD, API, metadane DCAT-AP-PL, plik XML do automatycznego zasilania portalu.
4. **Panel dysponenta** – kreator importu w 5 krokach z raportem błędów, odznaka akcji.
5. **Mapa i lista dla każdego** – najbliższe AED „dostępne teraz”, dwa tryby mapy, karta z instrukcją dostępu, „Paszport AED” z kodem QR, zgłoszenia obywateli z moderacją.
6. **Akcja „AED w danych”** – nazwa, hasło, logotyp, księga znaku, znaczniki mapy, odznaka dysponenta.

Architektura: FastAPI (Python) + React; uruchomienie `docker compose up --build`; kod: https://github.com/Serafin21/misja-aed

[ZRZUT: diagram architektury z README.md (mermaid)]

---

## Slajd 4 – Kroki użytkownika

**Mieszkaniec lub świadek zdarzenia (telefon)**
1. Dotyka „Pokaż najbliższe AED” albo wpisuje miejscowość.
2. Widzi 5 najbliższych AED z odległością; filtr „Tylko dostępne teraz” jest włączony.
3. Otwiera kartę AED: na górze informacja o zamkniętej szafce i instrukcja dostępu, niżej adres, godziny, „Prowadź pieszo”.
4. Przy urządzeniu skanuje kod QR „Paszport AED” i potwierdza, że AED jest na miejscu. Brak AED na mapie → „Zgłoś AED”.

**Dysponent (urząd, szkoła, firma)**
1. Pobiera szablon (CSV, XLSX) albo bierze własny plik.
2. Loguje się, wpisuje nazwę i rodzaj dysponenta, wgrywa plik.
3. Sprawdza dopasowanie kolumn.
4. Czyta raport: wiersz, pole, co poprawiliśmy, czego brakuje, które AED już są w zbiorze.
5. Zatwierdza i pobiera odznakę akcji.

**Moderator**
1. Loguje się do panelu.
2. Przy zgłoszeniu obywatela uzupełnia adres i godziny, zatwierdza, scala z istniejącym AED albo odrzuca. (API pozwala też dysponentowi rozpatrywać zgłoszenia dotyczące jego AED.)

[ZRZUT: E1 najbliższe AED na telefonie – http://localhost/ (390 px)]
[ZRZUT: E3 karta AED z zamkniętą szafką – http://localhost/aed/{id}]
[ZRZUT: E5 raport walidacji – http://localhost/dysponenci (krok 4)]
[ZRZUT: E9 formularz zatwierdzenia zgłoszenia – http://localhost/moderacja]

---

## Slajd 5 – Dwa tryby mapy

**Dostępność** – „czy mogę teraz z niego skorzystać?”
Zielona pinezka – dostępne teraz; bursztynowa z zegarem – teraz zamknięte; biała – brak godzin.

**Aktualność danych** – „jak dobrze znamy to AED?”
Zielona pinezka z sercem z komórek – sprawdzone w ostatnich 12 miesiącach; biała z zegarem – starsze albo bez daty. Gminy bez żadnego AED w danych są zakreskowane, a pod mapą jest ich lista – tam akcja szuka dysponentów.

Mapa całej Polski ładuje lekką warstwę punktów (18 tys. punktów, ok. 340 KB po kompresji); szczegóły AED pobierają się po kliknięciu. Stan rozróżnia kolor i kształt, nie tylko kolor.

[ZRZUT: tryb „Dostępność”, Warszawa – http://localhost/mapa]
[ZRZUT: tryb „Aktualność danych” z warstwą gmin – http://localhost/mapa?tryb=dane]

---

## Slajd 6 – Zgodność z zasadami dane.gov.pl

| Zasób | Format | Poziom otwartości |
|---|---|---|
| `aed.csv` (+ `aed.csvw.json`) | CSV wg Standardu technicznego: UTF-8 bez BOM, przecinek, CRLF, RFC 4180, jeden nagłówek | 3 |
| `aed.geojson` | GeoJSON, WGS 84 | 3 |
| `aed.jsonld`, rekord z `Accept: application/ld+json` | JSON-LD (schema.org), kontekst w nagłówku `Link` | 4 |
| `GET /api/v1/aed` | JSON API: stronicowanie, filtry, opis OpenAPI | 3 |
| `aed_osm_odbl.*` | osobny zasób z danymi OpenStreetMap (ODbL), z atrybucją | 3 |
| `metadane.jsonld` | metadane DCAT-AP-PL, pl/en | – |
| `dane_gov_pl_import.xml` | XML do automatycznego zasilania portalu wg instrukcji COI | – |

- Wartości wg Standardu: `true`/`false`, kropka dziesiętna, daty `rrrr-mm-dd`, jedna wartość w jednym polu, adres w osobnych polach.
- Dane wyłącznie w formatach odczytywalnych maszynowo; XLSX tylko jako szablon dla dysponentów.
- Licencje w każdym rekordzie (CC0-1.0 albo CC-BY-4.0); wartości z OSM nie trafiają do rekordów CC0.
- Bez danych osobowych: zgłoszenie obywatela nie zawiera kontaktu.
- Do potwierdzenia z zespołem dane.gov.pl: przestrzeń nazw i XSD pliku XML, kategoria zbioru.

[ZRZUT: E6 Zbiór danych – lista plików – http://localhost/dane]
[ZRZUT: fragment dane_gov_pl_import.xml i metadane.jsonld]
[ZRZUT: dokumentacja API – http://localhost/api/docs]

---

## Slajd 7 – Wzorcowy zakres danych

- **44 pola:** 24 wymagane, 15 zalecanych, 5 opcjonalnych; 8 słowników wartości (m.in. dostęp, status urządzenia, rodzaj dysponenta, metoda weryfikacji, województwo).
- Pola, których brakuje w dzisiejszych bazach, a decydują o ratunku: **godziny dostępności** (zapis opening_hours → „dostępne teraz”), **szafka zamknięta + instrukcja dostępu**, **data i metoda weryfikacji**, **urządzenie w pojeździe** (np. OSP).
- Jedno źródło prawdy, z którego powstają: tabela XLSX, słownik danych CSV, JSON Schema, metadane CSVW.
- Stały identyfikator `AED-PL-…`, który nie zmienia się przy aktualizacjach.

Plik: `deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx`

[ZRZUT: arkusz XLSX z zakresem danych]
[ZRZUT: E6 – opis pól ze słownika danych – http://localhost/dane]

---

## Slajd 8 – Wiele źródeł, jeden zbiór

- Import „brudnego” pliku gminy: separator i kodowanie wykrywane automatycznie, „pn-pt 8-16” → `Mo-Fr 08:00-16:00`, adres z jednej kolumny dzielony na pola.
- Deduplikacja: ten sam AED z kilku źródeł staje się jednym rekordem; pierwszeństwo mają dane dysponenta; pochodzenie każdego rekordu w `aed_pochodzenie.csv`.
- **Zakres referencyjny źródeł** (`zrodla.csv`, ekran „Źródła”): liczba rekordów, pokrycie pól wymaganych i zalecanych, licencja, format, częstotliwość, obszar.
- Pełny import OpenStreetMap: 18 297 obiektów → 18 033 AED; 22 odrzucone (za długie teksty), 242 duplikaty w samym OSM połączone.
- Granice 2 479 gmin z Państwowego Rejestru Granic (GUGiK) – do liczenia pokrycia.

[ZRZUT: E5 krok 3 – dopasowanie kolumn – http://localhost/dysponenci]
[ZRZUT: E7 Źródła – zakres referencyjny – http://localhost/zrodla]

---

## Slajd 9 – Akcja „AED w danych” i znak

- **Hasło:** Dane prosto z serca. **Podtytuł:** Masz AED? Udostępnij je na dane.gov.pl.
- **Znak:** serce z 21 zaokrąglonych kwadratów ułożonych jak komórki arkusza – każda komórka to jeden wiersz w zbiorze, czyli jeden defibrylator. Bursztynowa komórka to „Twoje AED” – wiersz, który dopisuje dysponent.
- **Znaczniki mapy** z tej samej rodziny: pinezka z sercem i błyskawicą (dostępność) i pinezka z sercem z komórek (aktualność danych).
- **Dla dysponenta:** odznaka „Udostępniamy dane o naszych AED” i naklejka „Paszport AED” z kodem QR.
- **Księga znaku (11 stron):** kolorystyka HEX/RGB/CMYK, pole ochronne, minimalna wielkość w px i mm, 8 niedozwolonych użyć, wersje pełna, achromatyczna, odwrócona i jednobarwna.

Pliki: `brand/logo.svg`, `.png`, `.jpg`, `.pdf`, `brand/ksiega_znaku.pdf`

[ZRZUT: E8 Akcja – http://localhost/akcja]
[ZRZUT: strona księgi znaku – wersje logotypu]

---

## Slajd 10 – Dostępność, ograniczenia, zakres AI

**Dostępność (WCAG 2.2 AA) i responsywność**
- Mapa ma równorzędną listę; pinezki mają tekstowe nazwy; stan nie jest przekazywany tylko kolorem; pełna obsługa klawiaturą; od 320 px szerokości.
- Wyniki testów: [UZUPEŁNIĆ: axe, Lighthouse, NVDA – docs/a11y/raport.md]

[ZRZUT: wynik Lighthouse „Dostępność”]

**Ograniczenia**
- Brak krajowego rejestru AED – kompletność zależy od dysponentów. Dane z OpenStreetMap mają rzadko adres (1%) i datę weryfikacji (33%).
- Rekordy dysponentów w prototypie to dane przykładowe (fikcyjne); dane OSM są prawdziwe i publikowane osobno na licencji ODbL.
- „Dostępne teraz” rozumie najczęstszy zapis godzin; inny zapis → „Sprawdź godziny na miejscu”.
- Brak geokodowania adresów; wyszukiwanie miejsca po nazwach ze zbioru.
- Konta dysponenta i moderatora w prototypie to konta demonstracyjne.
- Kafelki mapy z serwera OpenStreetMap – przy wdrożeniu potrzebny własny serwer kafelków.
- Do potwierdzenia z dane.gov.pl: XSD pliku XML importu i kategoria zbioru.

**Zakres użycia AI (§2 ust. 8 regulaminu):** [UZUPEŁNIĆ z docs/AI_USAGE.md – co zrobiła AI, co zespół]

**Dalej:** pilotaż z jedną gminą, połączenie z danymi dysponentów publicznych, naklejki „Paszport AED” na szafkach.
