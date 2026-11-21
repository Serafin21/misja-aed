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
