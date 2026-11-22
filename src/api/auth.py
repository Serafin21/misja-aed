"""Accounts and tokens.

- Two demo accounts from .env (DEMO_DYSPONENT_PASSWORD, DEMO_MODERATOR_PASSWORD); the demo provider represents
  DEMO_DYSPONENT_NAZWA.
- Provider accounts for real institutions (table `konta`): created by a moderator after checking the institution
  (POST /konta), each bound to one `dysponent_nazwa`; passwords stored as PBKDF2-SHA256 with salt; a deactivated account's
  token stops working at once.
- Token = "<login>.<HMAC(AED_SECRET, login | password hash)>" (no server-side sessions): a new password ends every
  session opened with the old one.
- CR-TL-11: nobody can read a password – not even the administrator. Only the PBKDF2 hash is stored. A lost password is
  replaced by a ONE-TIME password: the administrator issues it (shown once), it expires after TEMP_HOURS and the
  institution must set its own password at the first login ("Nie pamiętam hasła" sends the request to the administrator).
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import quote, unquote

from fastapi import Header, HTTPException

SECRET = os.environ.get("AED_SECRET", "zmien-mnie-w-env")
# Owner's decision (22.11): one built-in administrator account "admin" (password from ADMIN_PASSWORD, default admin123);
# no institution accounts until the administrator creates them or approves a request. The old test accounts
# (dysponent / administrator / moderator) exist only with AED_KONTA_TESTOWE=tak (automatic tests).
# CR-TL-9: the password only from ADMIN_PASSWORD (no default in the code); without it the admin account is disabled.
# Demo password: docs/tech/RUN.md and .env.example.
DEMO = {"admin": os.environ["ADMIN_PASSWORD"]} if os.environ.get("ADMIN_PASSWORD") else {}
DEMO_ROLE = {"admin": "administrator"}
RESERVED = {"admin", "administrator", "moderator", "dysponent", "demo", "root"}
if os.environ.get("AED_KONTA_TESTOWE") == "tak":
    DEMO |= {"dysponent": os.environ.get("DEMO_DYSPONENT_PASSWORD", "dysponent-demo"),
             "administrator": os.environ.get("DEMO_ADMINISTRATOR_PASSWORD", "administrator-demo"),
             "moderator": os.environ.get("DEMO_MODERATOR_PASSWORD", "moderator-demo")}
    DEMO_ROLE |= {"dysponent": "dysponent", "administrator": "administrator", "moderator": "administrator"}
ACCOUNTS = DEMO  # backwards compatibility
# TL decision: a provider (dysponent) may decide on citizen reports only for AED it operates.
DYSPONENT_NAZWA = os.environ.get("DEMO_DYSPONENT_NAZWA", "Urząd Gminy Przykładowo")
# Login: 3–60 characters – letters (also Polish and capital ones), digits, . _ - @ + (so an e-mail works too).
# Logins are case-insensitive (stored lower-case); spaces become dots ("UG Krosno" → "ug.krosno").
LOGIN_RE = re.compile(r"^[\w.@+-]{3,60}$")
LOGIN_HINT = "Login: od 3 do 60 znaków – litery, cyfry, kropka, myślnik, podkreślenie albo adres e-mail."


def normalize_login(login: str | None) -> str:
    return re.sub(r"\s+", ".", (login or "").strip()).lower()


class User(str):
    """The role as a string (so `role == "moderator"` keeps working) plus who it is."""
    login: str
    nazwa: str | None  # dysponent_nazwa for provider accounts
    musi_zmienic_haslo: bool  # logged in with a one-time password – only "set your own password" is allowed

    def __new__(cls, role: str, login: str, nazwa: str | None = None, musi_zmienic_haslo: bool = False):
        u = super().__new__(cls, role)
        u.login, u.nazwa, u.musi_zmienic_haslo = login, nazwa, musi_zmienic_haslo
        return u


def _conn():
    from src.core.store import get_store
    return get_store().conn


def hash_password(pw: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 200_000)
    return f"pbkdf2_sha256${salt}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, salt, _h = stored.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(pw, salt), stored)


def new_password() -> str:
    """Readable one-time password, e.g. 'kawa-7Qm2-lipa-9xRt'."""
    words = ["kawa", "lipa", "most", "sowa", "brzoza", "rzeka", "wiatr", "skala", "dzwon", "pole", "kos", "ruta"]
    return "-".join([secrets.choice(words), secrets.token_urlsafe(3), secrets.choice(words), secrets.token_urlsafe(3)])


TEMP_HOURS = 72  # a one-time password works this long, then the administrator issues a new one


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M")


def set_password(login: str, password: str, temporary: bool) -> str | None:
    """Store a new password (PBKDF2 only). temporary=True: one-time password – valid TEMP_HOURS, must be changed at
    the first login. Clears the "forgot password" request. Returns the expiry of a one-time password."""
    until = (datetime.now() + timedelta(hours=TEMP_HOURS)).strftime("%Y-%m-%dT%H:%M") if temporary else None
    c = _conn()
    c.execute("UPDATE konta SET haslo=?, haslo_tymczasowe_do=?, prosba_o_haslo=NULL WHERE login=?",
              (hash_password(password), until, login))
    c.commit()
    return until


def temp_expired(a: dict) -> bool:
    return bool(a.get("haslo_tymczasowe_do")) and a["haslo_tymczasowe_do"] < _now()


def account(login: str) -> dict | None:
    r = _conn().execute("SELECT * FROM konta WHERE login=?", (login,)).fetchone()
    return dict(r) if r else None


def _stamp(login: str) -> str:
    """Part of the token that changes with the password (so a password change or reset ends old sessions)."""
    if login in DEMO:
        return hashlib.sha256(DEMO[login].encode()).hexdigest()
    a = account(login)
    return a["haslo"] if a else ""


def token_for(login: str) -> str:
    # the login is percent-encoded: an HTTP header cannot carry Polish letters
    sig = hmac.new(SECRET.encode(), f"{login}|{_stamp(login)}".encode(), hashlib.sha256).hexdigest()[:32]
    return f"{quote(login, safe='@+-_')}.{sig}"


def check_login(login: str, password: str) -> str | None:
    login = normalize_login(login)
    expected = DEMO.get(login)
    if expected and hmac.compare_digest(expected, password or ""):
        return token_for(login)
    a = account(login)
    if a and a["aktywne"] and verify_password(password or "", a["haslo"]) and not temp_expired(a):
        return token_for(login)
    return None


def user_for(login: str) -> User | None:
    if login in DEMO:
        return User(DEMO_ROLE[login], login, DYSPONENT_NAZWA if login == "dysponent" else None)
    a = account(login)
    if a and a["aktywne"] and not temp_expired(a):
        return User(a["rola"], login, a.get("dysponent_nazwa"), bool(a.get("haslo_tymczasowe_do")))
    return None


def role_from(authorization: str | None) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    login = unquote(token.rsplit(".", 1)[0])
    if not hmac.compare_digest(token, token_for(login)):
        return None
    return user_for(login)


# "demo" (default for the hackathon demo): a request WITHOUT a token acts as a demo user with all roles,
# so the UI works before login is wired; a wrong token is still rejected. "wymagane": token always required.
AUTH_MODE = os.environ.get("AED_AUTH_MODE", "demo")


def require(*roles: str, allow_temp: bool = False):
    """allow_temp: also for a user logged in with a one-time password (only "who am I" and "set your own password")."""
    def dep(authorization: str | None = Header(default=None)) -> User:
        if not authorization and AUTH_MODE == "demo" and "anonim_demo" in roles:
            return User("demo", "demo")
        user = role_from(authorization)
        if user is None:
            raise HTTPException(401, detail={"code": "brak_autoryzacji", "message": "Zaloguj się (konto dysponenta lub moderatora)."})
        if user not in roles:
            raise HTTPException(403, detail={"code": "brak_uprawnien", "message": "Brak uprawnień do tej operacji."})
        if user.musi_zmienic_haslo and not allow_temp:
            raise HTTPException(403, detail={"code": "zmien_haslo", "message": "Zalogowano hasłem jednorazowym – najpierw ustaw własne hasło."})
        return user
    return dep
