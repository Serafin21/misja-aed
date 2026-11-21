# Claude Code dla każdego w zespole – start w 10 minut

Każdy pracuje na **swoim** koncie Claude (Pro, Max albo Team) i **swoim** koncie GitHub. Repo: https://github.com/Serafin21/misja-aed (publiczne).

## 0. Dostęp do repo (raz)

Czytać repo może każdy. Wypychać zmiany może tylko współpracownik.
1. Podaj Serafin21 swój login GitHub albo e-mail. Dostaniesz zaproszenie.
2. Przyjmij zaproszenie: link w mailu albo https://github.com/notifications.

## 1. Instalacja (raz)

**Windows (PowerShell):**
```
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
```
Zamknij i otwórz PowerShell ponownie, potem:
```
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
npm install -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code
```

**macOS (Terminal):** Git jest w systemie (`xcode-select --install`, jeśli go brak). Node: `brew install node` albo instalator z nodejs.org. Potem:
```
npm install -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code
```

Sprawdzenie: `git --version; node --version; claude --version` – trzy numery wersji.

## 2. Pobranie repo i gałąź swojej roli

Wpisujesz w **terminalu** (PowerShell / Terminal), nie w Claude Code:

| Rola | Gałąź |
|---|---|
| Model A – dane, agregator, API (macOS) | `a/core` |
| Model B – aplikacja, dostępność, prezentacja (Windows) | `b/ux-docs` |
| Team Leader – kontrakt, schematy, znak, scalanie | `main` |

```
cd ~/Desktop
git clone https://github.com/Serafin21/misja-aed
cd misja-aed
git checkout a/core
claude
```
(Zamiast `a/core` wpisz gałąź swojej roli. W PowerShell `cd $HOME\Desktop`.)

Przy pierwszym `claude`: wybierz motyw (Enter), zaloguj się **swoim** kontem Claude w przeglądarce, na pytanie o zaufanie do folderu odpowiedz „Yes”.

## 3. Pierwsza wiadomość w Claude Code

**Model A:**
```
Przeczytaj docs/agents/MODEL_A.md i działaj według niego. Pracujesz na gałęzi a/core
i piszesz tylko w strefie A (lista w .hn/ownership.json). Najpierw przeczytaj docs/CONTRACT.md,
docs/BRIEF.md i prośby o zmiany CR-B1…B9 w docs/HANDOFF_B.md. Model B czeka na:
GET /aed z polem dostepny_teraz (CR-B1), kształt GET /aed/{id} (CR-B3),
port 8000 i Swagger pod /api/docs (CR-B8) oraz docker-compose.yml z usługą ui (build: src/ui, port 80).
Po każdej funkcji: commit po polsku, git push origin a/core, blok HANDOFF w docs/HANDOFF_A.md.
```

**Model B:**
```
Przeczytaj docs/agents/MODEL_B.md i działaj według niego. Pracujesz na gałęzi b/ux-docs
i piszesz tylko w strefie B. Stan pracy jest w docs/HANDOFF_B.md – zacznij od „Następny krok”
w ostatnim bloku HANDOFF. Przed pracą zrób git pull, po pracy commit po polsku i git push origin b/ux-docs.
```

**Team Leader:**
```
Jestem Team Leaderem. Pracujesz na gałęzi main. Przeczytaj docs/BRIEF.md, docs/CONTRACT.md,
docs/HANDOFF_A.md i docs/HANDOFF_B.md. Zrób listę próśb o zmiany kontraktu (CR) do mojej decyzji
i listę rzeczy z mojej strefy, których brakuje do draftu i finału (brand/, docs/AI_USAGE.md, tools/hn.py).
```

## 4. Wypychanie zmian (`git push`)

- **Windows:** przy pierwszym `git push` otworzy się okno „Git Credential Manager” – zaloguj się przez przeglądarkę na swoje konto GitHub.
- **macOS:** najprościej `brew install gh` i `gh auth login` (GitHub.com → HTTPS → login w przeglądarce).
- Odmowa `403` znaczy, że nie przyjąłeś zaproszenia do repo (krok 0).

## 5. Zasady, żeby się nie zderzać

- Każda rola ma swoją gałąź i swoje pliki (`.hn/ownership.json`). Pliki wspólne (`docs/CONTRACT.md`, `docs/BRIEF.md`) zmienia tylko Team Leader.
- Zmiana kontraktu = prośba „CR-n” w swoim pliku HANDOFF, decyzja należy do TL.
- Przed pracą `git pull`, po pracy `git push`. Synchronizacje o 17:00, 23:00 i 05:00: TL scala gałęzie do `main`.
- Jeśli na jednej gałęzi pracują dwie osoby (np. dwie sesje Claude Code na `b/ux-docs`), każda robi `git pull --rebase` przed `git push`.

## 6. Claude Code w przeglądarce (bez instalacji)

Na https://claude.ai/code można też pracować w chmurze: połącz swoje konto GitHub i wybierz repo `Serafin21/misja-aed`. Aplikacja Claude ma już dostęp do tego repo na koncie Serafin21. Ograniczenie: w chmurze domyślnie działają tylko popularne rejestry pakietów, a Dockera i danych z zewnętrznych stron (OSM, dane.gov.pl) trzeba używać lokalnie albo dopisać domeny w ustawieniach sieci środowiska.
