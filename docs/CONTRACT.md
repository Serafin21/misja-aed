# CONTRACT v2.2 – Misja AED (Ministerstwo Cyfryzacji, Departament Zarządzania Danymi)

> Wspólny plik: edytuje tylko Team Leader. Zamrożenie: sob 15:00 (po konsultacji na stoisku danych). Zmiany wyłącznie przez CR (tabela na końcu).
> **Od v2.0 obowiązuje model ról i odpowiedzialności: `docs/MODEL_ROL.md`.** Dane o AED publikuje wyłącznie właściciel urządzenia (dostawca) na własnym koncie w dane.gov.pl; wspólna lista łączy zbiory dostawców bez zmian; administrator (MC) nie wprowadza danych; OSM to tylko warstwa pomocnicza „Do sprawdzenia”.
> Źródło prawdy dla danych: `docs/schema/` (JSON Schema, słownik danych, słowniki wartości, CSVW, przykład XML importu) i `deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx`. Wszystkie te pliki powstały z jednej definicji, więc są spójne.

## 1. Zasady

- REST API w JSON pod prefiksem `/api/v1`. Odpowiedzi list: `{"data": [...], "meta": {"count", "page", "per_page"}, "links": {"self", "next", "prev"}}` (styl JSON API – wymóg Standardu technicznego dla JSON na poziomie 3: stronicowanie, filtrowanie). Wzór: `data/sample/api_aed_strona1.json`.
- Błędy: `{"error": {"code": "...", "message": "...po polsku...", "fields": {"pole": "komunikat"}}}`; walidacja → HTTP 422.
- Formaty danych według Standardu technicznego dane.gov.pl: wartości logiczne `true`/`false`, kropka dziesiętna bez separatorów tysięcy, daty `yyyy-mm-dd`, data i czas `yyyy-mm-ddThh:mm`, jedna wartość w jednym polu, adres w osobnych polach.
- Współrzędne: WGS 84 (EPSG:4326), stopnie dziesiętne, 6 miejsc po przecinku. Strefa czasowa obliczeń „dostępne teraz”: Europe/Warsaw.
- Model A publikuje `docs/tech/openapi.json` przy każdej synchronizacji. Model B do czasu gotowości API pracuje na `data/sample/`.

## 2. Rekord AED – wzorcowy zakres danych v0.9 (44 pola, 24 wymagane)

Pełne opisy, przykłady, słowniki i mapowanie na OpenStreetMap i schema.org: `docs/schema/slownik_danych.csv` i plik XLSX.

| Pole | Obowiązkowość | Typ | Format |
|---|---|---|---|
| `id_aed` | wymagane | tekst | ^AED-PL-[0-9A-F]{10}$ |
| `id_dysponenta_aed` | zalecane | tekst | maks. 50 znaków |
| `nazwa_obiektu` | wymagane | tekst | maks. 200 znaków |
| `opis_lokalizacji` | wymagane | tekst | maks. 250 znaków |
| `pietro` | zalecane | liczba całkowita | -5…100 |
| `wewnatrz_budynku` | wymagane | logiczny | true | false |
| `wojewodztwo` | wymagane | tekst (słownik) | słownik: wojewodztwo |
| `powiat` | zalecane | tekst | – |
| `gmina` | wymagane | tekst | – |
| `miejscowosc` | wymagane | tekst | – |
| `ulica_cecha` | zalecane | tekst (słownik) | słownik: ulica_cecha |
| `ulica` | zalecane | tekst | – |
| `numer_budynku` | wymagane | tekst | maks. 10 znaków |
| `numer_lokalu` | opcjonalne | tekst | maks. 10 znaków |
| `kod_pocztowy` | wymagane | tekst | ^\d{2}-\d{3}$ |
| `teryt_terc` | zalecane (na wspólnej liście wymagane) | tekst | ^\d{7}$ – kod TERYT gminy, 7 cyfr |
| `teryt_simc` | zalecane | tekst | ^\d{7}$ |
| `szerokosc_geograficzna` | wymagane | liczba dziesiętna | 49.000000…54.900000 |
| `dlugosc_geograficzna` | wymagane | liczba dziesiętna | 14.100000…24.200000 |
| `dostep` | wymagane | tekst (słownik) | słownik: dostep |
| `godziny_dostepnosci` | wymagane | tekst | składnia opening_hours |
| `dostepny_24h` | wymagane | logiczny | true | false |
| `szafka_zamknieta` | wymagane | logiczny | true | false |
| `instrukcja_dostepu` | zalecane | tekst | maks. 250 znaków |
| `mobilny` | wymagane | logiczny | true | false |
| `status_urzadzenia` | wymagane | tekst (słownik) | słownik: status_urzadzenia |
| `tryb_pediatryczny` | zalecane | logiczny | true | false |
| `producent` | opcjonalne | tekst | – |
| `model` | opcjonalne | tekst | – |
| `data_waznosci_elektrod` | zalecane | data | yyyy-mm-dd |
| `data_ostatniego_przegladu` | zalecane | data | yyyy-mm-dd |
| `dysponent_nazwa` | wymagane | tekst | maks. 250 znaków |
| `dysponent_typ` | wymagane | tekst (słownik) | słownik: dysponent_typ |
| `dysponent_regon` | zalecane | tekst | ^\d{9}(\d{5})?$ |
| `kontakt_telefon` | zalecane | tekst | ^(\+48)?\d{9}$ |
| `kontakt_email` | zalecane | tekst | adres e-mail |
| `zrodlo_danych` | wymagane | tekst (słownik) | słownik: zrodlo_danych |
| `licencja` | wymagane | tekst (słownik) | słownik: licencja |
| `data_weryfikacji` | wymagane | data | yyyy-mm-dd |
| `metoda_weryfikacji` | wymagane | tekst (słownik) | słownik: metoda_weryfikacji |
| `data_aktualizacji` | wymagane | data i czas | yyyy-mm-ddThh:mm |
| `kompletnosc` | zalecane | liczba całkowita | 0…100 |
| `zdjecie_url` | opcjonalne | URL | https://… |
| `uwagi` | opcjonalne | tekst | maks. 500 znaków |

