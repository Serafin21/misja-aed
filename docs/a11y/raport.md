# Raport dostępności – aplikacja „AED w danych” (WCAG 2.2, poziom AA)

Stan: sob 21.11.2026, 13:45. Wersja: gałąź `b/ux-docs`. Aplikacja działała na danych przykładowych (tryb demonstracyjny), z atrapą mapy zamiast Leafleta.

## Co już sprawdziliśmy

| Test | Narzędzie | Zakres | Wynik |
|---|---|---|---|
| Kontrast tekstu (4,5:1, duży tekst 3:1) | własny skrypt w Playwright + Chrome, liczy kontrast każdego widocznego tekstu względem tła | E1–E9, szerokość 1280 i 320 px | 0 problemów |
| Dostępna nazwa linków, przycisków i pól formularzy | ten sam skrypt (aria-label, treść, powiązana etykieta `<label>`) | E1–E9, 1280 i 320 px | 0 problemów |
| Rozmiar celu (WCAG 2.2, 2.5.8: min. 24×24 px) | ten sam skrypt (bez linków w treści akapitów – wyjątek z 2.5.8) | E1–E9, 1280 i 320 px | 0 problemów; przyciski mają min. 44×44 px |
| Język strony, jeden `<h1>`, kolejność nagłówków bez przeskoków, `<main>`, unikalne `id`, `alt` obrazów | ten sam skrypt | E1–E9 | 0 problemów |
| Kontrola skryptu | celowo dodany szary tekst (#bbb) i przycisk 10×10 px bez nazwy | E1–E9 | skrypt wykrył oba problemy, więc działa |
| Kolejność fokusu klawiaturą | Playwright, klawisz Tab | E1 | „Przejdź do treści” → logo → 112 → menu → treść |
| Fokus po błędzie w formularzu | Playwright | E4 (zgłoszenie), E5 krok 2, E3 Paszport AED | fokus przechodzi na pierwsze błędne pole; nad formularzem lista błędów z linkami do pól |
| Responsywność (1.4.10) | Chrome, 320 px szerokości | E1–E9 | brak przewijania w poziomie |

## Rozwiązania zastosowane w interfejsie

- `lang="pl"`, landmarki `header`, `nav`, `main`, `footer`, link „Przejdź do treści głównej”, tytuł karty zmienia się z ekranem, a po przejściu do innego ekranu fokus trafia na jego `<h1>` (2.4.2, 2.4.3).
- Widoczny fokus: obwódka 3 px w kolorze akcji #0052A5 z odstępem 2 px na każdym elemencie interaktywnym (2.4.7, 2.4.11).
- Kolor nigdy nie jest jedynym nośnikiem informacji (1.4.1): „dostępne teraz” = ikona + tekst; pinezki na mapie różnią się kolorem, kształtem i znaczkiem (zegar, kłódka), zgodnie z księgą znaku.
- Mapa ma równorzędną listę z tymi samymi informacjami (1.1.1). Znaczniki mają dostępne nazwy (np. „Biblioteka Testowa, Warszawa – dostępne teraz, szafka zamknięta”), obsługują Enter. Kółko myszy przybliża mapę dopiero, gdy ma ona fokus, więc strona się nie blokuje.
- Formularze (3.3.1–3.3.3): etykiety, podpowiedzi powiązane przez `aria-describedby`, `aria-invalid`, komunikat przy polu i podsumowanie błędów, brak limitu czasu, brak pól na dane osobowe.
- Komunikaty o stanie w `role="status"` / `aria-live` (4.1.3): liczba wyników, zapisanie potwierdzenia, wynik importu.
- Tabele mają `<caption>` i nagłówki `scope`; szerokie tabele przewijają się w ramce dostępnej z klawiatury.
- `prefers-reduced-motion` i tryb wysokiego kontrastu (`forced-colors`).
- Cele dotykowe min. 44×44 px (2.5.8 wymaga 24×24).
- Kolory znaku (zieleń, bursztyn) tylko w logo, pinezkach, legendzie mapy i na ekranie E8; przyciski i linki w kolorze akcji (paleta poniżej).


## Paleta interfejsu w stylu serwisów gov.pl (sob 21.11.2026, 17:50)

Interfejs przejmuje język wizualny serwisów gov.pl (bez ich znaków): Open Sans, tekst #1B1B1B, kolor akcji #0052A5, płaskie powierzchnie, promień 4 px. Wszystkie wartości są w `src/ui/src/tokens.css`. Kontrast policzony wzorem WCAG 2.2 (luminancja względna):

| Para (tekst lub element / tło) | Kontrast | Wymóg | Wynik |
|---|---|---|---|
| tekst #1B1B1B / biel | 17,2:1 | 4,5:1 | ✅ |
| tekst drugorzędny #555555 / biel | 7,5:1 | 4,5:1 | ✅ |
| tekst drugorzędny #555555 / tło #F5F5F5 | 6,8:1 | 4,5:1 | ✅ |
| link i obrys przycisku #0052A5 / biel | 7,6:1 | 4,5:1 | ✅ |
| biel na przycisku #0052A5 | 7,6:1 | 4,5:1 | ✅ |
| biel na przycisku po najechaniu #006CD7 | 5,1:1 | 4,5:1 | ✅ |
| biel na przycisku wciśniętym #00468D | 9,3:1 | 4,5:1 | ✅ |
| #0052A5 na tle zaznaczenia #E5EEF8 | 6,5:1 | 4,5:1 | ✅ |
| błąd #A7162D / biel | 7,5:1 | 4,5:1 | ✅ |
| błąd #A7162D / tło błędu #FBE9EC | 6,4:1 | 4,5:1 | ✅ |
| sukces #1B6B3A / tło #E8F3EC | 5,8:1 | 4,5:1 | ✅ |
| ostrzeżenie #7A4F00 / tło #FFF4D6 | 6,5:1 | 4,5:1 | ✅ |
| obramowanie pól #767676 / biel | 4,5:1 | 3:1 (1.4.11) | ✅ |
| fokus #0052A5 / biel | 7,6:1 | 3:1 (1.4.11) | ✅ |
| tekst / pasek prototypu #F2F2F2 | 15,4:1 | 4,5:1 | ✅ |
| tekst / tło E8 (szron #EDF2EC) | 15,2:1 | 4,5:1 | ✅ |

Wartości kolorów do potwierdzenia przez TL z przewodnikiem Gov UI. Na telefonie (poniżej 700 px) tekst podstawowy ma 14 px – wymóg TL; treść można powiększyć do 200% bez utraty informacji (do sprawdzenia ręcznie).

## Do zrobienia przed finałem

- [ ] axe DevTools (rozszerzenie przeglądarki) na E1–E9 – zrzuty do prezentacji.
- [ ] Lighthouse (Accessibility) na E1, E2, E3 w widoku mobilnym – zrzuty.
- [ ] NVDA na Windows: ścieżka „najbliższe AED → karta → potwierdzenie” i kreator dysponenta.
- [ ] Prawdziwa mapa Leaflet: fokus na znacznikach, przyciski powiększenia (nazwy po polsku), atrybucja OSM.
- [ ] Powiększenie 200% w przeglądarce (1.4.4) i orientacja pozioma na telefonie.

## Zrzuty

`docs/a11y/zrzuty/` – ekrany w wersji desktop i 320 px.
