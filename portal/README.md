# Portal dane.gov.pl + „Wykaz AED” (CR-TL-9)

W tym katalogu jest **kod źródłowy portalu dane.gov.pl** (backend „mcod” 2.62.3, import bez zmian – [`IMPORT.md`](IMPORT.md))
i nasz **przyrost „Wykaz AED”** zrobiony dokładnie tak, jak portal robi to już dziś dla **wykazu chronionych danych (DGA,
Data Governance Act)**:

1. dostawca (gmina, szpital, firma, fundacja…) publikuje w swoim zbiorze zasób – plik CSV/XLS/XLSX z kolumnami wzorca
   AED v0.9 (44 pola) – i zaznacza **„Zasób zawiera wykaz AED”**;
2. portal **sprawdza plik** (kolumny, wartości wymagane, współrzędne w Polsce, TERYT, słownik dostępu, jeden wykaz na
   instytucję) – w panelu przy zapisie zasobu i przy harvestowaniu (CKAN, XML);
3. co noc (3:40) zadanie Celery łączy wykazy wszystkich dostawców w **„Wykaz AED – wykaz zbiorczy”** (zasób zbioru
   Ministerstwa Cyfryzacji, CSV + XLSX). Wiersze **nie są scalane**: każdy ma nazwę dostawcy, typ instytucji, link do
   zasobu źródłowego i datę aktualizacji; dwa AED różnych dostawców bliżej niż 25 m dostają tylko oznaczenie
   „Możliwy duplikat”;
4. `GET /aed-aggregated` w API portalu zwraca, gdzie leży aktualny wykaz zbiorczy (linki `csv_url`, `xlsx_url`).

Za treść każdego wiersza odpowiada dostawca, a poprawić go może tylko dostawca – w swoim zasobie w panelu dane.gov.pl.
Nasza aplikacja (`src/`) czyta wykaz zbiorczy z `/aed-aggregated`, gdy ustawisz `PORTAL_API` (patrz niżej).

## Uruchomienie portalu lokalnie

Oryginalna instrukcja portalu: [`backend/README.md`](backend/README.md). W skrócie (komputer z Dockerem, ok. 8 GB RAM,
pierwsze budowanie kilkadziesiąt minut):

```bash
cd portal/backend
```

```bash
cp env.sample .env
```

W `.env` ustaw `DISCOURSE_FORUM_ENABLED=false` (obraz forum Discourse jest w prywatnym rejestrze gitlab.dane.gov.pl)
i zmienne `MCOD_NGINX_*` z `backend/README.md` („Konfiguracja nginx”). Potem:

```bash
docker compose -f docker-compose.local.yml build
```

```bash
docker compose -f docker-compose.local.yml run mcod-local-run python manage.py init_mcod_db
```

```bash
docker compose -f docker-compose.local.yml run mcod-local-run python manage.py search_index --rebuild -f
```

```bash
docker compose -f docker-compose.local.yml up
```

Do `/etc/hosts` dopisz nazwy `admin.mcod.local`, `api.mcod.local`, `cms.mcod.local` wskazujące na kontener `mcod-nginx`
(`backend/README.md`, „Przypisanie nazw maszyn”). Migracje Wykazu AED (`resources/0075`, `resources/0076`) wykonują się
razem z resztą przy `init_mcod_db` / `python manage.py migrate`.

**Panel administracyjny:** https://admin.mcod.local – login `admin@mcod.local`, hasło `testadmin123!` (konto testowe
z oryginalnych danych inicjalnych portalu).

**Wykaz zbiorczy od ręki** (bez czekania do 3:40):

```bash
docker compose -f docker-compose.local.yml run mcod-local-run python manage.py create_main_aed_resource
```

(`--async` = przez kolejkę Celery). Potem: `curl -k https://api.mcod.local/aed-aggregated`.

**Testy Wykazu AED:**

```bash
docker compose -f docker-compose.local.yml run mcod-local-run pytest mcod/resources/tests/test_aed.py
```

Bez pełnego środowiska (bez baz) testy, które nie dotykają bazy, uruchamia `local/run_aed_tests.sh` w samym obrazie
aplikacji portalu – wynik w sesji: **23 passed**; 3 testy z bazą (`django_db`) wymagają pełnego środowiska.

