FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=Europe/Warsaw
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/core src/core
COPY src/api src/api
COPY src/__init__.py src/__init__.py
COPY scripts scripts
COPY docs/schema docs/schema
COPY data/sample data/sample
COPY data/granice data/granice
COPY data/dostawcy data/dostawcy
COPY data/cache data/cache
ENV AED_DB=/data/aed.sqlite3
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/v1/health')"
CMD ["sh", "scripts/start.sh"]
