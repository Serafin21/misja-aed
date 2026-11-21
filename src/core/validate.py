"""Validation against docs/schema/aed.schema.json + extra rules, with Polish messages."""
from __future__ import annotations

import re
from datetime import date

from jsonschema import Draft202012Validator, FormatChecker

from . import schema

_validator: Draft202012Validator | None = None


def validator() -> Draft202012Validator:
    global _validator
    if _validator is None:
        _validator = Draft202012Validator(schema.json_schema(), format_checker=FormatChecker())
    return _validator


def _msg(err) -> tuple[str | None, str]:
    field = err.path[0] if err.path else None
    v = err.validator
    if v == "required":
        missing = re.findall(r"'([^']+)'", err.message)[0]
        return missing, f"Brak wymaganego pola „{schema.labels().get(missing, missing)}”."
    if v == "additionalProperties":
        extra = ", ".join(re.findall(r"'([^']+)'", err.message))
        return None, f"Nieznane pole spoza zakresu danych: {extra}."
    if v == "enum":
        return field, f"Wartość spoza słownika. Dozwolone: {', '.join(map(str, err.validator_value))}."
    if v == "pattern":
        return field, f"Nieprawidłowy format (oczekiwany wzorzec {err.validator_value})."
    if v in ("minimum", "maximum"):
        return field, f"Wartość poza zakresem (współrzędne muszą leżeć w granicach Polski)." if field and "geograficzna" in field else f"Wartość poza dozwolonym zakresem."
    if v == "type" and err.instance is None:
        return field, f"Pole wymagane „{schema.labels().get(field, field)}” – uzupełnij."
    if v == "enum" and err.instance is None:
        return field, f"Pole wymagane „{schema.labels().get(field, field)}” – wybierz wartość ze słownika."
    if v == "type":
        names = {"string": "tekst", "integer": "liczba całkowita", "number": "liczba", "boolean": "true/false"}
        return field, f"Nieprawidłowy typ – oczekiwano: {names.get(err.validator_value, err.validator_value)}."
    if v == "format":
        return field, "Nieprawidłowy format daty (oczekiwano rrrr-mm-dd)." if err.validator_value == "date" else "Nieprawidłowy format."
    if v == "anyOf":
        # report the most relevant sub-error
        sub = sorted(err.context, key=lambda e: e.validator == "type")
        if sub:
            f2, m2 = _msg(sub[0])
            return field, m2
    return field, err.message


def validate_record(rec: dict) -> list[dict]:
    """Return list of problems: {pole, poziom, komunikat}. 'blad' blocks inclusion."""
    problems: list[dict] = []
    for err in validator().iter_errors(rec):
        field, message = _msg(err)
        problems.append({"pole": field, "poziom": "blad", "komunikat": message})
    # extra rules not expressible in JSON Schema
    for f, n in schema.max_lengths().items():
        v = rec.get(f)
        if isinstance(v, str) and len(v) > n:
            problems.append({"pole": f, "poziom": "blad", "komunikat": f"Tekst dłuższy niż {n} znaków."})
    p = rec.get("pietro")
    if isinstance(p, int) and not -5 <= p <= 100:
        problems.append({"pole": "pietro", "poziom": "blad", "komunikat": "Piętro poza zakresem -5…100."})
    k = rec.get("kompletnosc")
    if isinstance(k, int) and not 0 <= k <= 100:
        problems.append({"pole": "kompletnosc", "poziom": "blad", "komunikat": "Kompletność poza zakresem 0…100."})
    e = rec.get("kontakt_email")
    if e and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", str(e)):
        problems.append({"pole": "kontakt_email", "poziom": "blad", "komunikat": "Nieprawidłowy adres e-mail."})
    u = rec.get("zdjecie_url")
    if u and not str(u).startswith("https://"):
        problems.append({"pole": "zdjecie_url", "poziom": "blad", "komunikat": "Adres zdjęcia musi zaczynać się od https://."})
    if rec.get("dostepny_24h") is True and rec.get("godziny_dostepnosci") not in (None, "24/7"):
        problems.append({"pole": "dostepny_24h", "poziom": "ostrzezenie",
                         "komunikat": "Urządzenie oznaczone jako całodobowe, ale godziny dostępności to nie „24/7”."})
    from . import hours
    gh = rec.get("godziny_dostepnosci")
    if gh and not hours.is_valid(gh):
        problems.append({"pole": "godziny_dostepnosci", "poziom": "ostrzezenie",
                         "komunikat": "Zapis godzin spoza obsługiwanego podzbioru opening_hours – „dostępne teraz” nie zostanie policzone."})
    exp = rec.get("data_waznosci_elektrod")
    if exp and isinstance(exp, str) and exp < date.today().isoformat():
        problems.append({"pole": "data_waznosci_elektrod", "poziom": "ostrzezenie", "komunikat": "Elektrody są przeterminowane."})
    if rec.get("szafka_zamknieta") is True and not rec.get("instrukcja_dostepu"):
        problems.append({"pole": "instrukcja_dostepu", "poziom": "ostrzezenie",
                         "komunikat": "Szafka jest zamknięta – dodaj instrukcję dostępu (gdzie jest klucz lub kod)."})
    return problems


def has_errors(problems: list[dict]) -> bool:
    return any(p["poziom"] == "blad" for p in problems)
