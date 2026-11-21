# AED w danych – otwarty zbiór defibrylatorów dla dane.gov.pl

**Hasło akcji:** Dane prosto z serca
**Zadanie:** Misja AED – dane na ratunek (Ministerstwo Cyfryzacji, Departament Zarządzania Danymi), HackNation 2026
**Repozytorium:** https://github.com/Serafin21/misja-aed

> Wersja robocza v0 (sob 13:45). Przed finałem każde zdanie o funkcjach sprawdzamy z `docs/HANDOFF_A.md` i działającą aplikacją. Oznaczenie [w toku] = funkcja zaprojektowana, jeszcze niesprawdzona na prawdziwym backendzie.

## Problem

3 marca w centrum Warszawy świadkowie zawału szukali defibrylatora, a kilka urządzeń w okolicy było zamkniętych na klucz. W Polsce nie ma kompletnej mapy AED. Dane są rozproszone między dysponentami, fundacjami i społecznością OpenStreetMap, często niepełne i niezweryfikowane. Brakuje też jednego wzoru, według którego dysponent mógłby je udostępnić. Przy zatrzymaniu krążenia liczy się każda minuta, a AED może użyć każdy, jeśli wie, gdzie jest najbliższe dostępne i działające urządzenie i jak się do niego dostać.

## Rozwiązanie w 6 elementach

1. **Wzorcowy zakres danych:** 44 pola (24 wymagane), m.in. godziny dostępności w zapisie maszynowym, zamknięta szafka i instrukcja dostępu, data i metoda weryfikacji, urządzenie mobilne (np. w wozie OSP). Jedno źródło prawdy, z którego powstają XLSX, słownik danych, JSON Schema i metadane CSVW.
2. **Agregator źródeł:** import plików dysponentów (CSV, XLSX, JSON, GeoJSON), danych OpenStreetMap i zbiorów z dane.gov.pl; dopasowanie kolumn, normalizacja (np. „pn-pt 8-16” → `Mo-Fr 08:00-16:00`), walidacja, deduplikacja z zachowaniem pochodzenia każdego rekordu. Każde źródło ma opisany zakres referencyjny: liczbę rekordów, pokrycie pól, licencję, częstotliwość i obszar. [w toku]
3. **Publikacja w dane.gov.pl:** CSV i GeoJSON według Standardu technicznego portalu, API JSON ze stronicowaniem, metadane pl/en (DCAT-AP-PL), CSVW, plik XML do automatycznego zasilania portalu. Dane OpenStreetMap (ODbL) jako osobny zasób z atrybucją. [w toku]
4. **Panel dysponenta:** szablon do pobrania, kreator importu w 5 krokach z czytelnym raportem błędów (wiersz, pole, propozycja poprawki), odznaka akcji do pobrania.
5. **Mapa i lista dla każdego:** najbliższe AED z filtrem „dostępne teraz”, instrukcja dostępu przy zamkniętej szafce na górze karty, lista równorzędna z mapą, zgłoszenia obywateli z moderacją.
6. **Akcja „AED w danych”:** nazwa, hasło, logotyp (serce złożone z „wierszy danych”, jedna bursztynowa komórka = Twoje AED), znaczniki na mapie z tej samej rodziny, odznaka dla dysponentów i naklejka „Paszport AED” z kodem QR.

## Co wyróżnia rozwiązanie

- **„Dostępne teraz”, a nie tylko „jest”:** godziny w zapisie maszynowym pozwalają pokazać, które AED da się użyć o tej porze.
- **Zamknięta szafka to informacja, nie przeszkoda:** instrukcja dostępu jest na samej górze karty urządzenia.
- **Paszport AED:** kod QR na szafce prowadzi do karty, gdzie każdy przechodzień w 10 sekund potwierdza, że urządzenie jest na miejscu. Zbiór sam się odświeża.
- **Pochodzenie każdego rekordu:** wiadomo, z którego źródła pochodzi każda informacja i na jakiej licencji.

## Użytkownicy i ich kroki

**Świadek zdarzenia (telefon):**
1. Otwiera stronę i dotyka „Pokaż najbliższe AED” (albo wpisuje miejscowość).
2. Widzi 5 najbliższych AED z odległością i oznaczeniem „Dostępne teraz”.
3. Otwiera kartę: na górze ma informację o szafce i instrukcję dostępu, niżej adres, piętro i godziny. Dotyka „Prowadź pieszo”.

**Dysponent AED (urząd, szkoła, firma):**
1. Pobiera szablon albo bierze własny plik.
2. Wgrywa plik i wskazuje licencję.
3. Sprawdza dopasowanie kolumn.
4. Czyta raport: co poprawiliśmy automatycznie, czego brakuje, które AED już są w zbiorze.
5. Zatwierdza i pobiera odznakę akcji oraz naklejkę „Paszport AED” z kodem QR.

**Moderator:** przegląda zgłoszenia obywateli i zatwierdza, scala albo odrzuca każde z nich.

**Zespół dane.gov.pl / programista:** pobiera pliki zbioru, słownik danych i metadane, korzysta z API.

## Zgodność z zasadami dane.gov.pl

Formaty odczytywalne maszynowo: CSV, GeoJSON, JSON (API), CSVW, JSON-LD (DCAT-AP-PL), XML. Metadane po polsku i angielsku. Licencje CC0-1.0 / CC-BY-4.0 dla danych dysponentów i ODbL-1.0 w osobnym zasobie dla OpenStreetMap. Szczegóły: `docs/tech/COMPLIANCE.md` [w toku].

## Dostępność i responsywność

Cel: WCAG 2.2 na poziomie AA. Aplikacja działa od 320 px szerokości. Mapa ma równorzędną listę, stan „dostępne teraz” nie zależy tylko od koloru, aplikację w pełni obsługuje się klawiaturą, a formularze nie zbierają danych osobowych. Wyniki testów: `docs/a11y/raport.md`.

## Ograniczenia

- Nie ma krajowego rejestru AED, więc kompletność zbioru zależy od dysponentów. Prototyp działa na danych przykładowych (fikcyjnych) i otwartych.
- Dane OpenStreetMap wymagają licencji ODbL, więc są osobnym zasobem.
- „Dostępne teraz” rozumie podzbiór zapisu godzin otwarcia. Inny zapis daje komunikat „Sprawdź godziny na miejscu”.
- Brak automatycznego geokodowania adresów. Wyszukiwanie miejsca działa po nazwach ze zbioru.
- Schemat XSD pliku XML importu i kategorię zbioru trzeba potwierdzić z zespołem dane.gov.pl.
- W prototypie panel dysponenta i moderatora działa bez pełnego systemu kont.

## Zakres użycia AI

Zgodnie z §2 ust. 8 regulaminu zadania: szczegóły w `docs/AI_USAGE.md`. Decyzje twórcze (nazwa, hasło, logotyp, zakres danych) podjął i dopracował zespół.
