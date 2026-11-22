"""Wykaz AED – walidacja wykazu dostawcy i budowa wykazu zbiorczego (HackNation 2026, wzorem dga_utils.py).

Walidacja (formularz zasobu w panelu, harvester CKAN i XML):
- komplet 44 kolumn wzorca (kolejność dowolna, dodatkowe kolumny dozwolone),
- wymagane wartości w każdym wierszu (AED_REQUIRED, grupy „jedno z”),
- współrzędne WGS 84 w granicach Polski, TERYT TERC = 7 cyfr, `dostep` ze słownika,
- jeden opublikowany wykaz AED na instytucję (get_aed_resource_for_institution, jak get_dga_resource_for_institution).
"""
import logging
import math
import re
from io import BytesIO
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union

import pandas as pd
from django.core.exceptions import MultipleObjectsReturned
from django.core.files.uploadedfile import InMemoryUploadedFile

from mcod.resources.aed_constants import (
    AED_COLUMNS,
    AED_DOSTEP_VALUES,
    AED_REQUIRED,
    POLAND_LAT,
    POLAND_LON,
    TERYT_TERC_PATTERN,
)
from mcod.resources.dga_utils import create_df_from_dga_file

if TYPE_CHECKING:
    from mcod.resources.models import Resource

logger = logging.getLogger("mcod")

# W komunikacie pokazujemy najwyżej tyle błędnych wierszy – dostawca widzi wzór błędu, a nie tysiąc linii
MAX_ROW_ERRORS = 20


class AEDFileError(Exception):
    """Plik nie jest poprawnym wykazem AED; `errors` – lista komunikatów dla dostawcy."""

    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip() == ""


def _to_float(value: Any) -> Optional[float]:
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def create_df_from_aed_file(file: Union[InMemoryUploadedFile, BytesIO], extension: Optional[str]) -> Optional[pd.DataFrame]:
    """DataFrame z pliku CSV/XLS/XLSX – ten sam odczyt co dla wykazu DGA (wykrywanie kodowania i separatora).
    Wszystkie wartości jako tekst: TERYT „0201011” nie może stracić zera na początku."""
    df = create_df_from_dga_file(file, extension)
    if df is None:
        return None
    df.columns = [str(c).strip() for c in df.columns]
    return df.astype(object).where(pd.notna(df), None)


def validate_aed_df_columns(df: pd.DataFrame) -> List[str]:
    missing = [c for c in AED_COLUMNS if c not in df.columns]
    if missing:
        return [
            f"Brak {len(missing)} z {len(AED_COLUMNS)} kolumn wzorca AED: {', '.join(missing[:10])}"
            + ("…" if len(missing) > 10 else "")
            + "."
        ]
    return []


def validate_aed_row(row: Dict[str, Any]) -> List[str]:
    """Błędy jednego wiersza (pusta lista = wiersz poprawny)."""
    errors: List[str] = []
    for label, columns in AED_REQUIRED:
        if all(_is_empty(row.get(c)) for c in columns):
            errors.append(f"brak wartości: {label}")
    lat, lon = _to_float(row.get("szerokosc_geograficzna")), _to_float(row.get("dlugosc_geograficzna"))
    if not _is_empty(row.get("szerokosc_geograficzna")) and not _is_empty(row.get("dlugosc_geograficzna")):
        if lat is None or lon is None:
            errors.append("współrzędne nie są liczbami")
        elif not (POLAND_LAT[0] <= lat <= POLAND_LAT[1] and POLAND_LON[0] <= lon <= POLAND_LON[1]):
            hint = " (zamienione szerokość i długość?)" if POLAND_LAT[0] <= lon <= POLAND_LAT[1] and POLAND_LON[0] <= lat <= POLAND_LON[1] else ""
            errors.append(f"współrzędne {lat}, {lon} poza Polską{hint}")
    teryt = row.get("teryt_terc")
    if not _is_empty(teryt) and not re.match(TERYT_TERC_PATTERN, str(teryt).strip()):
        errors.append(f"teryt_terc „{teryt}” – wymagane 7 cyfr kodu TERYT gminy")
    dostep = row.get("dostep")
    if not _is_empty(dostep) and str(dostep).strip() not in AED_DOSTEP_VALUES:
        errors.append(f"dostep „{dostep}” – dozwolone: {', '.join(AED_DOSTEP_VALUES)}")
    return errors


