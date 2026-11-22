#!/usr/bin/env bash
# Testy „Wykazu AED” w obrazie aplikacji portalu (mcod-app:local) – bez bazy danych i Elasticsearch.
# Testy oznaczone django_db wymagają pełnego środowiska testów portalu:
#   cd portal/backend && docker compose -f docker-compose.local.yml run mcod-local-tests mcod/resources/tests/test_aed.py --no-cov
set -euo pipefail
cd "$(dirname "$0")/../backend"
docker run --rm --network host ${HTTPS_PROXY:+-e https_proxy=$HTTPS_PROXY} \
  -v "$PWD/mcod:/usr/src/mcod_backend/mcod" -e DJANGO_SETTINGS_MODULE=mcod.settings.test mcod-app:local sh -c '
    pip install -q "pytest<8" "pytest-django<4.6" pytest-mock requests-mock >/dev/null 2>&1
    mkdir -p /usr/src/mcod_backend/logs && cd /usr/src/mcod_backend
    python -m pytest mcod/resources/tests/test_aed.py -p no:cacheprovider --noconftest -o addopts="" -m "not django_db" -q -W ignore'
