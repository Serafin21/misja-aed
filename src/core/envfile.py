"""Settings from the .env file (KEY=value lines) without extra dependencies.

The server reads .env from the repository root; when there is no .env, it falls back to .env.example so the demo works
right after `git clone` (only ADMIN_PASSWORD is taken from .env.example – not from the code – and a warning is
logged). Variables already set in the environment always win."""
from __future__ import annotations

import logging
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
log = logging.getLogger("aed.env")


def _parse(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip().removeprefix("export ").strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
            v = v[1:-1]
        out[k] = v
    return out


def load(root: Path = ROOT) -> str | None:
    """Load .env (or .env.example) into os.environ without overriding. Returns the file name used."""
    for name in (".env", ".env.example"):
        p = root / name
        if p.is_file():
            vals = _parse(p)
            if name == ".env.example":  # only the demo admin password – other settings keep the code's defaults
                vals = {k: v for k, v in vals.items() if k == "ADMIN_PASSWORD"}
            for k, v in vals.items():
                os.environ.setdefault(k, v)
            if name == ".env.example":
                log.warning("Brak pliku .env – używam ustawień demo z .env.example (hasło konta admin z ADMIN_PASSWORD). "
                            "Skopiuj: cp .env.example .env i zmień hasło przed udostępnieniem strony.")
            return name
    return None
