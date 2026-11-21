# Prezentacja – „Mapa AED: wspólna lista AED w dane.gov.pl” (treść slajdów, v2)

> Model: `docs/MODEL_ROL.md` (CR-TL-5). Wymagania formalne (treść zadania, pkt 4): min. 5 slajdów z dowodami realizacji wymagań technicznych (zrzuty ekranu), opis funkcjonalności z krokami użytkownika, lista ograniczeń. PDF ≤ 10 MB.
> Liczby: tylko z `docs/tech/LICZBY.md` **po regeneracji przez A** (model listy). Wartości poniżej są z wersji 18:13 – przed eksportem PDF sprawdzić każdą (oznaczenie ⟲).
> Zrzuty: `pitch/zrzuty/` (PNG 1440×900, 01 i 03 dodatkowo 390×844), po scaleniu A i `seed --lista auto`. Bez danych osobowych.
> Logo „AED w danych” to materiał akcji dla dostawców, nie marka aplikacji ani prezentacji – pojawia się tylko na slajdzie 7.

---

## Slajd 1 – Mapa AED: wspólna lista AED w dane.gov.pl

Dane o każdym AED publikuje jego właściciel. Portal łączy zbiory dostawców we wspólną listę.

Zespół [NAZWA ZESPOŁU] · HackNation 2026 · zadanie Ministerstwa Cyfryzacji „Misja AED – dane na ratunek”

---

## Slajd 2 – Problem: nikt nie odpowiada za dane o AED

3 marca w centrum Warszawy świadkowie zatrzymania krążenia szukali defibrylatora. Kilka urządzeń było zamkniętych na klucz.

Danych nie brakuje – brakuje kogoś, kto za nie odpowiada:
- w OpenStreetMap jest ponad 18 tys. AED ⟲,
- tylko co szósty (17%) ma datę sprawdzenia z ostatnich 12 miesięcy ⟲,
- dwie trzecie nie mają żadnej daty weryfikacji ⟲,
- 351 z 2 479 gmin nie ma w danych ani jednego AED ⟲.

Te punkty wpisują wolontariusze. Nikt nie potwierdza, że urządzenie wciąż wisi i działa.

[ZRZUT 02_warstwa_osm: mapa z warstwą „Do sprawdzenia” – tysiące punktów OSM bez daty i bez odpowiedzialnego]

---

## Slajd 3 – Model ról: każdy rekord ma jednego dostawcę

| Rola | Może | Nie może |
|---|---|---|
| Mieszkaniec | znaleźć AED, zobaczyć źródło i datę, zgłosić problem | zmieniać danych |
| Dysponent (dostawca) | przygotować pliki, opublikować zbiór na **swoim** koncie, rozpatrywać zgłoszenia | publikować cudzych AED, zmieniać cudzych rekordów |
| Administrator (MC) | prowadzić konta i wzorzec, uruchamiać agregację, pokazywać luki, prowadzić akcję | dodawać, poprawiać, usuwać rekordów AED |
| OpenStreetMap | wskazywać luki (warstwa „Do sprawdzenia”) | trafić na listę ani do eksportu |

Dane płyną w jedną stronę: dysponent → dane.gov.pl → wspólna lista. Zgłoszenia wracają do dysponenta. Uprawnienia sprawdza serwer, każdy zapis trafia do dziennika zdarzeń (testy K1–K11).

Korzystamy z mechanizmów, które portal już ma: konta dostawców, harvester XML 1.13, komentarze do zbiorów, przypomnienia o aktualizacji.

---

## Slajd 4 – Dostawca: kreator i pakiet do publikacji

Kroki dysponenta (urząd, szkoła, szpital, firma):
1. Loguje się (w prototypie konto testowe, docelowo login.gov.pl) → **Moje AED**.
2. Dodaje AED w formularzu albo wgrywa plik; kreator sprawdza dane ze wzorcem 44 pól.
3. **„Pobierz pliki do publikacji”**: CSV wg wzorca, XML harvestera 1.13 zgodny z XSD, słownik pól, instrukcja.
4. Publikuje zbiór na **własnym koncie** w dane.gov.pl – wgrywa pliki albo podaje adres https pliku XML, który portal pobiera cyklicznie.

Nie ma przycisku „Opublikuj”: zespół ani administrator niczego nie publikują w imieniu dysponenta (K11).

Wzorzec: `deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx` – m.in. godziny dostępności w zapisie maszynowym, zamknięta szafka i instrukcja dostępu, data i metoda weryfikacji, kod TERYT gminy.

[ZRZUT 04_moje_aed_pliki: Moje AED z przyciskiem „Pobierz pliki do publikacji”]

---

## Slajd 5 – Wspólna lista: widok z pochodzeniem, nie nowy zbiór

Kroki mieszkańca (telefon):
1. „Znajdź AED” → najbliższe AED z informacją, czy jest dostępne teraz.
2. Karta AED: **dostawca danych, link do zbioru, data danych, data weryfikacji**; instrukcja dostępu przy zamkniętej szafce.

Reguły listy:
- tylko zbiory dostawców zgodne ze wzorcem; rekordy bez zmian, bez scalania,
- rekordy różnych dostawców bliżej niż 25 m – oba widoczne, oznaczone „możliwy duplikat”,
- tryb „Aktualność danych” rozróżnia **zbiór po terminie** (dostawca nie zaktualizował) i **rekord do weryfikacji** (AED nie sprawdzone od roku),
- eksport listy to kompilacja: każdy rekord niesie dostawcę, zbiór i warunki ponownego wykorzystania.