**Kompletność** = odsetek wypełnionych pól wymaganych i zalecanych (0–100), liczona przy każdym zapisie.

## 3. Zasoby

- **Zbiór dostawcy** (publikuje dostawca na swoim koncie w dane.gov.pl): `aed-<dostawca>.csv` (44 pola wzorca, UTF-8, przecinek, wiersz nagłówka), `aed_harvester.xml` (schemat 1.13), słownik pól jako `supplements`. Wymagania: `docs/MODEL_ROL.md` §6 (słowo kluczowe `wspolna-lista-aed`, `teryt_terc` w każdym rekordzie, `regions/terytIdent`, `responsibilities`, `updateFrequency` od daily do yearly, adresy https, tylko urządzenia dostawcy, nigdy dane OSM).
- **Wspólna lista** (`GET /eksport/{plik}`) to kompilacja zbiorów dostawców, nie zbiór: `aed.csv` = 44 pola + `dostawca, dostawca_regon, zbior_id, zbior_url, zasob_url, data_danych, licencja_zbioru, mozliwy_duplikat`; `aed.geojson`, `aed.jsonld`; `aed_pochodzenie.csv` (rekord → dostawca, zbiór, zasób, data danych, aktualność zbioru); `zrodla.csv` (zbiory dostawców); `slownik_danych.csv`, `aed.csvw.json`. Lista nie ma własnego pliku XML ani metadanych DCAT – nie ma dostawcy.
- **Warstwa pomocnicza OSM** (ODbL) – tylko na mapie, z atrybucją „© współtwórcy OpenStreetMap”; nie trafia do listy, eksportu ani zbiorów dostawców.

## 4. Przepływ danych (MODEL_ROL.md §5)

