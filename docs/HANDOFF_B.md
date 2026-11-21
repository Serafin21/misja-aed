# HANDOFF – Model B (aplikacja, dostępność, prezentacja)

## P4 – recenzja kontraktu v1.0 od strony ekranów (sob 12:40)

Uwagi do decyzji TL przed zamrożeniem o 15:00. Każda ma uzasadnienie z ekranu; bez nich frontend liczy coś po swojej stronie albo pokazuje mniej.

| CR | Ekran | Prośba | Dlaczego |
|---|---|---|---|
| CR-B1 | E2, E3 | Pole `dostepny_teraz` (true/false/null) w każdym rekordzie także w `GET /aed` i `GET /aed/{id}`, nie tylko w `/aed/najblizsze` | znacznik „dostępne teraz” na liście, mapie i karcie musi liczyć serwer (jedna logika, strefa Europe/Warsaw) |
| CR-B2 | E1 | Wyszukiwanie miejsca po nazwie: `GET /miejsca?q=` → `[{nazwa, lat, lon}]` (np. środek rekordów z danej miejscowości) albo zgoda na to, by UI liczył środek z `GET /aed?q=` | E1 wymaga „wpisz adres lub miejscowość”, a geokodowanie jest poza zakresem prototypu. **Do decyzji UI robi wariant 2.** |
| CR-B3 | E3 | Kształt `GET /aed/{id_aed}`: `{data: {type, id, attributes}, pochodzenie: [wiersze jak aed_pochodzenie.csv], potwierdzenia: {liczba, ostatnie: "yyyy-mm-ddThh:mm" \| null}}` + przykład w `data/sample/` | karta pokazuje źródła rekordu i „Paszport AED” |
| CR-B4 | E4, E9 | `POST /zgloszenia` → `201 {id, status: "do_weryfikacji"}`; `GET /zgloszenia` jak lista z §1; `POST /zgloszenia/{id}/decyzja` body `{decyzja: "zatwierdz"\|"odrzuc"\|"scal", id_aed_docelowy?}` | formularz i kolejka moderacji |
| CR-B5 | E7, E8 | Przykład `GET /statystyki` w `data/sample/` z polami: `liczba_aed`, `liczba_dysponentow`, `wg_wojewodztw`, `wg_zrodel`, `kompletnosc_rozklad`, `zweryfikowane_12m_proc` | liczniki na E7 i E8 biorę tylko z API (zakaz zmyślania liczb) |
| CR-B6 | E5 | Format `mapowanie_proponowane` w `POST /import` taki sam jak `mapowanie` w `raport_walidacji_przyklad.json` (kolumna → pole albo lista pól) | ekran kroku 3 używa jednego komponentu |
| CR-B7 | E5, E9 | `POST /auth/login` → `{token, rola}`; kolejne wywołania z nagłówkiem `Authorization: Bearer <token>` | panel dysponenta i moderatora |
| CR-B8 | wszystkie | Kontener `api` słucha na porcie **8000**, FastAPI pod `/api/v1`, Swagger pod `/api/docs` (lub podaj ścieżkę) | nginx w `src/ui/Dockerfile` przekazuje `/api` → `http://api:8000` |
| CR-B9 | E6 | `GET /eksport` (bez nazwy pliku) → lista plików: `{plik, format, licencja, rozmiar_b, opis}` | E6 nie trzyma listy na sztywno |

## HANDOFF #1

- Czas: sob 12:40
- Zrobione: P4 (CR-B1…B9 wyżej); szkielet `src/ui/` w toku.
- Jak uruchomić / zobaczyć: –
- Założenia: patrz HANDOFF #2.
- CR: CR-B1…CR-B9.
- Znane błędy: –
- Użycie AI (jedna linia): recenzja kontraktu przygotowana z Claude (Model B), decyzje podejmuje TL.
- Następny krok: szkielet, E1 → E3 → E2 na mockach.

## HANDOFF #2

