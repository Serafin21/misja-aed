"""Subset of OSM opening_hours: parsing, 'open now', and normalisation of free text."""
from __future__ import annotations

import re
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Warsaw")
DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

_PL_DAYS = {
    "pn": "Mo", "pon": "Mo", "poniedziałek": "Mo", "poniedzialek": "Mo",
    "wt": "Tu", "wto": "Tu", "wtorek": "Tu",
    "śr": "We", "sr": "We", "środa": "We", "sroda": "We",
    "cz": "Th", "czw": "Th", "czwartek": "Th",
    "pt": "Fr", "pią": "Fr", "pia": "Fr", "piątek": "Fr", "piatek": "Fr",
    "sb": "Sa", "sob": "Sa", "so": "Sa", "sobota": "Sa",
    "nd": "Su", "ndz": "Su", "nie": "Su", "niedz": "Su", "niedziela": "Su",
}
for _d in DAYS:
    _PL_DAYS[_d.lower()] = _d

_TIME = r"(\d{1,2})(?:[:.](\d{2}))?"
_RANGE_RE = re.compile(rf"^{_TIME}\s*-\s*{_TIME}$")
_DAYSPEC_RE = re.compile(r"^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$")


class Unparsable(ValueError):
    pass


def _expand_days(spec: str) -> set[int]:
    days: set[int] = set()
    for part in spec.split(","):
        m = _DAYSPEC_RE.match(part.strip())
        if not m:
            raise Unparsable(spec)
        a = DAYS.index(m.group(1))
        b = DAYS.index(m.group(2)) if m.group(2) else a
        i = a
        while True:
            days.add(i)
            if i == b:
                break
            i = (i + 1) % 7
    return days


def _minutes(h: str, m: str | None) -> int:
    hh, mm = int(h), int(m or 0)
    if hh > 24 or mm > 59:
        raise Unparsable(f"{h}:{m}")
    return hh * 60 + mm


def parse(oh: str) -> list[tuple[set[int], list[tuple[int, int]] | None]]:
    """Return rules: (days, intervals) – intervals None means 'off'. Raises Unparsable."""
    oh = (oh or "").strip()
    if not oh:
        raise Unparsable(oh)
    if oh == "24/7":
        return [(set(range(7)), [(0, 24 * 60)])]
    rules = []
    for rule in oh.split(";"):
        rule = rule.strip()
        if not rule:
            continue
        m = re.match(r"^((?:Mo|Tu|We|Th|Fr|Sa|Su)[A-Za-z,\-]*)\s+(.+)$", rule)
        if m:
            days, rest = _expand_days(m.group(1)), m.group(2).strip()
        else:
            days, rest = set(range(7)), rule
        if rest == "off" or rest == "closed":
            rules.append((days, None))
            continue
        intervals = []
        for span in rest.split(","):
            r = _RANGE_RE.match(span.strip())
            if not r:
                raise Unparsable(rule)
            start, end = _minutes(r.group(1), r.group(2)), _minutes(r.group(3), r.group(4))
            intervals.append((start, end))
        rules.append((days, intervals))
    if not rules:
        raise Unparsable(oh)
    return rules


def is_valid(oh: str) -> bool:
    try:
        parse(oh)
        return True
    except Unparsable:
        return False


def is_open(oh: str | None, when: datetime | None = None) -> bool | None:
    """True/False, or None when the expression is outside the supported subset."""
    try:
        rules = parse(oh or "")
    except Unparsable:
        return None
    when = (when or datetime.now(TZ)).astimezone(TZ)
    day, minute = when.weekday(), when.hour * 60 + when.minute
    prev_day = (day - 1) % 7
    # later rules override earlier ones for the days they mention (OSM semantics)
    effective: dict[int, list[tuple[int, int]] | None] = {}
    for days, intervals in rules:
        for d in days:
            effective[d] = intervals
    for start, end in effective.get(day) or []:
        if start <= end and start <= minute < end:
            return True
        if start > end and minute >= start:  # e.g. 20:00-02:00
            return True
    for start, end in effective.get(prev_day) or []:
        if start > end and minute < end:
            return True
    return False


def is_24_7(oh: str | None) -> bool:
    if not oh:
        return False
    if oh.strip() == "24/7":
        return True
    try:
        rules = parse(oh)
    except Unparsable:
        return False
    covered = {d for days, iv in rules if iv and any(s == 0 and e == 1440 for s, e in iv) for d in days}
    return covered == set(range(7))


def covers_all_week(oh: str | None) -> bool:
    try:
        rules = parse(oh or "")
    except Unparsable:
        return False
    effective: dict[int, object] = {}
    for days, iv in rules:
        for d in days:
            effective[d] = iv
    return all(effective.get(d) for d in range(7))


# ---------- free text -> opening_hours ----------

_ALWAYS = {"całodobowo", "calodobowo", "24h", "24/7", "24 h", "cała doba", "cala doba", "całą dobę",
           "non-stop", "nonstop", "całodobowy", "całodobowa", "zawsze"}


def _norm_time(h: str, m: str | None) -> str:
    return f"{int(h):02d}:{int(m or 0):02d}"


def _pl_day(tok: str) -> str | None:
    return _PL_DAYS.get(tok.strip().strip(".").lower())


def normalize(text: str | None) -> tuple[str | None, bool]:
    """Return (opening_hours, changed). (None, False) when it cannot be interpreted."""
    if text is None:
        return None, False
    raw = str(text).strip()
    if not raw:
        return None, False
    if is_valid(raw):
        return raw, False
    low = raw.lower()
    if low in _ALWAYS or "całodob" in low or "calodob" in low:
        return "24/7", True
    rules = []
    for chunk in re.split(r"[;,\n]+", raw):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.match(r"^([^\d]+?)\.?\s*(\d.*)$", chunk)
        if not m:
            return None, False
        dayspec, times = m.group(1).strip().rstrip(":"), m.group(2).strip()
        days = re.split(r"\s*[-–]\s*", dayspec)
        mapped = [_pl_day(d) for d in days]
        if not all(mapped) or len(mapped) > 2:
            return None, False
        t = re.match(rf"^{_TIME}\s*[-–]\s*{_TIME}$", times.replace("godz.", "").strip())
        if not t:
            return None, False
        span = f"{_norm_time(t.group(1), t.group(2))}-{_norm_time(t.group(3), t.group(4))}"
        rules.append(f"{'-'.join(mapped)} {span}")
    if not rules:
        return None, False
    out = "; ".join(rules)
    return (out, True) if is_valid(out) else (None, False)
