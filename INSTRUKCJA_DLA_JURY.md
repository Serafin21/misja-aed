# Instrukcja dla jury – MKS · Misja AED – dane na ratunek

Rozwiązanie ma trzy części:

1. **Wykaz AED w portalu dane.gov.pl** – zmiana w kodzie portalu (katalog `portal/`), zrobiona wzorem istniejącego wykazu chronionych danych (DGA). To jest rdzeń rozwiązania.
2. **Mapa danych AED** – aplikacja, która tylko czyta wykaz zbiorczy z portalu (`/aed-aggregated`) i pokazuje AED z dostawcą i linkiem do źródła.
3. **Akcja „AED w danych”** – materiały, które zachęcają instytucje do publikacji wykazu (`brand/`).

Zasada: **publikuje dostawca, który odpowiada za dane. Portal scala wykazy wielu dostawców w jedną listę, nie zmieniając wierszy.** Nikt poza dostawcą nie publikuje ani nie poprawia jego danych.

---

## 0. Najważniejsze: tabela Wykazu AED w portalu dane.gov.pl

1. Otwórz `pitch/zrzuty/14_portal_strona_wykaz_aed_tabela.png` – prawdziwy frontend portalu dane.gov.pl uruchomiony lokalnie: w menu **„Punkt informacyjny DGA”** i obok nasza pozycja **„Wykaz AED”**; strona „Wykaz AED – wykaz zbiorczy” z tabelą, przyciskami CSV/XLSX i wyszukiwarką – tak jak wykaz chronionych danych (DGA), z innym zakresem kolumn.
2. Odczytaj kolumny: Lp., Identyfikator AED, **Nazwa dostawcy**, Nazwa obiektu, adres, Dostęp, Godziny dostępności, współrzędne, Data weryfikacji, **Link do zasobu źródłowego**, **Możliwy duplikat**. Każdy wiersz ma dostawcę, który za niego odpowiada; wiersze nie są scalane.
3. Otwórz `pitch/zrzuty/16_portal_wykaz_po_harvesterze.png` – wiersze dwóch dostawców: **Urząd Miasta Testowo** (zasilenie ręczne: plik w panelu + „Zawiera wykaz AED”) i **Fundacja Serce dla Miasta** (zasilenie automatyczne: harvester XML z `<containsAedList>true</containsAedList>`, plik `portal/local/harvester/wykaz-aed-fundacja-serce.xml`). Dwa AED 7 m od siebie mają „Możliwy duplikat”.
4. Otwórz `pitch/zrzuty/13_portal_tabela_zasobu_wykaz_aed.png` – ten sam wykaz w zwykłym widoku tabeli zasobu w zbiorze „Wykaz AED – wykaz zbiorczy”.
5. Kod strony: `portal/frontend/src/app/pages/aed-information-point/` (kopia `dga-information-point`), `portal/frontend/src/app/services/aed.service.ts`; kod wykazu: `portal/backend/mcod/resources/aed_constants.py`, `aed_utils.py`. Historia: `git log --oneline -- portal/` (pierwsze commity frontendu i backendu to oryginalny kod bez zmian).
6. Jak to uruchomić u siebie: `portal/README.md`, sekcje „Uruchomienie portalu lokalnie” i „Tabela Wykazu AED we frontendzie portalu i dwa sposoby zasilenia”.

## A. Klikalny prototyp (bez instalacji)

1. Otwórz https://serafin21.github.io/misja-aed/ (tryb demonstracyjny: dane przykładowe, bez logowania – logowanie i panele działają po uruchomieniu lokalnym, sekcja C).
2. Kliknij **„Znajdź AED”**, wpisz miejscowość albo kliknij **„Moja lokalizacja”**.
3. Kliknij AED na liście → **„Szczegóły”**. Sekcja **„Skąd są te dane i kto za nie odpowiada”** pokazuje dostawcę, link do zbioru w dane.gov.pl i datę danych.
4. Zwróć uwagę na oznaczenia: **„Do sprawdzenia”** = punkt z OpenStreetMap, poza wspólną listą; **„Prototyp – nieopublikowane w dane.gov.pl”** = AED dodane w aplikacji, poza wykazem zbiorczym.
5. W stopce kliknij **„Dla instytucji”** – instrukcja publikacji wykazu AED w panelu dane.gov.pl w krokach, szablon pliku i typowe komunikaty walidacji portalu.
6. W stopce kliknij **„Akcja „AED w danych””** – hasło, logotyp, księga znaku.
7. (Tylko w wersji uruchomionej lokalnie) Stopka → **„Logowanie”**, konto `admin`, hasło `admin123` → „Panel moderacji prototypu”. To tryb pokazowy – patrz sekcja D.

## B. Kod zmian w portalu dane.gov.pl (bez dostępu do zewnętrznych domen)