- Czas: sob 13:15
- Zrobione: szkielet `src/ui/` (Vite + React 19 + TS, routing, układ responsywny, klient API z automatycznym przełączeniem na mocki z `data/sample/`, `Dockerfile` + nginx z proxy `/api` → `api:8000`); **E1** Najbliższe AED (geolokalizacja, wyszukiwanie miejscowości, filtr „dostępne teraz”, lista + mapa, 112), **E3** Karta AED (szafka zamknięta + instrukcja na górze, godziny po polsku, weryfikacja, dysponent, pochodzenie, licencja, Paszport AED, „Zgłoś problem”), **E2** Mapa i lista (filtry w URL, widok lista/mapa/oba, legenda). E4–E9: zaślepki.
- Jak uruchomić / zobaczyć: `cd src/ui && npm install && npm run dev` → http://localhost:5173 (bez API pokazuje dane przykładowe z banerem „Tryb demonstracyjny”). Docker: usługa `ui` z `build: src/ui`, port 80 – prośba do A o wpis w `docker-compose.yml`.
- Założenia: bez Mantine, MSW i react-query (mniej zależności i ryzyka licencyjnego; własny CSS pod kontrast WCAG); router własny (History API) z przeniesieniem fokusu na `<h1>`; „dostępne teraz” liczę w UI tylko w trybie mocków (CONTRACT §7), z API biorę `dostepny_teraz` (CR-B1).
- CR: CR-B1…B9 (wyżej). Pilne przed 15:00: B1, B3, B8.
- Znane błędy: nie uruchomiono jeszcze z prawdziwym Leafletem (w środowisku Modelu B brak sieci – podgląd na atrapie mapy); brak `npm run typecheck` (brak `@types` offline). Do sprawdzenia na Windows.
- Użycie AI (jedna linia): kod `src/ui/` (E1–E3, klient API, style) wygenerowany z Claude (Model B), przegląd i decyzje – zespół.
- Następny krok: uruchomić u siebie, potem E5 kroki 1–4, E6, E7, E4.

## HANDOFF #3

