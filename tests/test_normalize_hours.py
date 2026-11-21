from datetime import datetime

import pytest

from src.core import hours, normalize as N
from src.core.hours import TZ


@pytest.mark.parametrize("src,exp", [
    ("pn-pt 8-16", "Mo-Fr 08:00-16:00"),
    ("pn-pt 10-19, sob 10-14", "Mo-Fr 10:00-19:00; Sa 10:00-14:00"),
    ("całodobowo", "24/7"),
    ("Pn-Pt 7:30-15:30; Sob 9.00-13.00", "Mo-Fr 07:30-15:30; Sa 09:00-13:00"),
    ("Mo-Fr 08:00-16:00", "Mo-Fr 08:00-16:00"),
])
def test_hours_normalize(src, exp):
    assert hours.normalize(src)[0] == exp


def test_hours_unparsable():
    assert hours.normalize("w godzinach pracy urzędu")[0] is None
    assert hours.is_open("sunrise-sunset") is None


def test_is_open():
    mon_10 = datetime(2026, 11, 23, 10, 0, tzinfo=TZ)
    sat_15 = datetime(2026, 11, 21, 15, 0, tzinfo=TZ)
    assert hours.is_open("Mo-Fr 08:00-16:00", mon_10) is True
    assert hours.is_open("Mo-Fr 08:00-16:00", sat_15) is False
    assert hours.is_open("Mo-Fr 10:00-19:00; Sa 10:00-14:00", sat_15) is False
    assert hours.is_open("24/7", sat_15) is True
    assert hours.is_open("Mo-Su 20:00-02:00", datetime(2026, 11, 24, 1, 0, tzinfo=TZ)) is True
    assert hours.is_open("Mo-Fr 08:00-16:00; We off", datetime(2026, 11, 25, 10, 0, tzinfo=TZ)) is False


def test_bool_number_date():
    assert N.to_bool("TAK") is True and N.to_bool("nie") is False and N.to_bool("1") is True
    assert N.to_number("52,2437") == 52.2437
    assert N.to_number("1 234,5") == 1234.5
    assert N.to_date("21.11.2026") == "2026-11-21"
    with pytest.raises(ValueError):
        N.to_bool("może")


def test_address_and_coords():
    a = N.address("ul. Królewska 27, 00-060 Warszawa")
    assert a == {"ulica_cecha": "ul.", "ulica": "Królewska", "numer_budynku": "27", "numer_lokalu": None,
                 "kod_pocztowy": "00-060", "miejscowosc": "Warszawa"}
    assert N.address("al. Przykładowa 5A, 00-950 Warszawa")["numer_budynku"] == "5A"
    assert N.coords("52,243700 21,013900") == (52.2437, 21.0139)
    assert N.coords("52.2437, 21.0139") == (52.2437, 21.0139)
    assert N.woj_from_postal("30-059") == "małopolskie"
    assert N.floor_from_text("I piętro, przy dziekanacie") == 1
    assert N.outdoor_from_text("kapsuła na elewacji przy wejściu") is True
