# Zgłoszenie HackTribe – MKS · Misja AED – dane na ratunek

## Nazwa projektu
Wykaz AED w dane.gov.pl – jedna lista AED od wielu dostawców (Mapa danych AED + akcja „AED w danych”)

## Nazwa zespołu
MKS

## Numer stolika
15f

## Zadanie Partnerskie
MISJA AED – DANE NA RATUNEK

## Link do repozytorium
https://github.com/Serafin21/misja-aed

## Link do prototypu (klikalny, bez konfiguracji)
https://misja-aed.onrender.com/ (pierwsze wejście po przerwie może potrwać do 2–3 minut – serwer się budzi)

## Instrukcja dla jury (kroki ponumerowane)
https://github.com/Serafin21/misja-aed/blob/main/INSTRUKCJA_DLA_JURY.md

## Opis rozwiązania (3–4 zdania)
Rozwiązanie składa się z trzech części: **Wykazu AED w portalu dane.gov.pl**, **Mapy danych AED** jako strony odczytu i **akcji „AED w danych”** dla dostawców. Instytucja publikuje swój wykaz AED na własnym koncie w dane.gov.pl i zaznacza przy zasobie „Zawiera wykaz AED” (w XML: `containsAedList`); portal sprawdza kolumny wzorca i pola wymagane, a co noc składa „Wykaz AED – wykaz zbiorczy” z nazwą dostawcy i linkiem do źródła w każdym wierszu, udostępniany w API `/aed-aggregated`. To zmiana w kodzie portalu zrobiona wzorem istniejącego wykazu chronionych danych (DGA), a nie osobny system – publikuje tylko dostawca, który odpowiada za dane, a portal jedynie scala wykazy bez zmieniania wierszy. Mapa danych AED czyta wykaz zbiorczy i przy każdym AED pokazuje dostawcę i link do źródła.

## Podejście do problemu (3–4 zdania)
Danych o AED nie brakuje, brakuje odpowiedzialności: w OpenStreetMap jest 18 297 AED w Polsce, ale tylko 18% znanych AED ma datę sprawdzenia z ostatnich 12 miesięcy, a za żaden punkt nikt nie odpowiada (`docs/tech/LICZBY.md`). Zaczęliśmy od kodu źródłowego portalu dane.gov.pl i znaleźliśmy w nim gotowy wzór: wykaz chronionych danych (DGA), który portal już dziś składa z zasobów wielu instytucji w jeden wykaz zbiorczy. Ten sam mechanizm zastosowaliśmy do AED – bez przebudowy portalu i bez dawania prawa publikacji komukolwiek poza dostawcą. Zmiany w portalu: katalog `portal/` – pierwszy commit to oryginalny kod dane.gov.pl, każdy następny to nasz przyrost (`git log -- portal/`), więc jury przeczyta kod bez dostępu do zewnętrznych domen.

