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

- `lang="pl"`, landmarki `header`, `nav`, `main`, `footer`, link „Przejdź do treści”, tytuł karty zmienia się z ekranem, a po przejściu do innego ekranu fokus trafia na jego `<h1>` (2.4.2, 2.4.3).
- Widoczny fokus: niebieska obwódka 3 px z odstępem (2.4.7, 2.4.11).
- Kolor nigdy nie jest jedynym nośnikiem informacji (1.4.1): „dostępne teraz” = ikona + tekst; pinezki na mapie różnią się kolorem, kształtem i znaczkiem (zegar, kłódka), zgodnie z księgą znaku.
- Mapa ma równorzędną listę z tymi samymi informacjami (1.1.1). Znaczniki mają dostępne nazwy (np. „Biblioteka Testowa, Warszawa – dostępne teraz, szafka zamknięta”), obsługują Enter. Kółko myszy przybliża mapę dopiero, gdy ma ona fokus, więc strona się nie blokuje.
- Formularze (3.3.1–3.3.3): etykiety, podpowiedzi powiązane przez `aria-describedby`, `aria-invalid`, komunikat przy polu i podsumowanie błędów, brak limitu czasu, brak pól na dane osobowe.
- Komunikaty o stanie w `role="status"` / `aria-live` (4.1.3): liczba wyników, zapisanie potwierdzenia, wynik importu.
- Tabele mają `<caption>` i nagłówki `scope`; szerokie tabele przewijają się w ramce dostępnej z klawiatury.
- `prefers-reduced-motion` i tryb wysokiego kontrastu (`forced-colors`).
- Cele dotykowe min. 44×44 px (2.5.8 wymaga 24×24).
- Kontrast kolorów znaku na białym tle: zieleń ratunkowa #1A7A50 (tekst i przyciski, biel na zieleni 5,3:1), głęboka zieleń #0F3B2B (tekst).

## Do zrobienia przed finałem

- [ ] axe DevTools (rozszerzenie przeglądarki) na E1–E9 – zrzuty do prezentacji.
- [ ] Lighthouse (Accessibility) na E1, E2, E3 w widoku mobilnym – zrzuty.
- [ ] NVDA na Windows: ścieżka „najbliższe AED → karta → potwierdzenie” i kreator dysponenta.
- [ ] Prawdziwa mapa Leaflet: fokus na znacznikach, przyciski powiększenia (nazwy po polsku), atrybucja OSM.
- [ ] Powiększenie 200% w przeglądarce (1.4.4) i orientacja pozioma na telefonie.

## Zrzuty

`docs/a11y/zrzuty/` – ekrany w wersji desktop i 320 px.
