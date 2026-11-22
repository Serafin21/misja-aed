# Import kodu źródłowego portalu dane.gov.pl

| | |
|---|---|
| Co | backend portalu dane.gov.pl (projekt **mcod**, wersja **2.62.3** – „backend 2.62.3 from shared zip file”) |
| Źródło | strona kodu źródłowego dane.gov.pl (https://dane.gov.pl/pl/sourcecode) wyświetla się tylko w przeglądarce z JavaScriptem, więc – zgodnie z CR-TL-9 – użyto kopii: https://github.com/olekstomek/mcod-backend-dane.gov.pl, commit `00a0813977ebea83ee917c0a106afa234859f76a` |
| Sposób | `git fetch --depth 1 <mirror> 00a0813…` → `git archive --format=tar.gz --prefix=backend/ FETCH_HEAD` → rozpakowanie do `portal/backend/` (bez historii git oryginału) |
| Archiwum | `mcod-backend-00a0813.tar.gz`, 85 537 501 B, SHA-256 `35f006a3376b37db70f57ea5ca4e720eacd14110d685a5f7bdaab2f720fb8514` |
| Data pobrania | 2026-11-22 |
| Pliki | 6214 plików, ok. 200 MB (w tym statyczne pliki JS, słowniki Elasticsearch, dystrybucja Apache Jena Fuseki z oryginału) |
| Frontend | repozytorium frontendu portalu nie jest dostępne w tej kopii – praca na API, panelu administracyjnym i CMS (CR-TL-9 pkt 2) |

Ten commit zawiera kod **bez żadnych zmian**. Nasze zmiany („Środowisko lokalne: …”, „Wykaz AED: …”) są w kolejnych, osobnych commitach – `git log -- portal/`.

## Frontend portalu (CR-TL-14)

| | |
|---|---|
| Co | frontend portalu dane.gov.pl (projekt **mcod-frontend**, wersja **3.5.2** – „frontend 3.5.2 from shared zip file”), Angular |
| Źródło | kopia https://github.com/olekstomek/mcod-frontend-dane.gov.pl, commit `56cbf8a542155a0a82fa61244a1f70da182b1687` (oryginał: gitlab.dane.gov.pl/otwarte-dane/mcod-frontend, strona kodu źródłowego dane.gov.pl) |
| Sposób | `git fetch --depth 1 <mirror> 56cbf8a…` → `git archive --format=tar.gz --prefix=frontend/ FETCH_HEAD` → rozpakowanie do `portal/frontend/` (bez historii git oryginału) |
| Archiwum | `mcod-frontend-56cbf8a.tar.gz`, 2 701 131 B, SHA-256 `0d3122c3ea15682ca5351463586550b8a481d73aaeeffab87ef792483e222c9f` |
| Data pobrania | 2026-11-22 |
| Pliki | 1246 plików (wszystkie z archiwum, żaden nie pominięty przez .gitignore) |

Commit importu zawiera frontend **bez żadnych zmian**. Nasze zmiany („Wykaz AED (frontend): …”) są w kolejnych commitach – `git log -- portal/frontend`.
