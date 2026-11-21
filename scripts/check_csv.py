"""Check CSV files against the dane.gov.pl technical standard (level 3).

Usage: python scripts/check_csv.py plik.csv [...]   -> exit code 1 when any rule fails
"""
from __future__ import annotations

import csv
import io
import re
import sys

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$")


def check(path: str) -> list[str]:
    raw = open(path, "rb").read()
    errs = []
    if raw.startswith(b"\xef\xbb\xbf"):
        errs.append("plik zaczyna się od BOM (wymagane UTF-8 bez BOM)")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return ["kodowanie inne niż UTF-8"]
    if b"\n" in raw.replace(b"\r\n", b""):
        errs.append("końce wierszy inne niż CRLF")
    if not raw.endswith(b"\r\n"):
        errs.append("brak CRLF na końcu ostatniego wiersza")
    rows = list(csv.reader(io.StringIO(text, newline=""), delimiter=",", strict=True))
    if not rows:
        return errs + ["pusty plik"]
    header = rows[0]
    if len(set(header)) != len(header):
        errs.append("powtórzone nazwy kolumn")
    if any(not h.strip() for h in header):
        errs.append("pusta nazwa kolumny w nagłówku")
    if any(not re.fullmatch(r"[a-z0-9_]+", h) for h in header):
        errs.append("nazwy kolumn powinny być zrozumiałe i bez spacji (a-z, 0-9, _)")
    for i, r in enumerate(rows[1:], start=2):
        if len(r) != len(header):
            errs.append(f"wiersz {i}: {len(r)} pól zamiast {len(header)}")
        if not any(c.strip() for c in r):
            errs.append(f"wiersz {i}: pusty wiersz")
        for h, v in zip(header, r):
            if v.lower() in ("tak", "nie", "yes", "no", "True", "False") and v not in ("true", "false"):
                errs.append(f"wiersz {i}, {h}: wartość logiczna „{v}” – tylko true/false")
            if h.startswith("data_") and v and not (DATE.match(v) or DATETIME.match(v)):
                errs.append(f"wiersz {i}, {h}: data „{v}” nie w formacie rrrr-mm-dd")
            if h in ("szerokosc_geograficzna", "dlugosc_geograficzna") and v and not re.fullmatch(r"-?\d+\.\d+", v):
                errs.append(f"wiersz {i}, {h}: liczba „{v}” – kropka dziesiętna, bez separatorów")
    empty_cols = [h for j, h in enumerate(header) if len(rows) > 1 and all(len(r) > j and r[j] == "" for r in rows[1:])]
    if empty_cols and len(rows) > 1:
        errs.append(f"informacja: kolumny bez wartości w tym wydaniu: {', '.join(empty_cols)} (dopuszczalne – pola opcjonalne)")
    return errs


def main(argv):
    bad = False
    for p in argv:
        errs = check(p)
        hard = [e for e in errs if not e.startswith("informacja")]
        print(f"{'OK ' if not hard else 'BŁĄD'} {p}")
        for e in errs:
            print(f"   - {e}")
        bad |= bool(hard)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
