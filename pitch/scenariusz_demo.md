# Scenariusz demo (maks. 2:00) – v0

Nagranie ok. 07:00 w niedzielę. Przed nagraniem: aplikacja działa na prawdziwym API, przeglądarka ma czysty profil, powiększenie 100%, telefon (albo widok mobilny DevTools 390 px) do części 1. Sprawdzenie długości: `python tools/hn.py video pitch/demo.mp4 --check-only`.

| Czas | Ekran | Co robimy | Lektor |
|---|---|---|---|
| 0:00–0:15 | E8 Akcja (logo) | statyczny kadr na logo i hasło | „3 marca w centrum Warszawy świadkowie szukali defibrylatora. Kilka było zamkniętych na klucz. Nie ma jednej mapy AED – dane są rozproszone. Dlatego powstało AED w danych.” |
| 0:15–0:30 | E1 na telefonie | „Pokaż najbliższe AED” → lista 5 z odległością, „Dostępne teraz” | „Świadek dotyka jednego przycisku i widzi najbliższe AED, które jest dostępne teraz – a nie tylko gdzieś istnieje.” |
| 0:30–0:45 | E3 „Biblioteka Testowa” | na górze ramka „Szafka jest zamknięta” + instrukcja; przewinięcie do „Paszport AED” | „Zamknięta szafka? Instrukcja jest na samej górze. A kod QR na szafce pozwala każdemu potwierdzić, że AED jest na miejscu.” |
| 0:45–1:20 | E5 kreator | wgranie `zrodlo_gmina_przyklad.csv` → kolumny → raport („pn-pt 8-16” → `Mo-Fr 08:00-16:00`, scalony duplikat z OSM) → Zatwierdź → odznaka | „Gmina wgrywa swój plik – w swoim formacie. Dopasowujemy kolumny, poprawiamy zapis godzin, wykrywamy, że to AED jest już w OpenStreetMap, i scalamy je. Dysponent dostaje odznakę akcji.” |
| 1:20–1:45 | E6 Zbiór danych → E7 Źródła | lista plików (CSV, GeoJSON, OSM osobno, XML importu, DCAT-AP-PL), słownik pól; tabela źródeł z pokryciem pól | „Wynik trafia do dane.gov.pl w formatach Standardu technicznego: CSV, GeoJSON, API, metadane i plik XML do automatycznego zasilania. Każde źródło ma opisany zakres.” |
| 1:45–2:00 | E8 Akcja | logo, „Dodaj swoje AED” | „AED w danych. Jeden wiersz to jedno AED – i czyjaś szansa na życie.” |

**Do potwierdzenia przed nagraniem:** każde zdanie lektora sprawdzić z działającą aplikacją i `docs/HANDOFF_A.md` (P10). Jeśli plik XML importu lub metadane nie będą gotowe, usunąć je z tekstu w części 1:20–1:45.

## Plan B na finale (awaria internetu lub API)

1. Nagranie `pitch/demo.mp4` odtwarzane lokalnie.
2. Aplikacja w trybie demonstracyjnym (`VITE_USE_MOCKS=1 npm run dev`) – działa bez backendu.
3. Zrzuty ekranu w prezentacji PDF.
