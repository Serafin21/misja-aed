> Źródło: dokument zespołu „Wspólna lista AED w dane.gov.pl – model ról i odpowiedzialności” (21.11.2026). Wiążący dla CONTRACT.md od wersji 2.0. Stan wdrożenia w prototypie: sekcja „Wdrożenie” na końcu. **Wersja 1.3** (22.11.2026, CR-TL-8): zaufane konta instytucji (wniosek → zatwierdzenie), „Zgłoś AED” tylko po zalogowaniu, zatwierdzanie formalne przez administratora (§4, §5 P1a, P2a), kryteria K13–K16.

# Wspólna lista AED w dane.gov.pl – model ról i odpowiedzialności

Nov 21, 2026 · @Soczek

## 1. Cel i zakres

Dane o AED publikuje wyłącznie właściciel urządzenia, na własnym koncie dostawcy w dane.gov.pl. Ministerstwo Cyfryzacji administruje i łączy zbiory, ale nie wprowadza danych.

Problem, na który odpowiada model: dane o AED są rozproszone i niezweryfikowane, bo nikt nie bierze za nie odpowiedzialności. Odpowiedź: każdy rekord ma jednego, wskazanego z nazwy dostawcę.

Dokument ustala role, uprawnienia, procesy, wymagania wobec zbioru dostawcy i reguły wspólnej listy. Dotyczy prototypu z HackNation 2026 i wersji docelowej; różnice opisuje sekcja 11.

Poza zakresem:

- publikowanie przez zespół projektu danych zebranych z innych źródeł,

- przebudowa mechanizmów portalu tak, aby publikować mógł każdy,

- zmiany w kodzie dane.gov.pl; model korzysta z mechanizmów, które portal już ma.

## 2. Definicje

- **AED** – automatyczny defibrylator zewnętrzny dostępny dla osób postronnych.

- **Dysponent** – właściciel AED. Odpowiada za dostępność urządzenia i za dane o nim. W tym modelu dysponent jest jednocześnie dostawcą danych.

- **Dostawca danych** – podmiot z kontem na dane.gov.pl, który publikuje zbiór i odpowiada za jego jakość, aktualność i poprawność: instytucja publiczna, przedsiębiorca, organizacja pozarządowa.

- **Zbiór AED dostawcy** – zbiór na dane.gov.pl z urządzeniami jednego dostawcy, zgodny ze wzorcem AED.

- **Wzorzec AED** – wspólna struktura rekordu, schemat XML harvestera 1.13 i reguły metadanych (sekcja 6).

- **Wspólna lista AED** – widok łączący zbiory dostawców. Nie jest odrębnym zbiorem i nie ma własnego dostawcy; każdy rekord wskazuje swoje źródło.

- **Zgłoszenie** – informacja od mieszkańca o konkretnym AED (brak, awaria, brak dostępu, błędne położenie) albo o urządzeniu spoza listy.

- **Potwierdzenie** – deklaracja mieszkańca, że AED był na miejscu i był dostępny w danym dniu. Nie zmienia danych dostawcy.

- **Weryfikacja** – sprawdzenie urządzenia na miejscu przez dysponenta, zapisane w zbiorze jako data weryfikacji.

- **Podmiot wspierający** – inicjatywa oddolna (fundacja, uczelnia, gmina wobec cudzych urządzeń), która pomaga dysponentom przygotować i opublikować zbiór.

- **Warstwa pomocnicza** – punkty z OpenStreetMap oznaczone „Do sprawdzenia”, poza wspólną listą (sekcja 8).

- **Luka** – gmina bez żadnego zbioru AED dostawcy.

## 3. Zasady

Każdy rekord na wspólnej liście ma jednego dostawcę, który za niego odpowiada; nikt inny go nie zmienia.

1.  **Odpowiedzialność.** Wymaga się, aby każdy rekord pochodził ze zbioru jednego dostawcy. Dostawca odpowiada za jakość, aktualność i poprawność całego zbioru.

