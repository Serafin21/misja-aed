# Zgłoszenie HackTribe – kopiuj pola 1:1

> Model ról: docs/MODEL_ROL.md (CR-TL-5). FINAL: niedziela 11:00 (cel 10:30).
> Przed wysłaniem zamień każde TODO na treść (wyszukaj „TODO” w tym pliku). Pola „demo” i „prezentacja” w wersji wstępnej mogą zostać z dopiskiem „w wersji finalnej”.

## Nazwa projektu
Mapa danych AED – wspólna lista AED w dane.gov.pl (akcja dla dostawców danych: „AED w danych”)

## Nazwa zespołu
MKS

## Numer stolika
15f

## Zadanie Partnerskie
MISJA AED – DANE NA RATUNEK

## Link do repozytorium
https://github.com/Serafin21/misja-aed

## Opis rozwiązania (3–4 zdania)
Proponujemy model, w którym dane o każdym AED publikuje na dane.gov.pl jego właściciel, a portal łączy zbiory wielu dostawców we wspólną listę. Przygotowaliśmy wzorzec danych (44 pola) i kreator, który z formularza lub pliku tworzy komplet plików do publikacji na koncie dostawcy, w tym XML zgodny ze schematem harvestera dane.gov.pl 1.13. Wspólna lista nie jest nowym zbiorem: każdy rekord pokazuje dostawcę, link do zbioru i datę danych, a zgłoszenia mieszkańców trafiają do tego dostawcy. Akcja „AED w danych” zaprasza właścicieli AED do publikacji tam, gdzie mapa pokazuje luki.

## Podejście do problemu (3–4 zdania)
Problemem nie jest brak danych, tylko brak odpowiedzialności: w OpenStreetMap jest ponad 18 tys. AED, ale tylko co szósty ma datę sprawdzenia z ostatniego roku i nikt za nie nie odpowiada. Zaczęliśmy od zasad portalu i jego kodu źródłowego, żeby użyć istniejących mechanizmów: kont dostawców, harvestera XML, komentarzy do zbiorów i przypomnień o aktualizacji. Role mają twarde granice: publikuje tylko podmiot, który za dane odpowiada – właściciel, zarządca z umową albo fundacja, która sprawdziła AED na miejscu – i zawsze po zalogowaniu, administrator łączy zbiory, ale nie wpisuje danych, a OSM służy wyłącznie do wskazywania luk.

## Co zostało zrobione
Model ról i odpowiedzialności (docs/MODEL_ROL.md). Wzorzec danych AED: 44 pola (XLSX), słownik danych, JSON Schema, metadane CSVW. Zaufane konta instytucji: wniosek (nazwa, REGON, podstawa publikacji: właściciel, zarządca z umową albo podmiot weryfikujący) zatwierdzany przez administratora. „Zgłoś AED” tylko po zalogowaniu kontem instytucji: adres z podpowiedziami, „Użyj mojej lokalizacji” z dokładnością, pinezka do przeciągnięcia, obowiązkowe zdjęcie; administrator sprawdza zgłoszenie formalnie i zatwierdza albo odsyła do poprawy z komentarzem – nie edytuje danych. Kreator dostawcy (Moje AED): formularz albo plik, sprawdzenie ze wzorcem i przycisk „Pobierz pliki do publikacji” – pakiet z CSV, XML harvestera 1.13 zgodnym z XSD, słownikiem i instrukcją publikacji na własnym koncie (nie ma przycisku „Opublikuj”). Agregacja wspólnej listy ze zbiorów dostawców w formacie odpowiedzi API 1.4 portalu: bez scalania rekordów, z oznaczeniem możliwych duplikatów i zbiorów po terminie. Role sprawdzane na serwerze (dysponent zmienia tylko swoje AED, administrator nie ma zapisu do danych), dziennik zdarzeń bez możliwości zmiany. Zgłoszenia mieszkańców trafiają do dostawcy, a AED bez dostawcy – do kolejki administratora jako zaproszenie do publikacji. Mapa i lista z dwoma trybami (dostępność teraz, aktualność danych), karta AED z dostawcą, zbiorem i datą danych, warstwa „Do sprawdzenia” z OpenStreetMap poza listą, mapa luk w gminach, pierwsza pomoc. Testy automatyczne kryteriów K1–K11 z modelu ról. Ograniczenia prototypu: dostawcy są fikcyjni (3), zgłoszenia i przypomnienia są symulowane w aplikacji (docelowo komentarze i powiadomienia portalu), logowanie kontami testowymi (docelowo login.gov.pl i 2FA), kafelki mapy z serwera OpenStreetMap.

## Link do demo (do 2 min)
Nagranie demo (do 2 min) – w wersji finalnej

## Prezentacja (PDF do 10 MB)
Prezentacja PDF – w wersji finalnej (min. 5 slajdów ze zrzutami ekranu, kroki użytkownika, ograniczenia)

## Dodatkowe materiały
W repozytorium: model ról (docs/MODEL_ROL.md), przykładowy pakiet dostawcy (deliverables/pakiet_dostawcy_przyklad/), eksport wspólnej listy (deliverables/dataset/), wzorzec danych (deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx), logotyp i księga znaku akcji „AED w danych” (brand/ – materiały akcji dla dostawców, nie logo aplikacji).

