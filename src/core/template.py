"""XLSX template for AED owners (data entry only – published data is CSV/GeoJSON)."""
from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from . import schema

SKIP = {"id_aed", "kompletnosc", "data_aktualizacji", "zrodlo_danych"}


def template_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "dane"
    dd = {r["nazwa_pola"]: r for r in schema.data_dictionary()}
    fields = [f for f in schema.field_order() if f not in SKIP]
    req = set(schema.required_fields())
    dicts = schema.dictionaries()
    lists = wb.create_sheet("slowniki")
    col_of_dict = {}
    for i, (name, values) in enumerate(dicts.items(), start=1):
        lists.cell(1, i, name).font = Font(bold=True)
        for j, v in enumerate(values, start=2):
            lists.cell(j, i, v)
        col_of_dict[name] = (get_column_letter(i), len(values) + 1)
    bool_col = len(dicts) + 1
    lists.cell(1, bool_col, "logiczne").font = Font(bold=True)
    lists.cell(2, bool_col, "true"); lists.cell(3, bool_col, "false")
    types = schema.field_types()
    for c, f in enumerate(fields, start=1):
        cell = ws.cell(1, c, f)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1B5E20" if f in req else "607D8B")
        cell.alignment = Alignment(wrap_text=True)
        ws.column_dimensions[get_column_letter(c)].width = max(14, min(40, len(f) + 4))
        letter = get_column_letter(c)
        src = None
        slownik = dd[f]["slownik"]
        if slownik and slownik in col_of_dict:
            col, n = col_of_dict[slownik]
            src = f"slowniki!${col}$2:${col}${n}"
        elif types[f] == "boolean":
            bl = get_column_letter(bool_col)
            src = f"slowniki!${bl}$2:${bl}$3"
        if src:
            dv = DataValidation(type="list", formula1=f"={src}", allow_blank=f not in req)
            dv.error = "Wybierz wartość ze słownika."
            ws.add_data_validation(dv)
            dv.add(f"{letter}2:{letter}5000")
    ws.freeze_panes = "A2"
    info = wb.create_sheet("instrukcja", 0)
    info["A1"] = "Szablon danych AED – wzorcowy zakres danych v0.9"
    info["A1"].font = Font(bold=True, size=14)
    rows = ["Wypełnij arkusz „dane”: jeden wiersz = jedno urządzenie. Zielone kolumny są wymagane.",
            "Wartości logiczne: true / false. Daty: rrrr-mm-dd. Współrzędne: WGS 84, kropka dziesiętna.",
            "Godziny dostępności w składni opening_hours, np. 24/7 albo Mo-Fr 08:00-16:00; Sa 09:00-13:00.",
            "Plik wgraj w panelu dysponenta – system sprawdzi go i pokaże raport błędów."]
    for i, t in enumerate(rows, start=3):
        info.cell(i, 1, t)
    info.cell(8, 1, "Pole").font = Font(bold=True)
    for j, h in enumerate(["etykieta", "opis", "format", "przyklad", "obowiazkowosc"], start=2):
        info.cell(8, j, h).font = Font(bold=True)
    for i, f in enumerate(fields, start=9):
        info.cell(i, 1, f)
        for j, h in enumerate(["etykieta", "opis", "format", "przyklad", "obowiazkowosc"], start=2):
            info.cell(i, j, dd[f][h])
    info.column_dimensions["A"].width = 28
    info.column_dimensions["C"].width = 70
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