2.  **Publikuje właściciel.** Dysponent publikuje wyłącznie urządzenia, których jest właścicielem. Nie dopuszcza się publikowania cudzych urządzeń, także przez gminę, organizację pozarządową lub mieszkańca.

3.  **Publikacja na koncie dostawcy.** Zbiór publikuje się na koncie dostawcy w dane.gov.pl, według zasad portalu. Ani zespół projektu, ani administrator nie publikują danych w imieniu dysponentów.

4.  **Administrator nie wprowadza danych.** Ministerstwo Cyfryzacji prowadzi konta, wzorzec, agregację i akcję promocyjną. Nie dodaje, nie poprawia i nie usuwa rekordów AED.

5.  **Jedno źródło listy.** Wspólna lista powstaje wyłącznie ze zbiorów dostawców opublikowanych na dane.gov.pl. Dane z OSM i zgłoszeń mieszkańców nie trafiają na listę.

6.  **Bez scalania.** Nie dopuszcza się łączenia ani nadpisywania rekordów różnych dostawców. Możliwe duplikaty oznacza się i zgłasza obu dostawcom.

7.  **Informacja wraca do źródła.** Zgłoszenia i potwierdzenia trafiają do dostawcy, którego rekordu dotyczą. O zmianie danych decyduje dostawca.

8.  **Wielu dostawców, jeden wzorzec.** Dopuszcza się dowolną liczbę dostawców. Zaleca się jeden zbiór AED na dostawcę, aktualizowany w miejscu, bez zakładania nowego zbioru przy każdej zmianie.

9.  **Inicjatywy oddolne.** Dopuszcza się działanie podmiotów wspierających: pomoc w przygotowaniu plików, szkolenia, lokalne akcje. Podmioty te nie publikują danych o cudzych urządzeniach.

## 4. Role i uprawnienia

Prawo zapisu ma tylko dysponent i tylko wobec własnych urządzeń; administrator zarządza systemem, nie danymi.

| Rola                 | Kto                                         | Może                                                                                                                                           | Nie może                                                                             | Logowanie (docelowo)                          |
|----------------------|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|-----------------------------------------------|
| Mieszkaniec          | każda osoba                                 | wyszukać AED; zobaczyć źródło i datę danych; wysłać zgłoszenie; potwierdzić AED                                                                | zmieniać dane; widzieć dane zgłaszających                                            | bez logowania                                 |
| Dysponent (dostawca) | właściciel AED, zarządca z umową albo podmiot weryfikujący AED na miejscu, z **zatwierdzonym** kontem instytucji | przygotować pliki; opublikować zbiór na swoim koncie; aktualizować własne rekordy; rozpatrywać zgłoszenia o swoich AED                         | zmieniać rekordy innych dostawców; publikować cudze AED                              | konto dostawcy dane.gov.pl, login.gov.pl, 2FA |
| Administrator (MC)   | wyznaczeni pracownicy MC                    | prowadzić konta i wzorzec; uruchamiać agregację; monitorować aktualność i luki; obsługiwać zgłoszenia bez dostawcy; prowadzić akcję promocyjną | dodawać, poprawiać, usuwać rekordy AED; scalać duplikaty; publikować AED jako własne | konto administratora, 2FA obowiązkowe         |
| Podmiot wspierający  | fundacja, uczelnia, gmina wobec cudzych AED | pomagać dysponentom przygotować pliki; prowadzić lokalne akcje                                                                                 | publikować dane o cudzych AED                                                        | bez uprawnień w systemie                      |
| System agregujący    | proces techniczny                           | pobierać i walidować zbiory; budować listę; wysyłać przypomnienia i powiadomienia                                                              | zmieniać treść rekordów                                                              | konto techniczne, tylko odczyt API            |

Ukrycie linku do logowania nie jest zabezpieczeniem. Uprawnienia sprawdza serwer przy każdej operacji (sekcja 9).

