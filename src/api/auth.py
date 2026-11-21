"""Demo auth: two accounts (dysponent, moderator), passwords from environment (.env)."""
from __future__ import annotations

import hashlib
import hmac
import os

from fastapi import Header, HTTPException

SECRET = os.environ.get("AED_SECRET", "zmien-mnie-w-env")
ACCOUNTS = {
    "dysponent": os.environ.get("DEMO_DYSPONENT_PASSWORD", "dysponent-demo"),
    "moderator": os.environ.get("DEMO_MODERATOR_PASSWORD", "moderator-demo"),
}

# TL decision: a provider (dysponent) may decide on citizen reports only for AED it operates.
# The demo provider account represents this organisation (record field dysponent_nazwa).
DYSPONENT_NAZWA = os.environ.get("DEMO_DYSPONENT_NAZWA", "Urząd Gminy Przykładowo")


def token_for(role: str) -> str:
    sig = hmac.new(SECRET.encode(), role.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{role}.{sig}"


def check_login(login: str, password: str) -> str | None:
    expected = ACCOUNTS.get(login)
    if expected and hmac.compare_digest(expected, password or ""):
        return token_for(login)
    return None


def role_from(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    role = token.split(".", 1)[0]
    if role in ACCOUNTS and hmac.compare_digest(token, token_for(role)):
        return role
    return None


# "demo" (default for the hackathon demo): a request WITHOUT a token acts as a demo user with all roles,
# so the UI works before login is wired; a wrong token is still rejected. "wymagane": token always required.
AUTH_MODE = os.environ.get("AED_AUTH_MODE", "demo")


def require(*roles: str):
    def dep(authorization: str | None = Header(default=None)) -> str:
        if not authorization and AUTH_MODE == "demo":
            return "demo"
        role = role_from(authorization)
        if role is None:
            raise HTTPException(401, detail={"code": "brak_autoryzacji", "message": "Zaloguj się (konto demo dysponenta lub moderatora)."})
        if role not in roles:
            raise HTTPException(403, detail={"code": "brak_uprawnien", "message": "Brak uprawnień do tej operacji."})
        return role
    return dep
