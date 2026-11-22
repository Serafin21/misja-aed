# HANDOFF – Model A

## 2026-11-22 – HANDOFF #18: portal dane.gov.pl uruchomiony w sesji – „Wykaz AED” sprawdzony na żywo

- **Portal działa w sesji:** Postgres, Elasticsearch (wtyczki z plików – host `artifacts.elastic.co` dopuszczony w środowisku), Fuseki, Redis, RabbitMQ, Celery, panel i API (`portal/local/Dockerfile.es`, `Dockerfile.rdfdb`, `compose.local.yml`; kroki: `portal/README.md`, „Uruchomienie w sesji zespołu”). `init_mcod_db` z migracjami 0075/0076, indeksy ES.
- **Przeszło na żywo:** zasób „Zawiera wykaz AED: Tak” w panelu; plik z błędami odrzucony z listą błędów; nocne zadanie przez Celery → „Wykaz AED – wykaz zbiorczy” (zbiór MC, CSV + XLSX, 6 wierszy od 2 instytucji, „Możliwy duplikat” 9 m, bez scalania); `GET /aed-aggregated`; Mapa danych AED z `PORTAL_API` = API portalu pokazuje te 6 AED z dostawcą i linkiem. Zrzuty: `pitch/zrzuty/01–06, 12`.
- **Błędy wykryte dopiero na portalu i poprawione (`09b601b`):** (1) ogólna walidacja danych portalu odrzucała wykazy z pustymi komórkami w kolumnach liczb/dat – zasady dane.gov.pl: **znak umowny „-”** przypisany do zasobu; walidacja AED czyta „-” jak brak, wykaz zbiorczy wpisuje „-” i ma przypisany znak umowny; (2) typy kolumn zgadywane „po większości” („5A” wśród liczb = błąd) → wykaz zbiorczy ma stały `tabular_data_schema`; (3) każde ponowienie zadania tworzyło kolejny zasób → kroki 1–2 zapamiętane jak w DGA (`cache_memoize`); (4) drugi plik (XLSX) bez formatu wywracał listę zasobów w panelu i miał link „…/None” w `/aed-aggregated` → format i bezpośredni link.
- **Aplikacja (`98fe180`, `0251ac8`):** pakiet dla instytucji – „-” zamiast pustych pól, `<specialSigns>` w XML (XSD OK), instrukcja z „Zawiera wykaz AED” i znakiem umownym; zasada w arkuszu „Zasady formatu” wzorca xlsx; `PORTAL_API` i odczyt plików dostawców czytają „-” jako brak.
- **Testy:** aplikacja 114 passed; portal 25 bez bazy + **3 z bazą passed** (28/28).
- **Ograniczenie, które zostaje:** etykiety pól panelu po angielsku w lokalnej instalacji (brak skompilowanych tłumaczeń – kompilacja psuła logowanie przez tłumaczone wartości wyboru); dane pokazowe w portalu = 2 instytucje testowe.

## 2026-11-23 – HANDOFF #17: CR-TL-11 – administrator nie widzi haseł, odzyskanie dostępu

- **Usunięte:** `GET /konta/{login}/haslo`, `src/api/sejf.py`, kolumna `konta.haslo_podglad` (stare bazy: `ALTER TABLE … DROP COLUMN` + `VACUUM` przy starcie, `src/core/db.py`), wszystkie wywołania szyfrowania. Hasło tylko jako PBKDF2-SHA256 z solą.
- **Odzyskanie dostępu (jak w dużych serwisach):** `POST /auth/nie-pamietam-hasla` (login albo e-mail; zawsze ta sama odpowiedź, limit zapytań; prośba widoczna przy koncie: `prosba_o_haslo`) → administrator `POST /konta/{login}/reset-hasla` → **hasło jednorazowe** pokazane raz, ważne 72 h (`auth.TEMP_HOURS`), stare hasło przestaje działać. Jednorazowe jest też hasło nowego konta, pracownika i hasło wpisane przez administratora w edycji konta (hasło z wniosku instytucji – jej własne).
- **Pierwsze logowanie hasłem jednorazowym:** `musi_zmienic_haslo: true` w `POST /auth/login` i `GET /konta/ja`; każde inne zapytanie → `403 zmien_haslo`; `POST /konta/ja/haslo` (nowe ≠ stare) zwraca nowy token. Po 72 h logowanie → `403 haslo_wygaslo`.
- **Sesje:** token = HMAC(login | skrót hasła) – nowe hasło (zmiana, reset) od razu kończy wszystkie stare sesje, także złodzieja hasła.
- **UI (B, zrobione w tej sesji):** „Wydaj hasło jednorazowe” w panelu (ramka z hasłem raz), stan hasła i prośby przy koncie, zakładka „Proszą o nowe hasło”, „Nie pamiętam hasła” przy logowaniu, ekran „Ustaw własne hasło”.
- **Dokumenty:** MODEL_ROL v2.2 §9, CONTRACT v3.1 (CR-TL-11), JURY_QA pytanie 17 („administrator nie widzi haseł”).
- **Zlecenie TL nr 2 (etykieta pola):** `portal/backend/mcod/resources/forms.py:272` bez `.capitalize()` – zrobione. Nr 1 (hosting) i nr 3 (zrzuty portalu) – nie zrobione: brak konta hostingowego w sesji; portal nie startuje w sesji (blokady sieci, `portal/README.md`).
- **Testy:** `pytest` – 112 passed (nowy `test_haslo_niewidoczne_jednorazowe_i_odzyskanie`); portal `portal/local/run_aed_tests.sh` – 23 passed. Przeklikane (Playwright): założenie konta → hasło jednorazowe raz → wymuszona zmiana → „Nie pamiętam hasła” → hasło jednorazowe od admina → stare nie działa; brak błędów JS.

## 2026-11-22 – ZLECENIA TL dla A (po scaleniu CR-TL-9, przed 10:30)

