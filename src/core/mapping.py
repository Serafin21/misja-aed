"""Column mapping proposal: header names + synonyms + sample values."""
from __future__ import annotations

import re
import unicodedata

from rapidfuzz import fuzz, process

from . import hours, normalize, schema

ADDRESS = ["ulica_cecha", "ulica", "numer_budynku", "kod_pocztowy", "miejscowosc"]
COORDS = ["szerokosc_geograficzna", "dlugosc_geograficzna"]
STREET = ["ulica_cecha", "ulica"]


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = s.replace("ł", "l")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


SYNONYMS: dict[str, list[str]] = {
    "id_dysponenta_aed": ["id", "nr inwentarzowy", "numer inwentarzowy", "kod urzadzenia", "ref", "identyfikator", "lp id"],
    "nazwa_obiektu": ["nazwa", "obiekt", "budynek", "nazwa obiektu", "miejsce", "name", "lokal", "placowka", "nazwa placowki"],
    "opis_lokalizacji": ["gdzie dokladnie", "lokalizacja", "opis", "opis lokalizacji", "umiejscowienie", "gdzie",
                         "defibrillator location", "location", "miejsce zawieszenia"],
    "pietro": ["pietro", "kondygnacja", "poziom", "level", "floor"],
    "wewnatrz_budynku": ["wewnatrz", "w budynku", "indoor", "wewnatrz budynku"],
    "wojewodztwo": ["wojewodztwo", "woj"],
    "powiat": ["powiat"],
    "gmina": ["gmina"],
    "miejscowosc": ["miejscowosc", "miasto", "city", "addr city", "adres miasto", "adres miejscowosc"],
    "ulica": ["ulica", "street", "addr street", "adres ulica"],
    "numer_budynku": ["nr", "numer", "nr domu", "numer domu", "nr budynku", "housenumber", "addr housenumber", "adres nr",
                      "home number", "house number", "numer budynku"],
    "numer_lokalu": ["nr lokalu", "lokal nr", "numer lokalu", "mieszkanie"],
    "kod_pocztowy": ["kod", "kod pocztowy", "postcode", "addr postcode", "adres kod"],
    "teryt_terc": ["terc", "teryt terc", "kod terc"],
    "teryt_simc": ["simc", "teryt simc", "kod simc"],
    "szerokosc_geograficzna": ["lat", "szerokosc", "szerokosc geograficzna", "latitude", "y", "n"],
    "dlugosc_geograficzna": ["lon", "lng", "dlugosc", "dlugosc geograficzna", "longitude", "x", "e"],
    "dostep": ["dostep", "access", "dostepnosc dla osob postronnych", "kto moze"],
    "godziny_dostepnosci": ["godziny", "godziny dostepnosci", "dostepnosc", "opening hours", "godziny otwarcia", "czynne"],
    "dostepny_24h": ["cala dobe", "calodobowo", "24h", "24 7", "calodobowy", "dostepny 24h"],
    "szafka_zamknieta": ["zamknieta szafka", "szafka zamknieta", "szafka", "zamkniety", "na klucz", "locked"],
    "instrukcja_dostepu": ["instrukcja", "instrukcja dostepu", "klucz", "jak sie dostac", "kod do szafki"],
    "mobilny": ["mobilny", "w pojezdzie", "pojazd", "mobile"],
    "status_urzadzenia": ["status", "stan", "sprawny", "stan techniczny"],
    "tryb_pediatryczny": ["dzieci", "pediatryczny", "tryb pediatryczny", "elektrody pediatryczne", "pediatric"],
    "producent": ["producent", "manufacturer", "marka"],
    "model": ["model", "typ urzadzenia"],
    "data_waznosci_elektrod": ["waznosc elektrod", "data waznosci elektrod", "elektrody do", "elektrody"],
    "data_ostatniego_przegladu": ["przeglad", "data przegladu", "ostatni przeglad", "data ostatniego przegladu", "check date"],
    "dysponent_nazwa": ["dysponent", "wlasciciel", "operator", "podmiot", "jednostka"],
    "dysponent_typ": ["typ dysponenta", "rodzaj podmiotu"],
    "dysponent_regon": ["regon"],
    "kontakt_telefon": ["telefon", "tel", "phone", "nr telefonu", "contact phone"],
    "kontakt_email": ["email", "e mail", "mail", "contact email"],
    "data_weryfikacji": ["data weryfikacji", "zweryfikowano", "data sprawdzenia"],
    "zdjecie_url": ["zdjecie", "foto", "image", "url zdjecia"],
    "uwagi": ["uwagi", "notatki", "komentarz", "note", "description"],
}
COMPOSITE = {
    "adres": ADDRESS, "adres pelny": ADDRESS, "address": ADDRESS, "lokalizacja adres": ADDRESS,
    "wspolrzedne": COORDS, "wspolrzedne geograficzne": COORDS, "gps": COORDS, "polozenie": COORDS, "coordinates": COORDS,
    "ulica z cecha": STREET,
}

