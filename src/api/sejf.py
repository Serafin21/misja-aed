"""Owner's decision (22.11): the administrator can look up the login AND password of every account (e.g. to give it
again to an institution). The password used for logging in is still stored only as PBKDF2 (`konta.haslo`); a second,
encrypted copy (`konta.haslo_podglad`) is kept for the administrator's view. Encryption: keystream from HMAC-SHA256
(key derived from AED_SECRET, random nonce) + HMAC tag – standard library only. Every look-up is in the event log.
In a production service passwords should never be recoverable – see docs/MODEL_ROL.md v1.4.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

from .auth import SECRET

_KEY = hashlib.sha256(b"aed-podglad-hasla|" + SECRET.encode()).digest()


def _stream(nonce: bytes, n: int) -> bytes:
    out, i = b"", 0
    while len(out) < n:
        out += hmac.new(_KEY, nonce + i.to_bytes(4, "big"), hashlib.sha256).digest()
        i += 1
    return out[:n]


def zaszyfruj(haslo: str) -> str:
    raw = haslo.encode()
    nonce = secrets.token_bytes(16)
    ct = bytes(a ^ b for a, b in zip(raw, _stream(nonce, len(raw))))
    tag = hmac.new(_KEY, nonce + ct, hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(nonce + ct + tag).decode()


def odszyfruj(data: str | None) -> str | None:
    if not data:
        return None
    try:
        b = base64.urlsafe_b64decode(data.encode())
        nonce, ct, tag = b[:16], b[16:-16], b[-16:]
        if not hmac.compare_digest(tag, hmac.new(_KEY, nonce + ct, hashlib.sha256).digest()[:16]):
            return None
        return bytes(a ^ b for a, b in zip(ct, _stream(nonce, len(ct)))).decode()
    except Exception:  # noqa: BLE001 – damaged value or other AED_SECRET
        return None