### Co udało się uruchomić w sesji zespołu (limit 90 minut z CR-TL-9)

| Krok | Wynik |
|---|---|
| Obraz aplikacji portalu (`backend/docker/app/Dockerfile`) | ✅ zbudowany jako `mcod-app:local` – w środowisku z proxy HTTPS przez [`local/Dockerfile.app`](local/Dockerfile.app) (certyfikat proxy, apt przez https, katalog `logs` przed `compilemessages`) |
| `compilemessages` z naszymi tłumaczeniami PL | ✅ w obrazie |
| Testy `test_aed.py` bez bazy (`local/run_aed_tests.sh`) | ✅ 23 passed |
| Obraz Elasticsearch 6.8.23 | ⚠️ pobrany z Docker Hub, ale `docker/elasticsearch/Dockerfile` instaluje wtyczki `analysis-stempel` i `analysis-icu` z `artifacts.elastic.co` – **zablokowane** przez sieć sesji |
| Obraz `rdfdb` (Apache Jena Fuseki, Alpine) | ❌ `apk` bez certyfikatu proxy – nie zbudowany |
| `init_mcod_db`, indeksy ES, panel w przeglądarce | ❌ nie uruchomione – zależą od dwóch kroków wyżej |

Na zwykłym komputerze (bez proxy) te blokady nie występują – wystarczą kroki z sekcji wyżej. Zrzutów ekranu panelu
w tej wersji nie ma, bo panel nie wystartował w sesji; opis kroków dostawcy poniżej odpowiada kodowi formularza
(`mcod/resources/forms.py`, `mcod/resources/admin.py`).

## Ścieżka dostawcy w panelu

