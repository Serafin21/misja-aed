# Scenariusz demo (maks. 2:00) – v1

Nagranie ok. 07:00 w niedzielę. Przed nagraniem: aplikacja na prawdziwym API (`docker compose up --build`, dane po `python -m scripts.seed --reset --osm full`), czysty profil przeglądarki, powiększenie 100%, okno 1280 px; część na telefonie – widok mobilny 390 px. Długość sprawdź w odtwarzaczu (≤ 2:00; tempo lektora ok. 2 słowa na sekundę). Liczby w tekście lektora pochodzą z `docs/tech/LICZBY.md`.

| Czas | Ekran (adres) | Co robimy | Lektor |
|---|---|---|---|
| 0:00–0:12 | E2, tryb „Aktualność danych” (`/mapa?tryb=dane`), cała Polska | statyczny kadr: mapa pełna białych pinezek z zegarem | „3 marca w Warszawie świadkowie szukali defibrylatora – kilka było zamkniętych. W otwartych danych jest dziś 18 tysięcy AED, ale tylko co szósty był sprawdzony w ostatnim roku.” |
| 0:12–0:28 | E1 na telefonie (`/`) | „Pokaż najbliższe AED” → 5 najbliższych z odległością, „Tylko dostępne teraz” | „Świadek dotyka jednego przycisku i widzi najbliższe AED, które jest dostępne teraz – a nie tylko gdzieś istnieje.” |
| 0:28–0:42 | E3 karta AED z zamkniętą szafką | ramka „Szafka jest zamknięta” z instrukcją; przewinięcie do „Paszport AED” | „Zamknięta szafka? Instrukcja jest na samej górze. Kod QR na szafce pozwala każdemu potwierdzić, że AED jest na miejscu.” |
| 0:42–1:00 | E2 (`/mapa`) – przełącznik trybów | „Dostępność” → strzałką „Aktualność danych”; filtr województwa (np. kujawsko-pomorskie) → zakreskowane gminy i lista gmin bez danych | „Ta sama mapa w drugim trybie pokazuje, jak dawno sprawdzono dane. 351 gmin nie ma w danych ani jednego AED – tam akcja szuka dysponentów.” |
| 1:00–1:28 | E5 kreator (`/dysponenci`) | logowanie demo → wgranie `data/sample/zrodlo_gmina_przyklad.csv` → kolumny → raport („pn-pt 8-16” → `Mo-Fr 08:00-16:00`, AED już w zbiorze) → Zatwierdź → odznaka | „Gmina wgrywa plik w swoim formacie. Dopasowujemy kolumny, poprawiamy zapis godzin, wykrywamy AED, które już są w zbiorze. Dysponent dostaje odznakę akcji.” |
| 1:28–1:48 | E6 Zbiór danych (`/dane`) → E7 Źródła (`/zrodla`) | lista plików (CSV, GeoJSON, JSON-LD, osobny zasób OSM, DCAT-AP-PL, XML importu); tabela źródeł z pokryciem pól | „Wynik trafia do dane.gov.pl w formatach Standardu technicznego – z metadanymi i plikiem XML do automatycznego zasilania. Każde źródło ma opisany zakres.” |
| 1:48–2:00 | E8 Akcja (`/akcja`) | hasło, podtytuł, przycisk „Dodaj swoje AED” | „AED w danych. Dane prosto z serca. Masz AED? Udostępnij je na dane.gov.pl.” |

**Przed nagraniem (P10, weryfikacja przez A o 07:30):** każde zdanie lektora sprawdzić z działającą aplikacją i `docs/tech/LICZBY.md`. „Co szósty” = 3 148 z 18 033 (17%). Jeśli liczby się zmienią po ponownym imporcie, poprawić tekst. Ostatnie zdanie łączy hasło z nazwą i podtytułem (zasada z `brand/haslo.txt`).

## Plan B na finale (awaria internetu lub API)

1. Nagranie demo odtwarzane lokalnie z pliku.
2. Aplikacja w trybie demonstracyjnym (`VITE_USE_MOCKS=1 npm run dev`) – działa bez backendu (bez warstwy gmin i bez pełnych danych OSM).
3. Zrzuty ekranu w prezentacji PDF.