[ZRZUT 01_mapa_karta: mapa i karta AED z dostawcą, zbiorem i datą (1440×900 i 390×844)]

---

## Slajd 6 – Zgłoszenia wracają do dostawcy

1. Mieszkaniec na karcie AED: „Zgłoś problem z tym AED” → np. „szafka zamknięta”.
2. Widzi, do kogo trafi uwaga: do dostawcy, który odpowiada za ten rekord.
3. Dane na liście się nie zmieniają – o zmianie decyduje dostawca (K7).
4. AED spoza listy → kolejka administratora: zaproszenie właściciela do publikacji, nigdy wpis na listę (K8).

Docelowo zamiast kolejki w aplikacji: komentarze do zbiorów i zasobów w dane.gov.pl.

[ZRZUT 03_zgloszenie: zgłoszenie z informacją „trafi do: [dostawca]” (1440×900 i 390×844)]

---

## Slajd 7 – Akcja „AED w danych” dla dostawców danych

**AED w danych · Dane prosto z serca**
Masz AED? Udostępnij je na dane.gov.pl

- **Adresaci:** właściciele AED bez zbioru na dane.gov.pl – urzędy, szkoły, szpitale, uczelnie, dworce, galerie handlowe, firmy.
- **Kierowanie:** mapa luk w gminach i warstwa OSM pokazują, gdzie zacząć.
- **Znak:** serce z 16 zaokrąglonych kwadratów jak komórki arkusza – każda komórka to jeden wiersz danych, czyli jeden defibrylator. Bursztynowa komórka to „Twoje AED” – wiersz, którego jeszcze brakuje.
- **Materiały:** plakat, e-mail do instytucji, odznaka „Nasze AED jest w danych”, naklejka na szafkę z kodem QR do karty AED.
- **Księga znaku:** kolorystyka, pole ochronne, minimalna wielkość, niedozwolone użycia (`brand/ksiega_znaku.pdf`).

[ZRZUT 06_admin_luki: mapa luk – gminy bez dostawcy, cel akcji]
[logotyp: brand/logo.png]

---

## Slajd 8 – Administrator: agregacja i luki

1. Panel administratora → raport agregacji: zbiory na liście, zbiory po terminie, zbiory poza listą z powodem (np. bez 44 pól wzorca).
2. Luki: gminy bez żadnego dostawcy, z liczbą punktów OSM do sprawdzenia.
3. Zgłoszenia bez dostawcy, przypomnienia o aktualizacji, dziennik zdarzeń.
4. Administrator nie ma żadnego przycisku do zmiany danych AED (K2).

[ZRZUT 05_admin_agregacja: raport agregacji]

---

## Slajd 9 – Zgodność z dane.gov.pl

| Plik dostawcy | Wymóg |
|---|---|
| CSV wg wzorca | UTF-8, przecinek, RFC 4180, jeden wiersz nagłówka, 44 pola, WGS 84 |
| `aed_harvester.xml` | schemat harvestera 1.13 (XSD): responsibilities, regions/terytIdent (do 20 gmin), updateFrequency, adresy https, słownik jako supplements |
| słownik pól | opis wzorca dołączony do zbioru |

- Eksport listy oznaczony jako kompilacja; lista nie ma własnego XML ani metadanych DCAT, bo nie ma dostawcy.
- OSM (ODbL) nie trafia do zbiorów na dane.gov.pl – licencja wymaga tej samej licencji dla baz pochodnych.
- Bez danych osobowych: kontakt tylko służbowy; e-mail w zgłoszeniu opcjonalny i usuwany po zamknięciu.

Przykładowy pakiet: `deliverables/pakiet_dostawcy_przyklad/`

[ZRZUT: fragment aed_harvester.xml z pakietu]

---

## Slajd 10 – Dostępność, ograniczenia, zakres AI

**Dostępność (WCAG 2.2 AA) i responsywność**
- Mapa ma równorzędną listę; stan nie jest przekazywany tylko kolorem; pełna obsługa klawiaturą; od 320 px szerokości.
- Wyniki testów: [UZUPEŁNIĆ: axe, Lighthouse, NVDA – docs/a11y/]

**Ograniczenia prototypu**
- Dostawcy są fikcyjni (3), ich zbiory w kształcie odpowiedzi API 1.4 portalu.
- Prawdziwe zbiory AED samorządów na dane.gov.pl nie mają jeszcze 44 pól wzorca – są w raporcie agregacji, nie na mapie.
- Zgłoszenia i przypomnienia są symulowane w aplikacji (docelowo komentarze i powiadomienia portalu).
- Logowanie kontami testowymi (docelowo login.gov.pl i 2FA).
- „Dostępne teraz” rozumie najczęstszy zapis godzin; inny zapis → „Sprawdź godziny na miejscu”.
- Kafelki mapy z serwera OpenStreetMap – przy wdrożeniu potrzebny własny serwer kafelków.
- Terminy (7, 14, 30 dni, 12 miesięcy) i próg 25 m do potwierdzenia z MC (MODEL_ROL §13).

**Zakres użycia AI (§2 ust. 8 regulaminu):** [UZUPEŁNIĆ z docs/AI_USAGE.md – co zrobiła AI, co zespół]

**Dalej:** pilotaż z jedną gminą jako pierwszym dostawcą, słowo kluczowe listy uzgodnione z MC, zgłoszenia przez komentarze portalu.
