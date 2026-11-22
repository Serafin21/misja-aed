# Instrukcja dla jury – MKS 

**Prototyp online: https://misja-aed.onrender.com/** – bez instalacji i konfiguracji.

> Serwer zasypia po 15 minutach bez ruchu. Jeśli strona ładuje się dłużej, poczekaj do 2–3 minut i odśwież – serwer się budzi i wczytuje dane.

**Film demo (do 2 min): – najszybszy sposób, żeby zobaczyć całe rozwiązanie.

## Krok po kroku (ok. 10 minut)

1. Otwórz **https://misja-aed.onrender.com/**.
2. Kliknij **„Znajdź AED”**. Wpisz miejscowość (np. „Krosno”) albo kliknij **„Moja lokalizacja”**.
3. Kliknij AED na liście → **„Szczegóły”**. Na dole karty, w sekcji **„Skąd są te dane i kto za nie odpowiada”**, jest dostawca danych, link do zbioru w dane.gov.pl i data danych.
4. Na mapie: punkty **„Do sprawdzenia”** pochodzą z OpenStreetMap i nie należą do wspólnej listy (nikt za nie nie odpowiada).
5. W stopce kliknij **„Dla instytucji”** – jak instytucja publikuje wykaz AED w panelu dane.gov.pl, szablon pliku i typowe komunikaty walidacji portalu.
6. W stopce kliknij **„Akcja „AED w danych””** – hasło, logotyp i księga znaku (PDF).
7. Kliknij **„Zaloguj się, aby dodać AED”**, login **`admin`**, hasło **`admin123`** → **„Panel moderacji prototypu”**: konta instytucji, zgłoszenia AED, zbiory dostawców. To **tryb pokazowy prototypu** – docelowo dane zmienia wyłącznie dostawca w panelu dane.gov.pl (`docs/MODEL_ROL.md`).

## Zmiana w portalu dane.gov.pl

Portal (backend dane.gov.pl z naszą zmianą) uruchomiliśmy lokalnie – zrzuty z działającego portalu: `pitch/zrzuty/01`–`06` (pole „Zawiera wykaz AED”, odrzucony plik z błędami, wykaz zbiorczy, odpowiedź `/aed-aggregated`).

Kod przeczytacie w repozytorium, bez dostępu do zewnętrznych domen:

1. `git clone https://github.com/Serafin21/misja-aed` i `cd misja-aed`.
2. `git log --oneline -- portal/` – pierwszy commit to **oryginalny kod dane.gov.pl bez zmian** (`portal/IMPORT.md`), każdy następny to nasz przyrost „Wykaz AED: …”.
3. `portal/README.md` – jak to działa, tabela „gdzie wzór DGA, gdzie Wykaz AED” z numerami linii i kroki uruchomienia portalu.

## Gdzie jest każde wymaganie z treści zadania

| Wymaganie | Gdzie |
|---|---|
| Opis i tytuł | `SUBMISSION.md`, `pitch/opis_projektu.md` |
| Prezentacja | `pitch/prezentacja.pdf` |
| Film demo (do 2 min) | `pitch/demo.mp4` – całe rozwiązanie w 2 minuty |
| Prototyp | https://misja-aed.onrender.com/ |
| Wzorcowy zakres danych (XLSX) | `deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx` |
| Kod źródłowy | to repozytorium (`src/` – aplikacja, `portal/` – zmiana w portalu) |
| Logotyp (JPG, PNG, PDF, SVG) i księga znaku (PDF) | `brand/` |
| Dane w formatach maszynowych | `deliverables/dataset/` (CSV, GeoJSON, JSON-LD), API `/api/v1/docs` |
| Zgodność z zasadami dane.gov.pl | `portal/README.md`, `docs/tech/COMPLIANCE.md` |
| WCAG i responsywność | `docs/a11y/raport.md` |
| Zakres użycia AI | `docs/AI_USAGE.md` |

## Uruchomienie u siebie (opcjonalnie)

Wymaga Dockera:

```bash
cp .env.example .env
docker compose up --build
```

Aplikacja: http://localhost, konto `admin` / `admin123`.