1. **Kreator dostawcy (P2):** formularz pojedynczego AED albo plik (CSV, XLSX, JSON, GeoJSON) → mapowanie kolumn → normalizacja (`TAK/NIE` → `true/false`, przecinek → kropka, adres w jednym polu → pola, „pn-pt 8-16” → `Mo-Fr 08:00-16:00`) → walidacja ze wzorcem; `teryt_terc` uzupełniany z położenia (PRG). Wynik trafia do **kopii roboczej** dostawcy, nie na listę.
2. **Pliki do publikacji (P3, K11):** `POST /moje-aed/pakiet` → ZIP (CSV, XML harmonizatora, słownik, metadane, instrukcja). Dostawca publikuje je sam na swoim koncie w dane.gov.pl; aplikacja nie ma funkcji „Opublikuj”.
3. **Agregacja (P5):** zbiory oznaczone `wspolna-lista-aed` (prototyp: 3 fikcyjnych dostawców w `data/dostawcy/`, w kształcie odpowiedzi API 1.4) → walidacja zbioru i rekordów → lista. Rekord niezgodny ze wzorcem nie trafia na mapę; dostawca dostaje raport. Lista niczego nie poprawia i **nie scala** rekordów różnych dostawców; rekordy ≤ 25 m od siebie dostają `mozliwe_duplikaty`, oba zostają, obaj dostawcy dostają powiadomienie (P8). Zbiory AED w dane.gov.pl opublikowane przed wzorcem (bez słowa kluczowego i 44 pól), których plik da się odczytać → **zbiór przejściowy** (CR-TL-5): rekordy z położeniem pokazane bez zmian, `meta.zgodnosc = przejsciowy`, zaproszenie do wzorca; nieczytelne (PDF, brak pliku) → `poza_lista`. Agregacja: co noc (`AED_ODSWIEZANIE`), przy starcie i na żądanie administratora.
4. **Aktualność (§7, K9):** rekord „do weryfikacji” (`stan_danych = nieaktualne`), gdy `data_weryfikacji` > 12 mies. albo brak; zbiór „nieaktualny” (`zbior_nieaktualny`), gdy minął okres z `updateFrequency` + 30 dni (P9: przypomnienie dla dostawcy).
5. **Zgłoszenia mieszkańców (P6, P7):** z `id_aed` rekordu listy → kolejka i powiadomienie jego dostawcy, który decyduje `przyjete` / `odrzucone`; bez dostawcy (urządzenie spoza listy, punkt OSM) → kolejka administratora: `zaproszenie` / `odrzucone`. Zgłoszenie **nigdy nie zmienia danych**. Opis przechodzi filtr (bez e-maili, telefonów, linków); opcjonalny e-mail zgłaszającego jest usuwany po zamknięciu. Potwierdzenia „jest na miejscu” trafiają do dostawcy i są pokazywane osobno od daty weryfikacji.
6. **Zaufane konta i „Zgłoś AED” (MODEL_ROL v1.3, CR-TL-8):** instytucja składa wniosek o konto (bez logowania) → konto nieaktywne do decyzji administratora. Nowe AED zgłasza tylko zalogowana instytucja (adres + położenie, zdjęcie wymagane, bez „nie wiem”); administrator zatwierdza formalnie albo odsyła do poprawy z komentarzem, **bez edycji pól**; zatwierdzone AED → kopia robocza instytucji → pliki do publikacji (pkt 2). Zgłoszenia mieszkańców o istniejących AED (pkt 5) bez zmian.
7. **Rozliczalność (§9, K10):** każdy zapis – w dzienniku zdarzeń (kto, kiedy, operacja, obiekt, przed, po), którego nie da się zmienić ani usunąć.

## 5. Endpointy (role: MODEL_ROL.md §4; uprawnienia sprawdza serwer przy każdej operacji – zapis zawsze wymaga zalogowania)