1. Sklonuj repozytorium: `git clone https://github.com/Serafin21/misja-aed` i wejdź do katalogu `misja-aed`.
2. Uruchom `git log --oneline -- portal/`. Najstarszy commit (`b229557`) to **oryginalny kod dane.gov.pl bez zmian** (mcod-backend 2.62.3, pochodzenie i suma kontrolna: `portal/IMPORT.md`). Każdy następny commit „Wykaz AED: …” to nasz przyrost.
3. Zobacz cały przyrost jednym poleceniem: `git diff b229557 HEAD -- portal/backend`.
4. Otwórz `portal/README.md`, sekcja **„Gdzie wzór DGA, gdzie Wykaz AED (plik:linia)”** – każdy element Wykazu AED stoi obok swojego odpowiednika DGA.
5. Najważniejsze pliki (w `portal/backend/mcod/`):
   - `resources/models.py` – pole zasobu `contains_aed_list` („Zawiera wykaz AED”),
   - `resources/aed_constants.py` – 44 kolumny wzorca i pola wymagane,
   - `resources/aed_utils.py` – walidacja pliku i budowa wykazu zbiorczego bez scalania,
   - `resources/tasks/aed.py` i `celeryapp.py` – nocne zadanie `create_main_aed_resource_task` (3:40),
   - `resources/views.py`, `routes.py` – `GET /aed-aggregated`,
   - `resources/tests/test_aed.py` – testy.
6. Treść strony informacyjnej „Wykaz AED – punkt informacyjny” (odpowiednik strony wykazu chronionych danych w CMS): `portal/cms/wykaz_aed.md`.

## C. Uruchomienie lokalne

**Mapa danych AED (aplikacja + API), Docker:**

1. `cp .env.example .env`
2. `docker compose up --build`
3. Otwórz http://localhost. Dokumentacja API: http://localhost/api/docs.

**Portal dane.gov.pl z Wykazem AED** (Docker, ok. 8 GB RAM, pierwsze budowanie kilkadziesiąt minut): kroki w `portal/README.md`, sekcja „Uruchomienie portalu lokalnie”. Potem:

1. Panel https://admin.mcod.local, konto `admin@mcod.local` / `testadmin123!`.
2. Zbiory danych → zbiór instytucji → Dodaj zasób → plik CSV/XLSX z szablonu → **„Zawiera wykaz AED” = Tak** → Zapisz.
3. Wgraj plik z błędem (np. bez kolumny albo z pustym `teryt_terc`) → portal pokaże komunikat z numerem wiersza i nie zapisze zasobu.
4. `docker compose -f docker-compose.local.yml run mcod-local-run python manage.py create_main_aed_resource` → w zbiorze Ministerstwa Cyfryzacji powstaje „Wykaz AED – wykaz zbiorczy” (CSV + XLSX).
5. `curl -k https://api.mcod.local/aed-aggregated` → linki do plików wykazu zbiorczego.
6. W `.env` aplikacji ustaw `PORTAL_API=https://api.mcod.local` i uruchom aplikację ponownie – Mapa danych AED czyta wykaz zbiorczy.

**Testy:** aplikacja – `pip install -r requirements.txt` i `pytest` (115 testów); portal – `portal/local/run_aed_tests.sh` (25 testów Wykazu AED bez bazy) i 3 testy z bazą w uruchomionym portalu (`portal/README.md`); razem 28/28. Zrzuty z uruchomionego portalu: `pitch/zrzuty/01–06`.

## D. Czego nie oceniać jako rozwiązania – tryb pokazowy prototypu

Żeby dało się przeklikać całą ścieżkę bez uruchamiania portalu, aplikacja ma **tryb pokazowy prototypu, docelowo wyłączony** (`docs/MODEL_ROL.md`, sekcja „Zmiany v2.1”):

| W prototypie | Docelowo |
|---|---|
| Administrator aplikacji może edytować, usuwać i przypisywać AED („Panel moderacji prototypu”) | brak – dane zmienia tylko dostawca, nową wersją zasobu w panelu dane.gov.pl; edycje w prototypie **nie zmieniają wykazu zbiorczego** |
| Zatwierdzone zgłoszenie nowego AED pojawia się od razu na mapie | zgłoszenie wraca do dostawcy; AED trafia na mapę dopiero przez jego wykaz – w prototypie ma etykietę „Prototyp – nieopublikowane w dane.gov.pl” |
| Bez `PORTAL_API` mapa czyta pakiety fikcyjnych dostawców i 3 prawdziwe zbiory samorządów (Krosno, Przemyśl, Marki) | mapa czyta wyłącznie `/aed-aggregated` |
| Logowanie kontami testowymi | login.gov.pl i 2FA |

## E. Gdzie co jest

| Co | Gdzie |
|---|---|
| Opis zgłoszenia | `SUBMISSION.md` |
| Model ról (v2.1) | `docs/MODEL_ROL.md` |
| Wzorcowy zakres danych (XLSX) | `deliverables/zakres_danych/` |
| Przykładowy pakiet dostawcy, eksport listy | `deliverables/` |
| Logotyp i księga znaku akcji | `brand/` |
| Prezentacja (PDF) | `pitch/prezentacja.pdf` |
| Zakres użycia AI | `docs/AI_USAGE.md` |
