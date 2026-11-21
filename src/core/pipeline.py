"""Row -> AED record: apply mapping, normalise, infer missing values, validate."""
from __future__ import annotations

from . import hours, normalize as N, schema, validate
from .mapping import ADDRESS, COORDS, STREET
from .store import now_min, today

PLACEHOLDER_ID = "AED-PL-0000000000"

DOSTEP = {
    "publiczny": "publiczny", "yes": "publiczny", "public": "publiczny", "tak": "publiczny", "ogolnodostepny": "publiczny",
    "ogólnodostępny": "publiczny", "otwarty": "publiczny", "dla wszystkich": "publiczny",
    "ograniczony": "ograniczony", "customers": "ograniczony", "permissive": "ograniczony", "destination": "ograniczony",
    "w godzinach pracy": "ograniczony", "recepcja": "ograniczony", "limited": "ograniczony",
    "prywatny": "prywatny", "private": "prywatny", "no": "prywatny", "nie": "prywatny", "staff": "prywatny",
    "employees": "prywatny", "dla pracownikow": "prywatny", "dla pracowników": "prywatny",
}
STATUS = {"sprawny": "sprawny", "ok": "sprawny", "działa": "sprawny", "dziala": "sprawny", "tak": "sprawny",
          "w_serwisie": "w_serwisie", "w serwisie": "w_serwisie", "serwis": "w_serwisie",
          "niesprawny": "niesprawny", "uszkodzony": "niesprawny", "nie działa": "niesprawny", "nie": "niesprawny",
          "nieznany": "nieznany", "brak danych": "nieznany"}

DEFAULT_METHOD = {"dysponent": "deklaracja_dysponenta", "dane_gov_pl": "import_automatyczny",
                  "osm": "import_automatyczny", "zgloszenie_obywatela": "zgloszenie_obywatela", "inne": "import_automatyczny"}


def zrodlo_from_kod(kod_zrodla: str) -> str:
    head = (kod_zrodla or "").split(":")[0]
    return head if head in DEFAULT_METHOD else "inne"


def _convert(field: str, v, problems: list, rownum):
    t = schema.field_types()[field]
    if N.is_empty(v) and t != "boolean":
        return None
    if field == "kod_pocztowy":
        return N.postal(v)
    if field == "kontakt_telefon":
        return N.phone(v)
    if field in ("dysponent_regon", "teryt_terc", "teryt_simc"):
        return N.digits(v)
    if field == "wojewodztwo":
        return N.woj(v)
    if field == "dostep":
        return DOSTEP.get(str(v).strip().lower(), str(v).strip().lower())
    if field == "status_urzadzenia":
        return STATUS.get(str(v).strip().lower(), str(v).strip().lower())
    if field == "godziny_dostepnosci":
        oh, changed = N.opening_hours(v)
        if oh is None:
            problems.append(_p(rownum, field, "ostrzezenie", v, None,
                               "Nie rozpoznano zapisu godzin – wpisz w składni opening_hours, np. „Mo-Fr 08:00-16:00”."))
            return str(v).strip()
        if changed:
            problems.append(_p(rownum, field, "ostrzezenie", v, oh, "Zamieniono zapis godzin na składnię opening_hours."))
        return oh
    if field == "ulica":
        cecha, ul = N.street(v)
        return ul
    if t == "boolean":
        return N.to_bool(v)
    if t == "integer":
        return N.to_int(v)
    if t == "number":
        return N.to_number(v)
    if t == "date":
        return N.to_date(v)
    if t == "datetime":
        return N.to_datetime(v)
    return N.text(v)


def _p(row, field, level, src, prop, msg):
    return {"wiersz": row, "pole": field, "poziom": level,
            "wartosc_zrodlowa": None if src is None else str(src), "propozycja": prop, "komunikat": msg}


