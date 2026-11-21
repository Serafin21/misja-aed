# Scenariusz demo (maks. 2:00) – v2, model ról

Nagranie ok. 07:00 w niedzielę. Model: `docs/MODEL_ROL.md`. Przed nagraniem: API z `a/core` po scaleniu, dane `python -m scripts.seed --reset --osm full --lista auto`, czysty profil przeglądarki, powiększenie 100%, okno 1440 px; część mieszkańca na widoku 390 px. Długość sprawdź w odtwarzaczu (≤ 2:00; tempo lektora ok. 2 słowa na sekundę). Liczby w tekście lektora tylko z `docs/tech/LICZBY.md` po regeneracji przez A.

| Czas | Ekran (adres) | Co robimy | Lektor |
|---|---|---|---|
| 0:00–0:20 | Mapa (`/mapa`), cała Polska, warstwa „Do sprawdzenia” włączona | statyczny kadr: tysiące punktów OSM | „W otwartych danych jest dziś ponad 18 tysięcy AED. Tylko co szósty był sprawdzony w ostatnim roku i za żaden nikt nie odpowiada. Dlatego te punkty są tylko warstwą do sprawdzenia.” |
| 0:20–0:45 | „Znajdź AED” (`/znajdz`) na telefonie → karta AED | najbliższe AED → karta: dostawca, link do zbioru, data danych, etykieta „Zbiór przejściowy” | „Mieszkaniec widzi najbliższe AED, a na karcie – kto odpowiada za te dane, z którego zbioru na dane.gov.pl pochodzą i z jakiego są dnia.” |
| 0:45–1:05 | Karta AED → „Zgłoś problem z tym AED” (`/zglos?aed=…`) | typ „szafka zamknięta” → informacja „trafi do: [dostawca]” → wysłanie; powrót na kartę – dane bez zmian | „Zamknięta szafka? Zgłoszenie trafia prosto do dostawcy. Dane na liście się nie zmieniają – decyduje ten, kto za nie odpowiada.” |
| 1:05–1:35 | Logowanie (`/logowanie`, konto `dysponent`) → Moje AED (`/moje-aed`) | dodaj AED → sprawdzenie ze wzorcem → „Pobierz pliki do publikacji” → pokazać CSV i XML w pakiecie | „Dysponent dodaje swoje AED i pobiera komplet plików: CSV według wzorca i XML zgodny z harvesterem dane.gov.pl. Publikuje je na własnym koncie – my niczego nie publikujemy za niego.” |
| 1:35–2:00 | Panel administratora (`/panel`, konto `administrator`) → luki → akcja (`/akcja`) | raport agregacji (zbiory zgodne ze wzorcem, przejściowe, Warszawa poza listą) → mapa luk → strona akcji | „Administrator łączy zbiory, ale nie wpisuje danych. Mapa luk pokazuje, gdzie brakuje dostawców – tam trafia akcja AED w danych. Dane prosto z serca. Masz AED? Udostępnij je na dane.gov.pl.” |

**Przed nagraniem:** każde zdanie lektora sprawdzić z działającą aplikacją i `docs/tech/LICZBY.md`. Etykieta „Zbiór przejściowy” i podział „przejściowe / poza listą” w raporcie tylko, jeśli po scaleniu A `/api/v1/zbiory` je pokazuje – inaczej pominąć te słowa. Ostatnie zdanie łączy hasło z nazwą akcji i podtytułem (zasada z `brand/haslo.txt`); logo akcji pojawia się dopiero w ostatnim kadrze.

## Plan B na finale (awaria internetu lub API)

1. Nagranie demo odtwarzane lokalnie z pliku.
2. Aplikacja w trybie demonstracyjnym (`VITE_USE_MOCKS=1 npm run dev`) – działa bez backendu (bez logowania, bez pełnych danych OSM).
3. Zrzuty ekranu w prezentacji PDF (`pitch/zrzuty/`).
