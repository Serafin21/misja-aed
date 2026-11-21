"""Completeness and the reference scope of each source."""
from __future__ import annotations

from . import schema


def _filled(v) -> bool:
    return v is not None and v != ""


def completeness(rec: dict) -> int:
    """Share (0–100) of filled required + recommended fields. 'kompletnosc' itself counts as not filled."""
    fields = schema.required_fields() + schema.recommended_fields()
    filled = sum(1 for f in fields if f != "kompletnosc" and _filled(rec.get(f)))
    return round(100 * filled / len(fields))


def coverage(records: list[dict]) -> tuple[int, int]:
    """(% required fields filled, % recommended fields filled) over a list of source records."""
    if not records:
        return 0, 0
    req = schema.required_fields()
    rec_f = [f for f in schema.recommended_fields() if f != "kompletnosc"]
    r = sum(_filled(x.get(f)) for x in records for f in req) / (len(records) * len(req))
    z = sum(_filled(x.get(f)) for x in records for f in rec_f) / (len(records) * len(rec_f))
    return round(100 * r), round(100 * z)