0. **Stan hostingu (TL, nd ok. 7:20):** prototyp statyczny działa na **https://serafin21.github.io/misja-aed/** – GitHub Pages z gałęzi `gh-pages` (folder `/`), build `26a7e11` z `main` w trybie demonstracyjnym (`VITE_USE_MOCKS=1 VITE_ROUTER=hash`, `--base /misja-aed/`). Potwierdzone przez API GitHuba: workflow „pages build and deployment” – `success` (run 44993219605), wdrożenie `github-pages` 7974883016 – `success`, `environment_url` = adres wyżej. Bez logowania i paneli (to wymaga serwera – pkt 1 niżej nadal aktualny jako wersja pełna). **Przebudowa po zmianach w `src/ui`:** `cd src/ui && VITE_USE_MOCKS=1 VITE_ROUTER=hash npx vite build --base /misja-aed/ --outDir <katalog_tymczasowy>`, w nim `touch .nojekyll`, nowe repo git z gałęzią `gh-pages`, commit i `git push -f https://github.com/Serafin21/misja-aed HEAD:gh-pages`.
1. **Hosting publicznego prototypu (priorytet).** Jury chce klikalnego prototypu bez konfiguracji. Postaw obraz z `docker compose up --build` (API + UI) na publicznym adresie https (dowolny hosting kontenerów z wolnym planem; `ADMIN_PASSWORD` inne niż demo, `AED_PUBLIC_URL` = adres publiczny). Minimum awaryjne: statyczny build UI w trybie demonstracyjnym (`VITE_USE_MOCKS=1 VITE_ROUTER=hash npm run build`) na GitHub Pages. Adres wpisz w `SUBMISSION.md` w miejsce `PROTOTYP_URL` (TL sprawdza link przed wysłaniem).
2. **CR – etykieta pola w panelu:** `mcod/resources/forms.py:272` `_("Contains AED list").capitalize()` – `str.capitalize()` zamienia „Zawiera wykaz AED” na „Zawiera wykaz aed”. Usunąć `.capitalize()` (tłumaczenie już zaczyna się wielką literą).
3. **Zrzuty portalu** `pitch/zrzuty/01–06` (panel z „Zawiera wykaz AED”, komunikat walidacji, wykaz zbiorczy, `/aed-aggregated`) – jeśli portal ruszy na komputerze bez proxy (`portal/README.md`).

## 2026-11-22 – HANDOFF #16 (w CR-TL-9 nazwany „#13” – numeracja A była już na #15): CR-TL-9 – kod dane.gov.pl, „Wykaz AED” wzorem DGA

- **Import (pkt 1):** `portal/backend` = backend portalu dane.gov.pl (mcod 2.62.3, kopia github.com/olekstomek/mcod-backend-dane.gov.pl, commit `00a0813`), jeden commit bez zmian `b229557`; skąd, suma SHA-256 i data – `portal/IMPORT.md`.
- **Przyrost „Wykaz AED” (pkt 3, a–h)** – każdy krok osobnym commitem „Wykaz AED: …”, wzorem wykazu chronionych danych (DGA): `1464bf3` model `contains_aed_list` + migracja 0075 · `068b654` `aed_constants.py` (44 kolumny, wymagane, wszystkie typy instytucji) · `48fb8da` walidacja w panelu i harvesterze CKAN · `3184384` pole formularza, serializery, filtr, ES, tłumaczenia · `9bb5d27` XML `containsAedList`, XSD 1.14 (`portal/xsd/`) · `e5f4f91` zadanie `create_main_aed_resource_task`, harmonogram 3:40, komenda `create_main_aed_resource`, `AggregatedAEDInfo` + 0076, wykaz zbiorczy CSV + XLSX bez scalania z „Możliwy duplikat” ≤ 25 m · `5a214fd` `GET /aed-aggregated` · `67ce118` testy (`test_aed.py`). Punkt i (rejestr wykazów `mcod/wykazy`) – tylko opis w `portal/README.md`, bez kodu.
- **Środowisko lokalne (pkt 2, limit 90 min):** działa – obraz aplikacji portalu (`portal/local/Dockerfile.app`, commit `eb7f4fc`), `compilemessages`, **23 testy Wykazu AED bez bazy: passed** (`portal/local/run_aed_tests.sh`). Nie działa w sesji – wtyczki Elasticsearch z `artifacts.elastic.co` (zablokowane przez sieć sesji), obraz `rdfdb` (Alpine bez certyfikatu proxy), więc bez `init_mcod_db`, indeksów ES, panelu w przeglądarce i zrzutów ekranu; 3 testy `django_db` czekają na pełne środowisko. Opis blokad i kroki na zwykłym komputerze – `portal/README.md`.
- **`portal/README.md` (pkt 4):** uruchomienie, panel (`admin@mcod.local` / `testadmin123!`), ścieżka dostawcy, tabela DGA → AED (plik:linia), lista commitów (`1958427`).
- **`PORTAL_API` (pkt 5):** `src/core/dostawcy.py` `agreguj_z_portalu` – przy ustawionym `PORTAL_API` agregacja czyta `GET /aed-aggregated` i plik wykazu zbiorczego; bez niego stara ścieżka. Test `tests/test_portal_wykaz.py`.
- **Porządki (pkt 6, `751e264`):** AED dodane w prototypie – `meta.status_publikacji = nieopublikowane_w_dane_gov_pl` + `opis_statusu_publikacji` („dodane w prototypie, nie pochodzą z wykazu w dane.gov.pl…”), pole `status_publikacji` w `/aed/punkty`; nie trafiają do żadnego pliku eksportu (`src/core/publish.py`). Hasło `admin` **tylko** z `ADMIN_PASSWORD` (bez wartości domyślnej w kodzie; demo `admin123` w `.env.example`, README, RUN.md). Przy okazji: pamięć podręczna `/aed/punkty` rozróżnia instancje bazy (wcześniej dwie bazy z tym samym numerem wersji mogły dostać cudzą odpowiedź – wyszło w testach). UI (B): „Panel moderacji prototypu”, status publikacji na karcie AED.
- **Dokumenty (pkt 7):** MODEL_ROL v2.0, CONTRACT v3.0 (CR-TL-9 w rejestrze), JURY_QA – pytanie 7 bez „scalamy”, nowe pytanie 16 o Wykazie AED.
- **Testy:** `pytest` – 107 passed. Testy portalu – jw.
- **Następny krok:** na komputerze bez proxy – `docker compose -f docker-compose.local.yml build`, `init_mcod_db`, `search_index --rebuild -f`, przejść ścieżkę dostawcy w panelu i dodać zrzuty do `docs/portal/zrzuty/`, uruchomić 3 testy `django_db`.

## 2026-11-22 – HANDOFF #15: podgląd haseł, adresy w formularzu, nazwy z OSM

