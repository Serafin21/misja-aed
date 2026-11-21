# Zgłoszenie HackTribe – kopiuj pola 1:1

> DRAFT: wyślij ok. 13:00 (termin sob 20:00 – po nim nie zmienisz zadania). FINAL: niedziela 11:00 (cel 10:30).
> Zamień każde TODO na treść – `python tools/hn.py check` wyłapie braki.

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
Analiza wymagań i zasad dane.gov.pl, wzorcowy zakres danych v0.9 (XLSX, słownik danych, JSON Schema, CSVW), dane przykładowe z kilku źródeł, kontrakt API i podział pracy. Wybrana nazwa, hasło i system znaku akcji „AED w danych” (logo, znaczniki na mapie, kolorystyka). Prototyp aplikacji (React) z 9 ekranami na danych przykładowych: najbliższe dostępne AED, mapa z listą, karta AED z instrukcją dostępu przy zamkniętej szafce i „Paszportem AED”, zgłoszenie obywatela, kreator importu dla dysponenta z raportem błędów i odznaką, zbiór danych, źródła, akcja, moderacja. W toku: backend (import, walidacja, deduplikacja, publikacja), podłączenie aplikacji do API, testy dostępności, księga znaku.

## Link do demo (do 2 min)
TODO – wymagane w finale

## Prezentacja (PDF do 10 MB)
TODO – pitch/prezentacja.pdf (min. 5 slajdów ze zrzutami ekranu, kroki użytkownika, ograniczenia)

## Dodatkowe materiały
TODO – logotyp (JPG, PNG, PDF, SVG) i księga znaku PDF z brand/, XLSX z deliverables/zakres_danych/
