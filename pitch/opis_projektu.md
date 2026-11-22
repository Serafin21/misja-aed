# Wykaz AED w dane.gov.pl + Mapa danych AED

**Zadanie:** Misja AED – dane na ratunek (Ministerstwo Cyfryzacji, Departament Zarządzania Danymi), HackNation 2026
**Zespół:** MKS
**Repozytorium:** https://github.com/Serafin21/misja-aed
**Model ról i odpowiedzialności:** `docs/MODEL_ROL.md`

## Problem: nikt nie odpowiada za dane

Danych o AED nie brakuje: w OpenStreetMap jest 18 297 AED w Polsce. Ale tylko 18% znanych AED ma datę sprawdzenia z ostatnich 12 miesięcy, w 351 z 2 479 gmin nie ma w danych żadnego AED, a za punkty z OpenStreetMap nikt nie odpowiada (`docs/tech/LICZBY.md`). Dane są rozproszone i niezweryfikowane, bo nie mają właściciela.

## Rozwiązanie: Wykaz AED w portalu dane.gov.pl + Mapa danych AED + akcja „AED w danych”

Publikuje dostawca, który odpowiada za dane. Portal scala wykazy wielu dostawców w jedną listę – tak, jak dziś robi to z wykazem chronionych danych (DGA). To zmiana w kodzie portalu, a nie osobny system.

1. **Dostawca** w panelu dane.gov.pl zaznacza przy swoim zasobie „Zawiera wykaz AED” (w XML: `containsAedList`).
2. **Portal sprawdza plik**: 44 kolumny wzorca i pola wymagane, współrzędne w Polsce, TERYT gminy, jeden wykaz na instytucję – błąd z numerem wiersza.
3. **Nocne zadanie** (3:40) składa „Wykaz AED – wykaz zbiorczy” (CSV + XLSX) w zbiorze Ministerstwa Cyfryzacji: w każdym wierszu nazwa dostawcy i link do źródła; wiersze nie są scalane, bliskie AED różnych dostawców (≤ 25 m) mają oznaczenie „Możliwy duplikat”.
4. **API** `GET /aed-aggregated` wskazuje aktualny wykaz zbiorczy.
5. **Mapa danych AED** czyta wykaz: najbliższe AED, „otwarte teraz”, instrukcja przy zamkniętej szafce, przy każdym AED dostawca i link do źródła.
6. **Akcja „AED w danych”**: hasło „Dane prosto z serca”, wezwanie „Masz AED? Udostępnij je na dane.gov.pl”, logotyp i księga znaku.

Zmiany w portalu: katalog `portal/` – pierwszy commit to oryginalny kod dane.gov.pl, każdy następny to nasz przyrost (`git log -- portal/`). Kod jest w repozytorium, więc można go przeczytać bez dostępu do zewnętrznych domen. Wzorcowy zakres danych: 44 pola (XLSX, słownik danych, JSON Schema, CSVW).

## Użytkownicy i ich kroki

**Mieszkaniec (telefon):** „Znajdź AED” → najbliższe AED z informacją, czy jest dostępne teraz → karta z dostawcą, zbiorem, datą i instrukcją dostępu → „Zgłoś problem z tym AED”.

**Dostawca (urząd, szkoła, szpital, firma, fundacja):** pobiera szablon („Dla instytucji”) → wypełnia plik → panel dane.gov.pl → Dodaj zasób → „Zawiera wykaz AED” → Zapisz → poprawia błędy z komunikatu walidacji → następnego dnia jego AED są w wykazie zbiorczym i na mapie → aktualizuje nową wersją pliku w tym samym zasobie.

**Ministerstwo Cyfryzacji (administrator portalu):** nie wpisuje i nie poprawia danych; prowadzi wzorzec, wykaz zbiorczy (zadanie nocne lub `create_main_aed_resource`) i akcję „AED w danych” w gminach bez dostawców.

**Rekordy dodane w aplikacji** to prototyp, nieopublikowane w dane.gov.pl (etykieta na karcie, liście i w legendzie); nie trafiają do wykazu zbiorczego. Edycja AED przez administratora aplikacji to tryb pokazowy prototypu, docelowo wyłączony (`docs/MODEL_ROL.md` v2.1).

## Dane z OpenStreetMap

Tylko warstwa pomocnicza „Do sprawdzenia” i mapa luk. Nie trafiają na listę, do eksportu ani do zbiorów dostawców – licencja ODbL wymaga tej samej licencji dla baz pochodnych, a za te punkty nikt nie odpowiada.

## Zgodność z zasadami dane.gov.pl

Wykaz AED powtarza mechanizm portalu – wykaz chronionych danych (DGA) – zamiast budować obok niego nowy system; publikuje tylko dostawca na swoim koncie. Pliki: CSV wg Standardu technicznego (UTF-8, RFC 4180) i XLSX, XML harvestera (1.13 + propozycja 1.14 z `containsAedList`). Tabela DGA → AED (plik:linia): `portal/README.md`. Szczegóły: `docs/tech/COMPLIANCE.md`.

## Dostępność i responsywność

Cel: WCAG 2.2 na poziomie AA. Aplikacja działa od 320 px szerokości. Mapa ma równorzędną listę, stan „dostępne teraz” nie zależy tylko od koloru, pełna obsługa klawiaturą. Wyniki testów: `docs/a11y/`.

## Ograniczenia prototypu

- Portal z Wykazem AED działa lokalnie (uruchomiony w sesji zespołu, zrzuty `pitch/zrzuty/01–06`); dane w nim to 2 instytucje testowe. Testy Wykazu AED: 28/28 (25 bez bazy, 3 z bazą). Uruchomienie wykryło wymóg portalu, który testy pomijały – brak wartości w tabeli oznacza się znakiem umownym „-” – i jest już obsłużony.
- Bez `PORTAL_API` mapa czyta pakiety fikcyjnych dostawców i 3 prawdziwe zbiory samorządów opublikowane przed wzorcem (Krosno, Przemyśl, Marki – 50 AED).
- Edycja AED przez administratora aplikacji i zatwierdzanie zgłoszeń od razu na mapę – tryb pokazowy prototypu, docelowo wyłączony.
- Zgłoszenia mieszkańców symulowane w aplikacji (docelowo komentarze do zasobu w dane.gov.pl); logowanie kontami testowymi (docelowo login.gov.pl i 2FA).
- XSD 1.14 z `containsAedList` to propozycja do zatwierdzenia przez zespół portalu.
- Kafelki mapy z serwera OpenStreetMap; terminy i próg 25 m do potwierdzenia z MC.

## Zakres użycia AI

Zgodnie z §2 ust. 8 regulaminu zadania: szczegóły w `docs/AI_USAGE.md`. Decyzje (model ról, wzorzec danych, nazwa, hasło, logotyp) podjął i sprawdził zespół.