1. Zaloguj się do panelu (https://admin.mcod.local) kontem instytucji (albo `admin@mcod.local`).
2. **Zbiory danych** → swój zbiór (np. „Defibrylatory AED w Gminie Przykładowo”) → **Dodaj zasób**.
3. Wgraj plik CSV/XLSX z 44 kolumnami wzorca AED v0.9 (szablon: `deliverables/zakres_danych/` w repozytorium projektu).
4. W sekcji danych zasobu ustaw **„Zasób zawiera wykaz AED” = Tak** (pod opcją „Zasób zawiera wykaz chronionych danych”).
5. **Zapisz.** Jeśli plik nie pasuje do wzorca, formularz pokaże listę błędów (brakujące kolumny, numery wierszy z
   pustym polem wymaganym, współrzędne poza Polską, zły TERYT, drugi wykaz AED tej samej instytucji) – nic się nie
   zapisze, dopóki plik nie będzie poprawny.
6. Następnej nocy (3:40) wiersze trafią do „Wykaz AED – wykaz zbiorczy”. Poprawka = nowa wersja pliku w tym samym zasobie.

Harvester: w XML (wersja 1.14, propozycja w [`xsd/`](xsd/)) element `<containsAedList>true</containsAedList>` w zasobie;
w CKAN pole `contains_aed_list`. Te same reguły co w panelu.

## Gdzie wzór DGA, gdzie Wykaz AED (plik:linia)

Ścieżki względem `portal/backend/`. Numery linii – stan po commitach przyrostu.

| Element | DGA (oryginał portalu) | Wykaz AED (nasz przyrost) |
|---|---|---|
| Pole zasobu | `mcod/resources/models.py:579` `contains_protected_data` | `mcod/resources/models.py:582` `contains_aed_list` |
| Właściwość zasobu | `mcod/resources/models.py:1373` `is_dga` | `mcod/resources/models.py:1383` `is_aed_list` |
| Migracja pola | `mcod/resources/migrations/0067_resource_contains_protected_data.py` | `mcod/resources/migrations/0075_resource_contains_aed_list.py` |
| Model wykazu zbiorczego | `mcod/resources/models.py:1628` `AggregatedDGAInfo` (+ `0068_aggregateddgainfo.py`) | `mcod/resources/models.py:1656` `AggregatedAEDInfo` (+ `0076_aggregatedaedinfo.py`) |
| Kolumny wykazu dostawcy | `mcod/resources/dga_constants.py:33` `DGA_COLUMNS` | `mcod/resources/aed_constants.py:21` `AED_COLUMNS` (44) i `:70` `AED_REQUIRED` |
| Kto może publikować | `mcod/resources/dga_constants.py:40` `ALLOWED_DGA_INSTITUTIONS` | `mcod/resources/aed_constants.py:94` `ALLOWED_AED_INSTITUTIONS` (wszystkie typy) |
| Kolumny wykazu zbiorczego | `mcod/resources/dga_constants.py:19` `MAIN_DGA_COLUMNS` | `mcod/resources/aed_constants.py:104` `MAIN_AED_COLUMNS` |
| Walidacja kolumn | `mcod/resources/dga_utils.py:119` `validate_dga_df_columns` | `mcod/resources/aed_utils.py:89` `validate_aed_df_columns` |
| Walidacja pliku | `mcod/resources/dga_utils.py:124` `validate_dga_file_columns` | `mcod/resources/aed_utils.py:147` `validate_aed_file` (+ wiersze: `validate_aed_row`) |
| Aktualny zasób zbiorczy | `mcod/resources/dga_utils.py:80` `get_main_dga_resource` | `mcod/resources/aed_utils.py:188` `get_main_aed_resource` |
| Budowa tabeli zbiorczej | `mcod/resources/dga_utils.py:401` `create_main_dga_df` | `mcod/resources/aed_utils.py:311` `create_main_aed_df` (+ `mark_possible_duplicates`) |
| Pliki wykazu zbiorczego | `mcod/resources/dga_utils.py:514` `create_main_dga_file` (XLSX) | `mcod/resources/aed_utils.py:340` `create_main_aed_files` (CSV + XLSX) |
| Zbiór MC | `mcod/resources/dga_utils.py:645` `create_main_dga_dataset` | `mcod/resources/aed_utils.py:360` `create_main_aed_dataset` |
| Zasób z plikami | `mcod/resources/dga_utils.py:705` `create_main_dga_resource_with_dataset` | `mcod/resources/aed_utils.py:404` `create_main_aed_resource_with_dataset` |
| Zapis informacji o wykazie | `mcod/resources/dga_utils.py:786` `update_or_create_aggr_dga_info_and_delete_old_main_dga` | `mcod/resources/aed_utils.py:449` `update_or_create_aggr_aed_info_and_delete_old_main_aed` |
| Zadanie Celery | `mcod/resources/tasks/dga.py:32` `create_main_dga_resource_task` | `mcod/resources/tasks/aed.py:30` `create_main_aed_resource_task` |
| Harmonogram | `mcod/celeryapp.py:88` `dga_main_resource_creation` | `mcod/celeryapp.py:94` `aed_main_resource_creation` (3:40) |
| Komenda ręczna | – | `mcod/resources/management/commands/create_main_aed_resource.py` |
| Pole w formularzu panelu | `mcod/resources/forms.py:255` `contains_protected_data` | `mcod/resources/forms.py:269` `contains_aed_list`, `:370` `_validate_aed_list` |
| Zmiana zasobu zbiorczego | `mcod/resources/forms.py:433` `_is_main_dga_resource_updated` | `mcod/resources/forms.py:364` `_is_main_aed_resource_updated` |
| XML harvestera | `mcod/harvester/serializers.py:443` `containsProtectedData` | `mcod/harvester/serializers.py:444` `containsAedList`, `:693` `validate_xml_contains_aed_list` |
| Kody błędów CKAN | `mcod/harvester/ckan_utils.py:15` `RES_DGA_*` | `mcod/harvester/ckan_utils.py:25` `RES_AED_*` |
| Jeden wykaz na instytucję (CKAN) | `mcod/harvester/models.py:943` `_ckan_validate_item_org_single_dga_json` | `mcod/harvester/models.py:1119` `_ckan_validate_item_org_single_aed_json` |
| Schemat XSD | `data/harvester/xml_import_otwarte_dane_1_13.xsd` | `data/harvester/xml_import_otwarte_dane_1_14.xsd` = [`xsd/xml_import_otwarte_dane_1_14.xsd`](xsd/xml_import_otwarte_dane_1_14.xsd) |
| Odpowiedź API | `mcod/resources/serializers.py:696` `AggregatedDGAInfoApiResponse` | `mcod/resources/serializers.py:703` `AggregatedAEDInfoApiResponse` |
| Widok API | `mcod/resources/views.py:741` `AggregatedDGAInfoView` | `mcod/resources/views.py:779` `AggregatedAEDInfoView` |
| Adres API | `mcod/routes.py:147` `/dga-aggregated` | `mcod/routes.py:149` `/aed-aggregated` |
| Fabryki testowe | `mcod/resources/factories.py:291` `AggregatedDGAInfoFactory` | `mcod/resources/factories.py:304` `AggregatedAEDInfoFactory` (+ `AEDResourceFactory`) |
| Testy | `mcod/resources/tests/test_dga*.py` | `mcod/resources/tests/test_aed.py` |

Świadome różnice względem DGA: wykaz AED mogą publikować **wszystkie** typy instytucji (AED mają też firmy, fundacje,
uczelnie); wykaz zbiorczy ma kolumnę **„Możliwy duplikat”** (≤ 25 m, tylko między różnymi dostawcami) i dodatkowo
plik **CSV** (do map i aplikacji); TERYT czytany jako tekst (nie traci zera na początku).

## Commity przyrostu

`git log --oneline -- portal/` – po kolei:

| Commit | Co |
|---|---|
| `b229557` | Import: kod źródłowy portalu dane.gov.pl (mcod-backend 2.62.3, commit 00a0813) – bez zmian |
| `a57f34f` | Portal: .gitignore dla środowiska lokalnego |
| `1464bf3` | Wykaz AED: model – `Resource.contains_aed_list` + migracja 0075, `is_aed_list` (a) |
| `068b654` | Wykaz AED: `aed_constants.py` – 44 kolumny, pola wymagane, typy instytucji, kolumny wykazu zbiorczego (b) |
| `48fb8da` | Wykaz AED: walidacja pliku w panelu i w harvesterze CKAN (c) |
| `3184384` | Wykaz AED: pole w formularzu panelu, serializery API, filtr, dokument ES, fabryka, tłumaczenia (d) |
| `9bb5d27` | Wykaz AED: XML – `containsAedList`, XSD 1.14 (e) |
| `e5f4f91` | Wykaz AED: `create_main_aed_resource_task`, harmonogram 3:40, komenda, `AggregatedAEDInfo` + 0076 (f) |
| `eb7f4fc` | Środowisko lokalne: Dockerfile obrazu aplikacji za proxy HTTPS |
| `5a214fd` | Wykaz AED: `GET /aed-aggregated` (g) |
| `67ce118` | Wykaz AED: testy w stylu testów DGA (h) |

## Rejestr wykazów (propozycja, punkt „i” – bez kodu)

DGA i AED to dwa „wykazy zbiorcze” zbudowane tym samym schematem: znacznik na zasobie → walidacja wg stałych →
nocne łączenie → model `Aggregated…Info` → endpoint. Kolejny wykaz (np. toalety publiczne, punkty nieodpłatnej pomocy
prawnej) oznaczałby trzecią kopię tych samych ~1000 linii. Propozycja dla zespołu portalu: aplikacja `mcod/wykazy` z
rejestrem definicji wykazu (`kod`, `kolumny`, `wymagane`, `dozwolone_typy_instytucji`, `walidator_wiersza`,
`zbior_docelowy`, `harmonogram`) i jednym modelem `AggregatedListInfo(kod, resource, …)`; pole na zasobie zamiast
kolejnych `contains_*` – `list_kind`. DGA i AED stałyby się dwoma wpisami rejestru, a endpointy `/dga-aggregated` i
`/aed-aggregated` zostałyby jako aliasy `/wykazy/{kod}/aggregated`. Nie wdrażamy tego w hackathonie, żeby nie ruszać
działającego kodu DGA.

## Nasza aplikacja a portal (`PORTAL_API`)

`src/core/dostawcy.py` (`agreguj_z_portalu`): gdy w `.env` aplikacji ustawisz `PORTAL_API=https://api.mcod.local`
(albo adres API dane.gov.pl, gdy przyrost zostanie wdrożony), agregacja pobiera `GET {PORTAL_API}/aed-aggregated`,
potem plik CSV wykazu zbiorczego i ładuje wiersze z dostawcą i linkiem do zasobu z każdego wiersza. Bez `PORTAL_API`
działa dotychczasowa ścieżka (zbiory dostawców w `data/dostawcy` i wyszukiwanie w API dane.gov.pl). Test:
`tests/test_portal_wykaz.py`.
