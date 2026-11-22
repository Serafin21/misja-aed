# Prezentacja – „Wykaz AED w dane.gov.pl + Mapa danych AED” (treść slajdów, v3, CR-TL-9)

> Zespół MKS. Model: `docs/MODEL_ROL.md` v2.1. Wymagania formalne (treść zadania, pkt 4): **min. 5 slajdów z dowodami realizacji wymagań technicznych (zrzuty ekranu), opis funkcjonalności z krokami użytkownika, lista ograniczeń**; PDF ≤ 10 MB → `pitch/prezentacja.pdf`.
> Dowody (zrzuty ekranu): slajdy 3, 4, 5, 6, 7, 8 (`pitch/zrzuty/`). Kroki użytkownika: slajd 9. Ograniczenia: slajd 10.
> Liczby tylko z `docs/tech/LICZBY.md`. Logo „AED w danych” tylko na slajdzie 8.

---

## Slajd 1 – Wykaz AED w dane.gov.pl

Jedna lista AED od wielu dostawców – w portalu dane.gov.pl, tak jak wykaz chronionych danych.

**Wykaz AED w portalu** + **Mapa danych AED** (strona odczytu) + **akcja „AED w danych”** dla dostawców.

Zespół MKS · HackNation 2026 · Misja AED – dane na ratunek

---

## Slajd 2 – Problem: dane o AED nie mają właściciela

- W OpenStreetMap jest **18 297** AED w Polsce, ale tylko **18%** znanych AED ma datę sprawdzenia z ostatnich 12 miesięcy.
- W **351 z 2 479** gmin nie ma w danych żadnego AED.
- Za punkty z OpenStreetMap nikt nie odpowiada. Zbiory samorządów w dane.gov.pl mają każdy inny układ.

Źródło: `docs/tech/LICZBY.md` (eksport AED OSM Polska, granice PRG).

**Wniosek:** potrzebna jest lista, w której każdy wiersz ma dostawcę, który za niego odpowiada.

---

## Slajd 3 – Rozwiązanie: portal scala wykazy wzorem DGA (dowód: kod portalu)

1. Dostawca w panelu dane.gov.pl zaznacza przy zasobie **„Zawiera wykaz AED”** (XML: `containsAedList`).
2. Portal sprawdza kolumny wzorca (44) i pola wymagane.
3. Nocne zadanie składa **„Wykaz AED – wykaz zbiorczy”** – nazwa dostawcy i link do źródła w każdym wierszu, bez scalania.
4. API **`/aed-aggregated`**.
5. **Mapa danych AED** czyta wykaz.

To zmiana w kodzie portalu, nie osobny system. **Katalog `portal/` – pierwszy commit to oryginalny kod dane.gov.pl, każdy następny to nasz przyrost (`git log -- portal/`).**

[ZRZUT 01_git_log_portal: `git log --oneline -- portal/` – import + commity „Wykaz AED: …”]
[ZRZUT 02_dga_vs_aed: tabela DGA → AED z `portal/README.md`]

---

## Slajd 4 – Dostawca publikuje w panelu dane.gov.pl (dowód)

- Pole „Zawiera wykaz AED” obok „Zawiera wykaz chronionych danych” (`mcod/resources/forms.py`).
- Publikować mogą wszystkie typy instytucji; jedna instytucja = jeden wykaz.
- Poprawka = nowa wersja pliku w tym samym zasobie. Nikt poza dostawcą nie zmienia jego wierszy.

[ZRZUT 03_panel_zasob: panel – zasób z „Zawiera wykaz AED” = Tak]

---

## Slajd 5 – Walidacja portalu (dowód)

Przykładowe komunikaty (`mcod/resources/aed_utils.py`):

- „Brak 3 z 44 kolumn wzorca AED: …”
- „wiersz 4: brak wartości: teryt_terc”
- „współrzędne … poza Polską (zamienione szerokość i długość?)”
- „Instytucja ma już opublikowany wykaz AED … – portal przechowuje jeden wykaz AED na instytucję.”

Testy: `mcod/resources/tests/test_aed.py` – 23 testy bez bazy przechodzą.

[ZRZUT 04_walidacja: komunikat walidacji w panelu albo wynik `portal/local/run_aed_tests.sh`]

---

## Slajd 6 – Wykaz zbiorczy i API (dowód zgodności z dane.gov.pl – 30%)

