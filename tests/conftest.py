import os
import sys
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("AED_GEOKODER", "brak")  # tests never call the GUGiK geocoder
os.environ.setdefault("AED_ODSWIEZANIE", "wylaczone")  # no background refresh in tests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def store(tmp_path):
    from src.core import db
    from src.core.store import reset_store
    return reset_store(db.connect(tmp_path / "t.sqlite3"))


@pytest.fixture()
def seeded(tmp_path, monkeypatch):
    from src.core import db
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "s.sqlite3")
    from scripts import seed
    seed.main(["--reset", "--osm", "sample"])
    from src.core.store import get_store
    return get_store()


@pytest.fixture()
def client(seeded):
    from fastapi.testclient import TestClient
    from src.api.main import app
    return TestClient(app)


@pytest.fixture()
def auth(client):
    t = client.post("/api/v1/auth/login", json={"login": "dysponent", "haslo": "dysponent-demo"}).json()["token"]
    return {"Authorization": f"Bearer {t}"}
