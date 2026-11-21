# Mapa AED – wspólna lista AED w dane.gov.pl

**Zadanie:** Misja AED – dane na ratunek (Ministerstwo Cyfryzacji, Departament Zarządzania Danymi), HackNation 2026
**Repozytorium:** https://github.com/Serafin21/misja-aed
**Model ról i odpowiedzialności:** `docs/MODEL_ROL.md`

> Liczby tylko z `docs/tech/LICZBY.md` po regeneracji przez A (oznaczenie ⟲ = sprawdzić przed finałem).

## Problem: nikt nie odpowiada za dane

3 marca w centrum Warszawy świadkowie zatrzymania krążenia szukali defibrylatora, a kilka urządzeń w okolicy było zamkniętych na klucz. Danych o AED nie brakuje: w OpenStreetMap jest ponad 18 tys. urządzeń ⟲. Ale tylko co szósty ma datę sprawdzenia z ostatniego roku ⟲, a za żaden punkt nikt nie odpowiada. Dane są rozproszone i niezweryfikowane, bo nie mają właściciela.

## Rozwiązanie: publikuje ten, kto odpowiada; portal łączy

Dane o AED publikuje tylko podmiot, który za dane odpowiada – właściciel, zarządca z umową albo fundacja, która sprawdziła AED na miejscu – i zawsze po zalogowaniu, na własnym koncie dostawcy w dane.gov.pl. Portal łączy zbiory wielu dostawców we wspólną listę. Nie tworzymy nowego zbioru i niczego nie publikujemy w niczyim imieniu.

1. **Wzorzec danych AED:** 44 pola, m.in. godziny dostępności w zapisie maszynowym, zamknięta szafka i instrukcja dostępu, data i metoda weryfikacji, kod TERYT gminy. Jedna definicja, z której powstają XLSX, słownik danych, JSON Schema i CSVW.
2. **Kreator dostawcy (Moje AED):** formularz albo plik → sprawdzenie ze wzorcem → „Pobierz pliki do publikacji”: CSV, XML harvestera dane.gov.pl 1.13 zgodny z XSD, słownik, instrukcja. Dostawca publikuje je na swoim koncie.
3. **Wspólna lista:** agregacja zbiorów dostawców (w prototypie w formacie odpowiedzi API 1.4 portalu), bez scalania i bez poprawiania rekordów. Każda karta AED pokazuje dostawcę, link do zbioru i datę danych. Możliwe duplikaty i zbiory po terminie są oznaczone.
4. **Zgłoszenia wracają do dostawcy:** mieszkaniec zgłasza problem przy konkretnym AED i widzi, do kogo trafi uwaga. Dane się nie zmieniają, dopóki dostawca nie zdecyduje. AED bez dostawcy trafia do administratora jako zaproszenie do publikacji.
5. **Administrator bez zapisu do danych:** raport agregacji, mapa luk w gminach, przypomnienia, konta, dziennik zdarzeń.
6. **Akcja „AED w danych” dla dostawców:** hasło „Dane prosto z serca”, wezwanie „Masz AED? Udostępnij je na dane.gov.pl”, logotyp i księga znaku – materiały akcji, nie marka aplikacji.

## Użytkownicy i ich kroki

**Mieszkaniec (telefon):** „Znajdź AED” → najbliższe AED z informacją, czy jest dostępne teraz → karta z dostawcą, zbiorem, datą i instrukcją dostępu → „Zgłoś problem z tym AED”.

**Dysponent (urząd, szkoła, szpital, firma):** logowanie → Moje AED → dodanie AED albo wgranie pliku → raport ze wzorcem → „Pobierz pliki do publikacji” → publikacja na własnym koncie w dane.gov.pl → aktualizacja w zadeklarowanym rytmie i odpowiedzi na zgłoszenia.

**Administrator (MC):** raport agregacji → luki w gminach → zgłoszenia bez dostawcy (zaproszenia) → przypomnienia dla zbiorów po terminie.

## Dane z OpenStreetMap

Tylko warstwa pomocnicza „Do sprawdzenia” i mapa luk. Nie trafiają na listę, do eksportu ani do zbiorów dostawców – licencja ODbL wymaga tej samej licencji dla baz pochodnych, a za te punkty nikt nie odpowiada.

## Zgodność z zasadami dane.gov.pl

Model korzysta z mechanizmów portalu: konta dostawców, harvester XML 1.13, komentarze do zbiorów, częstotliwość aktualizacji z przypomnieniem. Pliki dostawcy: CSV wg Standardu technicznego (UTF-8, przecinek, RFC 4180) i XML zgodny z XSD harvestera. Szczegóły: `docs/tech/COMPLIANCE.md`.

## Dostępność i responsywność

Cel: WCAG 2.2 na poziomie AA. Aplikacja działa od 320 px szerokości. Mapa ma równorzędną listę, stan „dostępne teraz” nie zależy tylko od koloru, pełna obsługa klawiaturą. Wyniki testów: `docs/a11y/`.

## Ograniczenia prototypu

- Dostawcy są fikcyjni (3); prawdziwe zbiory AED samorządów nie mają jeszcze 44 pól wzorca, więc są w raporcie agregacji, nie na mapie.
- Zgłoszenia i przypomnienia są symulowane w aplikacji (docelowo komentarze i powiadomienia portalu).
- Logowanie kontami testowymi (docelowo login.gov.pl i 2FA).
- „Dostępne teraz” rozumie najczęstszy zapis godzin; inny zapis → „Sprawdź godziny na miejscu”.
- Kafelki mapy z serwera OpenStreetMap.
- Terminy i progi (7, 14, 30 dni, 12 miesięcy, 25 m) do potwierdzenia z MC.

## Zakres użycia AI

Zgodnie z §2 ust. 8 regulaminu zadania: szczegóły w `docs/AI_USAGE.md`. Decyzje (model ról, wzorzec danych, nazwa, hasło, logotyp) podjął i sprawdził zespół.
