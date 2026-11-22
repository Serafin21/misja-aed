"""Wykaz AED – testy wzorem test_main_dga.py i test_dga_utils.py."""
from io import BytesIO
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from django.conf import settings
from django.core.exceptions import MultipleObjectsReturned

from mcod.resources.aed_constants import (
    AED_COLUMNS,
    ALLOWED_AED_INSTITUTIONS,
    MAIN_AED_COLUMNS,
    MAIN_AED_DUPLICATE_COLUMN,
)
from mcod.resources.aed_utils import (
    create_main_aed_df,
    format_aed_file_errors,
    get_aed_resources_info_from_xml_harvester_file,
    main_aed_table_schema,
    mark_possible_duplicates,
    validate_aed_df,
    validate_aed_file,
    validate_aed_row,
)


def _row(**kw):
    row = {c: None for c in AED_COLUMNS}
    row.update(
        id_aed="AED-PL-0000000001",
        nazwa_obiektu="Urząd Gminy Przykładowo",
        miejscowosc="Warszawa",
        numer_budynku="27",
        kod_pocztowy="00-060",
        teryt_terc="1465011",
        szerokosc_geograficzna="52.2401",
        dlugosc_geograficzna="21.0154",
        dostep="publiczny",
        godziny_dostepnosci="Mo-Fr 08:00-16:00",
        data_weryfikacji="2026-11-02",
        kontakt_email="aed@przykladowo.example",
    )
    row.update(kw)
    return row


def _csv(rows) -> BytesIO:
    buf = BytesIO()
    pd.DataFrame(rows, columns=AED_COLUMNS).to_csv(buf, index=False)
    buf.seek(0)
    return buf


# ---------- constants ----------
def test_aed_columns_are_44_template_fields():
    assert len(AED_COLUMNS) == 44 and len(set(AED_COLUMNS)) == 44
    # wykaz zbiorczy (CR-TL-14): jak wykaz DGA – czytelne nagłówki, inny (węższy) zakres kolumn niż 44 pola wzorca
    assert MAIN_AED_COLUMNS == [
        "Lp.", "Identyfikator AED", "Nazwa dostawcy", "Nazwa obiektu", "Miejscowość", "Ulica", "Numer budynku",
        "Opis lokalizacji", "Dostęp", "Godziny dostępności", "Szerokość geograficzna", "Długość geograficzna",
        "Data weryfikacji", "Link do zasobu źródłowego", MAIN_AED_DUPLICATE_COLUMN,
    ]
    assert len(set(MAIN_AED_COLUMNS)) == len(MAIN_AED_COLUMNS) == 15


def test_all_institution_types_can_publish_aed_list():
    from mcod.organizations.models import Organization

    assert set(ALLOWED_AED_INSTITUTIONS) == {code for code, _ in Organization.INSTITUTION_TYPE_CHOICES}


# ---------- validation ----------
def test_valid_row_has_no_errors():
    assert validate_aed_row(_row()) == []


@pytest.mark.parametrize(
    "changes, expected",
    [
        ({"id_aed": None}, "brak wartości: id_aed"),
        ({"teryt_terc": "146501"}, "teryt_terc „146501”"),
        ({"szerokosc_geograficzna": "21.0154", "dlugosc_geograficzna": "52.2401"}, "zamienione szerokość i długość"),
        ({"szerokosc_geograficzna": "40.0"}, "poza Polską"),
        ({"dostep": "nie wiem"}, "dostep „nie wiem”"),
        ({"godziny_dostepnosci": None, "dostepny_24h": None}, "godziny_dostepnosci lub dostepny_24h"),
        ({"kontakt_email": None, "kontakt_telefon": None}, "kontakt (kontakt_telefon lub kontakt_email)"),
        ({"kod_pocztowy": " "}, "adres – kod pocztowy"),
    ],
)
def test_row_errors(changes, expected):
    errors = validate_aed_row(_row(**changes))
    assert any(expected in e for e in errors), errors


def test_one_of_groups_accept_either_column():
    assert validate_aed_row(_row(godziny_dostepnosci=None, dostepny_24h="true")) == []
    assert validate_aed_row(_row(kontakt_email=None, kontakt_telefon="+48120000000")) == []


def test_missing_columns():
    df = pd.DataFrame([_row()]).drop(columns=["teryt_terc", "dostep"])
    errors = validate_aed_df(df)
    assert errors == ["Brak 2 z 44 kolumn wzorca AED: teryt_terc, dostep."]


def test_column_order_does_not_matter_and_extra_columns_are_allowed():
    df = pd.DataFrame([_row()])[list(reversed(AED_COLUMNS))]
    df["moja kolumna"] = "x"
    assert validate_aed_df(df) == []