- **Podgląd loginu i hasła (decyzja właściciela projektu):** `GET /konta/{login}/haslo` (administrator, wpis `konto:podglad_hasla` w dzienniku). Do logowania nadal tylko PBKDF2; obok zaszyfrowana kopia `konta.haslo_podglad` (`src/api/sejf.py`, klucz z `AED_SECRET`), zapisywana przy założeniu konta, wniosku, pracowniku, resecie, zmianie przez administratora i przez instytucję. Konta sprzed tej zmiany – `haslo: null` + `uwaga` (ustaw nowe). Wbudowane `admin` – hasło z `.env`.
- `POST /konta`: hasło krótsze niż 8 znaków albo puste → **generowane** (bez błędu), w odpowiedzi `haslo_wygenerowane` i `meta.komunikat`.
- **Geokodowanie adresów:** (1) błędy usługi GUGiK nie są już zapamiętywane jako „nie znaleziono” (wcześniej jeden zbyt wolny wynik blokował adres do restartu; limit czasu 8 s); (2) „ul.”, „al.”, „pl.”, „os.” – próbowane warianty bez przedrostka i z pełną nazwą („al. Jerozolimskie 100” → „Aleje Jerozolimskie 100”); (3) „Marki, Piłsudskiego 95” = „Aleja Marszałka Józefa Piłsudskiego 95” (ten sam numer i miejscowość, słowa ulicy w pełnej nazwie).
- **Nazwy AED z OpenStreetMap:** gdy punkt nie miał `name`, nazwą był jego **opis** (592 punkty, np. „Aby dostać się do budynku należy użyć domofonu…”) – błąd po naszej stronie. Teraz: `name` / `operator` / `brand` (do 80 znaków, bez samych numerów telefonu, bez „- ” na początku), inaczej „AED – ulica numer, miasto” albo „Defibrylator AED”; opis zostaje w `opis_lokalizacji`. Działa po następnym odświeżeniu OSM (`seed` albo „Odśwież teraz”).
- `pytest` 103.

## 2026-11-22 – HANDOFF #14: dowolniejszy login, hasło nadane przez administratora

- Login: 3–60 znaków – litery (także wielkie i polskie), cyfry, `. _ - @ +` (e-mail też); wielkość liter bez znaczenia, spacje → kropki (`auth.normalize_login`, „UM Krosno” → `um.krosno`). Token koduje login (`quote`), więc polskie litery działają w nagłówku HTTP.
- `POST /konta` przyjmuje `haslo` (min. 8) – administrator może wpisać hasło; bez niego hasło jest generowane. W obu przypadkach odpowiedź zwraca je raz (`haslo_jednorazowe`).
- Test: `tests/test_admin_edycja.py::test_login_dowolny_i_haslo_od_admina`; `pytest` 102.

## 2026-11-22 – HANDOFF #13: błąd 500 przy równoczesnych zapytaniach

- **Naprawione:** jedno połączenie SQLite było używane przez kilka wątków serwera naraz – przy kilku zapytaniach w tej samej chwili (np. po zalogowaniu strona pobiera 4–5 rzeczy) zdarzał się błąd 500 `sqlite3.InterfaceError: bad parameter or other API misuse`. `db.connect()` zwraca teraz `LockedConnection`: każde polecenie pod jedną blokadą, wiersze pobierane od razu (`fetchone`/`fetchall`/iteracja bez zmian dla kodu). Sprawdzone: 110 równoczesnych zapytań (20 wątków) – same 200; `pytest` 101.

## 2026-11-22 – HANDOFF #12: decyzja właściciela projektu – konto admin, pełne prawa administratora, zgłoszenia zmian, od razu na mapie (MODEL_ROL v1.4, CONTRACT v2.3)

- **Konta:** wbudowane tylko `admin` / `admin123` (`ADMIN_PASSWORD`); konta testowe `dysponent`/`administrator`/`moderator` tylko z `AED_KONTA_TESTOWE=tak` (włączone w `tests/conftest.py`). Zarezerwowane loginy: admin, administrator, moderator, dysponent, demo, root. `PATCH /konta/{login}`: dane instytucji, `nowy_login`, `haslo`, `aktywne` (zmiana nazwy instytucji przenosi jej przypisania, AED z aplikacji i zgłoszenia); `DELETE /konta/{login}`; `_konto_out` z `oczekuje` i liczbą AED instytucji.
- **AED administratora:** `GET /admin/aed` (szukanie, filtr instytucji i warstwy, strony), `PATCH /admin/aed/{id}` (`{pola}` – dowolne pola wzorca, walidacja zmienionych pól, godziny normalizowane, TERYT z położenia), `DELETE /admin/aed/{id}`, `PUT /admin/aed/{id}/przypisanie`. Edycje i usunięcia w tabeli `edycje`, nakładane w `Store.load()` (przetrwają agregację i odświeżenie OSM – `osm.refresh` kończy się `store.load()`); szybka ścieżka `Store.reload_one`.
- **Zgłoszenia AED:** `typ` `nowe|zmiana` (+`id_aed`; instytucja tylko swoich AED), administrator też zgłasza (`organizacja` – komu przypisać), decyzja `zatwierdz|do_poprawy|odrzuc`. Zatwierdzone nowe → tabela `aed_aplikacja` → od razu na liście (`meta.zbior_id = aplikacja`); zmiana → nakładka na źródło; zdjęcie → `zdjecia_aed`, `zdjecie_url = /api/v1/aed/{id}/zdjecie`. Zdjęcie przy zmianie nieobowiązkowe, jeśli AED już je ma. `GET /moje-urzadzenia`, `GET /moje-zgloszenia` (administrator – swoje).
- **Instytucja a AED:** `Store.organizacja(id)` = przypisanie > właściciel AED z aplikacji > dostawca zbioru; zgłoszenia mieszkańców trafiają do tej instytucji. `GET /moje-aed/powiadomienia` – na początku przypomnienia o AED niesprawdzanych > 12 mies. (`meta.przypomnienia`).
- `/aed/punkty` – `nazwa` (sortowanie listy alfabetycznie).
- **Testy:** 101 (nowy `tests/test_admin_edycja.py`; zmieniony test zatwierdzenia – od razu na mapie).
- **CR:** – · **Znane błędy:** – · **Użycie AI:** kod, testy, dokumentacja z Claude.

## 2026-11-22 – HANDOFF #11: CR-TL-8 – zaufane konta instytucji, „Zgłoś AED” z zatwierdzaniem, adres zamiast współrzędnych

