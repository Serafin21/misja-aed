# Scenariusz demo (maks. 2:00) – v3, rdzeń: Wykaz AED w portalu dane.gov.pl (CR-TL-9)

Przed nagraniem: lokalny portal dane.gov.pl z przyrostem „Wykaz AED” (`portal/README.md`, „Uruchomienie portalu lokalnie”), konto panelu `admin@mcod.local`; zbiór instytucji z zasobem z zaznaczonym „Zawiera wykaz AED”; plik z błędem (np. pusty `teryt_terc` w wierszu 4); aplikacja z `PORTAL_API=https://api.mcod.local`. Okno 1440 px, powiększenie 100%. Liczby lektora tylko z `docs/tech/LICZBY.md`. Tempo ok. 2 słowa na sekundę.

| Czas | Ekran | Co robimy | Lektor |
|---|---|---|---|
| 0:00–0:20 | Panel dane.gov.pl (https://admin.mcod.local) → Zbiory danych → zbiór instytucji → zasób | pokazujemy zasób z zaznaczonym **„Zawiera wykaz AED” = Tak** | „To jest panel dane.gov.pl. Gmina publikuje swój wykaz defibrylatorów jak każdy zasób i zaznacza jedno pole: zawiera wykaz AED. Tak samo działa dziś wykaz chronionych danych.” |
| 0:20–0:45 | Ten sam panel → Dodaj zasób → plik z błędem → Zapisz | komunikat walidacji portalu z numerem wiersza (np. „wiersz 4: brak wartości: teryt_terc”); zasób się nie zapisuje | „Portal od razu sprawdza plik: 44 kolumny wzorca i pola wymagane. Błąd – komunikat z numerem wiersza. Do wykazu trafiają tylko poprawne dane.” |
| 0:45–1:10 | Terminal: `python manage.py create_main_aed_resource` → panel → zbiór Ministerstwa Cyfryzacji | zasób **„Wykaz AED – wykaz zbiorczy”** (CSV + XLSX); otwieramy plik: kolumny „Nazwa dostawcy”, „Link do zasobu źródłowego”, „Możliwy duplikat” | „Co noc portal składa wykazy wszystkich instytucji w jeden wykaz zbiorczy. Nic nie jest scalane ani poprawiane – przy każdym wierszu jest dostawca i link do jego pliku.” |
| 1:10–1:25 | Przeglądarka: `https://api.mcod.local/aed-aggregated` | odpowiedź JSON z linkami `csv_url`, `xlsx_url` | „Aplikacje pobierają wykaz z jednego adresu API: aed-aggregated.” |
| 1:25–1:50 | Mapa danych AED: „Znajdź AED” → karta AED | AED z wykazu, sekcja „Skąd są te dane i kto za nie odpowiada”: dostawca i link do źródła | „Nasza Mapa danych AED tylko czyta ten wykaz. Przy każdym AED widać, kto za nie odpowiada i skąd pochodzą dane. Poprawić je może tylko dostawca – w swoim panelu.” |
| 1:50–2:00 | Strona akcji (`/akcja`) – logo „AED w danych” | ostatni kadr | „Masz AED? Udostępnij je na dane.gov.pl. AED w danych – dane prosto z serca.” |

**Zasady nagrania:** każde zdanie lektora sprawdzić z działającym portalem i aplikacją. Logo akcji dopiero w ostatnim kadrze (`brand/haslo.txt`). Nie pokazujemy „Panelu moderacji prototypu” – to tryb pokazowy, docelowo wyłączony (`docs/MODEL_ROL.md` v2.1).

**Jeśli portal nie wystartuje przed nagraniem:** kroki 1–4 zastąpić kadrami kodu z `portal/backend` (pole w `mcod/resources/forms.py`, komunikat z `mcod/resources/aed_utils.py`, zadanie `mcod/resources/tasks/aed.py`, trasa w `mcod/routes.py`) i wynikiem testów `portal/local/run_aed_tests.sh` (23 passed) – lektor mówi „w kodzie portalu” zamiast „w panelu”. Nie pokazywać niczego, co udaje działający panel.

## Plan B na finale (awaria internetu lub API)

1. Nagranie demo odtwarzane lokalnie z pliku.
2. Aplikacja w trybie demonstracyjnym (`VITE_USE_MOCKS=1 npm run dev`) – działa bez backendu.
3. Zrzuty w prezentacji PDF (`pitch/zrzuty/`).