def test_duplicated_ids_and_empty_list():
    assert validate_aed_df(pd.DataFrame([_row(), _row()])) == ["Powtórzone id_aed w wykazie: AED-PL-0000000001."]
    assert validate_aed_df(pd.DataFrame(columns=AED_COLUMNS)) == ["Wykaz AED nie zawiera żadnego wiersza."]


def test_validate_aed_file_csv_keeps_teryt_leading_zero():
    rows = [_row(teryt_terc="0201011", szerokosc_geograficzna="51.1", dlugosc_geograficzna="16.9")]
    assert validate_aed_file(_csv(rows), "csv") == []


def test_special_sign_dash_means_no_value():
    """Zasady dane.gov.pl: pusta komórka = znak umowny „-”. W polu nieobowiązkowym jest poprawny, w wymaganym = brak."""
    rows = [{c: (v if v is not None else "-") for c, v in _row().items()}]
    assert validate_aed_file(_csv(rows), "csv") == []
    bad = [{c: (v if v is not None else "-") for c, v in _row(kontakt_email="-", teryt_terc="-").items()}]
    errors = validate_aed_file(_csv(bad), "csv")
    assert "brak wartości" in errors[1] and "teryt_terc" in errors[1] and "kontakt" in errors[1]


def test_main_aed_table_schema_fixed_types_and_special_sign():
    """Wykaz zbiorczy ma stały schemat danych – portal nie zgaduje typów („5A”, „00-950” są poprawne)."""
    s = main_aed_table_schema()
    types = {f["name"]: f["type"] for f in s["fields"]}
    assert [f["name"] for f in s["fields"]] == MAIN_AED_COLUMNS and s["missingValues"] == ["-"]
    assert types["Numer budynku"] == types["Identyfikator AED"] == types["Data weryfikacji"] == "string"
    assert types["Szerokość geograficzna"] == types["Długość geograficzna"] == "number" and types["Lp."] == "integer"


def test_validate_aed_file_reports_rows():
    rows = [_row(), _row(id_aed="AED-PL-0000000002", szerokosc_geograficzna="99")]
    errors = validate_aed_file(_csv(rows), "csv")
    assert errors[0] == "1 z 2 wierszy nie spełnia wzorca AED:" and errors[1].startswith("wiersz 3:")
    assert "<div class=\"expandable\">" in format_aed_file_errors(errors)


def test_validate_aed_file_unreadable():
    assert validate_aed_file(BytesIO(b"\x00\x01"), "xlsx") == ["Nie udało się odczytać pliku (dozwolone: CSV w UTF-8, XLS, XLSX)."]


def test_xml_harvester_aed_resources_info():
    data = [{"resources": [{"extIdent": "r1", "title": {"polish": "Wykaz AED"}, "containsAedList": True},
                           {"extIdent": "r2", "title": {"polish": "Inny"}}]}]
    assert get_aed_resources_info_from_xml_harvester_file(data) == [("r1", "Wykaz AED")]


# ---------- main AED list ----------
def test_possible_duplicates_only_between_providers():
    df = pd.DataFrame([
        dict(_row(id_aed="A1"), **{"Nazwa dostawcy": "Uczelnia"}),
        dict(_row(id_aed="A2", szerokosc_geograficzna="52.2402"), **{"Nazwa dostawcy": "MPK"}),  # ~11 m
        dict(_row(id_aed="A3", szerokosc_geograficzna="52.24015"), **{"Nazwa dostawcy": "Uczelnia"}),  # same provider
        dict(_row(id_aed="A4", szerokosc_geograficzna="52.25"), **{"Nazwa dostawcy": "Gmina"}),  # ~1 km
    ])
    assert list(mark_possible_duplicates(df)) == ["tak: A2", "tak: A1, A3", "tak: A2", ""]


def _resource(pk, org_title, institution_type="local"):
    r = MagicMock()
    r.pk = pk
    r.dataset.organization.title = org_title
    r.dataset.organization.get_institution_type_display.return_value = institution_type
    r.frontend_absolute_url = f"https://mcod.local/pl/dataset/1/resource/{pk}"
    r.data_date = pd.Timestamp("2026-11-02").date()
    return r


def test_create_main_aed_df_keeps_rows_and_providers():
    sources = {
        1: pd.DataFrame([_row(id_aed="U1"), _row(id_aed="U2", szerokosc_geograficzna="52.30")]),
        2: pd.DataFrame([_row(id_aed="M1", szerokosc_geograficzna="52.2402")]),
        3: None,  # unreadable resource is skipped
    }
    resources = [_resource(1, "Uczelnia Testowa", "Inne"), _resource(2, "MPK Przykładowo"), _resource(3, "Pusty")]
    with patch("mcod.resources.aed_utils.get_aed_source_df", side_effect=lambda r: sources[r.pk]):
        df = create_main_aed_df(resources)
    assert list(df.columns) == MAIN_AED_COLUMNS
    assert list(df["Lp."]) == [1, 2, 3]
    assert list(df["Nazwa dostawcy"]) == ["Uczelnia Testowa", "Uczelnia Testowa", "MPK Przykładowo"]
    assert list(df["Identyfikator AED"]) == ["U1", "U2", "M1"]  # no merging, provider's values unchanged
    assert df.loc[0, "Link do zasobu źródłowego"].endswith("/resource/1")
    assert df.loc[0, "Szerokość geograficzna"] == _row()["szerokosc_geograficzna"]
    assert list(df[MAIN_AED_DUPLICATE_COLUMN]) == ["tak: M1", "", "tak: U1"]