**Zaufane konta instytucji (v1.3).** Konto dostawcy zakłada sama instytucja – wniosek z nazwą, REGON, podstawą publikacji (właściciel AED / zarządca z umową / podmiot weryfikujący na miejscu), służbowym e-mailem i telefonem. Do zatwierdzenia przez administratora konto jest nieaktywne (logowanie odrzucone). Administrator sprawdza instytucję i podstawę, zatwierdza albo odrzuca z uzasadnieniem; decyzja trafia do dziennika. Zatwierdzona instytucja może dodać pracowników do swojej organizacji (te same uprawnienia). Administrator może też założyć konto instytucji sam. Za dane odpowiada instytucja, nie osoba zatwierdzająca konto.

**„Zgłoś AED” tylko po zalogowaniu (v1.3).** Nowe urządzenie zgłasza wyłącznie zalogowana instytucja. Mieszkańcy nadal zgłaszają problemy z istniejącymi AED bez logowania (P6) – te zgłoszenia trafiają do dostawcy i nie zmieniają danych.

## 5. Procesy

Dane płyną w jedną stronę: od dysponenta przez dane.gov.pl do wspólnej listy. Zgłoszenia wracają do dysponenta.

<img src="media/image1.png" style="width:6in;height:3.02678in" alt="przepływ danych, zgłoszeń i zaproszeń · 8 elementów" />

przepływ danych, zgłoszeń i zaproszeń · 8 elementów

Na wspólną listę dane trafiają tylko przez zbiór dysponenta. Administrator i dane OSM wpływają wyłącznie na mapę luk i akcję promocyjną.

1.  **P1. Konto dostawcy.** Dysponent zakłada konto organizacji w dane.gov.pl według procedury portalu. Docelowo loguje się przez login.gov.pl.

    **P1a. Wniosek o konto (v1.3).** Instytucja składa wniosek w aplikacji; administrator zatwierdza go po sprawdzeniu instytucji, REGON i podstawy publikacji albo odrzuca z uzasadnieniem. Przed zatwierdzeniem konto jest nieaktywne.

2.  **P2. Przygotowanie plików.** Dysponent wpisuje urządzenia w formularzu albo wgrywa plik. Kreator sprawdza dane ze wzorcem i tworzy komplet: CSV, XML harvestera, opis metadanych.

    **P2a. Zgłoś AED i zatwierdzenie formalne (v1.3).** Zalogowana instytucja zgłasza nowe AED: adres (ulica, numer, kod, miejscowość – położenie z geokodowania adresu albo z pinezki, ewentualnie „Użyj mojej lokalizacji”), opis miejsca, dostęp, godziny albo „całą dobę”, czy szafka jest zamknięta (tak/nie – bez „nie wiem”) i jak ją otworzyć, **zdjęcie** (obowiązkowe; metadane, w tym położenie GPS, są usuwane). Administrator sprawdza zgłoszenie **formalnie**: kompletność, zdjęcie, zgodność położenia z adresem. **Nie edytuje pól** – zatwierdza albo odsyła do poprawy z komentarzem; instytucja poprawia i wysyła ponownie. Zatwierdzone AED trafia do kopii roboczej instytucji; publikuje je ona sama na swoim koncie (P3), więc odpowiedzialność i publikacja zostają po jej stronie. Decyzja (kto, kiedy, komentarz) jest widoczna dla instytucji i zapisana w dzienniku.

3.  **P3. Publikacja.** Dysponent publikuje zbiór na swoim koncie: wgrywa pliki albo podaje adres https pliku XML, który portal pobiera cyklicznie. Kreator kończy się przyciskiem „Pobierz pliki do publikacji”, nie „Opublikuj”.

4.  **P4. Utrzymanie.** Dysponent aktualizuje zbiór zgodnie z zadeklarowaną częstotliwością. Zmianę stanu urządzenia (awaria, wycofanie, nowe miejsce) wprowadza w ciągu 7 dni. Każde urządzenie weryfikuje na miejscu co najmniej raz na 12 miesięcy.

