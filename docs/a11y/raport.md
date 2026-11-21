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

Wartości kolorów do potwierdzenia przez TL z przewodnikiem Gov UI. Tekst podstawowy ma 18 px na każdym ekranie (prosta strona, wymóg TL); powiększenie 200% – do sprawdzenia ręcznie.

## Wyniki testów (sob 21.11, ok. 23:50, przeglądarka Claude na localhost:5173, dane przykładowe)

Sprawdził Claude (Model B) narzędziami automatycznymi – **nie zastępuje to testu człowieka z czytnikiem ekranu**.

| Test | Zakres | Wynik |
|---|---|---|
| axe-core 4.10 (reguły WCAG 2.0/2.1/2.2 A i AA) | 15 ekranów: strona główna, Znajdź AED, karta AED, Zgłoś AED (bez logowania), zgłoszenie problemu, pierwsza pomoc, o projekcie, akcja, dla instytucji, logowanie, wniosek o konto, eksport, dostawcy, kontakt, deklaracja | **0 naruszeń WCAG A/AA** na 14 ekranach; na karcie AED 1 naruszenie (`aria-required` na `fieldset`, 4.1.2) – **poprawione** (cc28003) |
| axe – dobre praktyki | jw. | paski „Prototyp…” i „Tryb demonstracyjny” poza landmarkami; liczniki filtrów z `aria-label` na `span` – **poprawione** (cc28003) |
| axe – „do sprawdzenia ręcznie” (kontrast) | karta AED | 11 elementów, których tła axe nie ustalił, bo nachodzi na nie przyklejony nagłówek przy przewijaniu – nie jest to błąd kontrastu |
| Poziome przewijanie i elementy poza ekranem | 10 ekranów × 320, 768, 1024, 1440 px | 320 px: **„Znajdź AED” przewijała się w poziomie** (panel filtrów 368 px) – **poprawione** (cc28003); 768/1024/1440 px: bez problemów |
| Cele dotykowe < 24 px (2.5.8) | jw. | tylko pola radio/checkbox 20–22 px w etykietach ≥ 48 px – wyjątek 2.5.8 (klikalna etykieta) |
| Klawiatura | strona główna, Znajdź AED, Zgłoś AED, karta, akcja | link „Przejdź do treści głównej” na każdej stronie; fokus widoczny (obrys 3 px, `:focus-visible`) – sprawdzone klawiszem Tab; brak elementów klikalnych bez dostępu z klawiatury |

Poprawki z cc28003 sprawdzone tylko składniowo – do potwierdzenia po `git pull` u B (ponowny test axe i 320 px).

## Do zrobienia przed finałem

- [x] axe na wszystkich ekranach (powyżej).
- [ ] Lighthouse (Accessibility) w Chrome na stronie głównej i „Znajdź AED” w widoku mobilnym – zrzut do prezentacji (człowiek B).
- [ ] NVDA na Windows: ścieżka „Znajdź AED → karta → zgłoszenie problemu” i „Zgłoś AED” (człowiek B).
- [ ] Mapa Leaflet: fokus na znacznikach, nazwy przycisków powiększenia po polsku.
- [ ] Powiększenie 200% w przeglądarce (1.4.4) i orientacja pozioma na telefonie.

## Zrzuty

`docs/a11y/zrzuty/` – ekrany w wersji desktop i 320 px.