- Czas: sob 13:40
- Zrobione: system znaku TL wdrożony w UI (nazwa „AED w danych”, hasło, logo z kwadratów w nagłówku i favikonie, pinezki według stanu: zielona / bursztynowa + zegar / bursztynowa + kłódka / biała z szarym obrysem, przerywana obwódka = OSM, paleta #1A7A50 / #0F3B2B / #EDF2EC / #E2A23B / #B9791A / #6B7570). Nowe ekrany: **E4** Zgłoś AED, **E5** kreator dysponenta (5 kroków + odznaka SVG), **E6** Zbiór danych (pliki, API, słownik 44 pól z filtrem), **E7** Źródła (zakres referencyjny + statystyki), **E8** Akcja, **E9** Moderacja. Wszystkie 9 ekranów działają na mockach; testy w Chrome: 1280 px i 320 px bez przewijania w poziomie, brak błędów w konsoli, walidacja formularzy przenosi fokus na pierwsze błędne pole.
- Jak uruchomić / zobaczyć: `cd src/ui && npm install && npm run dev`.
- Założenia: liczniki na E7/E8 z `GET /statystyki` (w trybie demo – policzone z `data/sample`); odznaka dysponenta generowana w przeglądarce; brak kodu QR na naklejce (do zrobienia).
- CR: bez zmian (B1–B9).
- Znane błędy: jak w #2 (Leaflet i typecheck niesprawdzone na prawdziwych pakietach).
- Użycie AI (jedna linia): ekrany E4–E9 i wdrożenie znaku w UI wygenerowane z Claude (Model B); znak, nazwa i hasło – zespół (TL).
- Następny krok: przełączenie na API A, audyt WCAG (axe/Lighthouse/NVDA), README v1, `docs/a11y/raport.md`.

## HANDOFF #4

- Czas: sob 13:55
- Zrobione: `SUBMISSION.md` do draftu (nazwa projektu, link do repo, opis postępu – brakuje nazwy zespołu), `README.md` v1 (szybki start, ścieżki dla jury, architektura mermaid, dostępność, licencje), `docs/a11y/raport.md` (automatyczne sprawdzenie E1–E9 w 1280 i 320 px: kontrast, nazwy, cele 24 px, nagłówki – 0 problemów; lista testów do zrobienia: axe, Lighthouse, NVDA), naklejka „Paszport AED” z kodem QR na karcie E3 (zależność `qrcode-generator`, MIT), polskie podpisy przycisków powiększania mapy.
- Jak uruchomić / zobaczyć: `cd src/ui && npm install && npm run dev`; podgląd online (dla zespołu): artefakt „AED w danych – podgląd”.
- Założenia: README opisuje `docker compose up` jako „w toku” – czekam na `docker-compose.yml` i `.env.example` od A.
- CR: bez zmian.
- Znane błędy: QR, Leaflet i typecheck niesprawdzone na prawdziwych pakietach (brak sieci w środowisku B).
- Użycie AI (jedna linia): README, SUBMISSION, raport dostępności i skrypt kontroli dostępności przygotowane z Claude (Model B).
- Następny krok: przełączenie na API A po jego pushu; SYNC #1 o 17:00.

## HANDOFF #5

- Czas: sob 21.11.2026
- Zrobione: `npm install`, `npm run typecheck` – 0 błędów (bez zmian w kodzie). `npm run build` przechodzi po podmianie rollupa na `@rollup/wasm-node` (`overrides` w `src/ui/package.json`), bo zasady kontroli aplikacji Windows (Smart App Control) blokują natywny `rollup.win32-x64-msvc.node`. Dodany `package-lock.json` (Dockerfile używa `npm ci`). Licencje produkcyjne: MIT 5, BSD-2-Clause 1 (Leaflet); spoza listy tylko nasz pakiet (`UNLICENSED` przez `private`). W devDependencies: `caniuse-lite` (CC-BY-4.0, dane browserslist, nie trafia do builda).
- Jak uruchomić / zobaczyć: `cd src/ui && npm install && npm run dev`.
- Założenia: wasm-rollup jest wolniejszy, ale działa na każdej platformie i w Dockerze.
- CR: bez zmian.
- Znane błędy: ostrzeżenie Vite o paczce JS 535 kB (nie błąd). Mapa (kafelki, pinezki, klastry) i skan QR na `/aed/AED-PL-CBD53ED4AA` niesprawdzone wzrokowo – sesja bez narzędzi przeglądarki; serwer zwraca 200, kafelki OSM osiągalne.
- Użycie AI (jedna linia): diagnoza i naprawa builda z Claude (Model B).
- Następny krok: ręcznie sprawdzić mapę i QR telefonem; audyt axe/Lighthouse/NVDA.

## HANDOFF #6

- Czas: sob 14:45
- Zrobione: UI dostosowane do API A (3 CR z HANDOFF_A #2): 1) logowanie `POST /auth/login`, token w `sessionStorage`, każde żądanie z `Authorization: Bearer`; 401 → wylogowanie i ponowny formularz; E5 kroki 2–5 i E9 wymagają zalogowania (konta demo w README); 2) import wysyła `dysponent_nazwa`, `dysponent_typ` (nowe pole wyboru w kroku 2) i `nazwa_zrodla`; 3) „Zatwierdź…” w E9 otwiera formularz rekordu (nazwa, opis, adres, godziny, dostęp, szafka, dysponent), błędy 422 z `fields` przy polach i w podsumowaniu. Gałąź zsynchronizowana z `main` (merge), więc `docker compose up --build` działa z `b/ux-docs`.
- Jak uruchomić / zobaczyć: `cp .env.example .env && docker compose up --build` → http://localhost.
- Założenia: w trybie demonstracyjnym (bez API) logowanie przyjmuje hasła z `.env.example`.
- CR: brak nowych.
- Znane błędy: zmiany NIESPRAWDZONE w przeglądarce ani na żywym API (środowisko B bez sieci npm/pip); sprawdzona tylko składnia TS. Docker nadal nie budowany.
- Użycie AI (jedna linia): logowanie, formularz moderatora i pola importu z Claude (Model B).
- Następny krok: `npm run typecheck && npm run build` u człowieka, `docker compose up --build`, przejście ścieżek z README.

## HANDOFF #7

- Czas: sob 21.11.2026
- Zrobione: sprawdzenie UI na żywym API (wszystkie 9 ekranów, każde wywołanie z `client.ts`) – kształty odpowiedzi zgodne. Naprawione 2 błędy: 1) liczniki na E7 (Akcja) i E8 (Źródła) pokazywały „–”, bo `GET /statystyki` zwraca `{data: {...}}` – `getStats()` rozpakowuje `data`; 2) karta i lista AED pokazywały „null null, null null” dla rekordów OSM bez adresu – `address()` pomija puste części, a gdy adresu nie ma wcale, pokazuje „Brak adresu w danych – sprawdź położenie na mapie”; linia „Zapis w danych” przy godzinach ukryta, gdy godzin brak.
- Jak uruchomić / zobaczyć: `docker compose up --build` → http://localhost/zrodla i karta rekordu OSM.
- Założenia: –
- CR: do TL – `docs/CONTRACT.md` §6 mówi, że zgłoszenia zatwierdza „moderator albo dysponent”, a tabela uprawnień (§ endpointy) tylko moderator; API dopuszcza obie role.
- Znane błędy: –
- Użycie AI (jedna linia): test integracji i poprawki z Claude.
- Następny krok: ręczne sprawdzenie mapy i QR telefonem.

