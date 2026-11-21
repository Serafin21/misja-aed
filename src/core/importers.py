"""Read source files (CSV, XLSX, JSON, GeoJSON) into flat rows + detected format."""
from __future__ import annotations

import csv
import io
import json


def _decode(data: bytes) -> tuple[str, str]:
    for enc in ("utf-8-sig", "utf-8", "cp1250", "iso-8859-2"):
        try:
            text = data.decode(enc)
            return text, ("UTF-8" if enc.startswith("utf-8") else enc.upper())
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1"), "ISO-8859-1"


def flatten(obj: dict, prefix: str = "") -> dict:
    out = {}
    for k, v in obj.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flatten(v, key + "."))
        elif isinstance(v, list) and all(not isinstance(x, (dict, list)) for x in v):
            out[key] = "; ".join(str(x) for x in v)
        else:
            out[key] = v
    return out


def read_csv(data: bytes) -> tuple[list[dict], dict]:
    text, enc = _decode(data)
    sample = text[:20000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
        sep = dialect.delimiter
    except csv.Error:
        first = sample.splitlines()[0] if sample else ""
        sep = max(";,\t|", key=first.count)
    reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=sep)
    rows = []
    for r in reader:
        r = {(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items() if k is not None}
        if any(v not in (None, "") for v in r.values()):
            rows.append(r)
    import re
    dec_comma = sum(bool(re.search(r"\b\d{1,3},\d{3,}\b", str(v))) for r in rows[:50] for v in r.values()) > 0
    return rows, {"format": "CSV", "separator": sep, "kodowanie": enc, "przecinek_dziesietny": dec_comma}


def read_xlsx(data: bytes) -> tuple[list[dict], dict]:
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    # prefer a sheet named like the data sheet of our template
    ws = None
    for name in wb.sheetnames:
        if name.lower() in ("dane", "aed", "szablon", "dane_aed"):
            ws = wb[name]
            break
    ws = ws or wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    header = None
    rows = []
    for raw in it:
        if header is None:
            if raw and sum(c is not None and str(c).strip() != "" for c in raw) >= 2:
                header = [str(c).strip() if c is not None else "" for c in raw]
            continue
        if not raw or all(c is None or str(c).strip() == "" for c in raw):
            continue
        rows.append({h: c for h, c in zip(header, raw) if h})
    return rows, {"format": "XLSX", "arkusz": ws.title}


def read_json(data: bytes) -> tuple[list[dict], dict]:
    text, enc = _decode(data)
    obj = json.loads(text)
    if isinstance(obj, dict) and obj.get("type") == "FeatureCollection":
        rows = []
        for i, f in enumerate(obj.get("features", [])):
            props = flatten(f.get("properties") or {})
            geom = f.get("geometry") or {}
            if geom.get("type") == "Point":
                lon, lat = geom["coordinates"][:2]
                props.setdefault("szerokosc_geograficzna", lat)
                props.setdefault("dlugosc_geograficzna", lon)
            if f.get("id") is not None:
                props.setdefault("id", f["id"])
            rows.append(props)
        return rows, {"format": "GeoJSON", "kodowanie": enc}
    if isinstance(obj, dict):
        for key in ("data", "features", "items", "records", "aed", "wyniki"):
            if isinstance(obj.get(key), list):
                obj = obj[key]
                break
        else:
            obj = [obj]
    rows = []
    for item in obj:
        if isinstance(item, dict) and isinstance(item.get("attributes"), dict):  # JSON API
            item = {"id_aed": item.get("id"), **item["attributes"]}
        rows.append(flatten(item) if isinstance(item, dict) else {"wartosc": item})
    return rows, {"format": "JSON", "kodowanie": enc}


def read_any(filename: str, data: bytes) -> tuple[list[dict], dict]:
    name = (filename or "").lower()
    if name.endswith((".xlsx", ".xlsm")) or data[:2] == b"PK":
        return read_xlsx(data)
    if name.endswith((".json", ".geojson")) or data.lstrip()[:1] in (b"{", b"["):
        return read_json(data)
    return read_csv(data)