5.  **P5. Agregacja.** System pobiera zbiory oznaczone jako zbiory AED, waliduje je i buduje wspólną listę. Rekord niezgodny ze wzorcem nie trafia na mapę, a dostawca dostaje raport walidacji.

6.  **P6. Zgłoszenia i potwierdzenia.** Mieszkaniec zgłasza problem albo potwierdza AED przy konkretnym rekordzie. Informacja trafia do dostawcy przez mechanizm komentarzy portalu. Dostawca rozpatruje zgłoszenie w ciągu 14 dni i sam decyduje o zmianie zbioru.

7.  **P7. AED bez dostawcy.** Zgłoszenie urządzenia spoza listy trafia do kolejki administratora. Administrator go nie publikuje: zaprasza właściciela do publikacji (sekcja 10) i oznacza lukę na mapie.

8.  **P8. Możliwy duplikat.** Gdy rekordy dwóch dostawców leżą bliżej niż 25 m, lista pokazuje oba z oznaczeniem „możliwy duplikat”. System powiadamia obu dostawców; rozstrzygają oni między sobą.

9.  **P9. Przypomnienia.** Gdy zbiór przekroczy termin aktualizacji, dostawca dostaje przypomnienie z portalu. Po kolejnych 30 dniach zbiór jest oznaczony na mapie jako nieaktualny.

Terminy 7 dni, 14 dni, 30 dni, 12 miesięcy i próg 25 m to wartości proponowane, do potwierdzenia z MC (sekcja 13).

## 6. Wymagania wobec zbioru dostawcy

Zbiór wchodzi na wspólną listę, jeśli ma 44 pola wzorca AED i metadane zgodne ze schematem harvestera 1.13.

| Element          | Wymaganie                                                                                                                              |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Zawartość        | tylko urządzenia dostawcy; jeden rekord to jedno urządzenie                                                                            |
| Struktura        | 44 pola z pliku wzorcowy_zakres_danych_AED (wersja 0.9); CSV w UTF-8 z wierszem nagłówka                                               |
| Identyfikacja    | id_aed stały przy kolejnych aktualizacjach; dysponent_regon wskazuje dostawcę                                                          |
| Położenie        | szerokosc_geograficzna, dlugosc_geograficzna w WGS 84 (EPSG:4326), stopnie dziesiętne, 5 miejsc po przecinku; adres i opis_lokalizacji |
| Obszar           | teryt_terc gminy (7 znaków) w każdym rekordzie; w metadanych zasobu regions/terytIdent, do 20 obszarów                                 |
| Dostępność       | dostep, godziny_dostepnosci, dostepny_24h, instrukcja_dostepu                                                                          |
| Weryfikacja      | data_weryfikacji (RRRR-MM-DD) i metoda_weryfikacji; weryfikacja na miejscu co najmniej raz na 12 miesięcy                              |
| Źródło           | zrodlo_danych wskazuje źródło w organizacji dostawcy (inwentaryzacja, przegląd serwisowy); nigdy OSM                                   |
| Kontakt          | kontakt_email, kontakt_telefon wyłącznie służbowe; bez danych osobowych pracowników                                                    |
| Zdjęcie          | zdjecie_url bez wizerunku osób                                                                                                         |
| Metadane XML     | schemat harvestera 1.13, przestrzeń nazw urn:otwarte-dane:harvester:1.13                                                               |
| Odpowiedzialność | conditions/responsibilities (do 4000 znaków): kto odpowiada, za co i jak zgłaszać błędy                                                |
| Częstotliwość    | updateFrequency od daily do yearly; nie dopuszcza się irregular ani notPlanned                                                         |
| Adresy zasobów   | wyłącznie https                                                                                                                        |
| Słownik pól      | opis wzorca dołączony jako supplements                                                                                                 |