## HANDOFF #8

- Czas: sob 15:30
- Zrobione: komplet plików akcji w `brand/` (za zgodą TL): `logo.svg/png/jpg/pdf`, `warianty/` (pionowe i poziome: kolor, odwrócona, achromatyczna, czarna, biała; sam znak; ikony; znaczniki mapy), `ksiega_znaku.pdf` (10 stron A4, wektor, 452 kB), `haslo.txt`, generatory w `brand/zrodla/`. Nowe hasło „Dane prosto z serca” (decyzja zespołu) w aplikacji, README, SUBMISSION, opisie, scenariuszu i JURY_QA. Geometria komórek w UI wyrównana do księgi (0,8 x, promień 0,14 x), favikona = ikona aplikacji, hasło w UI krojem bezszeryfowym zamiast monospace.
- Jak uruchomić / zobaczyć: otwórz `brand/ksiega_znaku.pdf`; odtworzenie: `python brand/zrodla/generuj.py && python brand/zrodla/ksiega.py`.
- Założenia: krój Inter (OFL) zamiast kroju z PNG zespołu (IBM Plex – brak pliku w środowisku); CMYK bez profilu ICC (do potwierdzenia); minimalne wielkości wyliczone z czytelności hasła (wersaliki ≥ 11 px).
- CR: brak. Dla TL: `docs/AI_USAGE.md` – dopisać pliki znaku; `.gitattributes` z `*.sh text eol=lf`.
- Znane błędy: UI po zmianach nadal niesprawdzone w przeglądarce.
- Użycie AI (jedna linia): pliki wektorowe logo, warianty i księga znaku wygenerowane z Claude (Model B) na podstawie projektu zespołu.
- Następny krok: TL przegląda księgę; prezentacja PDF.

## HANDOFF #9

