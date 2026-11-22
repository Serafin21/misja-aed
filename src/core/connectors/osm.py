"""OpenStreetMap connector: AED export for Poland (ODbL-1.0, separate layer).

Source: https://aed.openstreetmap.org.pl/aed_poland.geojson (redirects to openaedmap.org country export).
Contact details (phone, e-mail) from OSM are NOT imported – they may identify private persons.
"""
from __future__ import annotations

import re

import json

from .. import dedup, hours, normalize as N, pipeline, quality, validate
from ..pipeline import PLACEHOLDER_ID, _p
from ..schema import ROOT
from ..store import Store, now_min
from .net import fetch

URL = "https://aed.openstreetmap.org.pl/aed_poland.geojson"
CACHE_NAME = "aed_poland.geojson"
SAMPLE = ROOT / "data" / "sample" / "zrodlo_osm_przyklad.geojson"
KOD = "osm"

ACCESS = {"yes": "publiczny", "public": "publiczny", "permissive": "ograniczony", "customers": "ograniczony",
          "destination": "ograniczony", "private": "prywatny", "no": "prywatny", "staff": "prywatny",
          "employees": "prywatny"}
# OSM layer: address is often missing in OSM – these required fields are downgraded to warnings (CR-3)
RELAXED = {"nazwa_obiektu", "wojewodztwo", "gmina", "miejscowosc", "numer_budynku", "kod_pocztowy", "dysponent_nazwa",
           "godziny_dostepnosci", "data_weryfikacji"}
_FILL = {"nazwa_obiektu": "Brak nazwy", "wojewodztwo": "mazowieckie", "kod_pocztowy": "00-000", "godziny_dostepnosci": "24/7",
         "data_weryfikacji": "2000-01-01"}


def osm_id(props: dict, feature: dict) -> str:
    if props.get("osm_id"):
        return str(props["osm_id"])
    if props.get("@osm_id"):
        return f"{props.get('@osm_type', 'node')}/{props['@osm_id']}"
    return str(feature.get("id"))


NAME_MAX = 80  # longer "names" in OSM are descriptions ("Aby dostać się do budynku należy…")


# Text that describes WHERE the device hangs, not what the place is called ("AED na ścianie budynku", "obok wejścia")
_DESC = re.compile(r"^(aed|defibrylator)\b.*\b(na|w|we|przy|obok|pod|nad)\s|zamontowan|znajduje si|na wyposażeniu|na ścian|"
                   r"przy wej|obok wej|klatk[ai] schodow|^aby\b|^(na|w|we|przy|obok|pod)\s", re.I)
# Placeholders that older versions stored instead of a name
PLACEHOLDER_NAMES = ("Defibrylator AED",)


# A generic word is not a name of the place ("AED", "Defibrylator AED", "Defibrillator")
_GENERIC = re.compile(r"(?i)[\s\-.]*(aed|defibrylator|defibrillator|automatyczny defibrylator( zewnętrzny)?)"
                      r"([\s\-]*(aed|\(aed\)|\d+))?[\s.]*")


def looks_like_description(v: str | None) -> bool:
    """True when the text is not a usable name: a description of the location or a generic word like "AED"."""
    return bool(v) and (len(v) > NAME_MAX or v[:1].islower() or bool(_DESC.search(v)) or bool(_GENERIC.fullmatch(v)))


def _name(p: dict) -> str | None:
    """Name of the place from OSM `name` tags only. The description, the operator (= the owner, dysponent_nazwa) or the
    address are NEVER used as a name; without a real name the record has no name and the app shows
    "Brak nazwy urządzenia" (owner's decision 22.11)."""
    for k in ("name", "name:pl", "official_name", "addr:housename"):
        v = N.text(p.get(k))
        v = re.sub(r"^[\s\-–•*.,;:]+", "", v or "")  # "- AED zamontowane…" → "AED zamontowane…"
        if v and not looks_like_description(v) and not re.fullmatch(r"[\d\s+()/-]+", v):  # a phone number is not a name
            return v
    return None


def clean_name(rec: dict) -> None:
    """Fix names stored by older versions: placeholders, "AED – street", descriptions."""
    n = rec.get("nazwa_obiektu")
    if n and (n in PLACEHOLDER_NAMES or n.startswith("AED – ") or looks_like_description(n)):
        rec["nazwa_obiektu"] = None


NAMES_MIGRATION = "nazwy_osm_v3"


