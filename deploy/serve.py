"""Single-process deployment: the FastAPI app (src/api) + the built UI (src/ui/dist) on one port.

Used only by deploy/Dockerfile for public hosting of the prototype (one free web service instead of two
containers). Local development and docker-compose.yml are unchanged. The API keeps its own routes under /api/v1;
every other path serves the UI, and unknown paths fall back to index.html (SPA deep links such as /aed/{id}).
"""
from __future__ import annotations

import os
from pathlib import Path

import json
import sys

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles

from src.core import db

# Memory on a 512 MB instance (18k OSM points): every record is held twice (record + source data) and json.loads
# creates new strings for the same field names and short values in each of ~36k dicts. Sharing them (sys.intern)
# halves the store (measured: 210 MB -> 91 MB). Same values and types as json.loads – only identity is shared.
_decoder = json.JSONDecoder(object_pairs_hook=lambda pairs: {
    sys.intern(k): (sys.intern(v) if type(v) is str and len(v) <= 64 else v) for k, v in pairs})


def _loads(s):
    return _decoder.decode(s.decode() if isinstance(s, (bytes, bytearray)) else s)


db.loads = _loads

from src.api.main import app  # noqa: E402 – after the patch, so the store loads with shared strings

UI_DIR = Path(os.environ.get("AED_UI_DIR", "/app/ui"))


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or path.startswith("api/"):
                raise
            return await super().get_response("index.html", scope)


# The API redirects "/" to its docs; here "/" must be the UI home page.
app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) != "/"]
app.mount("/", SPAStaticFiles(directory=UI_DIR, html=True), name="ui")

# Load the store once at start-up (not by several concurrent first requests – each would build its own copy).
from src.api.main import get_store  # noqa: E402

get_store()