- **Zrobione (od świeżego main po #10):**
  - **Wnioski o konto:** `POST /konta/wnioski` (bez logowania; `nazwa_instytucji, regon, podstawa, email_sluzbowy, telefon, login, haslo` ≥ 10 znaków) → 201 `{status: "oczekuje"}`, konto w tabeli `konta` nieaktywne; logowanie z poprawnym hasłem przed decyzją → **403 `konto_oczekuje`** (zablokowane konto → 403 `konto_zablokowane`, złe hasło dalej 401). `GET /konta/wnioski?status=`, `POST /konta/wnioski/{id}/decyzja {decyzja: zatwierdz|odrzuc, uzasadnienie}` (uzasadnienie wymagane przy odrzuceniu; odrzucenie zwalnia login) – administrator; dziennik + powiadomienie „konto”. `POST /konta/ja/uzytkownicy {login, email}` – zatwierdzona instytucja dodaje pracownika (ta sama organizacja i podstawa; hasło jednorazowe).
  - **Zgłoś AED:** `POST /zgloszenia-aed` – tylko token instytucji (401 bez, 403 administrator). Walidacja: wszystkie pola konkretne, „nie wiem”/„nieznane” → 422; `szafka_zamknieta` i `dostepny_24h` tylko true/false (StrictBool); `godziny` wymagane bez 24h i normalizowane („pn-pt 8-16” → `Mo-Fr 08:00-16:00`); `instrukcja_dostepu` wymagana przy zamkniętej szafce; położenie musi leżeć w gminie (PRG → `teryt_terc`); **zdjęcie wymagane** (plik, nie link), metadane usuwane na serwerze (`src/core/zdjecia.py`: JPEG APP1–15/COM, PNG tEXt/zTXt/iTXt/eXIf/tIME, WebP EXIF/XMP – bez ponownej kompresji). Zapisuje `nadawca_login` i `organizacja`.
  - `GET /moje-zgloszenia` (instytucja): `status` oczekuje|zatwierdzone|do_poprawy, `decyzja`, `komentarz`, `kto`, `kiedy`, `id_aed`, `historia`; `PUT /zgloszenia-aed/{id}` – poprawa i ponowne wysłanie po `do_poprawy`.
  - Administrator: `GET /admin/zgloszenia-aed?status=oczekuje` (z `zdjecie_url` – podpisany link `GET /zgloszenia-aed/{id}/zdjecie?t=` – i nadawcą), `POST /admin/zgloszenia-aed/{id}/decyzja {decyzja: zatwierdz|do_poprawy, komentarz}` (komentarz wymagany przy do_poprawy). **Każde inne pole w decyzji, `PUT` i `PATCH` zgłoszenia przez administratora → 403.** Zatwierdzenie dodaje AED do kopii roboczej instytucji (rekord wzorca: `metoda_weryfikacji = zdjecie`, `data_weryfikacji` = dzień zgłoszenia, licencja CC0-1.0, `dysponent_typ = inny` – instytucja może zmienić w kreatorze) – nie na listę; dalej pakiet i publikacja przez instytucję. Powiadomienie `zgloszenie_aed` na koncie nadawcy (`GET /moje-aed/powiadomienia`), wpisy w dzienniku.
  - **Adres zamiast współrzędnych:** `GET /miejsca` – każdy wynik ma `teryt_terc`, adres ma też `ulica, numer_budynku, kod_pocztowy, miejscowosc` (do wypełnienia formularza). Nowe `GET /miejsca/odwrotnie?lat=&lon=` – najbliższy punkt adresowy GUGiK (`GetAddressReverse`, 100 m): `ulica, numer_budynku, kod_pocztowy, miejscowosc, gmina, wojewodztwo, teryt_terc, odleglosc_m`; bez sieci gmina i TERYT z PRG, adres `null`.
  - Zgłoszenia mieszkańców `/zgloszenia` – bez zmian.
  - Dokumentacja: `docs/MODEL_ROL.md` v1.3 (§4 zaufane konta, „Zgłoś AED” po zalogowaniu; §5 P1a, P2a; K13–K16 i ich wdrożenie), `docs/CONTRACT.md` v2.2 (§4 pkt 6, §5 tabela, CR-TL-8), `docs/tech/openapi.json`.
- **Jak sprawdzić:** `pytest` (96; nowy `tests/test_konta_zgloszenia_aed.py`: wniosek → 403 → zatwierdzenie → logowanie, odrzucenie, pracownik, 401/422 (bez zdjęcia, `szafka_zamknieta: "nie_wiem"`, „nie wiem”), administrator edytuje → 403, decyzja w `/moje-zgloszenia`, poprawa i ponowne wysłanie, odwrotne geokodowanie, metadane PNG/WebP).
- **Dla B:** nowe ekrany: wniosek o konto (link przy logowaniu), „Zgłoś AED” dla zalogowanej instytucji (adres → `/miejsca`, „Użyj mojej lokalizacji” → `/miejsca/odwrotnie`, pinezka do korekty), „Moje zgłoszenia”, w panelu administratora „Wnioski o konto” i „Zgłoszenia AED do zatwierdzenia” (zdjęcie, nadawca, przyciski Zatwierdź / Do poprawy z komentarzem – bez pól edycji).
- **CR:** – · **Znane błędy:** – · **Użycie AI:** kod, testy i dokumentacja z Claude.
- **Następny krok:** interfejs (B).

## 2026-11-22 – HANDOFF #10: CR-TL-5 i CR-TL-6 (strona A) – dostawcy i zbiory, zbiory przejściowe, podstawa publikacji

- **Zrobione (CR od B #23, #24):**
  - `GET /api/v1/zbiory` (publiczny) w kształcie z CR-TL-5: `zbior_id, tytul, dostawca, zbior_url, status (wzorzec|przejsciowy|poza_lista), nieaktualny, rekordy, data_danych, licencja, problemy` (+ `fikcyjny`); `meta.agregacja`, `meta.warstwa_pomocnicza {zrodlo, licencja, obiekty}`. Kolejność: wzorzec → przejściowe → poza listą.
  - **Zbiory przejściowe:** zbiór AED dostawcy opublikowany przed wzorcem (bez słowa kluczowego `wspolna-lista-aed` i bez kolumn wzorca), którego plik da się odczytać, trafia na listę ze statusem `przejsciowy`: rekordy z współrzędnymi pokazane tak, jak je opublikowano (tylko odczyt do formatu pól, nic nie jest dopisywane ani scalane), dostawca dostaje powiadomienie „wzorzec” z zaproszeniem. Plik nieczytelny (PDF, link do portalu) → `poza_lista`. Na żywo: **Krosno (21 AED), Przemyśl (21), Marki (8) – przejściowe; Warszawa – poza listą** (brak pliku). W prototypie dwa nowe fikcyjne zbiory: Gmina Przykładowa Druga (przejściowy, 3 z 4 wierszy) i Miasto Przykładowe (PDF, poza listą) – `scripts/build_dostawcy.py`.
  - `meta.zgodnosc` (`wzorzec|przejsciowy`) w rekordach listy, `zgodnosc` w `/aed/punkty` (`null` dla OSM), kolumna `zgodnosc` w eksporcie listy.
  - **CR-TL-6:** `meta.dostawca_podstawa` (`wlasciciel|zarzadca|weryfikujacy`) – z konta dostawcy; bez konta `wlasciciel` (wzorzec wymaga `dysponent_nazwa` = dostawca). `POST /konta` przyjmuje `dostawca_podstawa` (wymagane dla roli `dysponent`, inna wartość → 422), `GET /konta` ją zwraca (+ `regon`). Stare bazy dostają kolumny `podstawa`, `regon`, `telefon` w `konta` automatycznie.
  - `docs/tech/LICZBY.md` wygenerowane dla modelu listy (`scripts/liczby.py`): lista vs warstwa pomocnicza, tabela zbiorów ze statusami, fikcyjni dostawcy nie liczeni w liczbach o Polsce. `deliverables/dataset/` wygenerowane ponownie (10 AED: 7 wzorzec + 3 przejściowe).
- **Jak sprawdzić:** `python -m scripts.seed --reset --osm full --lista auto` → `GET /api/v1/zbiory`; `pytest` (88, nowy `tests/test_zbiory_podstawa.py`).
- **Liczby w testach:** lista 7 → 10 AED (doszedł fikcyjny zbiór przejściowy), dostawców 3 → 4.
- **CR:** – · **Znane błędy:** – · **Użycie AI:** kod, testy i dokumentacja z Claude.
- **Następny krok:** CR-TL-8.

## 2026-11-22 – HANDOFF #9: model ról i odpowiedzialności (CONTRACT v2.0, `docs/MODEL_ROL.md`)

- **Zrobione:** wdrożenie dokumentu „Wspólna lista AED w dane.gov.pl – model ról i odpowiedzialności”. Kryteria K1–K11 mają testy (`tests/test_model_rol.py`, 84 testy razem).
  - **Lista tylko ze zbiorów dostawców** (`src/core/dostawcy.py`): agregacja zbiorów oznaczonych `wspolna-lista-aed` (prototyp: 3 fikcyjnych dostawców w `data/dostawcy/`, `scripts/build_dostawcy.py`, kształt API 1.4), ścisła walidacja (44 pola, `teryt_terc` zgodny z położeniem, tylko własne urządzenia, bez OSM), rekord niezgodny → poza mapą + raport i powiadomienie; **bez scalania** – duplikaty ≤ 25 m oznaczone u obu, powiadomienia dla obu; `zbior_nieaktualny` (updateFrequency + 30 dni) ≠ rekord „do weryfikacji”. Prawdziwe zbiory samorządów (Krosno, Przemyśl, Marki, Warszawa) → raport `poza_lista`.
  - **OSM = warstwa pomocnicza** („Do sprawdzenia”): bez scalania z niczym, poza listą, eksportem i API listy (`warstwa=pomocnicza` na żądanie).
  - **Role:** `dysponent` (dostawca) pisze tylko do swojej kopii roboczej; `administrator` (dawniej moderator, login `moderator` działa jako alias) – 403 na każdy zapis AED; tryb „bez tokenu = wszystkie role” usunięty (§9).
  - **Kreator:** `POST/PATCH /aed` i import → kopia robocza (`/moje-aed`), `POST /moje-aed/pakiet` → ZIP z CSV, XML 1.13 (responsibilities, regions/terytIdent, updateFrequency, https, supplements), słownikiem, metadanymi, instrukcją – brak funkcji „Opublikuj” (K11).
  - **Zgłoszenia:** `id_aed` + `typ` → dostawca (`przyjete`/`odrzucone`), bez dostawcy → administrator (`zaproszenie`/`odrzucone`); filtr treści (e-maile, telefony, linki), e-mail zgłaszającego usuwany po zamknięciu; potwierdzenia → powiadomienie dostawcy.
  - **Dziennik zdarzeń** (tabela `dziennik`, wyzwalacze blokują UPDATE/DELETE), **powiadomienia** dostawców, `GET /admin/luki` (gminy bez dostawcy z liczbą punktów OSM), `/admin/przypomnienia`, `/admin/agregacja`.
  - **Eksport listy** = kompilacja z kolumnami pochodzenia; bez plików OSM, XML i DCAT listy. `deliverables/dataset/` i nowy `deliverables/pakiet_dostawcy_przyklad/`.
  - Wzorzec: `teryt_terc` 7 cyfr (kod gminy z rodzajem) – `docs/schema/` zaktualizowane.
- **CR do B:** logowanie w stopce, menu wg roli („Moje AED” / „Panel administratora”), ekrany kreatora i panelu na nowych endpointach, warstwa „Do sprawdzenia” na mapie, karta z dostawcą/zbiorem/datą, neutralna nazwa aplikacji (logo tylko w akcji).
- **Użycie AI:** Claude.

## 2026-11-21 22:30 – HANDOFF #8: odświeżanie źródeł, konta instytucji, zdjęcie w zgłoszeniu, prawdziwe zbiory samorządów, XSD dane.gov.pl

- **Zrobione:**
  1. **Odświeżanie** (`src/core/refresh.py`): OSM + zbiory AED z dane.gov.pl co noc o `AED_ODSWIEZANIE` (domyślnie 03:30, `wylaczone`), przy starcie gdy w bazie jest tylko próbka OSM, na żądanie `POST /zrodla/odswiez` (moderator, w tle) + `GET /zrodla/odswiezanie` (stan: w toku, ostatnie, następne, wynik). `/zrodla` ma `ostatnie_pobranie` i `url`.
  2. **dane.gov.pl** – import prawdziwych zbiorów samorządów: Krosno 21/21, Przemyśl 21/21, Marki 8/8 (wcześniej 0 – wszystkie odrzucone); 31 połączonych z AED z OSM, 19 nowych. Czyszczenie: wiersze w cudzysłowie (Marki), zamienione szerokość/długość, kolumna `geometry` (JSON/WKT), stała nazwa „Defibrylator” → nazwa z kolumny lokalizacji, adres bez numeru, podwójne przecinki; brak godzin/numeru = ostrzeżenie; dysponent = instytucja publikująca, `data_weryfikacji` = data zasobu. Wyszukiwanie odrzuca zbiory niezwiązane (fraza „AED” łapała ceny mieszkań „AD …”). Warszawa (39512) – na portalu tylko link do portalu miasta, bez pliku. `seed --dgp auto` i `start.sh` (`AED_SEED_DGP`).
  3. **OSM**: zbyt długie teksty skracane z adnotacją zamiast odrzucenia → 0 odrzuconych (było 22).
  4. **Konta instytucji** (tabela `konta`, PBKDF2-SHA256): moderator zakłada konto (`POST /konta` → hasło jednorazowe pokazywane raz), reset hasła, blokada (token przestaje działać od razu); `GET /konta/ja`, `POST /konta/ja/haslo`. Konto = jedna instytucja (`dysponent_nazwa`): zgłoszenia tylko jej AED, import zawsze jako ta instytucja. Token = `login.HMAC`. Login zwraca też `login` i `dysponent_nazwa`.
  5. **Zgłoszenie**: `zdjecie` (data URI JPEG/PNG/WebP do 1,5 MB, sprawdzany nagłówek pliku), `godziny_dostepnosci`, `szafka_zamknieta`, `instrukcja_dostepu` (CR od B #16 pkt 1); w kolejce moderacji `zdjecie_url` (podpisany link `GET /zgloszenia/{id}/zdjecie?t=`), zdjęcie nie wychodzi publicznie; przy zatwierdzeniu godziny i szafka przechodzą do rekordu.
  6. **CR-1 rozwiązany**: XSD portalu `urn:otwarte-dane:harvester:1.13` (https://dane.gov.pl/static/xml/otwarte_dane_latest.xsd, kopia `docs/tech/otwarte_dane_1_13.xsd`); `dane_gov_pl_import.xml` przechodzi walidację (test, `scripts/check_xml.py`), warunki ponownego wykorzystania wypełnione. Wymaga publicznego adresu `https://` w `AED_PUBLIC_URL`.
  - `deliverables/dataset/` i `LICZBY.md` przebudowane (18 074 prawdziwych AED). 76 testów.
- **CR do B:** ekran panelu moderatora (odświeżanie, zbiory dane.gov.pl, konta), pole zdjęcia w zgłoszeniu, zdjęcie w kolejce moderacji.
- **Nadal otwarte (CR od B #16):** `PATCH /import/{id}/wiersze`, `POST /import/{id}/duplikaty`, `podglad` w raporcie, przykładowy wiersz w szablonie XLSX.
- **Użycie AI:** Claude.

## 2026-11-21 20:30 – HANDOFF #7: wyszukiwarka miejsc (`GET /miejsca`) i gmina w `/aed/punkty`

- **Zrobione:** `GET /api/v1/miejsca?q=&blisko=lat,lon` (`src/core/geocode.py`) – województwa i 2479 gmin z granic PRG (bez sieci, bez polskich znaków: „lodz” → Łódź, miasto przed gminą wiejską o tej samej nazwie) + miejscowości (także wsie), ulice („Kraków, Floriańska” albo „Kraków Floriańska”) i adresy („Kraków, Floriańska 3”) z **usługi geokodowania GUGiK** (`services.gugik.gov.pl/uug`, bezpłatna, oficjalne punkty adresowe; pamięć podręczna, limit 4 s; `AED_GEOKODER=brak` wyłącza). Sama nazwa ulicy + `blisko` → ulica w gminie na środku mapy. Wynik: `{typ: wojewodztwo|gmina|miejscowosc|ulica|adres, nazwa, opis, lat, lon, bbox|null, teryt (gmina), liczba_aed (gmina, województwo – po położeniu)}`; stare pola `nazwa, lat, lon` zostają. `/aed/punkty` ma `gmina_teryt` – filtr gminy w przeglądarce daje dokładną liczbę (np. Kraków: wszystkie AED w granicach miasta, a nie tylko te z „Kraków” w nazwie). 70 testów (geokoder w testach zastąpiony atrapą).
- **Dlaczego „Kraków” dawał mało wyników:** stare wyszukiwanie szukało tekstu w nazwie i adresie, a 99% rekordów OSM nie ma adresu.
- **Użycie AI:** Claude.

## 2026-11-21 19:00 – HANDOFF #6: CR od B (#14) + pod nową mapę E2

- **Zrobione:** (1) `tzdata` w `requirements.txt` (tylko Windows, Apache-2.0) i w `check_licenses.py`; (2) `GET /aed?wojewodztwo=` filtruje **po położeniu** w granicach PRG (pole rekordu tylko gdy punkt poza granicami); (3) `GET /aed/punkty` ma dodatkowo `dostep`, `wiek_danych_dni` (null = brak daty), `mobilny`, `wojewodztwo` (z położenia) – do filtrów po stronie przeglądarki; (4) `GET /aed?ids=a,b,c` (maks. 200) – rekordy w podanej kolejności, dla listy obok mapy. 66 testów.
- **CR do B:** kształt punktu: `properties: {dostepny_teraz, stan_danych, osm, dostep, wiek_danych_dni, mobilny, wojewodztwo}`.
- **Użycie AI:** Claude.

## 2026-11-21 17:10 – HANDOFF #5: obraz Docker naprawiony i sprawdzony

- **Zrobione:** `Dockerfile` kopiuje `data/granice/` (bez tego w Dockerze `/pokrycie` dawało 404, a `gminy_bez_danych` = 0). Nowy `.dockerignore` (bez `.git`, `deliverables`, `node_modules` – szybszy build). **Pierwszy pełny build i start obu obrazów (api + ui) przetestowany**: 18 039 AED, `/pokrycie`, `/aed/punkty` z gzip, UI przez nginx bez trybu demonstracyjnego.
- **Uwaga:** gdy przy pierwszym starcie kontenera nie ma sieci, a w `data/cache/` brak `aed_poland.geojson`, baza dostaje tylko próbkę OSM i nie odświeża się sama (`start.sh` seeduje tylko pustą bazę) – wtedy `POST /zrodla/osm/odswiez` albo usunięcie wolumenu.
- **Następny krok:** –

## 2026-11-21 16:45 – HANDOFF #4: decyzje TL (CR-TL-2) – uprawnienia dysponenta, /aed/punkty, granice 16 województw, LICZBY

- **Czas:** sob 15:10–16:45
- **Zrobione:**
  1. **Uprawnienia:** zgłoszenia rozpatruje moderator (wszystkie) albo dysponent – tylko dla swoich AED (`dysponent_nazwa` = organizacja konta, w demo `DEMO_DYSPONENT_NAZWA`, domyślnie „Urząd Gminy Przykładowo”). Dysponent: `scal`/`odrzuc`, gdy zgłoszenie dotyczy jego AED (wskazany `id_aed_docelowy` albo najbliższy w 30 m); `zatwierdz` – nowy rekord dostaje jego `dysponent_nazwa`, cudza nazwa → 403. `GET /zgloszenia` dla dysponenta pokazuje tylko zgłoszenia jego AED. W zgłoszeniu zapisuje się `decyzje_podjal`. `docs/CONTRACT.md` §4 pkt 6 i tabela §5 spójne z API (CONTRACT v1.2, CR-TL-2).
  2. **`GET /api/v1/aed/punkty`** – lekka warstwa mapy dla całej Polski albo `?bbox=`; gzip (18 tys. punktów: 3,2 MB → 339 KB), `ETag` + 304 przy `If-None-Match`, `Cache-Control: no-cache`, budowa 0,2 s, potem z pamięci.
  3. **Granice gmin 16 województw** (2479 gmin, 7,3 MB, nazwy plików bez polskich znaków) – uproszczenie z zachowaniem topologii (wspólny odcinek granicy upraszczany raz → bez szczelin i nakładek); AED poza wielokątami → najbliższa gmina do 1 km; indeks przestrzenny. `/pokrycie?wojewodztwo=` bez zmian. W `/statystyki` nowe `wg_wojewodztw_polozenie`; `gminy_bez_danych` liczone dla całej Polski. W `zrodla.csv` jedno źródło `prg-gugik:gminy` (2479, Polska).
  4. **`docs/tech/LICZBY.md`** (skrypt `python -m scripts.liczby`) – liczby z pełnych danych bez rekordów fikcyjnych. Import OSM zapisuje teraz powody odrzuceń.
  - Testy: 64 (14 nowych: uprawnienia dysponenta i moderatora, kształt/bbox/gzip/ETag `/aed/punkty`, topologia na danych syntetycznych, **brak szczelin w danych PRG** – w województwach śródlądowych każdy odcinek granicy gminy należy do dokładnie 2 gmin, punkt na granicy i w morzu, województwo z położenia, 16 plików granic).
- **Liczby (z LICZBY.md):** 18 033 AED; aktualne 3 148 (17%), nieaktualne 14 885, w tym 12 169 bez żadnej daty; 351 z 2479 gmin bez AED w danych (najwięcej: mazowieckie 79, lubelskie 60, podlaskie 38); odrzucone 22 z 18 297 – wszystkie za długie teksty (nazwa > 200 znaków: 20).
- **Jak uruchomić:** `python -m scripts.seed --reset --osm full && uvicorn src.api.main:app`; `python -m scripts.build_granice` (sieć, ok. 4 min) albo `--offline`; `python -m scripts.liczby`; `pytest`.
- **CR do B – kształt `GET /api/v1/aed/punkty`:**
  ```json
  {"type": "FeatureCollection",
   "features": [{"type": "Feature", "id": "AED-PL-B939F7EBA4",
                 "geometry": {"type": "Point", "coordinates": [21.0139, 52.2437]},
                 "properties": {"dostepny_teraz": true, "stan_danych": "aktualne", "osm": false}}],
   "meta": {"count": 18039, "liczone_na": "2026-11-21T16:40", "prog_aktualnosci_dni": 365,
            "atrybucja_osm": "© autorzy OpenStreetMap (ODbL)"}}
  ```
  `dostepny_teraz`: true / false / null (godzin nie da się odczytać); `stan_danych`: `aktualne` / `nieaktualne`; `osm`: true = warstwa ODbL (pokaż atrybucję). Nagłówki: `Content-Type: application/geo+json`, `Content-Encoding: gzip` (przeglądarka rozpakowuje sama), `ETag`; `fetch` z domyślnym cache przeglądarki sam wyśle `If-None-Match`. Zastępuje `GET /aed?per_page=500` na mapie; szczegóły po kliknięciu z `GET /aed/{id}`. Kolejka moderacji: dysponent może dostać 403 `brak_uprawnien` – pokaż komunikat z `error.message`.
- **Założenia:** obiekty OSM ≤ 5 m od siebie z prawie tą samą nazwą (242) są traktowane jako duplikat w OSM i łączone (zachowanie z wcześniejszego kodu).
- **Znane błędy / do decyzji TL:** 22 odrzucone rekordy OSM można przyjąć po skróceniu tekstu; 242 łączenia duplikatów OSM warto przejrzeć (czasem to dwa urządzenia w jednym budynku).
- **Użycie AI:** kod, testy i dokumentacja z Claude, przegląd człowieka.
- **Następny krok:** B – mapa na `/aed/punkty` i tryb „aktualność danych”.

## 2026-11-21 15:00 – HANDOFF #3: CR-TL-1 (tryb „aktualność danych”), pełny OSM, porządki

- **Czas:** sob 14:30–15:00
- **Zrobione:** CR-TL-1 dopisana do `docs/CONTRACT.md` (§8, wersja 1.1). API: `meta.stan_danych` (`aktualne` ≤ 365 dni od `data_weryfikacji`, inaczej i przy braku daty `nieaktualne`) i `meta.wiek_danych_dni` w każdym rekordzie; filtr `GET /aed?stan_danych=`; nowy `GET /pokrycie?wojewodztwo=` – GeoJSON 144 gmin kujawsko-pomorskiego (PRG GUGiK przez WFS, uproszczone do 431 KB, `data/granice/`, skrypt `scripts/build_granice.py`) z `teryt, gmina, liczba_aed, aktualne, nieaktualne, stan`; `/statystyki` + `aktualne`, `nieaktualne`, `gminy_bez_danych`. Licencja i atrybucja PRG w `zrodla.csv` (źródło `prg-gugik:gminy-kujawsko-pomorskie`). **Poprawka:** OSM bez `check_date` dostawał dzisiejszą datę weryfikacji – teraz pole jest puste (inaczej cała mapa byłaby „aktualna”). Pełny import OSM Polska: 18 297 obiektów → 18 057 rekordów, 22 odrzucone; `deliverables/dataset/` przebudowany. `.gitignore` (+ `git rm -r --cached` dla `__pycache__/`, baza i `data/cache/` poza repo). 50 testów (15 nowych: próg 0/364/365/366 dni, brak i błędna data, OSM bez daty, filtr, `/pokrycie`, przypisanie do gminy, statystyki, `zrodla`).
- **Wyniki na pełnych danych:** 3 154 AED aktualne, 14 885 nieaktualne (17%). Kujawsko-pomorskie: 27 gmin bez danych, 113 nieaktualne, 4 aktualne.
- **Jak uruchomić:** `python -m scripts.seed --reset --osm full && uvicorn src.api.main:app` → `/api/v1/pokrycie`; `pytest`.
- **Założenia:** stan gminy = `nieaktualne`, gdy choć jeden AED w gminie jest nieaktualny (ostrożnie: zachęca do weryfikacji); AED przypisany do gminy po położeniu, nie po polu `gmina`. PRG: dane PZGiK bez opłat i ograniczeń (art. 40a ust. 2 pkt 1 Pgik). Dla źródła referencyjnego pokrycie pól w `zrodla.csv` = 0 (nie dotyczy rekordu AED).
- **CR do B:** ekran mapy – przełącznik trybów „dostępność / aktualność danych”; w trybie aktualności warstwa gmin z `GET /pokrycie` (kolor wg `stan`, legenda, atrybucja z `meta.atrybucja`) i punkty wg `meta.stan_danych`. Liczniki do E7/E8: `aktualne`, `nieaktualne`, `gminy_bez_danych`.
- **Znane błędy:** granice uproszczone niezależnie dla każdej gminy – na styku mogą być wąskie szczeliny (AED w szczelinie nie trafia do żadnej gminy). Docker dalej niezbudowany w tym środowisku.
- **Użycie AI:** kod, testy i dokumentacja z Claude, przegląd człowieka.
- **Następny krok:** granice dla kolejnych województw (`--woj`), UI trybu „aktualność danych” (B).

## 2026-11-21 13:30 – HANDOFF #2: CR od B, JSON-LD, docs/tech, utwardzenie

- **Czas:** sob 13:25–13:30
- **Zrobione:** CR-B1…B9 wdrożone (`dostepny_teraz` w atrybutach; `pochodzenie` i `potwierdzenia` na górnym poziomie karty; `POST /zgloszenia` → `{id, status}`; `GET /zgloszenia` w stylu JSON API z `mozliwy_duplikat`; decyzja `scal`; `GET /miejsca?q=`; `GET /eksport` z formatem, licencją i rozmiarem; klucze statystyk jak u B; `/api/docs`). Usługa `ui` w compose (port 80). JSON-LD (poziom 4) z nagłówkiem `Link`, limit anonimowych zgłoszeń, `docs/tech/` (ARCHITECTURE, DATA_PIPELINE, COMPLIANCE, RUN), pakiet `deliverables/dataset/`, kontrola licencji. 35 testów; czysty klon zielony na Pythonie 3.12 i 3.13.
- **Jak uruchomić:** `docs/tech/RUN.md`.
- **Założenia:** `AED_AUTH_MODE=demo` – żądanie bez tokenu działa jako konto demo, bo UI jeszcze nie wysyła tokenu.
- **CR do B:** wysyłać `Authorization` po logowaniu; w imporcie dosyłać `dysponent_nazwa` i `dysponent_typ`; `zatwierdz` zgłoszenia wymaga `rekord` z adresem (inaczej 422 z polami).
- **Znane błędy:** obraz Docker nie zbudowany (Docker Hub zablokowany w moim środowisku), `compose config` poprawny.
- **Użycie AI:** kod, testy i dokumentacja z Claude (Opus), przegląd człowieka.
- **Następny krok:** SYNC #1, pełny OSM na Macu, P10.

## 2026-11-21 13:20 – P3 + F1 + F2 + F3 (rdzeń gotowy przed SYNC #1)

- **Czas:** sob 13:05–13:20
- **Zrobione:** `GET /aed` (bbox, wojewodztwo, gmina, dostep, dostepne_teraz, q, warstwa, stronicowanie), `/aed/{id}`, `/aed/najblizsze`, `POST /import` → `/mapowanie` → `/zatwierdz`, `POST/PATCH /aed`, zgłoszenia + moderacja, potwierdzenia (Paszport AED), `/zrodla`, konektory OSM i dane.gov.pl, `/eksport/*` (10 plików), `/szablon.csv|xlsx`, `/statystyki`, `/auth/login`. 30 testów, w tym end-to-end gmina+uczelnia → `aed_ujednolicone.csv`.
- **Jak uruchomić:** `pip install -r requirements.txt && python -m scripts.seed --reset && uvicorn src.api.main:app` → http://localhost:8000/api/v1/docs; `docker compose up --build`; `python -m scripts.publish`; `pytest`.
- **Założenia:** `id_aed` = SHA-1(`kod_zrodla|id_w_zrodle`); SQLite bez SQLAlchemy; telefonów i e-maili z OSM nie importujemy.
- **CR:** CR-1 – COI nie podaje URI ani XSD; dodałem wymagane `specialSigns`. CR-3 – warstwa OSM bez adresów (pola wymagane puste). CR-4 – dodatkowe pola importu i `meta` w odpowiedziach. CR-5 – wartości ODbL nie trafiają do rekordów CC0.
- **Znane błędy:** Docker nieprzetestowany (brak demona).
- **Użycie AI:** kod, testy i dokumentacja techniczna z Claude (Opus), przegląd człowieka.
- **Następny krok:** `docs/tech/`, realny OSM na Macu.

### CR – szczegóły dla TL
- **CR-1 (ustalenia):** wg „Instrukcji przygotowania pliku XML” COI (v1.0.6, 2025-11-21): korzeń `<p:datasets>`, `dataset`/`resource` z atrybutem `status`, `extIdent` ≤ 36 znaków i niezmienny, `title`/`description` pl+en (≤ 300 / ≤ 1000 znaków), `availability` = `local|remote`, w `resource` **wymagane `<specialSigns><specialSign>`** (brak w naszym przykładzie – dodałem `X` jak w przykładzie COI). URI przestrzeni nazw, XSD i składni `<tags>` instrukcja nie podaje → pytanie na stoisko.
- **CR-3:** OSM rzadko ma adres. W `aed_osm_odbl.*` pola wymagane (województwo, gmina, miejscowość, nr budynku, kod, dysponent, godziny) mogą być puste – walidator obniża je do ostrzeżeń. Nie zgadujemy adresów; geokodowanie (PRG/TERYT) poza prototypem. Decyzja: akceptujemy jako „warstwa uzupełniająca”?
- **CR-4 (rozszerzenie, niełamiące):** `POST /import` przyjmuje opcjonalnie `dysponent_nazwa, dysponent_typ, status_urzadzenia, data_weryfikacji, metoda_weryfikacji, nazwa_zrodla, czestotliwosc_aktualizacji, obszar` (wartości domyślne dla brakujących kolumn). Każdy element listy ma `meta` (`dostepny_teraz`, `warstwa`, `odleglosc_m`, komunikaty). Nowe: `GET /slowniki`, `GET /health`, `GET /eksport`, `aed_osm_odbl.geojson`, parametr `promien_m`.
- **CR-5:** scalanie pole po polu tylko między źródłami spoza ODbL. Rekord OSM pokrywający AED od dysponenta trafia tylko do `aed_pochodzenie.csv` – jego wartości nie są kopiowane do `aed.csv` (inaczej `aed.csv` byłby bazą pochodną ODbL).
