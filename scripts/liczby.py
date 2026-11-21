"""Numbers for the presentation from the full data → docs/tech/LICZBY.md.

Usage: python -m scripts.seed --reset --osm full && python -m scripts.liczby
Counts only real AED (OpenStreetMap national export + AED datasets of municipalities from dane.gov.pl); the fictional
sample records from data/sample/ are left out.
"""
from __future__ import annotations

import json
import statistics
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.core import coverage, db, hours  # noqa: E402
from src.core.store import TZ, get_store  # noqa: E402

OUT = ROOT / "docs" / "tech" / "LICZBY.md"


def pct(a: int, b: int) -> str:
    return f"{100 * a / b:.0f}%" if b else "–"


def n(x: int) -> str:
    return f"{x:,}".replace(",", " ")


def main():
    st = get_store()
    osm_meta = next((db.loads(r["data"]) for r in st.conn.execute("SELECT * FROM zrodla WHERE kod_zrodla='osm'")), {})
    sample_ids = {f["properties"]["id_aed"] for f in json.loads(
        (ROOT / "data" / "sample" / "aed_ujednolicone.geojson").read_text(encoding="utf-8"))["features"]}
    real = [r for i, r in st.records.items()
            if any((s["kod_zrodla"] == "osm" and not s["id_w_zrodle"].startswith("node/9000000"))
                   or s["kod_zrodla"].startswith("dane_gov_pl:") for s in st.sources.get(i, []))]
    dgp = [(r["kod_zrodla"], db.loads(r["data"])) for r in st.conn.execute("SELECT * FROM zrodla WHERE kod_zrodla LIKE 'dane_gov_pl:%'")]
    if len(real) < 1000:
        raise SystemExit("Za mało rekordów OSM – najpierw: python -m scripts.seed --reset --osm full")
    now = datetime.now(TZ)
    today = now.date()
    stany = [coverage.stan_danych(r, today) for r in real]
    akt = stany.count("aktualne")
    wieki = [w for w in (coverage.wiek_danych_dni(r, today) for r in real) if w is not None]
    counts = coverage.counts_by_gmina(real, today)
    woj_rows, all_gm, gm_stan = [], [], {"brak_danych": 0, "nieaktualne": 0, "aktualne": 0}
    miejskie_bez = []
    for kod, woj in coverage.WOJ_KOD.items():
        fc = coverage.coverage(real, woj, today, counts=counts)
        feats = fc["features"]
        a = sum(f["properties"]["aktualne"] for f in feats)
        na = sum(f["properties"]["nieaktualne"] for f in feats)
        bez = [f for f in feats if f["properties"]["stan"] == "brak_danych"]
        for f in feats:
            gm_stan[f["properties"]["stan"]] += 1
        miejskie_bez += [(woj, f["properties"]["gmina"]) for f in bez if f["properties"]["rodzaj"] == "miejska"]
        woj_rows.append((woj, a + na, a, na, len(feats), len(bez)))
        all_gm += feats
    poza = len(real) - sum(r[1] for r in woj_rows)
    with_hours = sum(1 for r in real if r.get("godziny_dostepnosci"))
    h247 = sum(1 for r in real if hours.is_24_7(r.get("godziny_dostepnosci")))
    with_addr = sum(1 for r in real if r.get("miejscowosc") and r.get("numer_budynku"))
    private = sum(1 for r in real if r.get("dostep") == "prywatny")
    imp = osm_meta.get("wynik_importu", {})
    powody = osm_meta.get("odrzucone_powody", {})
    n_gmin = len(all_gm)

    L = [
        "# Liczby z pełnych danych (do prezentacji)",
        "",
        f"> Wygenerowane {now:%d.%m.%Y %H:%M} przez `python -m scripts.liczby` z bazy po `python -m scripts.seed --reset --osm full`. "
        "Źródła AED: eksport AED OSM Polska (OpenStreetMap, ODbL-1.0, © autorzy OpenStreetMap) i zbiory AED samorządów z dane.gov.pl. Granice gmin: "
        "Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii. Rekordy przykładowe (fikcyjne) z `data/sample/` **nie są liczone**.",
        "> Aktualne = `data_weryfikacji` (w OSM `check_date`/`survey:date`) nie starsza niż 365 dni; brak daty = nieaktualne (CONTRACT §8).",
        "",
        "## Najważniejsze",
        "",
        "| Wskaźnik | Wartość |",
        "|---|---|",
        f"| AED w Polsce (OpenStreetMap + zbiory samorządów, po deduplikacji) | **{n(len(real))}** |",
        f"| Aktualne (sprawdzone w ostatnich 12 miesiącach) | **{n(akt)}** ({pct(akt, len(real))}) |",
        f"| Nieaktualne (starsza weryfikacja albo brak daty) | **{n(len(real) - akt)}** ({pct(len(real) - akt, len(real))}) |",
        f"| – w tym bez żadnej daty weryfikacji | {n(len(real) - len(wieki))} ({pct(len(real) - len(wieki), len(real))}) |",
        f"| Mediana wieku danych (rekordy z datą) | {n(int(statistics.median(wieki))) if wieki else '–'} dni |",
        f"| Gminy bez żadnego AED w danych | **{n(gm_stan['brak_danych'])}** z {n(n_gmin)} ({pct(gm_stan['brak_danych'], n_gmin)}) |",
        f"| Gminy, w których wszystkie AED mają aktualne dane | {n(gm_stan['aktualne'])} ({pct(gm_stan['aktualne'], n_gmin)}) |",
        f"| Gminy z co najmniej jednym nieaktualnym AED | {n(gm_stan['nieaktualne'])} ({pct(gm_stan['nieaktualne'], n_gmin)}) |",
        f"| Gminy miejskie (miasta) bez AED w danych | {n(len(miejskie_bez))} |",
        "",
        "## Według województw (po położeniu AED w granicach PRG)",
        "",
        "| Województwo | AED | aktualne | nieaktualne | % aktualnych | gminy | gminy bez danych |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for woj, tot, a, na, g, bez in sorted(woj_rows, key=lambda r: -r[1]):
        L.append(f"| {woj} | {n(tot)} | {n(a)} | {n(na)} | {pct(a, tot)} | {g} | {bez} |")
    L.append(f"| **Polska** | **{n(sum(r[1] for r in woj_rows))}** | **{n(sum(r[2] for r in woj_rows))}** | "
             f"**{n(sum(r[3] for r in woj_rows))}** | **{pct(sum(r[2] for r in woj_rows), sum(r[1] for r in woj_rows))}** | "
             f"**{n_gmin}** | **{gm_stan['brak_danych']}** |")
    if poza:
        L.append(f"\nPoza granicami gmin (np. morze dalej niż 1 km od brzegu, za granicą): {poza}.")
    L += [
        "",
        "## Import OpenStreetMap: co weszło, co odrzucone i dlaczego",
        "",
        f"- Obiektów w eksporcie: **{n(imp.get('liczba_obiektow', 0))}** (import {osm_meta.get('data_importu', '?').replace('T', ' ')}).",
        f"- Nowe rekordy: {n(imp.get('dodane', 0))}; scalone z rekordem dysponenta: {n(imp.get('scalone', 0))}; "
        f"połączone jako duplikaty w samym OSM (≤ 5 m od innego punktu i prawie ta sama nazwa): {n(imp.get('zaktualizowane', 0))}.",
        f"- **Odrzucone: {n(imp.get('odrzucone', 0))}** ({pct(imp.get('odrzucone', 0), imp.get('liczba_obiektow', 0))})."
        + (" Powody:" if powody else " Zbyt długie nazwy i opisy są skracane (z adnotacją w raporcie), a nie odrzucane."),
    ]
    if powody:
        L += ["", "| Powód odrzucenia | Liczba |", "|---|---:|"]
    for p, c in sorted(powody.items(), key=lambda x: -x[1]):
        L.append(f"| {p} | {c} |")
    if powody and all("dłuższy" in p for p in powody):  # older imports
        L += ["", "Wszystkie odrzucenia dotyczą zbyt długich tekstów (limity z wzorcowego zakresu danych). Takie rekordy dałoby się "
                  "przyjąć po skróceniu tekstu – do decyzji."]
    L += [
        "",
        "## Zbiory AED samorządów z dane.gov.pl (prawdziwe dane od dysponentów)",
        "",
        "| Zbiór | Wiersze | Nowe AED | Połączone z OSM | Odrzucone | Licencja |",
        "|---|---:|---:|---:|---:|---|",
    ]
    for kod, m in sorted(dgp):
        w = m.get("wynik_importu") or {}
        if w:
            L.append(f"| [{m.get('nazwa')}]({m.get('url')}) | {w.get('wiersze', '–')} | {w.get('dodane', 0)} | "
                     f"{w.get('scalone', 0) + w.get('zaktualizowane', 0)} | {w.get('odrzucone', 0)} | {m.get('licencja')} |")
        else:
            L.append(f"| [{m.get('nazwa')}]({m.get('url')}) | – | – | – | – | {m.get('licencja')} (brak pliku do pobrania – tylko link do portalu miasta) |")
    L += [
        "",
        "AED z zestawów samorządów mają pierwszeństwo przed OpenStreetMap przy scalaniu (CONTRACT §4). "
        "Brakujące godziny i numery budynków są ostrzeżeniami do uzupełnienia przez dysponenta.",
        "",
        "## Jakość danych (czego brakuje do wzorcowego zakresu)",
        "",
        "| Pole | Wypełnione | Odsetek |",
        "|---|---:|---:|",
        f"| godziny dostępności | {n(with_hours)} | {pct(with_hours, len(real))} |",
        f"| w tym całodobowo (24/7) | {n(h247)} | {pct(h247, len(real))} |",
        f"| adres (miejscowość i numer budynku) | {n(with_addr)} | {pct(with_addr, len(real))} |",
        f"| data weryfikacji | {n(len(wieki))} | {pct(len(wieki), len(real))} |",
        f"| dostęp „prywatny” (nie dla świadka zdarzenia) | {n(private)} | {pct(private, len(real))} |",
        "",
        "## Miasta (gminy miejskie) bez AED w danych",
        "",
        ", ".join(f"{g} ({w})" for w, g in sorted(miejskie_bez, key=lambda x: (x[0], x[1]))) or "brak",
        "",
    ]
    OUT.write_text("\n".join(L), encoding="utf-8")
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
