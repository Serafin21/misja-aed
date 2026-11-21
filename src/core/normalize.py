"""Value normalisation according to the dane.gov.pl technical standard."""
from __future__ import annotations

import re
from datetime import date, datetime

from . import hours

TRUE = {"true", "tak", "t", "yes", "y", "1", "prawda", "x", "✓", "on"}
FALSE = {"false", "nie", "n", "no", "0", "fałsz", "falsz", "off", "-"}

CECHY = {
    "ul": "ul.", "ulica": "ul.", "al": "al.", "aleja": "al.", "aleje": "al.", "pl": "pl.", "plac": "pl.",
    "os": "os.", "osiedle": "os.", "rondo": "rondo", "skwer": "skwer", "bulw": "bulw.", "bulwar": "bulw.",
}

# Postal code region prefix -> voivodeship (first two digits; approximate, flagged as a warning).
_POSTAL_WOJ = [
    (0, 9, "mazowieckie"), (10, 14, "warmińsko-mazurskie"), (15, 19, "podlaskie"), (20, 24, "lubelskie"),
    (25, 29, "świętokrzyskie"), (30, 34, "małopolskie"), (35, 39, "podkarpackie"), (40, 44, "śląskie"),
    (45, 49, "opolskie"), (50, 59, "dolnośląskie"), (60, 64, "wielkopolskie"), (65, 69, "lubuskie"),
    (70, 78, "zachodniopomorskie"), (80, 84, "pomorskie"), (85, 89, "kujawsko-pomorskie"), (90, 99, "łódzkie"),
]

# Cities with county rights (miasta na prawach powiatu) – powiat equals the city name.
CITY_COUNTIES = {
    "Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin",
    "Białystok", "Katowice", "Gdynia", "Częstochowa", "Radom", "Toruń", "Sosnowiec", "Rzeszów", "Kielce",
    "Gliwice", "Olsztyn", "Zabrze", "Bielsko-Biała", "Bytom", "Zielona Góra", "Rybnik", "Ruda Śląska",
    "Opole", "Tychy", "Gorzów Wielkopolski", "Elbląg", "Płock", "Dąbrowa Górnicza", "Wałbrzych",
    "Włocławek", "Tarnów", "Chorzów", "Koszalin", "Kalisz", "Legnica", "Grudziądz", "Jaworzno", "Słupsk",
    "Jastrzębie-Zdrój", "Nowy Sącz", "Jelenia Góra", "Siedlce", "Mysłowice", "Piotrków Trybunalski",
    "Konin", "Inowrocław", "Lubin", "Ostrołęka", "Suwałki", "Gniezno", "Przemyśl", "Leszno", "Zamość",
    "Chełm", "Biała Podlaska", "Łomża", "Piekary Śląskie", "Siemianowice Śląskie", "Świętochłowice",
    "Żory", "Krosno", "Tarnobrzeg", "Skierniewice", "Sopot", "Świnoujście", "Mysłowice",
}


def is_empty(v) -> bool:
    return v is None or (isinstance(v, str) and v.strip() in ("", "-", "brak", "b.d.", "bd", "n/a", "null"))


def to_bool(v) -> bool | None:
    if isinstance(v, bool):
        return v
    if is_empty(v) and v != "-":
        return None
    s = str(v).strip().lower()
    if s in TRUE:
        return True
    if s in FALSE:
        return False
    raise ValueError(f"Nie rozpoznano wartości logicznej: {v!r}")


def to_number(v) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "").replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:  # 1.234,56 or 1,234.56
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    else:
        s = s.replace(",", ".")
    return float(s)


def to_int(v) -> int | None:
    n = to_number(v)
    if n is None:
        return None
    if n != int(n):
        raise ValueError(f"Oczekiwano liczby całkowitej: {v!r}")
    return int(n)


def to_date(v) -> str | None:
    if is_empty(v):
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%Y.%m.%d", "%Y-%m-%dT%H:%M",
                "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(s[:19], fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Nieprawidłowa data: {v!r}")


def to_datetime(v) -> str | None:
    if is_empty(v):
        return None
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%dT%H:%M")
    s = str(v).strip().replace(" ", "T")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19], fmt).strftime("%Y-%m-%dT%H:%M")
        except ValueError:
            continue
    raise ValueError(f"Nieprawidłowa data i czas: {v!r}")


def digits(v) -> str | None:
    if is_empty(v):
        return None
    return re.sub(r"\D", "", str(v)) or None


def phone(v) -> str | None:
    if is_empty(v):
        return None
    s = re.sub(r"[\s\-()./]", "", str(v))
    if s.startswith("0048"):
        s = "+48" + s[4:]
    if s.startswith("48") and len(s) == 11:
        s = "+" + s
    # Standard techniczny 3.1: Polish numbers as 9 digits, without prefix, spaces or hyphens
    if s.startswith("+48") and len(s) == 12:
        s = s[3:]
    return s


def postal(v) -> str | None:
    if is_empty(v):
        return None
    s = re.sub(r"\s", "", str(v))
    if re.fullmatch(r"\d{5}", s):
        return f"{s[:2]}-{s[2:]}"
    return s


def woj_from_postal(kod: str | None) -> str | None:
    if not kod or not re.match(r"^\d{2}-\d{3}$", kod):
        return None
    p = int(kod[:2])
    for a, b, w in _POSTAL_WOJ:
        if a <= p <= b:
            return w
    return None