def transform(row: dict, mapping: dict, defaults: dict, rownum) -> tuple[dict, list[dict]]:
    rec = schema.empty_record()
    problems: list[dict] = []
    explicit: set[str] = set()
    for col, target in mapping.items():
        if not target or col not in row:
            continue
        v = row[col]
        try:
            if isinstance(target, list) and set(COORDS) <= set(target):
                c = N.coords(v)
                if c:
                    rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"] = c
                    explicit.update(COORDS)
            elif isinstance(target, list) and ("kod_pocztowy" in target or "numer_budynku" in target):
                a = N.address(v)
                if a:
                    for k, val in a.items():
                        if val is not None:
                            rec[k] = val
                            explicit.add(k)
                elif not N.is_empty(v):
                    problems.append(_p(rownum, "numer_budynku", "blad", v, None,
                                       "Nie udało się rozdzielić adresu na ulicę, numer, kod i miejscowość."))
            elif isinstance(target, list) and target == STREET:
                rec["ulica_cecha"], rec["ulica"] = N.street(v)
                explicit.update(STREET)
            elif isinstance(target, str):
                if target == "ulica" and not N.is_empty(v):
                    cecha, ul = N.street(v)
                    rec["ulica"] = ul
                    if not rec.get("ulica_cecha"):
                        rec["ulica_cecha"] = cecha
                else:
                    val = _convert(target, v, problems, rownum)
                    if val is not None or schema.field_types()[target] != "boolean":
                        rec[target] = val
                explicit.add(target)
        except (ValueError, TypeError) as e:
            problems.append(_p(rownum, target if isinstance(target, str) else ",".join(target), "blad", v, None, str(e)))
    _infer(rec, explicit, defaults, problems, rownum)
    return rec, problems


def _info(problems, rownum, field, value, msg):
    problems.append(_p(rownum, field, "informacja", None, value, msg))


def _infer(rec: dict, explicit: set, d: dict, problems: list, rownum):
    kod = d.get("kod_zrodla", "")
    zr = d.get("zrodlo_danych") or zrodlo_from_kod(kod)
    # coordinates: round, swap if obviously swapped
    lat, lon = rec.get("szerokosc_geograficzna"), rec.get("dlugosc_geograficzna")
    if isinstance(lat, float) and isinstance(lon, float):
        if not 49 <= lat <= 55 and 49 <= lon <= 55 and 14 <= lat <= 24.5:
            lat, lon = lon, lat
            problems.append(_p(rownum, "szerokosc_geograficzna", "ostrzezenie", f"{rec['szerokosc_geograficzna']} {rec['dlugosc_geograficzna']}",
                               f"{lat} {lon}", "Zamieniono miejscami szerokość i długość geograficzną."))
        rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"] = round(lat, 6), round(lon, 6)
    # hours / 24h
    if not rec.get("godziny_dostepnosci") and rec.get("dostepny_24h") is True:
        rec["godziny_dostepnosci"] = "24/7"
        _info(problems, rownum, "godziny_dostepnosci", "24/7", "Uzupełniono godziny na podstawie pola „całą dobę”.")
    if rec.get("dostepny_24h") is None and rec.get("godziny_dostepnosci"):
        rec["dostepny_24h"] = hours.is_24_7(rec["godziny_dostepnosci"])
    opis = rec.get("opis_lokalizacji") or ""
    if rec.get("wewnatrz_budynku") is None:
        rec["wewnatrz_budynku"] = not N.outdoor_from_text(opis)
        _info(problems, rownum, "wewnatrz_budynku", rec["wewnatrz_budynku"], "Ustalono na podstawie opisu lokalizacji.")
    if rec.get("pietro") is None and rec["wewnatrz_budynku"] and "pietro" not in explicit:
        f = N.floor_from_text(opis)
        if f is not None:
            rec["pietro"] = f
            _info(problems, rownum, "pietro", f, "Ustalono piętro na podstawie opisu lokalizacji.")
    if not rec.get("dostep"):
        if d.get("dostep"):
            rec["dostep"] = d["dostep"]
        elif rec.get("godziny_dostepnosci"):
            rec["dostep"] = "publiczny" if hours.covers_all_week(rec["godziny_dostepnosci"]) else "ograniczony"
            _info(problems, rownum, "dostep", rec["dostep"], "Ustalono dostępność na podstawie godzin – sprawdź.")
    for f, default in (("szafka_zamknieta", False), ("mobilny", False)):
        if rec.get(f) is None:
            rec[f] = d.get(f, default)
    # address & administrative units
    if not rec.get("wojewodztwo"):
        w = d.get("wojewodztwo") or N.woj_from_postal(rec.get("kod_pocztowy"))
        if w:
            rec["wojewodztwo"] = w
            _info(problems, rownum, "wojewodztwo", w, "Ustalono województwo na podstawie kodu pocztowego.")
    if not rec.get("gmina") and rec.get("miejscowosc"):
        rec["gmina"] = d.get("gmina") or rec["miejscowosc"]
    if not rec.get("powiat") and rec.get("miejscowosc") in N.CITY_COUNTIES:
        rec["powiat"] = rec["miejscowosc"]
    # source / provider metadata
    for f in ("dysponent_nazwa", "dysponent_typ", "status_urzadzenia", "dysponent_regon", "kontakt_telefon", "kontakt_email"):
        if not rec.get(f) and d.get(f):
            rec[f] = d[f]
    if not rec.get("dysponent_nazwa") and rec.get("nazwa_obiektu") and zr != "dysponent":
        rec["dysponent_nazwa"] = rec["nazwa_obiektu"]
    if not rec.get("status_urzadzenia"):
        rec["status_urzadzenia"] = "nieznany"
    if not rec.get("dysponent_typ") and zr != "dysponent":
        rec["dysponent_typ"] = "inny"
    rec["zrodlo_danych"] = zr
    rec["licencja"] = d.get("licencja") or rec.get("licencja") or "CC0-1.0"
    if not rec.get("data_weryfikacji"):
        rec["data_weryfikacji"] = d.get("data_weryfikacji") or today()
    if not rec.get("metoda_weryfikacji"):
        rec["metoda_weryfikacji"] = d.get("metoda_weryfikacji") or DEFAULT_METHOD.get(zr, "import_automatyczny")
    rec["data_aktualizacji"] = d.get("data_aktualizacji") or now_min()
    if not rec.get("id_aed") or not str(rec["id_aed"]).startswith("AED-PL-"):
        rec["id_aed"] = PLACEHOLDER_ID
    from . import quality
    rec["kompletnosc"] = quality.completeness(rec)


