# Zgłoszenie HackTribe – kopiuj pola 1:1

> DRAFT: wyślij sob ok. 19:30 (termin sob 20:00 – po nim nie zmienisz zadania). FINAL: niedziela 11:00 (cel 10:30).
> Przed wysłaniem zamień każde TODO na treść (wyszukaj „TODO” w tym pliku). Pola „demo” i „prezentacja” w wersji wstępnej mogą zostać z dopiskiem „w wersji finalnej”.

## Nazwa projektu
AED w danych – otwarty zbiór defibrylatorów dla dane.gov.pl

## Nazwa zespołu
TODO

## Numer stolika
15f

## Zadanie Partnerskie
MISJA AED – DANE NA RATUNEK

## Link do repozytorium
https://github.com/Serafin21/misja-aed

## Opis rozwiązania (3–4 zdania)
Tworzymy ogólnopolski, otwarty zbiór danych o defibrylatorach AED w portalu dane.gov.pl. Proponujemy wzorcowy zakres danych (44 pola, w tym godziny dostępności, zamknięcie szafki z instrukcją dostępu i datę weryfikacji) oraz narzędzie, które pobiera dane z wielu źródeł, mapuje je na ten zakres, waliduje, usuwa duplikaty i publikuje w formatach zgodnych ze Standardem technicznym portalu (CSV, GeoJSON, API, plik XML do automatycznego zasilania). Dysponenci dodają AED przez formularz lub plik z czytelnym raportem błędów, a mieszkańcy i służby znajdują najbliższe dostępne urządzenie w responsywnej aplikacji zgodnej z WCAG. Całość wspiera akcja „AED w danych” z hasłem „Dane prosto z serca” i logotypem (serce z 21 „komórek danych”), która zachęca dysponentów do dzielenia się danymi.

## Podejście do problemu (3–4 zdania)
Zaczęliśmy od zasad portalu dane.gov.pl (Standard techniczny, DCAT-AP-PL, plik XML importu) i na ich podstawie zaprojektowaliśmy zakres danych z jednym źródłem prawdy, z którego generujemy XLSX, słownik danych, JSON Schema i metadane CSVW. Każde źródło ma opisany zakres referencyjny (pokrycie pól, licencja, częstotliwość), a każdy rekord zachowuje pochodzenie; dane OpenStreetMap (ODbL) publikujemy jako osobną warstwę. Prototyp to backend FastAPI z importem, walidacją i deduplikacją oraz frontend React. Zakres wykorzystania AI opisujemy w dokumentacji zgodnie z regulaminem zadania.

## Co zostało zrobione
Wzorcowy zakres danych v0.9 (44 pola; XLSX, słownik danych, JSON Schema, metadane CSVW) i zbiór w formatach dla dane.gov.pl (CSV, GeoJSON, JSON-LD, plik XML do automatycznego zasilania). Backend FastAPI + SQLite: import z wielu źródeł, walidacja według zakresu, deduplikacja, zachowanie pochodzenia każdego rekordu i API. Wczytaliśmy pełny eksport AED z OpenStreetMap dla Polski (ponad 18 tys. AED, publikowane osobno na licencji ODbL) i policzyliśmy aktualność danych w każdej gminie (granice z Państwowego Rejestru Granic). Aplikacja (React) na żywym API, prosta dla osób rzadko korzystających z internetu (duży tekst, duże przyciski, „Dzwoń 112” zawsze widoczne): mapa i lista najbliższych AED z filtrami i wyszukiwarką miejsc, karta AED z instrukcją dostępu, zgłoszenie AED przez mieszkańca w 4 krokach, strona dla instytucji (wgranie pliku z raportem błędów albo wpisanie ręczne), pierwsza pomoc krok po kroku. Akcja „AED w danych”: hasło „Dane prosto z serca”, logotyp w wariantach (JPG, PNG, PDF, SVG) i księga znaku PDF. Ograniczenia: rekordy instytucji w prototypie są przykładowe (fikcyjne), prawdziwe są dane OSM; kafelki mapy z serwera OpenStreetMap (przy wdrożeniu potrzebny własny); 22 rekordy OSM odrzucone przez limity długości tekstu. W toku do finału: testy dostępności, prezentacja i nagranie demo.

## Link do demo (do 2 min)
Nagranie demo (do 2 min) – w wersji finalnej

## Prezentacja (PDF do 10 MB)
Prezentacja PDF – w wersji finalnej (min. 5 slajdów ze zrzutami ekranu, kroki użytkownika, ograniczenia)

## Dodatkowe materiały
W repozytorium: logotyp (brand/logo.jpg, .png, .pdf, .svg + warianty), księga znaku (brand/ksiega_znaku.pdf), wzorcowy zakres danych (deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx), zbiór danych (deliverables/dataset/).
