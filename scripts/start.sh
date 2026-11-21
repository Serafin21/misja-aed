#!/bin/sh
# Seed on first start (empty database), then serve the API.
set -e
python -c "import os,sys; sys.exit(0 if os.path.exists(os.environ.get('AED_DB','data/aed.sqlite3')) else 1)" \
  || python -m scripts.seed --osm "${AED_SEED_OSM:-auto}" --lista "${AED_SEED_LISTA:-auto}"
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000