_INDEX: list[tuple[str, object]] = []
for _f, _syns in SYNONYMS.items():
    _INDEX.append((fold(_f), _f))
    for _s in _syns:
        _INDEX.append((fold(_s), _f))
for _s, _t in COMPOSITE.items():
    _INDEX.append((fold(_s), _t))


# two numbers in one cell: "52,24 21,01" / "52.24;21.01" / "52.24, 21.01" (not a single "52,0123")
_PAIR = re.compile(r"\d(?:[.,]\d+)?\s*[\s;|]\s*-?\d|\d\.\d+\s*,\s*-?\d+\.\d")


def _sniff(values: list) -> object | None:
    vals = [v for v in values if not normalize.is_empty(v)][:20]
    if not vals:
        return None
    def share(pred):
        ok = 0
        for v in vals:
            try:
                ok += bool(pred(v))
            except Exception:
                pass
        return ok / len(vals)
    if share(lambda v: normalize.coords(v) and 49 <= normalize.coords(v)[0] <= 55) > 0.8 and \
            all(_PAIR.search(str(v)) for v in vals):
        return COORDS
    if share(normalize.address) > 0.7:
        return ADDRESS
    if share(lambda v: re.fullmatch(r"\d{2}-?\d{3}", str(v).strip())) > 0.8:
        return "kod_pocztowy"
    if share(lambda v: normalize.opening_hours(v)[0]) > 0.7 and not share(lambda v: str(v).strip().lower() in normalize.TRUE | normalize.FALSE):
        return "godziny_dostepnosci"
    if share(lambda v: re.fullmatch(r"[^@\s]+@[^@\s]+\.\w+", str(v))) > 0.8:
        return "kontakt_email"
    if share(lambda v: re.fullmatch(r"\d{9}|\d{14}", str(v).strip())) > 0.8:
        return "dysponent_regon"
    return None


def propose(rows: list[dict], saved: dict | None = None) -> dict:
    """Return {source_column: target} where target is a field name, a list (composite) or None."""
    columns: list[str] = []
    for r in rows[:200]:
        for k in r:
            if k not in columns:
                columns.append(k)
    saved = saved or {}
    out: dict[str, object] = {}
    used: set[str] = set()
    known = set(schema.field_order())
    # 1) saved mapping for this source, 2) exact schema field names
    for c in columns:
        if c in saved:
            out[c] = saved[c]
        elif c in known:
            out[c] = c
    for t in out.values():
        used.update(t if isinstance(t, list) else [t] if t else [])
    # 3) names + synonyms (fuzzy), 4) sample values
    for c in columns:
        if c in out:
            continue
        fc = fold(c.split(".")[-1]) if "." in c else fold(c)
        full = fold(c)
        best = None
        for cand in (full, fc):
            hit = process.extractOne(cand, [k for k, _ in _INDEX], scorer=fuzz.ratio, score_cutoff=86)
            if hit:
                best = _INDEX[hit[2]][1]
                break
        if best is None:
            best = _sniff([r.get(c) for r in rows[:50]])
        # value check for name-based guesses that are clearly wrong
        if best in ("szerokosc_geograficzna", "dlugosc_geograficzna"):
            sniff = _sniff([r.get(c) for r in rows[:50]])
            if sniff == COORDS:
                best = COORDS
        key = tuple(best) if isinstance(best, list) else best
        if best is not None and not isinstance(best, list) and best in used:
            best = None
        out[c] = best
        if best:
            used.update(best if isinstance(best, list) else [best])
    return out


def describe(m: dict) -> list[dict]:
    """Human-friendly mapping rows for UI."""
    lab = schema.labels()
    return [{"kolumna": c, "pole": t,
             "etykieta": (", ".join(lab.get(x, x) for x in t) if isinstance(t, list) else lab.get(t, t) if t else None)}
            for c, t in m.items()]


_ = hours  # keep import (used indirectly by normalize)