def validate_aed_df(df: pd.DataFrame) -> List[str]:
    """Wszystkie błędy wykazu AED (pusta lista = wykaz poprawny)."""
    errors = validate_aed_df_columns(df)
    if errors:
        return errors
    if df.empty:
        return ["Wykaz AED nie zawiera żadnego wiersza."]
    row_errors: List[str] = []
    bad_rows = 0
    for i, row in enumerate(df.to_dict(orient="records"), start=2):  # wiersz 1 = nagłówek
        problems = validate_aed_row(row)
        if problems:
            bad_rows += 1
            if len(row_errors) < MAX_ROW_ERRORS:
                row_errors.append(f"wiersz {i}: " + "; ".join(problems))
    if bad_rows:
        more = f" (pokazano {MAX_ROW_ERRORS})" if bad_rows > MAX_ROW_ERRORS else ""
        return [f"{bad_rows} z {len(df)} wierszy nie spełnia wzorca AED{more}:"] + row_errors
    ids = df["id_aed"].map(lambda v: str(v).strip())
    dup = sorted(set(ids[ids.duplicated()]))
    if dup:
        return [f"Powtórzone id_aed w wykazie: {', '.join(dup[:10])}."]
    return []


def validate_aed_file(file: Union[InMemoryUploadedFile, BytesIO], extension: Optional[str]) -> List[str]:
    """Błędy pliku wykazu AED; pusta lista = plik poprawny (wzór: validate_dga_file_columns)."""
    try:
        df = create_df_from_aed_file(file, extension)
    except Exception as exc:  # noqa: BLE001 – każdy błąd odczytu = plik nieczytelny
        logger.exception(f"Error reading AED file: {exc}")
        return ["Nie udało się odczytać pliku (dozwolone: CSV w UTF-8, XLS, XLSX)."]
    finally:
        if hasattr(file, "seek"):
            file.seek(0)
    if df is None:
        return ["Nie udało się odczytać pliku (dozwolone: CSV w UTF-8, XLS, XLSX)."]
    return validate_aed_df(df)


def get_aed_resource_for_institution(
    organization_id: Union[int, str],
    exclude_resource_id: Optional[Union[int, str]] = None,
) -> Optional["Resource"]:  # noqa: F821
    """Opublikowany wykaz AED instytucji (najwyżej jeden), bez wykazu zbiorczego (wzór: get_dga_resource_for_institution)."""
    from mcod.resources.models import Resource

    exclude_ids: List[Union[int, str]] = []
    main = get_main_aed_resource()
    if main:
        exclude_ids.append(main.pk)
    if exclude_resource_id:
        exclude_ids.append(exclude_resource_id)
    query = Resource.objects.filter(
        dataset__organization=organization_id,
        contains_aed_list=True,
        status="published",
    ).exclude(id__in=exclude_ids)
    count = query.count()
    if count > 1:
        message = f"Found {count} AED list Resources for organization: {organization_id}"
        logger.error(message)
        raise MultipleObjectsReturned(message)
    return query.first()


def get_main_aed_resource() -> Optional["Resource"]:  # noqa: F821
    from django.apps import apps

    try:
        AggregatedAEDInfo = apps.get_model("resources", "AggregatedAEDInfo")
    except LookupError:  # model added in a later step of the increment
        return None
    info = AggregatedAEDInfo.objects.last()
    return info.main_aed_resource if info else None


def get_aed_resources_info_from_xml_harvester_file(loaded_data: List[Dict[str, Any]]) -> List[Tuple]:
    """(extIdent, tytuł) zasobów oznaczonych w XML jako containsAedList (wzór: get_dga_resources_info_from_xml_harvester_file)."""
    out: List[Tuple] = []
    for ds in loaded_data:
        for rs in ds.get("resources") or []:
            if rs.get("containsAedList"):
                out.append((rs.get("extIdent"), (rs.get("title") or {}).get("polish")))
    return out


def format_aed_file_errors(errors: List[str]) -> str:
    """Komunikat dla panelu i raportu harvestera (wzór: format_res_dga_url_bad_columns_error_details)."""
    head, *rows = errors
    detail = "".join(f"<p>{r}</p>" for r in rows)
    return f"<p>{head}</p>" + (f'<div class="expandable">{detail}</div>' if detail else "")
