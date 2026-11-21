"""Numbers for the presentation from the full data → docs/tech/LICZBY.md.

Usage: python -m scripts.seed --reset --osm full && python -m scripts.liczby
Model ról (docs/MODEL_ROL.md): the common list = provider datasets (fictional providers of the prototype are reported
separately and NOT counted as real), the helper layer = OpenStreetMap "Do sprawdzenia". The "all known AED" numbers
(gaps, data age) count real records of both layers: OSM points + real providers' records.
"""
from __future__ import annotations

import statistics
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.core import coverage, db, dostawcy, hours  # noqa: E402
from src.core.store import TZ, get_store  # noqa: E402

OUT = ROOT / "docs" / "tech" / "LICZBY.md"


def pct(a: int, b: int) -> str:
    return f"{100 * a / b:.0f}%" if b else "–"


def n(x: int) -> str:
    return f"{x:,}".replace(",", " ")


def main():
    st = get_store()
    osm_meta = next((db.loads(r["data"]) for r in st.conn.execute("SELECT * FROM zrodla WHERE kod_zrodla='osm'")), {})
    osm = [r for i, r in st.records.items() if i not in st.lista
           and any(s["kod_zrodla"] == "osm" and not s["id_w_zrodle"].startswith("node/9000000") for s in st.sources.get(i, []))]
    lista_real = [st.records[i] for i, p in st.lista.items() if i in st.records and not p.get("fikcyjny")]
    lista_fikc = [i for i, p in st.lista.items() if p.get("fikcyjny")]
    real = osm + lista_real
    rap = dostawcy.raport(st)
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
        "Model ról (`docs/MODEL_ROL.md`): **wspólna lista** = zbiory dostawców z dane.gov.pl (bez scalania), **warstwa pomocnicza** "
        "„Do sprawdzenia” = eksport AED OSM Polska (OpenStreetMap, ODbL-1.0, © autorzy OpenStreetMap), osobno od listy. Granice gmin: "
        "Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii. Fikcyjni dostawcy prototypu (`data/dostawcy/`) **nie są liczeni** "
        "w liczbach o Polsce – są tylko w tabeli zbiorów.",
        "> Aktualne = `data_weryfikacji` (w OSM `check_date`/`survey:date`) nie starsza niż 365 dni; brak daty = nieaktualne (CONTRACT §8).",
        "",
        "## Wspólna lista i warstwa pomocnicza",
        "",
        "| Wskaźnik | Wartość |",
        "|---|---|",
        f"| Prawdziwe zbiory dostawców na liście (wzorzec / przejściowe) | **{sum(1 for e in rap['zbiory'] if e.get('status') == 'wlaczony' and not e.get('fikcyjny'))}** / "
        f"**{sum(1 for e in rap['zbiory'] if e.get('status') == 'przejsciowy' and not e.get('fikcyjny'))}** |",
        f"| Zbiory fikcyjnych dostawców prototypu | {sum(1 for e in rap['zbiory'] if e.get('fikcyjny'))} |",
        f"| Zbiory AED w dane.gov.pl poza listą (nieczytelne albo bez wymagań) | {sum(1 for e in rap['zbiory'] if e.get('status') not in ('wlaczony', 'przejsciowy') and not e.get('fikcyjny'))} |",
        f"| AED na wspólnej liście od prawdziwych dostawców | **{n(len(lista_real))}** |",
        f"| AED fikcyjnych dostawców prototypu (nie liczone dalej) | {n(len(lista_fikc))} |",
        f"| Warstwa pomocnicza „Do sprawdzenia” (OpenStreetMap) | **{n(len(osm))}** |",
        f"| Gminy z co najmniej jednym AED od prawdziwego dostawcy | {n(len({coverage.index().teryt(r['dlugosc_geograficzna'], r['szerokosc_geograficzna']) for r in lista_real} - {None}))} z 2 479 |",
        "",
        "## Wszystkie znane AED (obie warstwy, bez fikcyjnych)",
        "",
        "| Wskaźnik | Wartość |",
        "|---|---|",
        f"| AED znane w Polsce (lista + OpenStreetMap; warstw się nie scala) | **{n(len(real))}** |",
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
        f"- Rekordy warstwy pomocniczej: {n(imp.get('dodane', 0) + imp.get('zaktualizowane', 0))} (OSM nie jest scalany z listą dostawców).",
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
        "## Zbiory dostawców (ostatnia agregacja: " + str(rap.get("czas") or "–").replace("T", " ") + ")",
        "",
        "| Zbiór | Dostawca | Status | Na liście | Odrzucone | Licencja |",
        "|---|---|---|---:|---:|---|",
    ]
    nazwy = {"wlaczony": "wzorzec", "przejsciowy": "przejściowy", "odrzucony": "poza listą (błędy)", "poza_lista": "poza listą", "blad": "błąd odczytu"}
    for e in sorted(rap["zbiory"], key=lambda e: (["wlaczony", "przejsciowy"].index(e["status"]) if e.get("status") in ("wlaczony", "przejsciowy") else 2, e.get("dostawca") or "")):
        t = f"[{e.get('tytul')}]({e['zbior_url']})" if e.get("zbior_url") else str(e.get("tytul"))
        L.append(f"| {t} | {e.get('dostawca') or '–'}{' (fikcyjny)' if e.get('fikcyjny') else ''} | {nazwy.get(e.get('status'), e.get('status'))} | "
                 f"{e.get('wlaczone', 0)} | {e.get('odrzucone', 0)} | {e.get('licencja') or '–'} |")
    L += [
        "",
        "Rekordy zbiorów przejściowych są pokazane tak, jak je opublikowano (bez uzupełniania), z etykietą „Zbiór przejściowy”. "
        "Warstwa OSM nie jest scalana z listą – punkt OSM obok AED dostawcy zostaje osobnym punktem „Do sprawdzenia”.",
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
