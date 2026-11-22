# Jak uruchomić „Mapę danych AED” na swoim komputerze i sprawdzić najważniejsze funkcje

Instrukcja dla osoby, która **nie programuje i nie zna Gita**. Opisuje komputer z **Windows 10 lub 11**. Zajmie ok. **30–40 minut**, z czego większość to czekanie na pobieranie.

Na końcu każdego kroku jest **„Co powinieneś zobaczyć”** – jeśli widzisz coś innego, zajrzyj do części **„Gdy coś nie działa”** na dole.

> Ta instrukcja uruchamia **aplikację „Mapa danych AED” i jej serwer danych**. Zmiany w samym portalu dane.gov.pl („Wykaz AED”) są w katalogu `portal/` – jak je przejrzeć bez uruchamiania, opisuje część 9.

---

## Spis treści

1. [Zainstaluj trzy programy](#1-zainstaluj-trzy-programy)
2. [Otwórz Wiersz polecenia](#2-otwórz-wiersz-polecenia-cmd)
3. [Pobierz projekt z GitHuba](#3-pobierz-projekt-z-githuba)
4. [Przygotuj serwer danych](#4-przygotuj-serwer-danych)
5. [Wczytaj dane o AED](#5-wczytaj-dane-o-aed)
6. [Uruchom serwer danych (okno 1)](#6-uruchom-serwer-danych-okno-1)
7. [Uruchom stronę (okno 2)](#7-uruchom-stronę-okno-2)
8. [Sprawdź najważniejsze funkcje](#8-sprawdź-najważniejsze-funkcje)
9. [Zobacz zmiany w kodzie portalu dane.gov.pl](#9-zobacz-zmiany-w-kodzie-portalu-danegovpl)
10. [Jak wyłączyć i jak uruchomić ponownie](#10-jak-wyłączyć-i-jak-uruchomić-ponownie)
11. [Gdy coś nie działa](#11-gdy-coś-nie-działa)

---

## Zasady, które oszczędzą Ci kłopotów

- Używaj programu **„Wiersz polecenia” (cmd)**, a **nie** „Windows PowerShell”. Polecenia z tej instrukcji są pisane dla cmd.
- Polecenie **kopiuj w całości** z szarej ramki i **wklejaj prawym przyciskiem myszy** (albo Ctrl+V) w czarne okno. Potem naciśnij **Enter**.
- Każde polecenie zaczyna się od `cd /d …` – to „przejdź do folderu”. Dzięki temu nie musisz pamiętać, gdzie jesteś.
- Gdy polecenie pracuje, nic nie wpisuj. Skończyło, gdy na dole znów pojawi się linia kończąca się znakiem `>`, np. `C:\Users\Jan>`.
- Instrukcja zakłada, że projekt trafi do folderu **`C:\misja-aed`**. Jeśli chcesz inny folder, zmień tę ścieżkę we wszystkich poleceniach.

---

## 1. Zainstaluj trzy programy

Potrzebujesz trzech darmowych programów. Jeśli już je masz, przejdź do kroku 2.

### 1.1. Git (pobieranie projektu)

1. Wejdź na **https://git-scm.com/download/win** – pobieranie zacznie się samo.
2. Uruchom pobrany plik `Git-…-64-bit.exe`.
3. Na każdym ekranie klikaj **„Next”**, na końcu **„Install”**, potem **„Finish”**. Domyślne ustawienia są dobre.

### 1.2. Python 3.12 (serwer danych)

1. Wejdź na **https://www.python.org/downloads/** i kliknij żółty przycisk **„Download Python 3.12…”** (albo nowszy 3.x).
2. Uruchom pobrany plik.
3. **Ważne:** na pierwszym ekranie zaznacz na dole pole **„Add python.exe to PATH”**.
4. Kliknij **„Install Now”**, a na końcu **„Close”**.

### 1.3. Node.js 20 lub nowszy (strona)

1. Wejdź na **https://nodejs.org/** i pobierz wersję oznaczoną **„LTS”**.
2. Uruchom pobrany plik `.msi`, klikaj **„Next”**, zaakceptuj licencję, na końcu **„Install”** i **„Finish”**.

**Co powinieneś zobaczyć:** wszystkie trzy instalatory zakończyły się bez błędu. **Uruchom komputer ponownie** albo przynajmniej wyloguj się i zaloguj – wtedy Windows „zobaczy” nowe programy.

---

## 2. Otwórz Wiersz polecenia (cmd)

1. Naciśnij na klawiaturze **klawisz Windows + R**.
2. W okienku „Uruchamianie” wpisz **`cmd`** i naciśnij **Enter**.
3. Otworzy się czarne okno z napisem w rodzaju `C:\Users\TwojaNazwa>`.

Sprawdź, czy programy z kroku 1 działają. Wklej i naciśnij Enter:

```
git --version && python --version && node --version && npm --version
```

**Co powinieneś zobaczyć:** cztery linie z numerami wersji, np. `git version 2.4…`, `Python 3.12.…`, `v22.…`, `10.…`. Jeśli pojawia się „nie jest rozpoznawany jako polecenie” – patrz punkt 11.1.

---

## 3. Pobierz projekt z GitHuba

W tym samym oknie wklej:

```
cd /d C:\ && git clone https://github.com/Serafin21/misja-aed.git misja-aed
```

Pobieranie trwa ok. 1–2 minuty (projekt ma ok. 20 MB, bo zawiera kod portalu dane.gov.pl).

**Co powinieneś zobaczyć:** linie `Cloning into 'misja-aed'...`, `Receiving objects: 100%`, `Resolving deltas: 100%`. W Eksploratorze plików pojawi się folder **`C:\misja-aed`**.

> **Bez Gita:** na stronie https://github.com/Serafin21/misja-aed kliknij zielony przycisk **„Code” → „Download ZIP”**, rozpakuj plik i zmień nazwę rozpakowanego folderu na `misja-aed`, a potem przenieś go do `C:\`. Część 9 (historia zmian portalu) wymaga jednak Gita.

---

## 4. Przygotuj serwer danych

Wklej (to jedno polecenie, trwa 1–3 minuty):

```
cd /d C:\misja-aed && python -m venv .venv && .venv\Scripts\python -m pip install -r requirements.txt
```

Co to robi: tworzy w projekcie osobny „pojemnik” na Pythona (folder `.venv`) i instaluje do niego potrzebne biblioteki.

**Co powinieneś zobaczyć:** wiele linii `Collecting …`, a na końcu `Successfully installed … fastapi … uvicorn …`. Żółta uwaga o nowszej wersji `pip` nie przeszkadza.

---

## 5. Wczytaj dane o AED

Wklej (trwa 1–5 minut, potrzebny internet):

```
cd /d C:\misja-aed && .venv\Scripts\python -m scripts.seed --reset --osm full --lista auto
```

Co to robi: pobiera punkty AED z OpenStreetMap (warstwa „Do sprawdzenia”) i zbiory dostawców (fikcyjnych dostawców prototypu oraz prawdziwe zbiory AED samorządów z dane.gov.pl) i zapisuje je w lokalnej bazie.

**Co powinieneś zobaczyć:** na końcu linie podobne do:

```
Warstwa pomocnicza OSM (siec): 18310 punktów
Zbiór 3624 (Urząd Miasta Krosna): przejsciowy, na liście 21, odrzucone 0
...
Wspólna lista: 60 AED · warstwa pomocnicza: 18310 punktów
```

Liczby mogą się trochę różnić – dane w OpenStreetMap zmieniają się codziennie.

> **Bez internetu albo gdy to polecenie się nie powiedzie:** użyj wersji z małą próbką danych zapisaną w projekcie:
> ```
> cd /d C:\misja-aed && .venv\Scripts\python -m scripts.seed --reset --osm sample
> ```

---

## 6. Uruchom serwer danych (okno 1)

W tym samym oknie wklej:

```
cd /d C:\misja-aed && .venv\Scripts\python -m uvicorn src.api.main:app --port 8000
```

**Co powinieneś zobaczyć:**

```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Nie zamykaj tego okna i nic w nim nie wpisuj.** Serwer działa tylko wtedy, gdy to okno jest otwarte. Kolejne linie `INFO: … GET …` pojawiające się później są normalne – to zapytania ze strony.

---

## 7. Uruchom stronę (okno 2)

1. Otwórz **drugie** okno cmd: **Windows + R**, wpisz `cmd`, **Enter**.
2. Wklej (za pierwszym razem trwa 1–3 minuty):

```
cd /d C:\misja-aed\src\ui && npm install && npm run dev
```

**Co powinieneś zobaczyć:** na końcu ramkę w rodzaju:

```
  VITE v7.…  ready in … ms
  ➜  Local:   http://localhost:5173/
```

**Tego okna też nie zamykaj.**

3. Otwórz przeglądarkę (Chrome, Edge albo Firefox) i wpisz w pasku adresu: **http://localhost:5173**

**Co powinieneś zobaczyć:** stronę „Mapa danych AED” z sercem z kwadratów w lewym górnym rogu. **U góry NIE powinno być żółtego paska „Tryb demonstracyjny”.** Jeśli jest – strona nie łączy się z serwerem z okna 1 (punkt 11.4).

---

## 8. Sprawdź najważniejsze funkcje

Przejdź po kolei. Przy każdym punkcie jest, **co kliknąć** i **co powinno się pokazać**.

### 8.1. Znajdź najbliższe AED (mieszkaniec)

1. W menu u góry kliknij **„Znajdź AED”**.
2. W polu **„Gdzie jesteś?”** wpisz **`Krosno`**, poczekaj chwilę i wybierz z listy podpowiedzi **Krosno** (miasto w województwie podkarpackim).
3. **Powinno się pokazać:** po lewej lista AED, po prawej mapa przybliżona na Krosno, nad listą liczba AED.
4. Kliknij przycisk **„Moja lokalizacja”** w polu wyszukiwania. Przeglądarka zapyta o zgodę – kliknij **„Zezwól”**.
   **Powinno się pokazać:** lista najbliższych AED od Twojego miejsca, z odległością.

### 8.2. Karta AED – kto odpowiada za dane

1. Przy dowolnym AED na liście kliknij **„Szczegóły”**.
2. **Powinno się pokazać:** nazwa miejsca, czy AED jest teraz dostępne, godziny, informacja o szafce, adres.
3. Przewiń w dół do sekcji **„Skąd są te dane i kto za nie odpowiada”**.
   **Powinno się pokazać:** nazwa **dostawcy danych** (np. Urząd Miasta Krosna), **link do zbioru w dane.gov.pl** i **data danych**.
4. Punkty z OpenStreetMap mają oznaczenie **„Do sprawdzenia”** – za nie nikt nie odpowiada, dlatego nie należą do wykazu.

### 8.3. Zgłoszenie problemu z AED (bez logowania)

1. Na karcie AED kliknij **„Zgłoś problem z tym AED”**.
2. **Powinno się pokazać:** formularz z wyborem problemu (np. szafka zamknięta, brak urządzenia) i informacją, **do kogo trafi zgłoszenie** – do dostawcy, który odpowiada za te dane. Dane na mapie się od tego nie zmieniają.

### 8.4. Pierwsza pomoc

1. W menu kliknij **„Pierwsza pomoc”**.
2. **Powinno się pokazać:** kroki postępowania przy zatrzymaniu krążenia i zdjęcie przykładowego AED.

### 8.5. Dla instytucji – jak opublikować wykaz AED w dane.gov.pl

1. Przewiń stronę na sam dół i w stopce kliknij **„Dla instytucji”**.
2. **Powinno się pokazać:** instrukcja publikacji wykazu AED w panelu dane.gov.pl w krokach, szablon pliku do pobrania i typowe komunikaty walidacji.

### 8.6. Akcja „AED w danych” – logo i księga znaku

1. W stopce kliknij **„Akcja „AED w danych””**.
2. **Powinno się pokazać:** logo (serce z kwadratów), hasło **„Dane prosto z serca”**, wezwanie **„Masz AED? Udostępnij je na dane.gov.pl”**.
3. Na **stronie głównej**, na samym dole, kliknij link do **księgi znaku (PDF)**. Otworzy się w nowej karcie.
4. Przejdź na **ostatnią stronę** księgi i kliknij przy dowolnej wersji logo **SVG**, **PNG**, **JPG** albo **PDF**.
   **Powinno się pokazać:** otworzy się albo pobierze wybrany plik logo.

### 8.7. Dane dla programistów i dane.gov.pl

1. W stopce kliknij **„Eksport listy”**.
   **Powinno się pokazać:** pliki do pobrania (CSV, GeoJSON, JSON-LD) – kompilacja zbiorów dostawców, a w każdym wierszu dostawca i link do źródła.
2. W stopce kliknij **„Dostawcy”**.
   **Powinno się pokazać:** tabela zbiorów dostawców i ich status (zgodny ze wzorcem / przejściowy / poza listą) – m.in. Krosno, Przemyśl, Marki.
3. W nowej karcie przeglądarki otwórz **http://localhost:8000/api/v1/docs**.
   **Powinno się pokazać:** dokumentacja API (Swagger) z listą wszystkich adresów serwera danych.

### 8.8. Logowanie i panel moderacji (tryb pokazowy prototypu)

1. W stopce kliknij **„Logowanie dla dostawców i administratorów”**.
2. Wpisz login **`admin`** i hasło **`admin123`**, kliknij **„Zaloguj się”**.
3. **Powinno się pokazać:** w menu nowe pozycje, m.in. **„Zgłoszenia AED”** i **„Panel moderacji prototypu”** – wnioski instytucji o konto i zgłoszenia AED do zatwierdzenia.

> To **tryb pokazowy prototypu, docelowo wyłączony**. W docelowym rozwiązaniu dane publikuje i poprawia wyłącznie dostawca w swoim zasobie w dane.gov.pl, a portal tylko łączy wykazy (`docs/MODEL_ROL.md`).

4. Na koniec kliknij **„Wyloguj”**.

### 8.8a. Wniosek instytucji o konto (bez logowania)

1. Wyloguj się. W menu kliknij **„Zaloguj się, aby dodać AED”**, a na stronie logowania link do **wniosku o konto**.
2. **Powinno się pokazać:** formularz: nazwa instytucji, REGON, podstawa publikacji (właściciel / zarządca z umową / podmiot weryfikujący), e-mail służbowy, login i hasło. Konto zacznie działać dopiero po zatwierdzeniu przez administratora.

### 8.9. Telefon i dostępność

1. W Chrome naciśnij **F12**, a potem **Ctrl+Shift+M** (widok telefonu). U góry wybierz np. **iPhone 12 Pro**.
2. Odśwież stronę (**F5**) i otwórz „Znajdź AED”.
   **Powinno się pokazać:** strona bez przewijania w bok, mapa i lista jedna pod drugą, menu pod przyciskiem **„Menu”**.
3. Zamknij narzędzia klawiszem **F12**.
4. Spróbuj obsłużyć stronę samą klawiaturą: klawisz **Tab** przechodzi do kolejnych elementów, każdy zaznaczony element ma wyraźną ramkę. Pierwszy **Tab** pokazuje link **„Przejdź do treści głównej”**.

Wyniki testów dostępności (WCAG 2.2 AA): `docs/a11y/raport.md`.

---

## 9. Zobacz zmiany w kodzie portalu dane.gov.pl

Rdzeń rozwiązania – **„Wykaz AED”** – to zmiana w kodzie portalu dane.gov.pl, zrobiona wzorem istniejącego w portalu wykazu chronionych danych (DGA). Kod leży w repozytorium, więc można go przejrzeć **bez dostępu do zewnętrznych stron**.

1. Otwórz **trzecie** okno cmd (Windows + R, `cmd`, Enter) i wklej:

```
cd /d C:\misja-aed && git log --oneline -- portal/
```

**Co powinieneś zobaczyć:** listę zmian od najnowszej do najstarszej. **Ostatnia linia** to `… Import: kod źródłowy portalu dane.gov.pl (mcod-backend 2.62.3 …) – bez zmian` – oryginalny kod portalu. **Wszystkie linie nad nią** to nasze zmiany, większość zaczyna się od „Wykaz AED: …”.

2. Naciśnij **q**, jeśli lista się nie zamknęła sama.
3. Otwórz w Eksploratorze plik **`C:\misja-aed\portal\README.md`** (np. w Notatniku albo w przeglądarce na GitHubie). Sekcja **„Gdzie wzór DGA, gdzie Wykaz AED (plik:linia)”** pokazuje każdy nasz element obok jego odpowiednika w oryginalnym portalu.
4. Najważniejsze pliki (w `C:\misja-aed\portal\backend\mcod\resources\`):
   - `aed_constants.py` – 44 kolumny wzorca i pola wymagane,
   - `aed_utils.py` – sprawdzanie pliku dostawcy i budowa wykazu zbiorczego (bez scalania wierszy różnych dostawców),
   - `tasks\aed.py` – nocne zadanie, które składa „Wykaz AED – wykaz zbiorczy”,
   - `tests\test_aed.py` – testy.

Uruchomienie całego portalu dane.gov.pl wymaga Dockera i ok. 8 GB pamięci – opis w `portal/README.md`, część „Uruchomienie portalu lokalnie”. W środowisku hackathonu nie udało się go uruchomić w całości (blokady sieciowe przy budowie obrazów); testy Wykazu AED, które nie wymagają bazy danych, przechodzą (23 testy).

---

## 10. Jak wyłączyć i jak uruchomić ponownie

**Wyłączenie:** w oknie 1 i oknie 2 naciśnij **Ctrl+C** (jeśli pojawi się pytanie „Czy przerwać zadanie wsadowe (T/N)?”, wpisz **T** i Enter), potem zamknij okna.

**Ponowne uruchomienie** (kroki 1–5 robisz tylko raz):

Okno 1:
```
cd /d C:\misja-aed && .venv\Scripts\python -m uvicorn src.api.main:app --port 8000
```

Okno 2:
```
cd /d C:\misja-aed\src\ui && npm run dev
```

Przeglądarka: **http://localhost:5173**

**Pobranie najnowszej wersji z GitHuba** (kasuje Twoje lokalne zmiany w plikach projektu, zostawia zainstalowane biblioteki i dane; najpierw zamknij okna 1 i 2):
```
cd /d C:\misja-aed && git fetch origin && git checkout -f main && git reset --hard origin/main && git clean -fdx -e .venv -e node_modules -e data
```

---

## 11. Gdy coś nie działa

### 11.1. „… nie jest rozpoznawany jako polecenie wewnętrzne lub zewnętrzne”
Program z kroku 1 nie jest zainstalowany albo Windows go jeszcze nie widzi.
- Zamknij wszystkie okna cmd, uruchom komputer ponownie i spróbuj jeszcze raz.
- Przy Pythonie: zainstaluj go ponownie i **zaznacz „Add python.exe to PATH”**.

### 11.2. „The token '&&' is not a valid statement separator”
Wklejasz polecenie do **PowerShell** zamiast do **cmd**. Otwórz cmd: **Windows + R → `cmd` → Enter**.

### 11.3. „npm error … Could not read package.json”
Polecenie `npm` zostało uruchomione w złym folderze. Użyj dokładnie polecenia z kroku 7 – zaczyna się od `cd /d C:\misja-aed\src\ui`.

### 11.4. Żółty pasek „Tryb demonstracyjny” na stronie
Strona nie łączy się z serwerem danych i pokazuje tylko kilka przykładowych AED. Sprawdź, czy **okno 1** jest otwarte i ma napis `Uvicorn running on http://127.0.0.1:8000`. Jeśli nie – uruchom je ponownie (krok 6) i odśwież stronę (F5).

### 11.5. Logowanie nie działa
Login to **`admin`**, hasło **`admin123`** (małe litery). Jeśli dalej nie działa – serwer w oknie 1 mógł zostać uruchomiony ze starszej wersji projektu. Zamknij go (Ctrl+C) i uruchom ponownie (krok 6).

### 11.6. „address already in use” / „port 8000 (albo 5173) is already in use”
Serwer albo strona już działają w innym oknie. Zamknij wszystkie stare okna cmd i PowerShell i uruchom okna 1 i 2 jeszcze raz.

### 11.7. „Odmowa dostępu” przy zmianie nazwy albo usuwaniu folderu
Folder jest otwarty w innym programie (okno cmd, Eksplorator, edytor). Zamknij te programy albo użyj innej nazwy folderu.

### 11.8. Krok 5 kończy się błędem pobierania
Brak internetu albo serwis OpenStreetMap chwilowo nie odpowiada. Użyj wersji z próbką danych (ramka w kroku 5).

### 11.9. Mapa jest szara, bez ulic
Podkład mapy pobiera się z serwerów OpenStreetMap – potrzebny jest internet. Lista AED i karty działają bez podkładu.
