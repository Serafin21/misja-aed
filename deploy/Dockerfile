# Public prototype on one port (e.g. Render free web service): API + built UI in one container.
# Build from the repository root:  docker build -f deploy/Dockerfile -t mapa-aed .
FROM node:22-alpine AS ui
WORKDIR /ui
COPY src/ui/package.json src/ui/package-lock.json ./
RUN npm ci
COPY src/ui/ ./
RUN VITE_USE_MOCKS=0 npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=Europe/Warsaw AED_DB=/data/aed.sqlite3 AED_UI_DIR=/app/ui \
    MALLOC_ARENA_MAX=2 AED_ODSWIEZANIE=wylaczone
# 512 MB instance: fewer malloc arenas; no nightly refresh in the process (data is reseeded on every start anyway)
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/__init__.py src/__init__.py
COPY src/core src/core
COPY src/api src/api
COPY deploy/serve.py deploy/serve.py
COPY deploy/__init__.py deploy/__init__.py
COPY .env.example .env.example
COPY scripts scripts
COPY docs/schema docs/schema
COPY data/sample data/sample
COPY data/granice data/granice
COPY data/dostawcy data/dostawcy
COPY data/cache data/cache
COPY --from=ui /ui/dist /app/ui
RUN mkdir -p /data
EXPOSE 8000
# Seed on first start (empty database), then serve API + UI on $PORT (Render sets it; default 8000).
CMD ["sh", "-c", "python -c \"import os,sys; sys.exit(0 if os.path.exists(os.environ['AED_DB']) else 1)\" || python -m scripts.seed --osm \"${AED_SEED_OSM:-auto}\" --lista \"${AED_SEED_LISTA:-auto}\"; exec uvicorn deploy.serve:app --host 0.0.0.0 --port ${PORT:-8000}"]