| Metoda i ścieżka | Kto | Opis |
|---|---|---|
| `GET /aed` | publiczny | wspólna lista (domyślnie `warstwa=lista`; `pomocnicza` = OSM, `wszystkie`); filtry: `bbox`, `wojewodztwo` (po położeniu), `gmina`, `dostep`, `dostepne_teraz`, `stan_danych`, `q`, `ids`, `page`, `per_page`; w `meta` rekordu: `warstwa`, `dostawca`, `zbior_url`, `zasob_url`, `data_danych`, `zbior_nieaktualny`, `mozliwe_duplikaty`, `zgodnosc` (`wzorzec`/`przejsciowy`), `dostawca_podstawa` (`wlasciciel`/`zarzadca`/`weryfikujacy`, CR-TL-6) |
| `GET /aed/punkty?bbox=&warstwa=` | publiczny | warstwa mapy (domyślnie obie warstwy): `id`, współrzędne, `dostepny_teraz`, `stan_danych`, `warstwa`, `zbior_nieaktualny`, `duplikat`, `zgodnosc`, `dostep`, `wiek_danych_dni`, `mobilny`, `wojewodztwo`, `gmina_teryt`; gzip, `ETag` |
| `GET /aed/{id_aed}`, `GET /aed/najblizsze` | publiczny | rekord z pochodzeniem i potwierdzeniami; najbliższe (domyślnie z listy) |
| `GET /zbiory` | publiczny | dostawcy i zbiory: `status` = `wzorzec` / `przejsciowy` / `poza_lista`, `nieaktualny`, `rekordy`, `data_danych`, `licencja`, `problemy`; `meta.warstwa_pomocnicza` (CR-TL-5) |
| `GET /miejsca?q=&blisko=` | publiczny | wyszukiwarka miejsc (województwa, gminy, miejscowości, ulice, adresy); każdy wynik z `lat`, `lon`, `teryt_terc`; adres także `ulica`, `numer_budynku`, `kod_pocztowy`, `miejscowosc` |
| `GET /miejsca/odwrotnie?lat=&lon=` | publiczny | najbliższy adres („Użyj mojej lokalizacji”): `ulica`, `numer_budynku`, `kod_pocztowy`, `miejscowosc`, `gmina`, `wojewodztwo`, `teryt_terc`, `odleglosc_m` (CR-TL-8) |
| `POST /konta/wnioski` | publiczny | wniosek instytucji: `nazwa_instytucji`, `regon`, `podstawa` (`wlasciciel`/`zarzadca`/`weryfikujacy`), `email_sluzbowy`, `telefon`, `login`, `haslo` → 201 `{status: "oczekuje"}`; logowanie przed zatwierdzeniem → 403 `konto_oczekuje` |
| `GET /konta/wnioski?status=`, `POST /konta/wnioski/{id}/decyzja` | administrator | `{decyzja: "zatwierdz" albo "odrzuc", uzasadnienie}` (uzasadnienie wymagane przy odrzuceniu); wpis w dzienniku |
| `POST /konta/ja/uzytkownicy` | zatwierdzona instytucja | dodaje pracownika do swojej organizacji (te same uprawnienia; hasło jednorazowe) |
| `POST /zgloszenia-aed`, `PUT /zgloszenia-aed/{id}` | instytucja (bez logowania 401, administrator 403) | `nazwa_obiektu`, `ulica`, `numer_budynku`, `kod_pocztowy`, `miejscowosc`, `szerokosc`, `dlugosc`, `opis_lokalizacji`, `wewnatrz_budynku`, `dostep`, `dostepny_24h` albo `godziny`, `szafka_zamknieta` (true/false), `instrukcja_dostepu` (gdy zamknięta), `zdjecie` (wymagane; metadane usuwane); PUT = poprawa po `do_poprawy` |
| `GET /moje-zgloszenia` | instytucja | zgłoszenia AED organizacji: `status` (`oczekuje`/`zatwierdzone`/`do_poprawy`), `decyzja`, `komentarz`, `kto`, `kiedy`, `id_aed` (po zatwierdzeniu), `historia` |
| `GET /admin/zgloszenia-aed?status=`, `POST /admin/zgloszenia-aed/{id}/decyzja` | administrator | kolejka ze zdjęciem (`zdjecie_url`, podpisany link) i nadawcą; `{decyzja: "zatwierdz" albo "do_poprawy", komentarz}` – inne pola → 403 |
| `POST /aed`, `PATCH /aed/{id_aed}` | dostawca – tylko własne AED; administrator 403 | formularz kreatora → kopia robocza (K1, K2) |
| `POST /import`, `/import/{id}/mapowanie`, `/import/{id}/zatwierdz` | dostawca; administrator 403 | plik → kopia robocza; licencja CC0-1.0 albo CC-BY-4.0 |
| `GET /moje-aed`, `POST /moje-aed/z-opublikowanego`, `DELETE /moje-aed/{id}` | dostawca | kopia robocza, zgodność ze wzorcem, raport agregacji jego zbioru |
| `POST /moje-aed/pakiet` | dostawca | „Pobierz pliki do publikacji” (ZIP) – K11 |
| `GET /moje-aed/powiadomienia` | dostawca | zgłoszenia, potwierdzenia, duplikaty, walidacja, przypomnienia |
| `POST /zgloszenia` | publiczny | `lat`, `lon`, `opis`, `id_aed`, `typ` (`brak`, `awaria`, `brak_dostepu`, `bledne_polozenie`, `inne`, `nowe`), opcjonalnie `email`, `zdjecie`, `godziny_dostepnosci`, `szafka_zamknieta`, `instrukcja_dostepu` |
| `GET /zgloszenia`, `POST /zgloszenia/{id}/decyzja` | dostawca – o jego AED; administrator – bez dostawcy | decyzje bez zmiany danych (K7, K8) |
| `GET /zgloszenia/{id}/zdjecie?t=` | podpisany link z kolejki | zdjęcie ze zgłoszenia |
| `POST /aed/{id_aed}/potwierdzenia` | publiczny | „Paszport AED”; trafia do dostawcy |
| `POST /admin/agregacja`, `GET /admin/agregacja` | administrator | agregacja i raport walidacji zbiorów |
| `GET /admin/luki`, `GET/POST /admin/przypomnienia` | administrator | gminy bez dostawcy (z liczbą punktów OSM – cel akcji); zbiory po terminie |
| `GET /dziennik` | administrator | dziennik zdarzeń (tylko odczyt) |
| `GET/POST /konta`, `POST /konta/{login}/reset-hasla`, `PATCH /konta/{login}` | administrator | konta dostawców (organizacja = `dysponent_nazwa`, `dostawca_podstawa` wymagana), hasło jednorazowe, blokada |
| `GET /konta/ja`, `POST /konta/ja/haslo` | zalogowany | kim jestem, zmiana hasła |
| `GET /zrodla`, `POST /zrodla/odswiez`, `GET /zrodla/odswiezanie`, `POST /zrodla/osm/odswiez`, `POST /zrodla/dane-gov-pl/szukaj` | publiczny / administrator | źródła, odświeżanie (agregacja + OSM), podgląd zbiorów AED w dane.gov.pl (bez importu) |
| `GET /eksport`, `GET /eksport/{plik}`, `GET /szablon.csv`, `GET /szablon.xlsx` | publiczny | kompilacja listy (§3), szablony dla dostawców |
| `GET /statystyki`, `GET /pokrycie?wojewodztwo=` | publiczny | mierniki (§10 MODEL_ROL: dostawcy, AED na liście, % gmin z dostawcą, % zweryfikowanych), mapa luk (z liczbą punktów „do sprawdzenia”) |
| `POST /auth/login` | – | konta testowe `dysponent` (dostawca „Urząd Gminy Przykładowo”), `administrator` (alias `moderator`); konta dostawców zakłada administrator; docelowo login.gov.pl + 2FA |