- Czas: sob 16:10
- Zrobione: CR-TL-1 w UI. E1 i E2: nad mapą przełącznik „Dostępność” / „Aktualność danych” (natywne radio, strzałki, stan w URL `?tryb=dane`), legenda zmienia się z trybem. Tryb danych: pinezki z sercem z komórek (`dataPinSvg`: aktualne – zielona, białe komórki; nieaktualne – biała z obrysem i komórkami #B9791A + zegar; przerywany obrys OSM), nazwa markera = obiekt + stan danych + data weryfikacji; warstwa gmin z `GET /pokrycie` (brak_danych – kreskowanie #D9DDDA/#F2EFE6, przerywana ramka #6B7570; pozostałe – lekki odcień), atrybucja PRG w mapie, pod mapą lista gmin bez danych (E1 zwinięta). Lista i karta AED: etykieta „Dane z MM.RRRR” / „Dane nieaktualne” (ikona + tekst, pełna data dla czytnika). E7/E8: liczniki `aktualne`, `nieaktualne`, `gminy_bez_danych`. E8: nagłówek = hasło, `BRAND_CTA`, przycisk „Dodaj swoje AED”, legenda obu trybów. Mocki: `stan_danych` i `wiek_danych_dni` liczone z `data_weryfikacji` (próg 365 dni, Europe/Warsaw, jak `src/core/coverage.py`). Księga znaku: nowa strona 10 (znaczniki trybu danych), pliki `warianty/znacznik_dane_*`.
- Jak uruchomić / zobaczyć: `npm run dev` → http://localhost:5173/mapa?tryb=dane (warstwa gmin tylko z API: kujawsko-pomorskie).
- Założenia: komórki „nieaktualne” w bursztynie ciemnym (#B9791A, 3,6:1) zamiast #E2A23B (2,2:1 – za mało dla grafiki, WCAG 1.4.11). Wzór TL był w PDF „3 koncepcje logo” s. 1, nie w księdze s. 7. W trybie demo brak warstwy gmin (komunikat).
- CR: brak. Uwaga dla A/TL: E2 pobiera `per_page=500`, a zbiór ma 18 057 rekordów – na mapie Polski widać tylko część; w trybie danych warto filtrować województwo.
- Znane błędy: niesprawdzone w przeglądarce ani typecheckiem z pakietami (środowisko B bez npm).
- Użycie AI (jedna linia): tryby mapy, warstwa gmin, etykiety i strona księgi z Claude (Model B).
- Następny krok: typecheck + build u człowieka, przegląd w przeglądarce (klawiatura, 320 px, legenda).

## HANDOFF #10

- Czas: sob 16:40
- Zrobione: **sprawdzone przez człowieka u siebie (Windows):** `npm ci`, `npm run typecheck` – 0 błędów, `npm run build` – OK. **Sprawdzone w przeglądarce (tryb demo, `npm run dev`):** przełącznik trybów (strzałki zmieniają tryb, URL `?tryb=dane`, legenda i etykiety się zmieniają, widoczny fokus), pinezki trybu danych, etykiety „Dane z 11.2026”, E8 z hasłem i CTA, 320 px bez przewijania w poziomie. Poprawki po teście: klastry jako koła (brakowało stylu – kwadraty z liczbą poza kształtem), `aria-label` pinezek (divIcon ignoruje `alt`), zmiana trybu nie resetuje przybliżenia, równe szerokości opcji przełącznika.
- Jak uruchomić / zobaczyć: `git pull`, `npm run dev` → http://localhost:5173/mapa?tryb=dane.
- Założenia: na komputerze B nie ma Dockera ani Pythona – `docker compose` i warstwy gmin na żywym API jeszcze nikt nie widział.
- CR: dla TL – `.gitattributes` z `*.sh text eol=lf` (na Windows `scripts/start.sh` miał CRLF → kontener API by nie wstał).
- Znane błędy: dane demo mają tylko rekordy „aktualne” (brak przykładu pinezki nieaktualnej w trybie demo).
- Użycie AI (jedna linia): test w przeglądarce i poprawki z Claude (Model B), uruchomienie i typecheck – człowiek.
- Następny krok: Python → test na API (warstwa gmin), Docker u TL/A, prezentacja.

## HANDOFF #11

- Czas: sob 17:25
- Zrobione: (1) `brand/haslo.txt`: podtytuł „Masz AED? Udostępnij je na dane.gov.pl” i zasada „hasło zawsze z nazwą akcji albo podtytułem” (też w generatorze i w księdze znaku s. 2). (2) E2 na `GET /aed/punkty` (CR-TL-2): bez filtrów mapa całej Polski z warstwy punktów (klastry, `chunkedLoading`), szczegóły z `GET /aed/{id}` dopiero po kliknięciu lub Enter – okienko z nazwą, adresem, stanem i linkiem do karty (fokus na linku); z filtrami mapa = lista; „Tylko dostępne teraz” działa też na punktach; podpowiedź „Lista pokazuje pierwsze 500 z N”. Warstwa gmin wg filtra województwa (domyślnie kujawsko-pomorskie). (3) `pitch/prezentacja.md` – 10 slajdów, liczby z `docs/tech/LICZBY.md`, miejsca `[ZRZUT: …]`. (4) `pitch/scenariusz_demo.md` v1 – 2:00, oba tryby mapy.
- Jak uruchomić / zobaczyć: `git pull`, `npm run typecheck`, `npm run dev` → /mapa.
- Założenia: punkty nie mają nazwy, więc dostępna nazwa pinezki = stan + „Naciśnij Enter, aby zobaczyć nazwę i adres”.
- CR do A: w `/aed/punkty` dodać `prywatny: bool` (i ewentualnie `niesprawny`) – bez tego pinezka „tylko dla uprawnionych” (kłódka) i „niesprawny” nie da się pokazać na mapie całej Polski (17% AED w OSM to dostęp prywatny).
- Znane błędy: (2) niesprawdzone typecheckiem z pakietami ani w przeglądarce. Slajd 10: wyniki axe/Lighthouse/NVDA i zakres AI do uzupełnienia.
- Użycie AI (jedna linia): warstwa punktów, treść prezentacji i scenariusz z Claude (Model B) na podstawie LICZBY.md i COMPLIANCE.md od A.
- Następny krok: typecheck u człowieka, test mapy w przeglądarce, zrzuty ekranu, PDF prezentacji.

## HANDOFF #12

- Czas: sob 17:55
- Zrobione: UI w języku wizualnym serwisów gov.pl (bez ich znaków: brak logo gov.pl, godła, paska i stopki portalu, nazwy ministerstwa, logotypów UE). `src/ui/src/tokens.css` – jedyne miejsce z kolorami (Open Sans 400/600/700, 16 px / 14 px < 700 px, tekst #1B1B1B, akcja #0052A5 / #006CD7 / #00468D, błąd #A7162D, odstęp 20 px, promień 4 px, obramowania 1 px, bez cieni); `styles.css` przepisany na zmienne. Biały nagłówek z naszym znakiem, pasek „Prototyp zespołu HackNation 2026 – nie jest serwisem administracji publicznej”, link „Przejdź do treści głównej”, okruszki (ikona domu, ukryte < 700 px). Przyciski 44 px, ramka 2 px, wersaliki; jeden główny na widok, drugorzędne obrysowe, trzeciorzędne tekstowe, czerwony tylko „Odrzuć” (moderacja); nawigacja jako linki (lista AED, karta, Zgłoś problem); bez ikon dekoracyjnych w przyciskach. Formularze (E3 Paszport, E4, E5 krok 2, logowanie, moderacja): „*” przy polach wymaganych, „* Pola obowiązkowe”, walidacja po opuszczeniu pola, podsumowanie błędów `role="alert"` z fokusem i linkami, `autocomplete`/`type`/`required` sprawdzone. Komunikaty z ramką 2 px. Linki zewnętrzne z „(otwiera się w nowym oknie)”. Stopka: 10 linków, m.in. nowe podstrony O projekcie, Deklaracja dostępności, Dane osobowe, Pliki cookies i pamięć przeglądarki, Licencje i atrybucje, Kontakt; linia praw autorskich i blok [ADRES / KONTAKT ZESPOŁU]. Kontrast palety w `docs/a11y/raport.md`. Bez zmian: logika, API, trasy E1–E9, tryby mapy, pinezki (kolory z księgi znaku).
- Jak uruchomić / zobaczyć: **najpierw** `cd src/ui && npm install @fontsource/open-sans` (aktualizuje `package-lock.json` – bez tego `npm ci` i budowanie Dockera się nie powiodą), potem `npm run typecheck && npm run build`, commit `package-lock.json`.
- Założenia: znak wymaganego pola = „*” (w poleceniu znak się nie wyświetlił); E8 „Dodaj swoje AED” to link w stylu przycisku głównego (wezwanie akcji na ekranie akcji); kolory sukcesu #1B6B3A i ostrzeżenia #7A4F00 dobrane przeze mnie (6,5 i 7,1:1). Hexy poza tokens.css zostały tylko w TS dla znaku i mapy (pinezki, warstwa gmin) – wartości z księgi znaku.
- CR do A: `scripts/check_licenses.py` musi dopuścić **OFL-1.1** dla fontów (`@fontsource/open-sans`).
- Prośba do TL: (1) sprawdzić wartości z przewodnikiem Gov UI (kolory, rozmiary, odstępy); (2) wpisać dane w [ADRES / KONTAKT ZESPOŁU] (stopka i /kontakt); (3) `npm install`, jeśli nie zrobi tego człowiek B.
- Znane błędy: niesprawdzone typecheckiem z pakietami ani w przeglądarce (środowisko B bez npm).
- Użycie AI (jedna linia): przebudowa stylów, formularzy, stopki i podstron informacyjnych z Claude (Model B); treść podstron oparta na faktach z kodu i raportu dostępności.
- Następny krok: npm install + typecheck + build u człowieka, przegląd w przeglądarce (1280 / 320 px, klawiatura, podsumowanie błędów).

## HANDOFF #13

- Czas: sob 18:15
- Zrobione: **sprawdzone przez człowieka:** `npm install @fontsource/open-sans`, `npm run build` – OK (font w paczce, w tym latin-ext), `package-lock.json` w repo (e0d53e6). **Sprawdzone w przeglądarce (Claude, tryb demo):** Open Sans załadowany, tekst 16 px / 14 px poniżej 700 px, pasek prototypu, „Przejdź do treści głównej”, okruszki widoczne przy 1280 px i ukryte przy 590 px, stopka z 10 linkami; E4: wysłanie pustego formularza → podsumowanie „Formularz zawiera 2 błędy” z `role="alert"` i fokusem, `aria-invalid` na polach; walidacja po opuszczeniu pola (Tab) pokazuje błąd przy polu bez podsumowania. Poprawka: dopisek „(otwiera się w nowym oknie)” rozjeżdżał się w kolumnę w stopce i na liście AED.
- Jak uruchomić / zobaczyć: `npm run dev` → /zglos, /mapa, stopka.
- Założenia: –
- CR: bez zmian (OFL-1.1 w `check_licenses.py` – A).
- Znane błędy: `npm run typecheck` po przebudowie gov.pl nie był pokazany – do potwierdzenia u człowieka.
- Użycie AI (jedna linia): test w przeglądarce i poprawka stopki z Claude (Model B).
- Następny krok: typecheck, przegląd pozostałych ekranów (E5, E9, karta AED), zrzuty do prezentacji.

## HANDOFF #14

- Czas: sob 18:30
- Zrobione: **pierwszy test UI na żywym API (Windows, Python 3.12, `seed --osm full`, uvicorn + `npm run dev`), sprawdzone w przeglądarce:** `/statystyki` – 18 040 AED (18 035 OSM + 5 przykładowych), aktualne 3 155, nieaktualne 14 885, 351 gmin bez danych (zgodne z LICZBY.md); E2 bez trybu demo, mapa całej Polski z `/aed/punkty` (18 040 punktów w klastrach), podpowiedź „Lista pokazuje pierwsze 500 z 18 040”; tryb „Aktualność danych”: pinezki aktualne i nieaktualne (zegar), warstwa 144 gmin kujawsko-pomorskiego, 27 zakreskowanych, atrybucja PRG, lista gmin bez danych; kliknięcie pinezki → okienko ze szczegółami z `/aed/{id}`, fokus na linku do karty. Poprawka: filtr województwa nie przełącza już mapy na listę (pokazywała 1 AED) – mapa zostaje na warstwie punktów, a warstwa gmin przybliża się do województwa; lista ma dopisek, że pokazuje tylko AED z wpisanym województwem.
- Jak uruchomić / zobaczyć (Windows, bez Dockera): `py -m venv .venv`, `.venv\Scripts\python -m pip install -r requirements.txt tzdata`, `.venv\Scripts\python -m scripts.seed --reset --osm full`, `.venv\Scripts\python -m uvicorn src.api.main:app --port 8000`; w drugim oknie `cd src\ui && npm run dev`.
- Założenia: –
- CR do A: (1) **`tzdata; sys_platform == "win32"` w requirements.txt** (Apache-2.0) – bez tego na Windows API nie startuje: `ZoneInfoNotFoundError: Europe/Warsaw`; (2) **`GET /aed?wojewodztwo=` filtrować po położeniu** (jak `wg_wojewodztw_polozenie`), bo 17 996 rekordów OSM nie ma pola `wojewodztwo` – teraz filtr zwraca 1 AED dla kujawsko-pomorskiego; (3) bez zmian: `prywatny` w `/aed/punkty`, OFL-1.1 w `check_licenses.py`.
- Znane błędy: lista E2 przy filtrze województwa – do czasu CR (2).
- Użycie AI (jedna linia): test na żywym API i poprawka filtra z Claude (Model B); uruchomienie środowiska – człowiek.
- Następny krok: zrzuty ekranu do prezentacji z żywego API.

## HANDOFF #15

- Czas: sob 19:30
- Zrobione: **E2 Mapa i lista – nowy układ** (prośba właściciela projektu): filtry po lewej, lista obok mapy, mapa na szerokość ekranu (do 1680 px). (1) **Przybliżanie kółkiem myszy / touchpadem** (`MapView` prop `wheelZoom`, domyślnie włączony). (2) **Lista pokazuje AED widoczne na mapie**, najbliższe środka mapy na górze, po 30 z „Pokaż kolejne”; po każdym przesunięciu/przybliżeniu (opóźnienie 250 ms) szczegóły z nowego `GET /aed?ids=` (HANDOFF A #6). Status: „X AED spełnia filtry, na mapie widać Y”. (3) **Filtry z licznikami, działają od razu w przeglądarce** na warstwie `/aed/punkty` (`lib/pointFilters.ts`): Dostępność (dostępne teraz / teraz zamknięte / godziny nieznane / tylko dla uprawnionych), Aktualność danych (aktualne / nieaktualne / bez daty sprawdzenia), Źródło (dysponenci / OpenStreetMap), województwo (po położeniu), urządzenia w pojazdach; szukaj i gmina przez API (`searchAedIds`). W grupie – „lub”, między grupami – „i”; liczba przy opcji = ile AED pokaże kliknięcie (liczenie fasetowe). Filtry w URL (`?dostepnosc=teraz,nieznane&aktualnosc=aktualne&zrodlo=osm&wojewodztwo=…`), stare linki `?dostepne_teraz=true` działają. (4) Warstwa gmin w trybie „Aktualność danych”: wybrane województwo albo to, w którym jest większość widocznych AED (od przybliżenia 8). Poprawki: szara połowa mapy po „Tylko mapa” (`ResizeObserver` → `invalidateSize`), mapa na karcie AED pokazywała Europę zamiast urządzenia, podwójne okruszki na karcie AED; znaczniki budowane raz na tryb i używane ponownie (bez `chunkedLoading` – jego liczniki czasu dodawały znaczniki po zmianie filtrów i dawały błąd `getMinZoom` przy React StrictMode).
- Jak uruchomić / zobaczyć: API z `a/core` (potrzebne `/aed?ids=` i nowe pola punktów) + `npm run dev` → /mapa.
- Założenia: lista w trybie „Tylko lista” = wszystkie AED spełniające filtry (bez ograniczenia mapą).
- CR: –
- Znane błędy: –
- Użycie AI (jedna linia): układ E2, filtry i poprawki mapy z Claude.
- Następny krok: sprawdzenie czytnikiem ekranu nowego panelu filtrów.