- Zasób **„Wykaz AED – wykaz zbiorczy”** w zbiorze Ministerstwa Cyfryzacji, CSV + XLSX, codziennie o 3:40.
- Kolumny: Lp., Nazwa dostawcy, Typ instytucji, Link do zasobu źródłowego, Data aktualizacji zasobu, 44 kolumny wzorca, Możliwy duplikat (≤ 25 m, różni dostawcy).
- `GET /aed-aggregated` → linki `csv_url`, `xlsx_url` – wzorem `/dga-aggregated`.
- Formaty maszynowe wg Standardu technicznego; XML harvestera 1.13 + propozycja 1.14 z `containsAedList` (`portal/xsd/`).

[ZRZUT 05_wykaz_zbiorczy: plik wykazu zbiorczego]
[ZRZUT 06_aed_aggregated: odpowiedź `/aed-aggregated`]

---

## Slajd 7 – Mapa danych AED: strona odczytu wykazu (dowód)

- Najbliższe AED, „otwarte teraz”, instrukcja przy zamkniętej szafce, „Nawiguj”.
- Przy każdym AED: dostawca, link do źródła, data danych.
- Oznaczenia: „Do sprawdzenia” (OpenStreetMap, poza listą), „Prototyp – nieopublikowane w dane.gov.pl” (dodane w aplikacji, poza wykazem).
- WCAG 2.2 AA, od 320 px szerokości (`docs/a11y/raport.md`).

[ZRZUT 07_mapa: Znajdź AED – lista i mapa]
[ZRZUT 08_karta: karta AED – „Skąd są te dane i kto za nie odpowiada”]

---

## Slajd 8 – Akcja „AED w danych” (25%)

**AED w danych · Dane prosto z serca** – Masz AED? Udostępnij je na dane.gov.pl

- Adresaci: instytucje bez wykazu AED w dane.gov.pl; najpierw gminy z luk.
- Znak: serce z 16 komórek arkusza – każda komórka to wiersz danych, bursztynowa to „Twoje AED”.
- Logotyp SVG, PNG, JPG, PDF i księga znaku: `brand/`. Strona „Dla instytucji”: instrukcja publikacji w krokach, szablon, typowe błędy walidacji.

[logotyp: brand/logo.png] [ZRZUT 09_dla_instytucji]

---

## Slajd 9 – Kroki użytkowników

**Dostawca:** szablon → plik → panel dane.gov.pl → Dodaj zasób → „Zawiera wykaz AED” → Zapisz → poprawki z komunikatu → następnego dnia w wykazie zbiorczym i na mapie.

**Mieszkaniec:** Znajdź AED → najbliższe otwarte → karta z dostawcą i instrukcją dostępu → Nawiguj → zgłoszenie trafia do dostawcy.

**Ministerstwo Cyfryzacji:** nie zmienia danych; prowadzi wzorzec, wykaz zbiorczy i akcję tam, gdzie brakuje dostawców.

**Programista / służby:** `GET /aed-aggregated` → CSV albo XLSX wykazu zbiorczego.

---

## Slajd 10 – Ograniczenia, zakres AI, dalej

**Ograniczenia**
- Portalu z Wykazem AED nie uruchomiliśmy w całości w środowisku hackathonu (blokada wtyczek Elasticsearch); 3 testy z bazą czekają na pełne środowisko.
- Edycja AED przez administratora aplikacji – tryb pokazowy prototypu, docelowo wyłączony.
- Bez `PORTAL_API` mapa czyta fikcyjnych dostawców i 3 zbiory samorządów sprzed wzorca (Krosno, Przemyśl, Marki – 50 AED).
- Zgłoszenia symulowane w aplikacji (docelowo komentarze do zasobu); logowanie testowe (docelowo login.gov.pl i 2FA).
- XSD 1.14 – propozycja; terminy i próg 25 m do potwierdzenia z MC.

**AI (§2 ust. 8):** Claude i Claude Code – kod, testy, teksty; decyzje (model ról, wzorzec, nazwa, hasło, koncepcja znaku) – zespół. `docs/AI_USAGE.md`.

**Dalej:** przegląd przyrostu z zespołem dane.gov.pl, pilotaż z jedną gminą, rejestr wykazów (`portal/README.md`, punkt „i”).