## Co zostało zrobione
1. **Wykaz AED w portalu dane.gov.pl** (`portal/backend`, kod mcod 2.62.3 + przyrost „Wykaz AED: …”): pole zasobu `contains_aed_list` „Zawiera wykaz AED” (model, migracja, formularz panelu, serializery, filtr, Elasticsearch), walidacja pliku przy zapisie i przy harvestowaniu (44 kolumny wzorca, pola wymagane, współrzędne w Polsce, TERYT, słownik dostępu, jeden wykaz na instytucję), element `containsAedList` w XML (propozycja XSD 1.14), nocne zadanie `create_main_aed_resource_task` (3:40) tworzące „Wykaz AED – wykaz zbiorczy” CSV + XLSX bez scalania, z kolumną „Możliwy duplikat” (≤ 25 m, różni dostawcy), `GET /aed-aggregated`, testy (`mcod/resources/tests/test_aed.py`). Opis i tabela DGA → AED: `portal/README.md`; treść strony informacyjnej CMS: `portal/cms/wykaz_aed.md`.
2. **Mapa danych AED** (strona odczytu): z ustawionym `PORTAL_API` czyta `/aed-aggregated` i plik wykazu zbiorczego; najbliższe AED, „otwarte teraz”, instrukcja przy zamkniętej szafce, karta z dostawcą i linkiem do źródła, warstwa OpenStreetMap osobno jako „Do sprawdzenia”. Rekordy dodane w aplikacji mają etykietę „Prototyp – nieopublikowane w dane.gov.pl” i nie trafiają do wykazu ani eksportu.
3. **Dla instytucji**: instrukcja publikacji w panelu dane.gov.pl w krokach, szablon pliku (CSV, XLSX), typowe komunikaty walidacji portalu z poprawkami, kreator pliku i pakiet z XML harvestera.
4. **Wzorcowy zakres danych AED**: 44 pola (XLSX), słownik danych, JSON Schema, CSVW, słowniki wartości.
5. **Akcja „AED w danych”**: hasło „Dane prosto z serca”, wezwanie „Masz AED? Udostępnij je na dane.gov.pl”, logotyp (SVG, PNG, JPG, PDF) i księga znaku.
6. **Model ról** (`docs/MODEL_ROL.md` v2.2): publikuje dostawca, administrator nie zmienia danych dostawców, zgłoszenia wracają do dostawcy, mapa = wykaz zbiorczy. Funkcje edycji AED przez administratora w aplikacji to **tryb pokazowy prototypu, docelowo wyłączony** (MODEL_ROL, „Zmiany v2.1”).
7. **Referencyjny zakres źródeł** (pkt 2 zadania): każde źródło ma ten sam zakres referencyjny – wzorzec 44 pól (portal odrzuca wykaz bez kolumn wzorca i bez pól wymaganych); w wykazie zbiorczym każdy wiersz wskazuje swoje źródło (dostawca, typ instytucji, link do zasobu, data aktualizacji); eksport aplikacji `deliverables/dataset/zrodla.csv` opisuje każde źródło: format, licencja, częstotliwość aktualizacji, liczba rekordów, pokrycie pól wymaganych i zalecanych (%), obszar.
8. **Testy i uruchomienie**: aplikacja – 114 testów `pytest` (role, walidacja, agregacja, eksport); portal – 28/28 testów Wykazu AED (25 bez bazy, 3 z bazą). **Portal dane.gov.pl z Wykazem AED uruchomiliśmy lokalnie** (panel, API, Celery, Elasticsearch) i przeszliśmy całą ścieżkę: wykaz instytucji w panelu → walidacja (plik z błędami odrzucony) → nocne zadanie → „Wykaz AED – wykaz zbiorczy” → `/aed-aggregated` → Mapa danych AED (`PORTAL_API`); zrzuty: `pitch/zrzuty/01–06, 12`. Uruchomienie wykryło wymóg portalu – brak wartości w tabeli = znak umowny „-” – obsłużony w portalu, we wzorcu i w plikach dla instytucji.

Ograniczenia: portal z Wykazem AED działa lokalnie na 2 instytucjach testowych (kroki uruchomienia: `portal/README.md`), etykiety panelu po angielsku w lokalnej instalacji; dostawcy w prototypie są fikcyjni, obok 3 prawdziwych zbiorów samorządów opublikowanych przed wzorcem (Krosno, Przemyśl, Marki – 50 AED); logowanie kontami testowymi (docelowo login.gov.pl i 2FA); zgłoszenia mieszkańców symulowane w aplikacji (docelowo komentarze do zasobu w dane.gov.pl).

## Link do demo (do 2 min)
https://github.com/Serafin21/misja-aed/blob/main/pitch/demo.mp4

## Prezentacja (PDF do 10 MB)
https://github.com/Serafin21/misja-aed/blob/main/pitch/prezentacja.pdf

## Dodatkowe materiały
- Instrukcja dla jury: `INSTRUKCJA_DLA_JURY.md`
- Kod portalu i przyrost „Wykaz AED”: `portal/` (`portal/README.md`, `git log -- portal/`)
- Logotyp i księga znaku akcji „AED w danych”: `brand/`
- Wzorcowy zakres danych (XLSX), przykładowy pakiet dostawcy, eksport listy: `deliverables/`
- Model ról: `docs/MODEL_ROL.md`; zakres użycia AI (§2 ust. 8 regulaminu): `docs/AI_USAGE.md`
- Prawa autorskie (§4 regulaminu): autorskim rozwiązaniem zespołu jest wszystko poza katalogiem `portal/backend` w commicie `b229557` – to oryginalny kod portalu dane.gov.pl (Ministerstwo Cyfryzacji), dołączony bez zmian, żeby pokazać nasz przyrost; pochodzenie i suma kontrolna: `portal/IMPORT.md`. Zależności: wyłącznie licencje MIT, BSD, Apache-2.0, ISC, PSF (sprawdzenie: `python -m scripts.check_licenses`, `cd src/ui && npm run licenses`); krój IBM Plex Sans – SIL OFL 1.1; dane OpenStreetMap (ODbL) tylko w osobnej warstwie, poza wykazem i eksportem.