ID_COLUMNS = ("id", "osm_id", "@id", "identyfikator", "lp")


def source_id(rec: dict, row: dict, idx: int, id_column: str | None = None) -> str:
    """Stable id of a row within its source: explicit id > owner's id > object name > row index."""
    if id_column and not N.is_empty(row.get(id_column)):
        return str(row[id_column])
    if rec.get("id_dysponenta_aed"):
        return str(rec["id_dysponenta_aed"])
    for c in ID_COLUMNS:
        if not N.is_empty(row.get(c)):
            return str(row[c])
    if rec.get("nazwa_obiektu"):
        return str(rec["nazwa_obiektu"])
    return str(idx)


def truncate(rec: dict, probs: list, rownum) -> None:
    """Automatic imports (OSM, dane.gov.pl): too long texts are shortened with a note instead of rejecting the AED."""
    for f, n in schema.max_lengths().items():
        v = rec.get(f)
        if isinstance(v, str) and len(v) > n:
            rec[f] = v[: n - 1].rstrip() + "…"
            probs.append(_p(rownum, f, "informacja", v[:60] + "…", None, f"Skrócono tekst do {n} znaków."))


def check(rec: dict, rownum) -> list[dict]:
    out = []
    for p in validate.validate_record(rec):
        out.append(_p(rownum, p["pole"], p["poziom"], rec.get(p["pole"]) if p["pole"] else None, None, p["komunikat"]))
    return out


def process_rows(rows: list[dict], mapping: dict, defaults: dict, first_row: int = 2, id_column: str | None = None):
    """Return list of {wiersz, id_w_zrodle, rekord, problemy, poprawny}."""
    out = []
    seen: dict[str, int] = {}
    for i, row in enumerate(rows):
        rownum = i + first_row
        rec, probs = transform(row, mapping, defaults, rownum)
        probs += check(rec, rownum)
        sid = source_id(rec, row, i, id_column)
        seen[sid] = seen.get(sid, 0) + 1
        if seen[sid] > 1:
            sid = f"{sid} #{seen[sid]}"
        out.append({"wiersz": rownum, "id_w_zrodle": sid, "rekord": rec,
                    "problemy": probs, "poprawny": not validate.has_errors(probs)})
    return out