def migrate_names(conn) -> int:
    """One-time fix of OSM names in a database imported by an older version, which used the operator (owner) or the
    address as the name. Names are recomputed from the OSM source file (data/cache, else the sample); OSM points
    missing from it keep the stored name minus placeholders/descriptions, and the operator-as-name is removed.
    Returns the number of changed records."""
    from .net import CACHE  # noqa: PLC0415
    if conn.execute("SELECT 1 FROM stan WHERE klucz=?", (NAMES_MIGRATION,)).fetchone():
        return 0
    rows = conn.execute("SELECT id_w_zrodle, id_aed, dane FROM pochodzenie WHERE kod_zrodla='osm'").fetchall()
    names: dict[str, str | None] = {}
    for path in ((SAMPLE, CACHE / CACHE_NAME) if rows else ()):
        if path.is_file():
            try:
                for f in json.loads(path.read_text(encoding="utf-8")).get("features", []):
                    p = f.get("properties") or {}
                    names[osm_id(p, f)] = _name(p)
            except (ValueError, OSError):
                pass
    changed = 0
    for r in rows:
        dane = json.loads(r["dane"])
        old = dane.get("nazwa_obiektu")
        if r["id_w_zrodle"] in names:
            new = names[r["id_w_zrodle"]]
        else:
            tmp = dict(dane)
            clean_name(tmp)
            new = None if tmp.get("nazwa_obiektu") and tmp["nazwa_obiektu"] == dane.get("dysponent_nazwa") else tmp.get("nazwa_obiektu")
        if new == old:
            continue
        dane["nazwa_obiektu"] = new
        conn.execute("UPDATE pochodzenie SET dane=? WHERE kod_zrodla='osm' AND id_w_zrodle=?",
                     (json.dumps(dane, ensure_ascii=False), r["id_w_zrodle"]))
        only_osm = not conn.execute("SELECT 1 FROM pochodzenie WHERE id_aed=? AND kod_zrodla<>'osm'", (r["id_aed"],)).fetchone()
        row = conn.execute("SELECT data FROM aed WHERE id_aed=?", (r["id_aed"],)).fetchone()
        if only_osm and row:
            rec = json.loads(row["data"])
            rec["nazwa_obiektu"] = new
            conn.execute("UPDATE aed SET data=? WHERE id_aed=?", (json.dumps(rec, ensure_ascii=False), r["id_aed"]))
        changed += 1
    conn.execute("INSERT OR REPLACE INTO stan VALUES (?,?)", (NAMES_MIGRATION, json.dumps({"zmienione": changed})))
    conn.commit()
    return changed


def to_record(feature: dict) -> tuple[dict, list[dict]]:
    p = feature.get("properties") or {}
    lon, lat = feature["geometry"]["coordinates"][:2]
    probs: list[dict] = []
    rid = osm_id(p, feature)
    loc = p.get("defibrillator:location") or p.get("defibrillator:location:pl") or p.get("description")
    rec = {k: None for k in quality.schema.field_order()}
    rec.update({
        "id_aed": PLACEHOLDER_ID,
        "id_dysponenta_aed": p.get("ref"),
        "nazwa_obiektu": _name(p),
        "opis_lokalizacji": N.text(loc) or "Brak opisu w OpenStreetMap – sprawdź na miejscu",
        "szerokosc_geograficzna": round(float(lat), 6), "dlugosc_geograficzna": round(float(lon), 6),
        "miejscowosc": N.text(p.get("addr:city") or p.get("addr:place")),
        "ulica": N.text(p.get("addr:street")),
        "numer_budynku": N.text(p.get("addr:housenumber")),
        "kod_pocztowy": N.postal(p.get("addr:postcode")),
        "dysponent_nazwa": N.text(p.get("operator")),
        "producent": N.text(p.get("manufacturer")),
        "model": N.text(p.get("model")),
        "zrodlo_danych": "osm", "licencja": "ODbL-1.0", "metoda_weryfikacji": "import_automatyczny",
        "mobilny": False, "status_urzadzenia": "nieznany", "dysponent_typ": "inny",
        "uwagi": None,
    })
    if rec["ulica"]:
        rec["ulica_cecha"], rec["ulica"] = N.street(rec["ulica"])
    try:
        rec["pietro"] = N.to_int(p.get("level")) if p.get("level") not in (None, "") else None
        if rec["pietro"] is not None and not -5 <= rec["pietro"] <= 100:
            rec["pietro"] = None
    except ValueError:
        rec["pietro"] = None
    indoor = p.get("indoor")
    rec["wewnatrz_budynku"] = True if indoor == "yes" else False if indoor == "no" else not N.outdoor_from_text(loc)
    rec["dostep"] = ACCESS.get((p.get("access") or "").lower(), "ograniczony" if p.get("access") else "publiczny")
    if not p.get("access"):
        probs.append(_p(rid, "dostep", "informacja", None, "publiczny", "Brak tagu access – przyjęto „publiczny” (sprawdź)."))
    oh = p.get("opening_hours")
    if oh and hours.is_valid(oh):
        rec["godziny_dostepnosci"] = oh
    elif oh:
        rec["godziny_dostepnosci"] = oh
        probs.append(_p(rid, "godziny_dostepnosci", "ostrzezenie", oh, None, "Zapis godzin spoza obsługiwanego podzbioru."))
    # no opening_hours in OSM: left empty (CR-3) – "dostępne teraz" = null, never guessed
    rec["dostepny_24h"] = hours.is_24_7(rec["godziny_dostepnosci"])
    lock = (p.get("defibrillator:cabinet:lock") or p.get("locked") or "").lower()
    rec["szafka_zamknieta"] = lock in ("yes", "key", "code", "true")
    rec["tryb_pediatryczny"] = True if p.get("defibrillator:pediatric") == "yes" else False if p.get("defibrillator:pediatric") == "no" else None
    # CR-TL-1: no check_date in OSM = date unknown (never "today"), so the record counts as "nieaktualne"
    check = p.get("check_date") or p.get("survey:date")
    try:
        rec["data_weryfikacji"] = N.to_date(check) if check else None
    except ValueError:
        rec["data_weryfikacji"] = None
    if rec.get("kod_pocztowy"):
        rec["wojewodztwo"] = N.woj_from_postal(rec["kod_pocztowy"])
    if rec.get("miejscowosc"):
        rec["gmina"] = rec["miejscowosc"]
        if rec["miejscowosc"] in N.CITY_COUNTIES:
            rec["powiat"] = rec["miejscowosc"]
    rec["data_aktualizacji"] = now_min()
    rec["kompletnosc"] = quality.completeness(rec)
    return rec, probs