Dostawca oznacza zbiór słowem kluczowym listy (sekcja 13). System włącza go do agregacji po pozytywnej walidacji.

## 7. Reguły wspólnej listy

Wspólna lista pokazuje rekordy dostawców bez zmian, z widocznym źródłem i datą; nie ma funkcji edycji.

- **Źródła.** Tylko zbiory na dane.gov.pl oznaczone słowem kluczowym listy i zgodne ze wzorcem.

- **Pochodzenie.** Karta każdego AED pokazuje nazwę dostawcy, link do zbioru i zasobu, datę danych oraz datę weryfikacji.

- **Aktualność zbioru.** Zbiór jest „nieaktualny”, gdy od ostatniej aktualizacji minął okres z updateFrequency i kolejne 30 dni.

- **Aktualność rekordu.** Rekord jest „do weryfikacji”, gdy data_weryfikacji jest starsza niż 12 miesięcy. Oba sygnały pokazuje tryb aktualności danych na mapie.

- **Walidacja.** Rekord bez współrzędnych albo z błędnym kodem TERYT nie trafia na mapę. Dostawca dostaje raport; lista niczego nie poprawia za niego.

- **Duplikaty.** Rekordy różnych dostawców w odległości do 25 m dostają oznaczenie „możliwy duplikat”. Oba pozostają widoczne.

- **Potwierdzenia mieszkańców.** Pokazuje się je osobno („ostatnie potwierdzenie mieszkańca: data”). Nie zastępują daty weryfikacji dostawcy.

- **Udostępnianie listy.** Eksport i API listy oznacza się jako kompilację zbiorów dostawców. Każdy rekord niesie identyfikator dostawcy, zbioru i warunki ponownego wykorzystywania zbioru źródłowego.

## 8. Dane z OpenStreetMap

Punkty z OSM służą tylko do wskazywania luk. Nie trafiają na wspólną listę, do eksportu ani do zbiorów dostawców.

- **Prezentacja.** Dopuszcza się osobną warstwę „Do sprawdzenia”, odróżnioną od listy kolorem i opisem, z dopiskiem, że dysponent nie potwierdził tych danych.

- **Licencja.** Wymagana jest atrybucja „© współtwórcy OpenStreetMap” (ODbL 1.0). ODbL wymaga tej samej licencji dla baz pochodnych, dlatego dane OSM nie mogą trafić do zbiorów na dane.gov.pl.

- **Dysponent.** Może potraktować punkt OSM jako wskazówkę do własnej weryfikacji. Do zbioru wpisuje wyłącznie dane sprawdzone na miejscu.

- **Administrator.** Wykorzystuje warstwę do mapy luk i do kierowania akcji promocyjnej.

## 9. Bezpieczeństwo i rozliczalność

Każdy zapis jest autoryzowany po stronie serwera i rejestrowany w dzienniku zdarzeń.

- **Autoryzacja.** Przy każdej operacji serwer sprawdza rolę użytkownika i to, czy rekord należy do jego organizacji. Ukrycie elementów interfejsu nie zastępuje tej kontroli.

- **Uwierzytelnienie.** Docelowo konta portalu dane.gov.pl z logowaniem przez login.gov.pl. Od administratorów i dostawców wymaga się uwierzytelniania dwuskładnikowego.

- **Dziennik zdarzeń.** Rejestruje się: kto, kiedy, jaką operację, na którym rekordzie, stan przed i po. Dziennika nie można zmieniać z poziomu aplikacji.

- **Dane osobowe.** Zbiory dostawców nie zawierają danych osobowych. Zgłoszenia są domyślnie anonimowe; e-mail zgłaszającego jest opcjonalny, służy tylko do odpowiedzi i jest usuwany po zamknięciu zgłoszenia (RODO).

- **Nadużycia.** Stosuje się limit zgłoszeń z jednego źródła i filtr treści przed przekazaniem zgłoszenia dostawcy.