## 6. Publikacja w dane.gov.pl

- Publikuje **wyłącznie dostawca**, na swoim koncie w dane.gov.pl: wgrywa pliki z kreatora albo podaje adres https pliku XML harmonizatora (portal pobiera go cyklicznie). Zespół projektu i administrator niczego nie publikują.
- XML harmonizatora: przestrzeń nazw **`urn:otwarte-dane:harvester:1.13`**, schemat portalu https://dane.gov.pl/static/xml/otwarte_dane_latest.xsd (kopia `docs/tech/otwarte_dane_1_13.xsd`); plik z kreatora przechodzi walidację XSD (test K3, `python scripts/check_xml.py <plik>`). Kategoria `HEAL`.
- Przykładowe pliki jednego dostawcy: `deliverables/pakiet_dostawcy_przyklad/`.

## 7. „Dostępne teraz”

Serwer interpretuje podzbiór składni opening_hours: `24/7`; dni `Mo Tu We Th Fr Sa Su` z zakresami (`Mo-Fr`); kilka reguł rozdzielonych `;`; przedziały `HH:MM-HH:MM`; `off`. Inny zapis → `dostepny_teraz: null` i komunikat „Sprawdź godziny na miejscu”. Rekord z `dostep = prywatny` nigdy nie jest „dostępny teraz” dla publiczności; z `mobilny = true` – pokazujemy z oznaczeniem „urządzenie w pojeździe”.

## 8. Mapa: tryby „dostępność” i „aktualność danych” (CR-TL-1)

Mapa ma dwa tryby. **Dostępność** – jak dotąd (§7, `dostepny_teraz`). **Aktualność danych** – pokazuje, gdzie dane są świeże, stare albo ich brak.

