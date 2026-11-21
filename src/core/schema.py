"""Load the reference data scope (docs/schema) – single source of truth for fields."""
from __future__ import annotations

import csv
import json
import os
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(os.environ.get("AED_ROOT", Path(__file__).resolve().parents[2]))
SCHEMA_DIR = ROOT / "docs" / "schema"


@lru_cache(maxsize=1)
def json_schema() -> dict:
    return json.loads((SCHEMA_DIR / "aed.schema.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def dictionaries() -> dict[str, list[str]]:
    raw = json.loads((SCHEMA_DIR / "slowniki.json").read_text(encoding="utf-8"))
    return {k: [item["wartosc"] for item in v] for k, v in raw.items()}


@lru_cache(maxsize=1)
def data_dictionary() -> list[dict]:
    with open(SCHEMA_DIR / "slownik_danych.csv", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=1)
def field_order() -> list[str]:
    """Column order of published CSV – exactly as in the data dictionary."""
    return [row["nazwa_pola"] for row in data_dictionary()]


@lru_cache(maxsize=1)
def required_fields() -> list[str]:
    return list(json_schema()["required"])


@lru_cache(maxsize=1)
def recommended_fields() -> list[str]:
    return [r["nazwa_pola"] for r in data_dictionary() if r["obowiazkowosc"] == "zalecane"]


@lru_cache(maxsize=1)
def field_types() -> dict[str, str]:
    """Simple type per field: string | integer | number | boolean | date | datetime."""
    out: dict[str, str] = {}
    for name, spec in json_schema()["properties"].items():
        variants = spec.get("anyOf", [spec])
        main = next((v for v in variants if v.get("type") != "null"), variants[0])
        t = main.get("type", "string")
        fmt = main.get("format")
        if fmt == "date":
            t = "date"
        elif fmt == "date-time" or name == "data_aktualizacji":
            t = "datetime"
        out[name] = t
    return out


@lru_cache(maxsize=1)
def max_lengths() -> dict[str, int]:
    out = {}
    for r in data_dictionary():
        m = re.search(r"maks\.\s*(\d+)", r["format"])
        if m:
            out[r["nazwa_pola"]] = int(m.group(1))
    return out


@lru_cache(maxsize=1)
def labels() -> dict[str, str]:
    return {r["nazwa_pola"]: r["etykieta"] for r in data_dictionary()}


def empty_record() -> dict:
    return {f: None for f in field_order()}