- **Dostępność cyfrowa.** Interfejs mieszkańca spełnia WCAG 2.1 na poziomie AA, zgodnie z ustawą o dostępności cyfrowej.

## 10. Akcja promocyjna dla dostawców

Logo „AED w danych” i hasło „Dane prosto z serca” służą akcji skierowanej do potencjalnych dostawców, nie do prezentacji aplikacji.

- **Adresaci.** Właściciele AED bez zbioru na dane.gov.pl: urzędy, szkoły, szpitale, firmy, obiekty sportowe, galerie handlowe, dworce, wspólnoty mieszkaniowe.

- **Wezwanie.** „Masz AED? Udostępnij je na dane.gov.pl” prowadzi do kreatora plików (P2) i instrukcji publikacji (P3).

- **Kierowanie.** Mapa luk i warstwa OSM wskazują gminy i obiekty, do których akcja trafia najpierw.

- **Materiały.** Plakat, e-mail do instytucji, grafika do mediów społecznościowych, odznaka „Nasze AED jest w danych” dla dostawców po publikacji.

- **Rozdzielenie marek.** Aplikacja ma własną, neutralną nazwę. Logo akcji występuje tylko w materiałach akcji i na jej stronie docelowej dla dostawców.

- **Mierniki.** Liczba dostawców, liczba AED na liście, odsetek gmin z co najmniej jednym dostawcą, odsetek rekordów zweryfikowanych w ostatnich 12 miesiącach.

## 11. Prototyp a wersja docelowa

Prototyp pokazuje model na fikcyjnych dostawcach; wersja docelowa korzysta z mechanizmów, które dane.gov.pl już ma, bez przebudowy portalu.

| Element                 | Prototyp (HackNation)                                      | Docelowo: mechanizm dane.gov.pl (kod mcod-backend)                                         |
|-------------------------|------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Dostawcy                | 3 fikcyjnych dostawców, dane testowe                       | organizacje portalu: samorządowe, państwowe, prywatne, inne (mcod/organizations)           |
| Logowanie               | konta testowe dla ról                                      | login.gov.pl (mcod/logingovpl) i 2FA                                                       |
| Publikacja              | pliki do pobrania z kreatora; zespół niczego nie publikuje | zbiór na koncie dostawcy, harvester XML 1.13 (mcod/harvester)                              |
| Agregacja               | pakiety fikcyjnych dostawców w formacie odpowiedzi API 1.4 | API 1.4 portalu albo funkcja portalu (sekcja 13)                                           |
| Zgłoszenia              | kolejka symulowana w aplikacji                             | komentarze do zbioru i zasobu: POST /datasets/{id}/comments, POST /resources/{id}/comments |
| Przypomnienia           | symulacja w panelu administratora                          | częstotliwość aktualizacji z powiadomieniem: update_notification_frequency (mcod/datasets) |
| Historia zmian          | dziennik zdarzeń aplikacji                                 | historia obiektów (mcod/histories)                                                         |
| Obszar                  | kody TERYT w rekordach                                     | regiony zasobu (mcod/regions)                                                              |
| AED bez dostawcy        | kolejka administratora                                     | propozycje zbiorów (mcod/suggestions)                                                      |
| Prezentacja rozwiązania | strona aplikacji                                           | przykłady wykorzystania danych (mcod/showcases)                                            |

## 12. Kryteria odbioru

Model uznaje się za wdrożony w prototypie, gdy przechodzą wszystkie testy z tabeli.