- Każdy rekord ma w `meta`: `stan_danych` = `aktualne`, gdy `data_weryfikacji` jest nie starsza niż **365 dni** (liczone w strefie Europe/Warsaw; dokładnie 365 dni = jeszcze `aktualne`), w przeciwnym razie `nieaktualne` – **także przy braku lub nieczytelnej dacie**. Do tego `meta.wiek_danych_dni` (liczba całkowita albo `null`, gdy daty brak).
- Brakującej daty weryfikacji nie zastępujemy dzisiejszą (np. rekord OSM bez `check_date` ma puste `data_weryfikacji`).
- `GET /aed?stan_danych=aktualne|nieaktualne` – filtr; inna wartość → 422.
- `GET /pokrycie?wojewodztwo=` (domyślnie `kujawsko-pomorskie`) → `FeatureCollection` (`application/geo+json`) granic gmin; w `properties`: `teryt` (TERC, 7 cyfr), `gmina`, `wojewodztwo`, `rodzaj`, `liczba_aed`, `aktualne`, `nieaktualne`, `stan` = `brak_danych` (0 AED) / `nieaktualne` (co najmniej jeden AED nieaktualny) / `aktualne` (wszystkie aktualne). `meta`: `liczba_gmin`, `gminy_wg_stanu`, `prog_aktualnosci_dni`, `atrybucja`. Brak granic dla województwa → 404 `brak_granic`. AED przypisujemy do gminy po położeniu (punkt w wielokącie), nie po polu `gmina`.
- Granice: Państwowy Rejestr Granic (GUGiK, usługa WFS) dla **wszystkich 16 województw** (2479 gmin), w `data/granice/` (plik na województwo). Uproszczone **z zachowaniem topologii**: wspólny odcinek granicy dwóch gmin jest upraszczany raz i identyczny w obu – bez szczelin i nakładek. AED poza wszystkimi wielokątami (np. na nabrzeżu) trafia do najbliższej gminy, jeśli jej granica jest w promieniu 1 km. Licencja i atrybucja („Źródło: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii”) w `zrodla.csv` jako źródło referencyjne `prg-gugik:gminy`.
- `GET /statystyki` ma dodatkowo `aktualne`, `nieaktualne` (liczby rekordów), `gminy_bez_danych` (cała Polska; rozbicie w `meta.gminy_liczone_dla`) i `wg_wojewodztw_polozenie` (województwo z położenia AED, bo rekordy OSM zwykle nie mają adresu).

## Rejestr zmian (CR)

| CR | Kto prosi | Zmiana | Decyzja | Wersja |
|---|---|---|---|---|
| CR-1 | Team Leader | Schemat XSD i przestrzeń nazw pliku XML importu | **rozwiązany**: `urn:otwarte-dane:harvester:1.13`, XSD portalu w `docs/tech/`; plik przechodzi walidację | 1.3 |
| CR-2 | Team Leader | Kategoria zbioru i warunki ponownego wykorzystania | do potwierdzenia na stoisku danych | – |
| CR-TL-1 | Team Leader | Mapa w dwóch trybach: „dostępność” i „aktualność danych”; `stan_danych` i `wiek_danych_dni` w `meta`, filtr `stan_danych`, `GET /pokrycie`, liczniki w `/statystyki` (§8) | przyjęta | 1.1 |
| CR-TL-2 | Team Leader | Zgłoszenia rozpatruje moderator albo dysponent (tylko swoich AED) – spójnie z API (§4 pkt 6, §5); `GET /aed/punkty` (lekka warstwa mapy, gzip, ETag); granice gmin dla 16 województw bez szczelin (§8) | przyjęta | 1.2 |
| CR-TL-3 | właściciel projektu | Odświeżanie źródeł (noc, start, przycisk), konta instytucji zakładane przez moderatora, zdjęcie i szczegóły w zgłoszeniu, import prawdziwych zbiorów AED samorządów z dane.gov.pl | przyjęta | 1.3 |
| CR-TL-4 | Team Leader | Model ról i odpowiedzialności (`docs/MODEL_ROL.md`): publikuje tylko dostawca, wspólna lista bez scalania, administrator bez zapisu do danych, OSM jako warstwa pomocnicza, kreator kończy się pobraniem plików, dziennik zdarzeń; `teryt_terc` 7 cyfr | przyjęta | 2.0 |
| CR-TL-5/6 | Team Leader | `GET /zbiory`, zbiory przejściowe (`meta.zgodnosc`), `meta.dostawca_podstawa` i podstawa publikacji przy koncie dostawcy | przyjęta | 2.1 |
| CR-TL-8 | Team Leader | Zaufane konta instytucji (wniosek → zatwierdzenie, pracownicy), „Zgłoś AED” tylko po zalogowaniu z zatwierdzeniem formalnym przez administratora, `GET /miejsca/odwrotnie`, `teryt_terc` w `/miejsca` (MODEL_ROL v1.3) | przyjęta | 2.2 |
