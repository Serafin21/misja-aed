"""Wykaz AED – stałe (HackNation 2026, wzorem mcod/resources/dga_constants.py).

Wykaz AED dostawcy = zasób (CSV/XLS/XLSX) z kolumnami wzorcowego zakresu danych AED v0.9 (44 pola,
deliverables/zakres_danych/wzorcowy_zakres_danych_AED_v0.9.xlsx w repozytorium projektu). Portal co noc łączy wykazy
wszystkich dostawców w „Wykaz AED – wykaz zbiorczy” (zasób zbioru Ministerstwa Cyfryzacji), tak jak łączy wykazy
chronionych danych (DGA). Wiersze NIE są scalane: każdy wiersz ma dostawcę i link do zasobu źródłowego, a za jego treść
odpowiada dostawca.

Tak jak w DGA trzy listy mają różne zadania:
- AED_COLUMNS – struktura pojedynczego wykazu dostawcy (kolejność dowolna, komplet kolumn wymagany),
- AED_REQUIRED – pola, które w każdym wierszu muszą mieć wartość (grupy „jedno z”),
- MAIN_AED_COLUMNS – struktura wykazu zbiorczego.
"""
from typing import List, Tuple

from mcod.organizations.models import Organization

AED_RESOURCE_EXTENSIONS: List[str] = ["xlsx", "xls", "csv"]

# 44 pola wzorcowego zakresu danych AED v0.9 – w tej kolejności (słownik danych: docs/schema/slownik_danych.csv)
AED_COLUMNS: List[str] = [
    "id_aed",
    "id_dysponenta_aed",
    "nazwa_obiektu",
    "opis_lokalizacji",
    "pietro",
    "wewnatrz_budynku",
    "wojewodztwo",
    "powiat",
    "gmina",
    "miejscowosc",
    "ulica_cecha",
    "ulica",
    "numer_budynku",
    "numer_lokalu",
    "kod_pocztowy",
    "teryt_terc",
    "teryt_simc",
    "szerokosc_geograficzna",
    "dlugosc_geograficzna",
    "dostep",
    "godziny_dostepnosci",
    "dostepny_24h",
    "szafka_zamknieta",
    "instrukcja_dostepu",
    "mobilny",
    "status_urzadzenia",
    "tryb_pediatryczny",
    "producent",
    "model",
    "data_waznosci_elektrod",
    "data_ostatniego_przegladu",
    "dysponent_nazwa",
    "dysponent_typ",
    "dysponent_regon",
    "kontakt_telefon",
    "kontakt_email",
    "zrodlo_danych",
    "licencja",
    "data_weryfikacji",
    "metoda_weryfikacji",
    "data_aktualizacji",
    "kompletnosc",
    "zdjecie_url",
    "uwagi",
]

# Wymagane wartości w każdym wierszu. Każdy element to grupa: wystarczy wartość w jednej z kolumn grupy
# (np. „godziny_dostepnosci lub dostepny_24h”, „kontakt” = telefon lub e-mail). Nazwa grupy trafia do komunikatu błędu.
AED_REQUIRED: List[Tuple[str, Tuple[str, ...]]] = [
    ("id_aed", ("id_aed",)),
    ("nazwa_obiektu", ("nazwa_obiektu",)),
    ("adres – miejscowość", ("miejscowosc",)),
    ("adres – numer budynku", ("numer_budynku",)),
    ("adres – kod pocztowy", ("kod_pocztowy",)),
    ("teryt_terc", ("teryt_terc",)),
    ("szerokosc_geograficzna", ("szerokosc_geograficzna",)),
    ("dlugosc_geograficzna", ("dlugosc_geograficzna",)),
    ("dostep", ("dostep",)),
    ("godziny_dostepnosci lub dostepny_24h", ("godziny_dostepnosci", "dostepny_24h")),
    ("data_weryfikacji", ("data_weryfikacji",)),
    ("kontakt (kontakt_telefon lub kontakt_email)", ("kontakt_telefon", "kontakt_email")),
]

AED_DOSTEP_VALUES: List[str] = ["publiczny", "ograniczony", "prywatny"]

# Polska (z marginesem): współrzędne WGS 84 spoza tego prostokąta są błędem (np. zamienione szerokość i długość)
POLAND_LAT: Tuple[float, float] = (49.0, 54.9)
POLAND_LON: Tuple[float, float] = (14.1, 24.2)
TERYT_TERC_PATTERN: str = r"^\d{7}$"

# Wykaz AED mogą publikować wszystkie typy instytucji – AED mają też firmy, fundacje i uczelnie
# (inaczej niż DGA: ALLOWED_DGA_INSTITUTIONS = samorządy i administracja państwowa).
ALLOWED_AED_INSTITUTIONS: List[str] = [code for code, _label in Organization.INSTITUTION_TYPE_CHOICES]

# Wykaz zbiorczy: dostawca, typ instytucji, link do zasobu, data aktualizacji zasobu, 44 kolumny wzorca, możliwy duplikat
MAIN_AED_PROVIDER_COLUMNS: List[str] = [
    "Nazwa dostawcy",
    "Typ instytucji",
    "Link do zasobu źródłowego",
    "Data aktualizacji zasobu",
]
MAIN_AED_DUPLICATE_COLUMN: str = "Możliwy duplikat"
MAIN_AED_COLUMNS: List[str] = ["Lp."] + MAIN_AED_PROVIDER_COLUMNS + AED_COLUMNS + [MAIN_AED_DUPLICATE_COLUMN]
# Rekord oznaczany jako „możliwy duplikat”, gdy w promieniu tylu metrów jest AED innego dostawcy (wiersze nie są scalane)
MAIN_AED_DUPLICATE_DISTANCE_M: float = 25.0

# Zasady dane.gov.pl: w tabeli nie zostawia się pustych komórek – brak wartości oznacza się znakiem umownym (tabela
# special_signs, np. „-” = „Zjawisko nie wystąpiło.”), zaznaczonym przy zasobie. Ogólna walidacja danych portalu
# (goodtables, mcod/resources/type_guess.py) traktuje pustą komórkę w kolumnie liczbowej lub daty jako błąd.
# Walidacja wykazu AED czyta znak umowny jak brak wartości; wykaz zbiorczy wpisuje go w puste komórki.
AED_MISSING_VALUE_SIGN: str = "-"
AED_MISSING_VALUE_SIGNS: List[str] = ["-"]