| Nr  | Kryterium                                                            | Sposób sprawdzenia                                                                |
|-----|----------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| K1  | Dysponent nie zmieni rekordu innego dostawcy                         | żądanie API na cudzy rekord kończy się odmową 403                                 |
| K2  | Administrator nie ma zapisu do rekordów AED                          | przegląd API; próba zapisu kończy się odmową 403                                  |
| K3  | Pliki dostawcy są zgodne ze schematem harvestera 1.13                | walidacja XSD; obecne responsibilities, terytIdent, updateFrequency, adresy https |
| K4  | Każdy rekord na liście wskazuje źródło                               | karta AED pokazuje dostawcę, link do zbioru i datę danych                         |
| K5  | Lista nie zawiera danych z OSM                                       | eksport listy bez rekordów OSM; warstwa OSM z atrybucją ODbL                      |
| K6  | Duplikaty nie są scalane                                             | 2 rekordy różnych dostawców w 25 m: oba widoczne, oznaczone, 2 powiadomienia      |
| K7  | Zgłoszenie trafia do właściwego dostawcy i nie zmienia danych        | zgłoszenie testowe w kolejce dostawcy; rekord bez zmian                           |
| K8  | AED bez dostawcy nie trafia na listę                                 | zgłoszenie nowego miejsca w kolejce administratora, brak na mapie                 |
| K9  | Tryb aktualności rozróżnia zbiór nieaktualny i rekord do weryfikacji | dane testowe z przekroczonymi terminami                                           |
| K10 | Każdy zapis jest w dzienniku zdarzeń                                 | operacja testowa daje wpis: kto, kiedy, co, przed i po                            |
| K11 | Kreator kończy się pobraniem plików, nie publikacją                  | przycisk „Pobierz pliki do publikacji”; brak przycisku „Opublikuj”                |
| K12 | Interfejs mieszkańca spełnia WCAG 2.1 AA                             | test automatyczny i obsługa samej klawiatury                                      |
| K13 | Konto instytucji działa dopiero po zatwierdzeniu wniosku             | logowanie przed zatwierdzeniem odrzucone (403), po zatwierdzeniu działa            |
| K14 | Zdjęcie AED jest wymagane, a jego metadane są usuwane                | zgłoszenie bez zdjęcia odrzucone; zapisane zdjęcie bez EXIF/GPS                    |
| K15 | „Zgłoś AED” tylko po zalogowaniu i bez wartości „nie wiem”           | bez logowania 401; „nie wiem”/„nieznane” odrzucone (422)                           |
| K16 | Administrator zatwierdza formalnie, nie edytuje danych               | próba zmiany pól przez administratora → 403; decyzja widoczna u nadawcy            |

## 13. Kwestie do potwierdzenia z MC

Do czasu odpowiedzi MC zespół stosuje założenia robocze z tabeli.

| Nr  | Pytanie do MC                                                                          | Założenie robocze                                                                                |
|-----|----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Q1  | Czy wspólna lista ma być funkcją portalu, czy usługą zewnętrzną korzystającą z API?    | usługa na API 1.4, napisana tak, by dało się ją przenieść do portalu                             |
| Q2  | Jak oznaczać zbiory należące do listy?                                                 | słowo kluczowe „wspolna-lista-aed” i wersja wzorca w słowniku pól                                |
| Q3  | Czy przewiduje się uproszczoną rejestrację małych podmiotów prywatnych jako dostawców? | standardowa procedura portalu; kreator przygotowuje komplet plików                               |
| Q4  | Czy zgłoszenia mieszkańców mogą płynąć przez komentarze do zbiorów i zasobów?          | tak; w prototypie symulacja                                                                      |
| Q5  | Czy dopuścić dostawcę, który publikuje cudze AED po własnej weryfikacji, np. fundację? | nie; publikuje tylko właściciel, inicjatywy oddolne wspierają                                    |
| Q6  | Czy terminy 7 dni, 14 dni, 30 dni, 12 miesięcy i próg 25 m są akceptowalne?            | tak, jako wartości startowe                                                                      |
| Q7  | Jakie warunki ponownego wykorzystywania zalecić dostawcom prywatnym?                   | obowiązek wskazania źródła i informacji o modyfikacji, opis odpowiedzialności w responsibilities |

## Wdrożenie w prototypie (Model A, 21.11.2026)