def test_create_main_aed_df_street_and_hours():
    sources = {1: pd.DataFrame([
        _row(id_aed="S1", ulica_cecha="ul.", ulica="Królewska", dostepny_24h="true", godziny_dostepnosci=None),
        _row(id_aed="S2", ulica_cecha=None, ulica="Rynek", dostepny_24h="false", godziny_dostepnosci="Mo-Fr 08:00-16:00"),
    ])}
    with patch("mcod.resources.aed_utils.get_aed_source_df", side_effect=lambda r: sources[r.pk]):
        df = create_main_aed_df([_resource(1, "Urząd")])
    assert list(df["Ulica"]) == ["ul. Królewska", "Rynek"]
    assert list(df["Godziny dostępności"]) == ["24/7", "Mo-Fr 08:00-16:00"]


def test_create_main_aed_df_empty():
    with patch("mcod.resources.aed_utils.get_aed_source_df", return_value=None):
        df = create_main_aed_df([_resource(1, "X")])
    assert df.empty and list(df.columns) == MAIN_AED_COLUMNS


# ---------- database (factories) ----------
@pytest.mark.django_db
def test_get_aed_resource_for_institution():
    from mcod.datasets.factories import DatasetFactory
    from mcod.resources.aed_utils import get_aed_resource_for_institution
    from mcod.resources.factories import AEDResourceFactory

    dataset = DatasetFactory.create()
    assert get_aed_resource_for_institution(dataset.organization.pk) is None
    first = AEDResourceFactory.create(dataset=dataset, status="published")
    assert get_aed_resource_for_institution(dataset.organization.pk) == first
    assert get_aed_resource_for_institution(dataset.organization.pk, exclude_resource_id=first.pk) is None
    AEDResourceFactory.create(dataset=dataset, status="published")
    with pytest.raises(MultipleObjectsReturned):
        get_aed_resource_for_institution(dataset.organization.pk)


@pytest.mark.django_db
def test_aggregated_aed_info_single_instance_and_main_resource():
    from django.core.exceptions import ValidationError

    from mcod.resources.aed_utils import get_main_aed_resource
    from mcod.resources.factories import AggregatedAEDInfoFactory
    from mcod.resources.models import AggregatedAEDInfo

    info = AggregatedAEDInfoFactory.create(resource__status="published")
    assert get_main_aed_resource() == info.resource
    with pytest.raises(ValidationError):
        AggregatedAEDInfo.objects.create(resource=info.resource)


@pytest.mark.django_db
def test_create_main_aed_dataset(main_dga_owner_organization):
    from mcod.datasets.models import Dataset
    from mcod.resources.aed_utils import create_main_aed_dataset

    with patch.object(settings, "MAIN_AED_DATASET_OWNER_ORGANIZATION_PK", main_dga_owner_organization.pk):
        pk = create_main_aed_dataset()
    ds = Dataset.objects.get(pk=pk)
    assert ds.title == settings.MAIN_AED_DATASET_DEFAULT_TITLE and ds.organization == main_dga_owner_organization


def test_main_aed_task_steps():
    from mcod.resources.tasks.aed import create_main_aed_resource_task

    resource = MagicMock()
    with patch("mcod.resources.tasks.aed.create_main_aed_files", return_value=("a.csv", "a.xlsx")) as files, \
            patch("mcod.resources.tasks.aed.create_main_aed_resource_with_dataset", return_value=(7, None)) as create, \
            patch("mcod.resources.tasks.aed.check_all_resource_validations_status") as check, \
            patch("mcod.resources.tasks.aed.update_or_create_aggr_aed_info_and_delete_old_main_aed") as update, \
            patch("mcod.resources.tasks.aed.clean_up_after_main_aed_resource_creation") as clean, \
            patch("mcod.resources.tasks.aed.apps.get_model") as get_model:
        get_model.return_value.objects.get.return_value = resource
        create_main_aed_resource_task.apply(throw=True)
    files.assert_called_once()
    create.assert_called_once_with("a.csv", "a.xlsx")
    check.assert_called_once_with(resource)
    update.assert_called_once_with(resource)
    clean.assert_called_once_with((7, None), ("a.csv", "a.xlsx"), exception_occurred=False)
