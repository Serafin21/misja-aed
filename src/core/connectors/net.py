"""HTTP fetch with local cache (venue Wi-Fi can be weak)."""
from __future__ import annotations

import time
import urllib.request
from pathlib import Path

from ..schema import ROOT

CACHE = ROOT / "data" / "cache"
UA = "MisjaAED-prototyp/1.0 (HackNation 2026; kontakt w repozytorium)"


def fetch(url: str, cache_name: str | None = None, timeout: int = 60, max_age_h: float = 24) -> tuple[bytes, str]:
    """Return (body, origin) where origin is 'siec' or 'cache'. Raises if neither works."""
    path = CACHE / cache_name if cache_name else None
    if path and path.exists() and (time.time() - path.stat().st_mtime) < max_age_h * 3600:
        return path.read_bytes(), "cache"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, */*"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
        if path:
            CACHE.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        return body, "siec"
    except Exception:
        if path and path.exists():
            return path.read_bytes(), "cache"
        raise


def cached(cache_name: str) -> Path | None:
    p = CACHE / cache_name
    return p if p.exists() else None


_ = Path
