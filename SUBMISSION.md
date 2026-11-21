# Zgłoszenie HackTribe – kopiuj pola 1:1

> DRAFT: wyślij ok. 13:00 (termin sob 20:00 – po nim nie zmienisz zadania). FINAL: niedziela 11:00 (cel 10:30).
> Zamień każde TODO na treść – `python tools/hn.py check` wyłapie braki.

## Nazwa projektu
TODO – nazwa akcji wybrana przez zespół (np. z listy w docs/BRIEF.md); w drafcie może być robocza

## Nazwa zespołu
TODO

## Numer stolika
15f

## Zadanie Partnerskie
MISJA AED – DANE NA RATUNEK

## Link do repozytorium
TODO

## Opis rozwiązania (3–4 zdania)
Tworzymy ogólnopolski, otwarty zbiór danych o defibrylatorach AED w portalu dane.gov.pl. Proponujemy wzorcowy zakres danych (44 pola, w tym godziny dostępności, zamknięcie szafki z instrukcją dostępu i datę weryfikacji) oraz narzędzie, które pobiera dane z wielu źródeł, mapuje je na ten zakres, waliduje, usuwa duplikaty i publikuje w formatach zgodnych ze Standardem technicznym portalu (CSV, GeoJSON, API, plik XML do automatycznego zasilania). Dysponenci dodają AED przez formularz lub plik z czytelnym raportem błędów, a mieszkańcy i służby znajdują najbliższe dostępne urządzenie w responsywnej aplikacji zgodnej z WCAG. Całość wspiera akcja z hasłem i logotypem, która zachęca dysponentów do dzielenia się danymi.

## Podejście do problemu (3–4 zdania)
Zaczęliśmy od zasad portalu dane.gov.pl (Standard techniczny, DCAT-AP-PL, plik XML importu) i na ich podstawie zaprojektowaliśmy zakres danych z jednym źródłem prawdy, z którego generujemy XLSX, słownik danych, JSON Schema i metadane CSVW. Każde źródło ma opisany zakres referencyjny (pokrycie pól, licencja, częstotliwość), a każdy rekord zachowuje pochodzenie; dane OpenStreetMap (ODbL) publikujemy jako osobną warstwę. Prototyp to backend FastAPI z importem, walidacją i deduplikacją oraz frontend React. Zakres wykorzystania AI opisujemy w dokumentacji zgodnie z regulaminem zadania.

## Co zostało zrobione
Analiza wymagań i zasad dane.gov.pl, wzorcowy zakres danych v0.9 (XLSX, słownik danych, JSON Schema, CSVW), dane przykładowe z kilku źródeł, kontrakt API i podział pracy. Trwa implementacja importu i walidacji, aplikacji z mapą oraz prace nad nazwą i logotypem akcji.

## Link do demo (do 2 min)
TODO – wymagane w finale

## Prezentacja (PDF do 10 MB)
TODO – pitch/prezentacja.pdf (min. 5 slajdów ze zrzutami ekranu, kroki użytkownika, ograniczenia)

## Dodatkowe materiały
TODO – logotyp (JPG, PNG, PDF, SVG) i księga znaku PDF z brand/, XLSX z deliverables/zakres_danych/