def check(rec: dict, rid) -> list[dict]:
    out = []
    for pr in validate.validate_record(_fill_for_validation(rec)):
        out.append(_p(rid, pr["pole"], pr["poziom"], rec.get(pr["pole"]) if pr["pole"] else None, None, pr["komunikat"]))
    for f in RELAXED:
        if rec.get(f) in (None, ""):
            out.append(_p(rid, f, "ostrzezenie", None, None, "Brak w OpenStreetMap – pole wymagane uzupełni dysponent (CR-3)."))
    return out


def _fill_for_validation(rec: dict) -> dict:
    """Validation-only copy: relaxed fields get dummy values so only real format errors remain."""
    r = dict(rec)
    for f in RELAXED:
        if r.get(f) in (None, ""):
            r[f] = _FILL.get(f, "x")
    return r


def load_features(source: str | None = None) -> tuple[list[dict], str]:
    if source == "sample":
        return json.loads(SAMPLE.read_text(encoding="utf-8"))["features"], "próbka"
    try:
        body, origin = fetch(URL, CACHE_NAME, timeout=90)
        return json.loads(body)["features"], origin
    except Exception:
        return json.loads(SAMPLE.read_text(encoding="utf-8"))["features"], "próbka (brak sieci i cache)"


def refresh(store: Store, source: str | None = None) -> dict:
    feats, origin = load_features(source)
    counts = {"dodane": 0, "zaktualizowane": 0, "scalone": 0, "odrzucone": 0}
    problems = 0
    powody: dict[str, int] = {}  # rejection reasons (for zrodla meta and docs/tech/LICZBY.md)

    def reject(reason: str):
        counts["odrzucone"] += 1
        powody[reason] = powody.get(reason, 0) + 1

    for f in feats:
        try:
            if (f.get("geometry") or {}).get("type") != "Point":
                reject(f"geometria inna niż punkt ({(f.get('geometry') or {}).get('type')})")
                continue
            rec, probs = to_record(f)
            pipeline.truncate(rec, probs, osm_id(f.get("properties") or {}, f))  # TL: shorten instead of rejecting
            probs += check(rec, osm_id(f.get("properties") or {}, f))
            errors = [pr for pr in probs if pr["poziom"] == "blad"]
            if errors:
                reject(f"{errors[0]['pole'] or 'rekord'}: {errors[0]['komunikat']}")
                continue
            problems += sum(pr["poziom"] == "ostrzezenie" for pr in probs)
            oid = osm_id(f.get("properties") or {}, f)
            # model ról: OSM is a helper layer – never merged with providers' records (no duplicate search)
            res = store.upsert_source(KOD, oid, rec, force_id=dedup.make_id(KOD, oid), commit=False)
            counts[res["status"]] += 1
        except Exception as e:  # malformed feature
            reject(f"nieczytelny obiekt ({type(e).__name__})")
    store.commit()
    store.register_source(KOD, {"nazwa": "OpenStreetMap – warstwa AED (eksport AED OSM Polska)", "typ_zrodla": "spolecznosc",
                                "format": "GeoJSON", "licencja": "ODbL-1.0", "czestotliwosc_aktualizacji": "daily",
                                "obszar": "Polska", "odrzucone": counts["odrzucone"], "url": URL,
                                "odrzucone_powody": powody, "wynik_importu": counts | {"liczba_obiektow": len(feats)},
                                "data_importu": now_min()})
    store.load()  # re-apply the administrator's edits and deletions on top of the refreshed layer
    return counts | {"zrodlo": origin, "liczba_obiektow": len(feats), "ostrzezenia": problems, "odrzucone_powody": powody}