| Kryterium | Jak spełnione | Test |
|---|---|---|
| K1 | `PATCH /aed/{id}` na rekord innego dostawcy → 403; własny → zmiana w kopii roboczej | `tests/test_model_rol.py::test_k1…` |
| K2 | administrator: `POST/PATCH /aed`, `/import`, import z dane.gov.pl → 403/422; brak tras zapisu do listy | `test_k2…` |
| K3 | `POST /moje-aed/pakiet` → ZIP z `aed_harvester.xml` zgodnym z XSD 1.13 (responsibilities, regions/terytIdent, updateFrequency, https, supplements) | `test_k3…` |
| K4 | `meta` każdego rekordu listy: dostawca, `zbior_url`, `zasob_url`, `data_danych` | `test_k4…` |
| K5 | lista i eksport tylko z rekordów dostawców; OSM = warstwa `pomocnicza` z atrybucją ODbL | `test_k5…` |
| K6 | rekordy różnych dostawców ≤ 25 m: oba widoczne, `mozliwe_duplikaty`, powiadomienie dla obu | `test_k6…` |
| K7 | zgłoszenie z `id_aed` → kolejka i powiadomienie dostawcy; decyzja nie zmienia rekordu; e-mail usuwany po zamknięciu | `test_k7…` |
| K8 | zgłoszenie bez dostawcy → kolejka administratora (`zaproszenie` / `odrzucone`), nigdy na liście | `test_k8…` |
| K9 | `zbior_nieaktualny` (updateFrequency + 30 dni) ≠ `stan_danych` rekordu (weryfikacja > 12 mies.) | `test_k9…` |
| K10 | tabela `dziennik` (kto, kiedy, operacja, obiekt, przed, po); UPDATE/DELETE blokowane wyzwalaczami | `test_k10…` |
| K11 | kreator kończy się `POST /moje-aed/pakiet` („Pobierz pliki do publikacji”); brak trasy publikacji | `test_k11…` |
| K12 | interfejs (Model B) | `docs/a11y/` |
| K13 | `POST /konta/wnioski` (bez logowania) → konto nieaktywne, logowanie 403 `konto_oczekuje`; `POST /konta/wnioski/{id}/decyzja` → aktywne konto dostawcy, wpis w dzienniku | `tests/test_konta_zgloszenia_aed.py::test_wniosek…` |
| K14 | `POST /zgloszenia-aed` bez zdjęcia → 422; JPEG/PNG/WebP bez EXIF, XMP, komentarzy (`src/core/zdjecia.py`, bez ponownej kompresji) | `test_zglos_aed_zatwierdzenie…`, `test_metadane_png_webp` |
| K15 | `POST /zgloszenia-aed` tylko z tokenem instytucji (401 bez, 403 administrator); `szafka_zamknieta` tylko true/false; „nie wiem”, „nieznane” → 422 | `test_zglos_aed_walidacja` |
| K16 | decyzja administratora z polami danych, `PUT`/`PATCH` zgłoszenia przez administratora → 403; `GET /moje-zgloszenia`: status, decyzja, komentarz, kto, kiedy | `test_zglos_aed_zatwierdzenie…`, `test_zglos_aed_do_poprawy…` |

Dane prototypu: 3 fikcyjnych dostawców w `data/dostawcy/` (odpowiedzi w kształcie API 1.4; `python -m scripts.build_dostawcy`). Prawdziwe zbiory AED samorządów z dane.gov.pl opublikowane przed wzorcem (Krosno, Przemyśl, Marki) są na liście jako **zbiory przejściowe** (CR-TL-5: rekordy bez zmian, etykieta, zaproszenie do wzorca); Warszawa (brak pliku do odczytu) – `poza_lista`. Logowanie: konta testowe (`dysponent`, `administrator`), konta instytucji z zatwierdzonego wniosku albo założone przez administratora, pracownicy dodani przez instytucję; docelowo login.gov.pl i 2FA (§9, §11).
