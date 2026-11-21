# Mapa AED – wspólna lista AED w dane.gov.pl

Prototyp na HackNation 2026, zadanie Ministerstwa Cyfryzacji „Misja AED – dane na ratunek”. Dane o każdym AED publikuje na dane.gov.pl jego właściciel, na własnym koncie dostawcy, a portal łączy zbiory wielu dostawców we wspólną listę. Przygotowaliśmy wzorzec danych (44 pola) i kreator, który z formularza lub pliku tworzy komplet plików do publikacji, w tym XML zgodny ze schematem harvestera dane.gov.pl 1.13. Wspólna lista nie jest nowym zbiorem: każdy rekord pokazuje dostawcę, link do zbioru i datę danych, a zgłoszenia mieszkańców trafiają do tego dostawcy.

Źródło prawdy o rolach i procesach: [`docs/MODEL_ROL.md`](docs/MODEL_ROL.md). Treść zadania i regulamin: [strona zadania na hacknation.pl](https://hacknation.pl).

## Role

| Rola | Kto | Może | Nie może |
|---|---|---|---|
| Mieszkaniec | każda osoba, bez logowania | wyszukać AED; zobaczyć źródło i datę danych; wysłać zgłoszenie; potwierdzić AED | zmieniać dane |
| Dysponent (dostawca) | podmiot, który za dane odpowiada: właściciel, zarządca z umową albo fundacja, która sprawdziła AED na miejscu; zawsze po zalogowaniu | przygotować pliki; opublikować zbiór na swoim koncie; aktualizować własne rekordy; rozpatrywać zgłoszenia o swoich AED | zmieniać rekordy innych dostawców; publikować AED, za które nie odpowiada |
| Administrator (MC) | wyznaczeni pracownicy MC | prowadzić konta i wzorzec; uruchamiać agregację; monitorować aktualność i luki; obsługiwać zgłoszenia bez dostawcy; prowadzić akcję promocyjną | dodawać, poprawiać, usuwać rekordy AED; scalać duplikaty |
| Podmiot wspierający | fundacja, uczelnia, gmina wobec cudzych AED | pomagać dysponentom przygotować pliki; prowadzić lokalne akcje | publikować dane o cudzych AED |
| System agregujący | proces techniczny | pobierać i walidować zbiory; budować listę; wysyłać przypomnienia | zmieniać treść rekordów |

Zasada: dane o AED publikuje tylko podmiot, który za dane odpowiada – właściciel, zarządca z umową albo fundacja, która sprawdziła AED na miejscu – i zawsze po zalogowaniu. Uprawnienia sprawdza serwer przy każdej operacji, a każdy zapis trafia do dziennika zdarzeń. Dane z OpenStreetMap są tylko warstwą pomocniczą „Do sprawdzenia” – nie trafiają na listę ani do eksportu.

## Szybki start

### Cały system (backend + aplikacja)

```bash
cp .env.example .env
docker compose up --build
```

Aplikacja: http://localhost (port 80), API: http://localhost/api/v1, dokumentacja API: http://localhost/api/docs.

> Stan: konfiguracja gotowa, pierwsze zbudowanie obrazów przez zespół – sob wieczorem (wynik wpiszemy tutaj).

**Konta testowe** (hasła z pliku `.env`, domyślne z `.env.example`). Logowanie: link w stopce „Logowanie dla dostawców i administratorów” (`/logowanie`).

| Rola | Login | Hasło | Do czego |
|---|---|---|---|
| Dysponent (fikcyjny dostawca) | `dysponent` | `dysponent-demo` | Moje AED: dodanie i edycja własnych AED, „Pobierz pliki do publikacji”, zgłoszenia o własnych AED |
| Administrator | `administrator` | `administrator-demo` | Panel administratora: agregacja, luki, zgłoszenia bez dostawcy, przypomnienia, konta, dziennik zdarzeń |

Mapa, karty AED, zgłoszenia i eksport listy nie wymagają logowania. Dane do prototypu: `python -m scripts.seed --reset --osm full --lista auto`.

### Sama aplikacja (bez backendu, na danych przykładowych)

Wymaga Node.js 20+.

```bash
cd src/ui
npm install
npm run dev
```

Otwórz http://localhost:5173. Gdy API nie odpowiada, aplikacja sama przełącza się na dane przykładowe z `data/sample/` i pokazuje baner „Tryb demonstracyjny”.

## Dla zespołu

Jak każdy uruchamia Claude Code na tym repo ze swojego konta: [`docs/user/claude_code_dla_zespolu.md`](docs/user/claude_code_dla_zespolu.md).

## Ścieżki testowe dla jury

1. **Mieszkaniec.** „Znajdź AED” → najbliższe AED → karta: dostawca danych, link do zbioru, data danych i data weryfikacji; instrukcja dostępu przy zamkniętej szafce.
2. **Zgłoszenie.** Na karcie AED „Zgłoś problem z tym AED” (np. szafka zamknięta) → informacja, do którego dostawcy trafi uwaga. Dane na liście się nie zmieniają (K7).
3. **Dostawca.** `/logowanie` kontem `dysponent` → Moje AED → dodaj AED albo wgraj plik → raport ze wzorcem → „Pobierz pliki do publikacji” (CSV, XML harvestera 1.13, słownik, instrukcja). Publikację na swoim koncie w dane.gov.pl wykonuje dostawca (K11).
4. **Administrator.** `/logowanie` kontem `administrator` → Panel administratora → raport agregacji (zbiory na liście i poza nią), luki w gminach, zgłoszenia bez dostawcy. Administrator nie ma przycisków do edycji AED (K2).
5. **Warstwa „Do sprawdzenia”.** Mapa → warstwa OpenStreetMap: punkty bez dostawcy i bez daty, odróżnione od listy, z atrybucją ODbL (K5).
6. **Programista.** Stopka → „Eksport listy” (kompilacja zbiorów dostawców z identyfikatorem dostawcy i zbioru w każdym rekordzie) i „Dostawcy”.

## Architektura

```mermaid
flowchart LR
  D1[Dysponent A] & D2[Dysponent B] --> K[Kreator: formularz lub plik<br/>sprawdzenie ze wzorcem]
  K --> P[Pakiet: CSV + XML harvestera 1.13]
  P --> DGP[Konto dostawcy<br/>w dane.gov.pl]
  DGP --> AG[Agregacja: API 1.4<br/>bez scalania, z pochodzeniem]
  AG --> L[Wspólna lista: mapa, lista, eksport]
  M[Mieszkaniec] -- zgłoszenie --> Q[Kolejka dostawcy]
  Q --> D1
  O[OpenStreetMap ODbL] -. tylko warstwa „Do sprawdzenia”<br/>i mapa luk .-> L
```

- Kontrakt API: [`docs/CONTRACT.md`](docs/CONTRACT.md). Szczegóły techniczne backendu: `docs/tech/` (w toku).
- Wzorcowy zakres danych: [`deliverables/zakres_danych/`](deliverables/zakres_danych/) i [`docs/schema/`](docs/schema/).
- Aplikacja: [`src/ui/`](src/ui/) – React 19 + TypeScript + Vite, mapa Leaflet wywoływana bezpośrednio, build statyczny serwowany przez nginx z przekazaniem `/api` do backendu.

## Zgodność z dane.gov.pl

Model korzysta z mechanizmów, które portal już ma (MODEL_ROL §11): konta dostawców, harvester XML 1.13, komentarze do zbiorów i zasobów, częstotliwość aktualizacji z przypomnieniem. Pliki dostawcy: CSV (UTF-8, przecinek, RFC 4180) według wzorca 44 pól i XML harvestera zgodny z XSD. Eksport listy jest oznaczony jako kompilacja zbiorów dostawców i nie ma własnego pliku XML ani metadanych DCAT, bo lista nie ma dostawcy. Szczegóły: [`docs/tech/COMPLIANCE.md`](docs/tech/COMPLIANCE.md).

## Co w prototypie jest symulacją

- Dostawcy są fikcyjni (3), ich zbiory leżą w `data/dostawcy/` w kształcie odpowiedzi API 1.4 portalu.
- Zgłoszenia mieszkańców i przypomnienia o aktualizacji są symulowane w aplikacji; docelowo komentarze do zbiorów i powiadomienia dane.gov.pl.
- Logowanie kontami testowymi; docelowo login.gov.pl i uwierzytelnianie dwuskładnikowe.
- Prawdziwe zbiory AED samorządów z dane.gov.pl nie mają jeszcze 44 pól wzorca – agregacja pokazuje je w raporcie, nie na mapie.
- Kafelki mapy z serwera OpenStreetMap; przy wdrożeniu potrzebny własny serwer kafelków.

## Dostępność

Cel: WCAG 2.2 na poziomie AA. Wyniki testów i zrzuty: [`docs/a11y/raport.md`](docs/a11y/raport.md).

- Lista najbliższych AED i lista na mapie zawierają te same informacje co mapa.
- Stan „dostępne teraz” jest zawsze pokazywany ikoną i tekstem, a na mapie kolorem, kształtem i znaczkiem.
- Pełna obsługa klawiaturą, link „Przejdź do treści”, widoczny fokus, cele dotykowe min. 44×44 px.
- Formularze: etykiety, podpowiedzi, błędy przy polach i w podsumowaniu, bez limitu czasu, bez danych osobowych.
- Układ działa od 320 px szerokości.

## Akcja „AED w danych” (materiały dla dostawców)

Logo „AED w danych” i hasło „Dane prosto z serca” służą akcji skierowanej do właścicieli AED, którzy nie mają jeszcze zbioru na dane.gov.pl – nie są marką aplikacji. Wezwanie: „Masz AED? Udostępnij je na dane.gov.pl”. Mapa luk i warstwa OSM wskazują gminy, do których akcja trafia najpierw. Pliki logotypu i księga znaku: [`brand/`](brand/).

## Licencje

- Kod: zależności wyłącznie na licencjach MIT, BSD, Apache-2.0 lub ISC (sprawdzenie: `cd src/ui && npm run licenses`). Mapa: Leaflet (BSD-2-Clause) bez react-leaflet.
- Kafelki mapy i dane OpenStreetMap: © autorzy OpenStreetMap, licencja ODbL.
- Dostawcy i ich zbiory w prototypie są fikcyjni.

## Zakres użycia AI

Opis: [`docs/AI_USAGE.md`](docs/AI_USAGE.md).
