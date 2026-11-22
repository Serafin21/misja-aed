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


# =====================================================================================================================
# Wykaz zbiorczy (create_main_aed_resource_task, wzorem create_main_dga_resource_task)
# =====================================================================================================================
def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def mark_possible_duplicates(df: pd.DataFrame, distance_m: Optional[float] = None) -> pd.Series:
    """Kolumna „Możliwy duplikat”: id_aed rekordów INNYCH dostawców w promieniu `distance_m` (domyślnie 25 m).
    Wiersze nie są scalane – oba zostają w wykazie, a za każdy odpowiada jego dostawca."""
    from mcod.resources.aed_constants import MAIN_AED_DUPLICATE_DISTANCE_M

    limit = distance_m or MAIN_AED_DUPLICATE_DISTANCE_M
    cell = 0.001  # ~110 m – siatka do szukania sąsiadów
    grid: Dict[Tuple[int, int], List[int]] = {}
    pts: List[Optional[Tuple[float, float]]] = []
    for i, (lat, lon) in enumerate(zip(df["szerokosc_geograficzna"], df["dlugosc_geograficzna"])):
        la, lo = _to_float(lat), _to_float(lon)
        pts.append((la, lo) if la is not None and lo is not None else None)
        if pts[-1]:
            grid.setdefault((int(la // cell), int(lo // (cell * 1.6))), []).append(i)
    providers = list(df["Nazwa dostawcy"])
    ids = [str(v) for v in df["id_aed"]]
    out: List[str] = []
    for i, p in enumerate(pts):
        near: List[str] = []
        if p:
            ky, kx = int(p[0] // cell), int(p[1] // (cell * 1.6))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    for j in grid.get((ky + dy, kx + dx), []):
                        if j != i and providers[j] != providers[i] and _haversine_m(p[0], p[1], *pts[j]) <= limit:
                            near.append(ids[j])
        out.append("tak: " + ", ".join(sorted(set(near))) if near else "")
    return pd.Series(out, index=df.index)


def get_all_aed_resources_sorted_by_organizations():
    """Opublikowane wykazy AED dostawców z zakończoną walidacją, bez wykazu zbiorczego (wzór: DGA)."""
    from django.apps import apps

    Resource = apps.get_model("resources", "Resource")
    main = get_main_aed_resource()
    return (
        Resource.objects.filter(
            contains_aed_list=True,
            status="published",
            data_tasks_last_status="SUCCESS",
            file_tasks_last_status="SUCCESS",
            link_tasks_last_status="SUCCESS",
        )
        .exclude(id=main.pk if main else None)
        .select_related("dataset__organization")
        .order_by("dataset__organization__title")
    )


def get_aed_source_df(resource: "Resource") -> Optional[pd.DataFrame]:
    """Wiersze wykazu AED jednego dostawcy: plik zasobu (wgrany w panelu) albo plik z linku (harvester).
    Zasób bez kolumn wzorca jest pomijany; wiersze niezgodne ze wzorcem są pomijane i liczone w logu."""
    import os
    from mimetypes import guess_extension as _ext

    from mcod.resources.dga_utils import get_remote_extension_if_correct_dga_content_type, request_remote_dga

    df: Optional[pd.DataFrame] = None
    main_file = getattr(resource, "main_file", None)
    try:
        if main_file and getattr(main_file, "path", None) and os.path.exists(main_file.path):
            extension = os.path.splitext(main_file.path)[1][1:].lower()
            with open(main_file.path, "rb") as f:
                df = create_df_from_aed_file(BytesIO(f.read()), extension)
        elif resource.link:
            response = request_remote_dga(resource.link)
            extension = get_remote_extension_if_correct_dga_content_type(response) if response.status_code == 200 else None
            if extension is None:
                guessed = _ext(response.headers.get("Content-Type", "")) if response.status_code == 200 else None
                extension = guessed[1:] if guessed else None
            df = create_df_from_aed_file(BytesIO(response.content), extension) if extension else None
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Skipping AED list resource {resource.pk}: cannot read the file ({exc}).")
        return None
    if df is None or validate_aed_df_columns(df):
        logger.error(f"Skipping AED list resource {resource.pk}: missing AED template columns.")
        return None
    rows = df.to_dict(orient="records")
    ok = [r for r in rows if not validate_aed_row(r)]
    if len(ok) < len(rows):
        logger.warning(f"AED list resource {resource.pk}: {len(rows) - len(ok)} of {len(rows)} rows skipped (template errors).")
    return pd.DataFrame(ok, columns=df.columns) if ok else None


def create_main_aed_df(resources) -> pd.DataFrame:
    """Wykaz zbiorczy: wiersze wszystkich dostawców jeden pod drugim + dostawca, typ instytucji, link do zasobu
    źródłowego, data aktualizacji zasobu i „Możliwy duplikat”. Bez scalania i bez zmiany treści wierszy."""
    from mcod.resources.aed_constants import (
        AED_COLUMNS,
        MAIN_AED_COLUMNS,
        MAIN_AED_DUPLICATE_COLUMN,
    )

    parts: List[pd.DataFrame] = []
    for resource in resources:
        df = get_aed_source_df(resource)
        if df is None or df.empty:
            continue
        org = resource.dataset.organization
        df = df.reindex(columns=AED_COLUMNS)
        df.insert(0, "Nazwa dostawcy", org.title)
        df.insert(1, "Typ instytucji", org.get_institution_type_display())
        df.insert(2, "Link do zasobu źródłowego", getattr(resource, "frontend_absolute_url", None) or resource.link)
        updated = resource.data_date or (resource.modified.date() if resource.modified else None)
        df.insert(3, "Data aktualizacji zasobu", updated.isoformat() if updated else None)
        parts.append(df)
    columns_without_lp = [c for c in MAIN_AED_COLUMNS if c != "Lp."]
    main_df = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=columns_without_lp)
    main_df[MAIN_AED_DUPLICATE_COLUMN] = mark_possible_duplicates(main_df) if not main_df.empty else []
    main_df.insert(0, "Lp.", range(1, len(main_df) + 1))
    return main_df[MAIN_AED_COLUMNS]


def create_main_aed_files() -> Tuple[str, str]:
    """Pliki wykazu zbiorczego: CSV (UTF-8, przecinek) i XLSX; zwraca ścieżki (csv, xlsx)."""
    import datetime
    import os

    from django.conf import settings

    from mcod.core.utils import save_df_to_xlsx

    directory = settings.MAIN_AED_RESOURCE_CREATION_ROOT
    os.makedirs(directory, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d")
    base = os.path.join(directory, f"{settings.MAIN_AED_FILE_NAME_PREFIX} {stamp}")
    df = create_main_aed_df(get_all_aed_resources_sorted_by_organizations())
    df.to_csv(base + ".csv", index=False, encoding="utf-8")
    save_df_to_xlsx(df=df, file_path=base + ".xlsx", sheet_name=settings.MAIN_AED_XLSX_WORKSHEET_NAME)
    logger.info(f"Main AED files created: {len(df)} rows.")
    return base + ".csv", base + ".xlsx"


def create_main_aed_dataset() -> int:
    """Zbiór „Wykaz AED – wykaz zbiorczy” instytucji Ministerstwo Cyfryzacji (wzór: create_main_dga_dataset)."""
    from django.apps import apps
    from django.conf import settings
    from django.core.exceptions import ObjectDoesNotExist

    Organization = apps.get_model("organizations", "Organization")
    Dataset = apps.get_model("datasets", "Dataset")
    Category = apps.get_model("categories", "Category")
    Tag = apps.get_model("tags", "Tag")
    try:
        institution = Organization.objects.get(pk=settings.MAIN_AED_DATASET_OWNER_ORGANIZATION_PK)
    except Organization.DoesNotExist:
        raise ObjectDoesNotExist("Main AED owner institution not found.")
    dataset = Dataset.objects.create(
        title=settings.MAIN_AED_DATASET_DEFAULT_TITLE,
        notes=settings.MAIN_AED_DATASET_DEFAULT_DESC,
        organization=institution,
        update_notification_recipient_email=settings.MAIN_AED_DATASET_UPDATE_NOTIFICATION_EMAIL,
        has_dynamic_data=False,
        has_high_value_data=False,
        has_high_value_data_from_ec_list=False,
        has_research_data=False,
        update_frequency="daily",
        status="published",
    )
    dataset.categories.set(Category.objects.filter(title__in=settings.MAIN_AED_DATASET_CATEGORIES_TITLES))
    lang = settings.LANGUAGES[0][0]
    dataset.tags.set([Tag.objects.get_or_create(name=n, language=lang)[0] for n in settings.MAIN_AED_DATASET_TAGS_NAMES])
    dataset.save()
    return dataset.pk


def get_main_aed_dataset():
    from django.apps import apps

    try:
        AggregatedAEDInfo = apps.get_model("resources", "AggregatedAEDInfo")
    except LookupError:
        return None
    info = AggregatedAEDInfo.objects.last()
    return info.main_aed_dataset if info else None


def create_main_aed_resource_with_dataset(csv_path: str, xlsx_path: str) -> Tuple[int, Optional[int]]:
    """Zasób wykazu zbiorczego (plik główny CSV + XLSX) w zbiorze MC; zbiór tworzony, gdy go nie ma."""
    import datetime
    import os

    from django.apps import apps
    from django.conf import settings
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.db import transaction

    Resource = apps.get_model("resources", "Resource")
    ResourceFile = apps.get_model("resources", "ResourceFile")
    Dataset = apps.get_model("datasets", "Dataset")
    old = get_main_aed_resource()
    dataset = get_main_aed_dataset()
    created_dataset: Optional[int] = None
    with transaction.atomic():
        if dataset is None:
            created_dataset = create_main_aed_dataset()
            dataset = Dataset.objects.get(pk=created_dataset)
        resource = Resource.objects.create(
            title=old.title if old else settings.MAIN_AED_RESOURCE_DEFAULT_TITLE,
            description=old.description if old else settings.MAIN_AED_RESOURCE_DEFAULT_DESC,
            dataset=dataset,
            has_dynamic_data=False,
            has_high_value_data=False,
            has_high_value_data_from_ec_list=False,
            has_research_data=False,
            contains_aed_list=True,
            status="published",
            data_date=datetime.datetime.today(),
        )
        for path, mime, is_main in (
            (csv_path, "text/csv", True),
            (xlsx_path, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", False),
        ):
            with open(path, "rb") as f:
                ResourceFile.objects.create(
                    resource=resource,
                    is_main=is_main,
                    file=SimpleUploadedFile(name=os.path.basename(path), content=f.read(), content_type=mime),
                )
    return resource.pk, created_dataset


def update_or_create_aggr_aed_info_and_delete_old_main_aed(new_main: "Resource") -> None:
    """AggregatedAEDInfo wskazuje nowy wykaz zbiorczy, stary zasób jest usuwany (wzór: DGA)."""
    from django.apps import apps
    from django.db import transaction

    AggregatedAEDInfo = apps.get_model("resources", "AggregatedAEDInfo")
    info = AggregatedAEDInfo.objects.last()
    old = info.main_aed_resource if info else None
    with transaction.atomic():
        if info:
            info.resource = new_main
            info.save()
        else:
            AggregatedAEDInfo.objects.create(resource=new_main)
        if old and old.pk != new_main.pk:
            old.delete()


def clean_up_after_main_aed_resource_creation(created: Optional[Tuple[int, Optional[int]]], paths: Tuple[str, ...],
                                              exception_occurred: bool) -> None:
    """Po błędzie usuwa utworzony zasób i zbiór; zawsze usuwa pliki tymczasowe."""
    import os

    from django.apps import apps

    if exception_occurred and created:
        resource_pk, dataset_pk = created
        if resource_pk:
            apps.get_model("resources", "Resource").raw.filter(pk=resource_pk).delete()
        if dataset_pk:
            apps.get_model("datasets", "Dataset").raw.filter(pk=dataset_pk).delete()
    for p in paths:
        try:
            if p and os.path.exists(p):
                os.remove(p)
        except OSError as exc:
            logger.error(f"Cannot delete main AED temp file {p}: {exc}")