def woj(v) -> str | None:
    if is_empty(v):
        return None
    s = str(v).strip().lower()
    s = re.sub(r"^(woj\.?|województwo)\s+", "", s)
    return s


def coords(v) -> tuple[float, float] | None:
    """'52,243700 21,013900' / '52.2437, 21.0139' / '52.2437;21.0139' -> (lat, lon)."""
    if is_empty(v):
        return None
    s = str(v).strip().strip("()[]")
    parts = [p for p in re.split(r"[\s;|]+", s) if p]
    if len(parts) == 2:
        nums = [to_number(p.rstrip(",")) for p in parts]
    else:
        parts = [p.strip() for p in s.split(",")]
        if len(parts) == 2:
            nums = [to_number(p) for p in parts]
        elif len(parts) == 4:  # 52,2437,21,0139
            nums = [to_number(parts[0] + "." + parts[1]), to_number(parts[2] + "." + parts[3])]
        else:
            raise ValueError(f"Nie rozpoznano współrzędnych: {v!r}")
    lat, lon = nums
    return lat, lon


_ADDR_RE = re.compile(
    r"^\s*(?:(?P<cecha>ul|ulica|al|aleja|aleje|pl|plac|os|osiedle|rondo|skwer|bulw|bulwar)\.?\s+)?"
    r"(?P<ulica>.+?)\s+(?P<nr>\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?)(?:\s*(?:/|m\.|lok\.)\s*(?P<lok>\w+))?"
    r"\s*,?\s*(?P<kod>\d{2}-\d{3})\s+(?P<miasto>.+?)\s*$",
    re.IGNORECASE,
)
_ADDR_CITY_FIRST = re.compile(
    r"^\s*(?P<kod>\d{2}-\d{3})\s+(?P<miasto>[^,]+),\s*(?:(?P<cecha>ul|al|pl|os|rondo|skwer|bulw)\.?\s+)?"
    r"(?P<ulica>.+?)\s+(?P<nr>\d+[A-Za-z]?)(?:\s*/\s*(?P<lok>\w+))?\s*$",
    re.IGNORECASE,
)
_ADDR_VILLAGE = re.compile(r"^\s*(?P<miasto>[^\d,]+?)\s+(?P<nr>\d+[A-Za-z]?)\s*,\s*(?P<kod>\d{2}-\d{3})(?:\s+.+)?$")


def address(v) -> dict | None:
    """Split one-field address into ulica_cecha, ulica, numer_budynku, numer_lokalu, kod_pocztowy, miejscowosc."""
    if is_empty(v):
        return None
    s = str(v).strip()
    for rx in (_ADDR_RE, _ADDR_CITY_FIRST):
        m = rx.match(s)
        if m:
            g = m.groupdict()
            cecha = CECHY.get((g.get("cecha") or "").lower().rstrip(".")) if g.get("cecha") else None
            if not cecha and g.get("ulica"):
                cecha = "ul."
            return {
                "ulica_cecha": cecha, "ulica": g["ulica"].strip(), "numer_budynku": g["nr"],
                "numer_lokalu": g.get("lok"), "kod_pocztowy": g["kod"], "miejscowosc": g["miasto"].strip(),
            }
    m = _ADDR_VILLAGE.match(s)
    if m:
        return {"ulica_cecha": None, "ulica": None, "numer_budynku": m["nr"], "numer_lokalu": None,
                "kod_pocztowy": m["kod"], "miejscowosc": m["miasto"].strip()}
    return None


def street(v) -> tuple[str | None, str | None]:
    """'ul. Testowa' -> ('ul.', 'Testowa'); 'Testowa' -> ('ul.', 'Testowa')."""
    if is_empty(v):
        return None, None
    s = str(v).strip()
    m = re.match(r"^(ul|ulica|al|aleja|aleje|pl|plac|os|osiedle|rondo|skwer|bulw|bulwar)\.?\s+(.+)$", s, re.I)
    if m:
        return CECHY[m.group(1).lower()], m.group(2).strip()
    return "ul.", s


_ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10}


def floor_from_text(text: str | None) -> int | None:
    if not text:
        return None
    t = text.lower()
    if re.search(r"\bparter\b|\bhol\b|\bholu\b|\bpoziom 0\b", t):
        return 0
    m = re.search(r"\b(-?\d{1,2})\s*\.?\s*(?:piętro|pietro|p\.)", t) or re.search(r"(?:piętro|pietro)\s*(-?\d{1,2})\b", t)
    if m:
        return int(m.group(1))
    m = re.search(r"\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\s+(?:piętro|pietro)", t)
    if m:
        return _ROMAN[m.group(1)]
    if re.search(r"piwnic|podziem|poziom -1|\b-1\b", t):
        return -1
    return None


def outdoor_from_text(text: str | None) -> bool:
    t = (text or "").lower()
    return bool(re.search(r"elewacj|na zewnątrz|na zewnatrz|kapsuł|kapsul|przed wejściem|przed budynkiem|ściana zewn|wiata|słup", t))


def opening_hours(v) -> tuple[str | None, bool]:
    return hours.normalize(None if is_empty(v) else str(v))


def text(v, max_len: int | None = None) -> str | None:
    if is_empty(v):
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s
