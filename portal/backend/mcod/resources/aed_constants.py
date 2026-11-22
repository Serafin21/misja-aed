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
from typing import List, Optional, Tuple

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

# Wykaz zbiorczy – zakres kolumn (CR-TL-14): jak wykaz chronionych danych (MAIN_DGA_COLUMNS) – czytelne polskie
# nagłówki i tylko pola potrzebne, żeby znaleźć AED i sprawdzić źródło. Pełne 44 pola wzorca zostają w zasobach
# dostawców (kolumna „Link do zasobu źródłowego”). „Identyfikator AED” łączy wiersz z zasobem dostawcy i z kolumną
# „Możliwy duplikat”.
MAIN_AED_PROVIDER_COLUMNS: List[str] = [
    "Nazwa dostawcy",
    "Link do zasobu źródłowego",
]
MAIN_AED_DUPLICATE_COLUMN: str = "Możliwy duplikat"
# nagłówek wykazu zbiorczego -> pole wzorca AED (None = kolumna wyliczana: Lp., dostawca, link, duplikat, ulica, godziny)
MAIN_AED_COLUMN_SOURCES: List[Tuple[str, Optional[str]]] = [
    ("Lp.", None),
    ("Identyfikator AED", "id_aed"),
    ("Nazwa dostawcy", None),
    ("Nazwa obiektu", "nazwa_obiektu"),
    ("Miejscowość", "miejscowosc"),
    ("Ulica", None),  # ulica_cecha + ulica, np. „ul. Królewska”
    ("Numer budynku", "numer_budynku"),
    ("Opis lokalizacji", "opis_lokalizacji"),
    ("Dostęp", "dostep"),
    ("Godziny dostępności", None),  # godziny_dostepnosci albo „24/7”, gdy dostepny_24h = true
    ("Szerokość geograficzna", "szerokosc_geograficzna"),
    ("Długość geograficzna", "dlugosc_geograficzna"),
    ("Data weryfikacji", "data_weryfikacji"),
    ("Link do zasobu źródłowego", None),
    (MAIN_AED_DUPLICATE_COLUMN, None),
]
MAIN_AED_COLUMNS: List[str] = [name for name, _field in MAIN_AED_COLUMN_SOURCES]
MAIN_AED_NUMBER_COLUMNS: List[str] = ["Szerokość geograficzna", "Długość geograficzna"]
# Rekord oznaczany jako „możliwy duplikat”, gdy w promieniu tylu metrów jest AED innego dostawcy (wiersze nie są scalane)
MAIN_AED_DUPLICATE_DISTANCE_M: float = 25.0

# Zasady dane.gov.pl: w tabeli nie zostawia się pustych komórek – brak wartości oznacza się znakiem umownym (tabela
# special_signs, np. „-” = „Zjawisko nie wystąpiło.”), zaznaczonym przy zasobie. Ogólna walidacja danych portalu
# (goodtables, mcod/resources/type_guess.py) traktuje pustą komórkę w kolumnie liczbowej lub daty jako błąd.
# Walidacja wykazu AED czyta znak umowny jak brak wartości; wykaz zbiorczy wpisuje go w puste komórki.
AED_MISSING_VALUE_SIGN: str = "-"
AED_MISSING_VALUE_SIGNS: List[str] = ["-"]
