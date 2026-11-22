"""Single-process deployment: the FastAPI app (src/api) + the built UI (src/ui/dist) on one port.

Used only by deploy/Dockerfile for public hosting of the prototype (one free web service instead of two
containers). Local development and docker-compose.yml are unchanged. The API keeps its own routes under /api/v1;
every other path serves the UI, and unknown paths fall back to index.html (SPA deep links such as /aed/{id}).
"""
from __future__ import annotations

import os
from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles

from src.api.main import app

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
