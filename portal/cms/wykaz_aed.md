<!--
Treść strony CMS (Wagtail) „Wykaz AED – punkt informacyjny” – odpowiednik strony „Wykaz chronionych danych”
(DGAProtectedDataList w portal/backend/mcod/cms/models/dga.py). Do wczytania jako pole „Tekst” (body) podstrony.
Wszystkie fakty odpowiadają kodowi przyrostu „Wykaz AED” w portal/backend (README: portal/README.md).
-->

# Wykaz AED – punkt informacyjny

## Czym jest Wykaz AED

Wykaz AED to lista automatycznych defibrylatorów zewnętrznych (AED), które instytucje udostępniają w portalu dane.gov.pl. Każda instytucja publikuje **własny** wykaz AED jako zasób w swoim zbiorze danych. Portal co noc łączy wykazy wszystkich instytucji w jeden zasób **„Wykaz AED – wykaz zbiorczy”** w zbiorze Ministerstwa Cyfryzacji – tak samo jak wykaz chronionych danych.

Wykaz zbiorczy nie zmienia danych instytucji. Wiersze nie są scalane. Przy każdym wierszu jest nazwa instytucji, która za niego odpowiada, i link do jej zasobu.

## Kto publikuje

Wykaz AED publikuje instytucja, która odpowiada za dane o swoich urządzeniach: urząd, szpital, szkoła, uczelnia, firma, fundacja – wykaz mogą publikować wszystkie typy instytucji w portalu. Instytucja publikuje tylko AED, za które odpowiada. Ministerstwo Cyfryzacji nie wpisuje, nie poprawia i nie usuwa danych instytucji – tylko łączy opublikowane wykazy.

Jedna instytucja ma jeden wykaz AED. Zmiany wprowadza się, dodając nową wersję pliku w tym samym zasobie.

## Jak oznaczyć zasób jako wykaz AED

1. Pobierz szablon wykazu AED (44 kolumny wzorcowego zakresu danych AED) i wypełnij go – jeden wiersz to jedno AED.
2. Zaloguj się do panelu dane.gov.pl na konto instytucji i otwórz swój zbiór danych.
3. Dodaj zasób i wybierz z dysku plik CSV, XLS albo XLSX.
4. Zaznacz pole **„Zawiera wykaz AED”**.
5. Zapisz. Portal od razu sprawdza plik. Jeśli plik nie spełnia wzorca, zobaczysz komunikat z numerem wiersza i opisem problemu.

Przy automatycznym zasilaniu plikiem XML (harvester) zasób oznacza się elementem `containsAedList` (schemat XML 1.14 = 1.13 + ten element). Zasoby z harvestera CKAN – polem `contains_aed_list`.

### Co sprawdza portal

- czy plik ma wszystkie kolumny wzorca, np. „Brak 3 z 44 kolumn wzorca AED: …”;
- czy każdy wiersz ma wartości wymagane: id_aed, nazwa_obiektu, miejscowość, numer budynku, kod pocztowy, teryt_terc, szerokość i długość geograficzną, dostep, godziny_dostepnosci albo dostepny_24h, data_weryfikacji oraz kontakt_telefon albo kontakt_email;
- czy współrzędne leżą w Polsce (z podpowiedzią, gdy szerokość i długość są zamienione);
- czy teryt_terc ma 7 cyfr kodu TERYT gminy;
- czy dostep ma jedną z wartości: publiczny, ograniczony, prywatny;
- czy instytucja nie ma już innego wykazu AED.

## Kolumny

**Plik instytucji:** 44 kolumny wzorcowego zakresu danych AED (w tej kolejności co w szablonie), m.in. id_aed, nazwa_obiektu, opis_lokalizacji, adres w osobnych polach, teryt_terc, współrzędne, dostep, godziny_dostepnosci, dostepny_24h, szafka_zamknieta, instrukcja_dostepu, data_weryfikacji, kontakt. Opis każdej kolumny: słownik danych AED.

**Wykaz zbiorczy** ma dodatkowo:

| Kolumna | Znaczenie |
|---|---|
| Lp. | numer wiersza |
| Nazwa dostawcy | instytucja, która opublikowała wiersz i za niego odpowiada |
| Typ instytucji | typ instytucji w portalu |
| Link do zasobu źródłowego | zasób instytucji, z którego pochodzi wiersz |
| Data aktualizacji zasobu | kiedy instytucja ostatnio zmieniła swój wykaz |
| 44 kolumny wzorca | wartości z pliku instytucji, bez zmian |
| Możliwy duplikat | identyfikatory AED **innych** instytucji w promieniu 25 m – tylko oznaczenie, wiersze nie są łączone |

## Kiedy powstaje wykaz zbiorczy

Portal tworzy wykaz zbiorczy **codziennie w nocy (o 3:40)**, w formatach CSV i XLSX, w zbiorze „Wykaz AED – wykaz zbiorczy” Ministerstwa Cyfryzacji (kategoria: Zdrowie). Nowy albo poprawiony wykaz instytucji pojawia się w wykazie zbiorczym następnego dnia. Wiersze, które nie spełniają wzorca, są pomijane.

Adres aktualnego wykazu zbiorczego zwraca API portalu: `GET /aed-aggregated` (linki do plików CSV i XLSX). Z tego adresu korzystają aplikacje, np. mapy AED.

## Kontakt

Pytania o wykaz AED i o wzorcowy zakres danych: zespół portalu dane.gov.pl w Ministerstwie Cyfryzacji – przez formularz kontaktowy portalu. Uwagi do konkretnego AED kieruj do instytucji wskazanej w kolumnie „Nazwa dostawcy” – tylko ona może zmienić dane.

Akcja dla instytucji: **„AED w danych”** – „Masz AED? Udostępnij je na dane.gov.pl”.
