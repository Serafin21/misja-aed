"""Model ról (docs/MODEL_ROL.md): AED data is published ONLY by the owner (provider) on its own dane.gov.pl account.

- `pakiet()` – the wizard's output for one provider: CSV (44 fields), harvester XML 1.13, data dictionary, metadata,
  instructions. The team and the administrator never publish anything (K11).
- `agreguj()` – builds the common list from provider datasets published on dane.gov.pl (in the prototype: packages of
  fictional providers in data/dostawcy/ in the shape of API 1.4 answers). A record is shown exactly as published:
  no merging between providers (K6), no fixing (a record that breaks the standard is left out and reported, P5),
  possible duplicates (< 25 m, different providers) are flagged on both and both providers are notified (P8).
- OSM is not a provider: its points stay a separate helper layer "Do sprawdzenia" (K5, §8).
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import unicodedata
import zipfile
from datetime import date, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

from . import coverage, dedup, schema, validate
from .schema import ROOT
from .store import Store, now_min, today

KEYWORD = "wspolna-lista-aed"            # Q2: datasets that belong to the list
WZORZEC_WERSJA = "0.9"
PROG_DUPLIKAT_M = 25                    # P8 (Q6: to confirm with MC)
ZAPAS_DNI = 30                           # P9 / §7: dataset "nieaktualny" = update period + 30 days
FREQ_DAYS = {"daily": 1, "weekly": 7, "monthly": 31, "quarterly": 92, "everyHalfYear": 183, "yearly": 366}
LOCAL = ROOT / "data" / "dostawcy"      # prototype: fictional providers' datasets as API 1.4 answers
PORTAL = "https://dane.gov.pl"
XMLNS = "urn:otwarte-dane:harvester:1.13"

OSTATNI_RAPORT: dict = {"czas": None, "zbiory": []}


def raport(store: Store) -> dict:
    """Last aggregation report – kept in the database, so it survives a restart of the API."""
    if OSTATNI_RAPORT["czas"] is None:
        from . import db
        row = store.conn.execute("SELECT data FROM stan WHERE klucz='raport_agregacji'").fetchone()
        if row:
            OSTATNI_RAPORT.update(db.loads(row["data"]))
    return OSTATNI_RAPORT


def slug(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.replace("ł", "l").replace("Ł", "L"))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60] or "dostawca"


# ---------- reading and validating a provider dataset ----------
def _typed(row: dict) -> dict:
    """CSV strings → typed values following the data dictionary (no guessing, no fixing)."""
    types = schema.field_types()
    rec = schema.empty_record()
    for f in schema.field_order():
        v = row.get(f)
        v = v.strip() if isinstance(v, str) else v
        if v in (None, ""):
            rec[f] = None
            continue
        t = types[f]
        try:
            if t == "boolean":
                rec[f] = {"true": True, "false": False}.get(str(v).lower(), v)
            elif t == "number":
                rec[f] = float(v)
            elif t == "integer":
                rec[f] = int(v)
            else:
                rec[f] = v
        except ValueError:
            rec[f] = v  # left as text → the validator reports it
    return rec


def _freq_ok(freq: str | None) -> bool:
    return freq in FREQ_DAYS


def dataset_nieaktualny(modified: str | None, freq: str | None, dzis: date | None = None) -> bool:
    """§7: a dataset is out of date when its update period + 30 days have passed since the last update."""
    if not modified:
        return True
    try:
        d = date.fromisoformat(modified[:10])
    except ValueError:
        return True
    return (dzis or date.today()) > d + timedelta(days=FREQ_DAYS.get(freq or "", 366) + ZAPAS_DNI)


def sprawdz_zbior(meta: dict, header: list[str]) -> list[str]:
    """Dataset-level requirements (§6). Empty list = OK."""
    p = []
    kw = [k.lower() for k in meta.get("keywords") or []]
    if KEYWORD not in kw:
        p.append(f"Zbiór nie jest oznaczony słowem kluczowym „{KEYWORD}”.")
    if not _freq_ok(meta.get("update_frequency")):
        p.append(f"Częstotliwość aktualizacji „{meta.get('update_frequency')}” – wymagana od daily do yearly (nie irregular ani notPlanned).")
    if not str(meta.get("zasob_url") or "").startswith("https://"):
        p.append("Adres zasobu musi zaczynać się od https://.")
    missing = [f for f in schema.field_order() if f not in header]
    if missing:
        p.append(f"Brak {len(missing)} z {len(schema.field_order())} pól wzorca AED: {', '.join(missing[:8])}{'…' if len(missing) > 8 else ''}.")
    return p


def sprawdz_rekord(rec: dict, dostawca: str) -> list[str]:
    """Record-level requirements (§6, §7). Empty list = the record goes on the map unchanged."""
    p = [f"{x['pole'] or 'rekord'}: {x['komunikat']}" for x in validate.validate_record(rec) if x["poziom"] == "blad"]
    if (rec.get("dysponent_nazwa") or "").strip().lower() != dostawca.strip().lower():
        p.append("dysponent_nazwa: zbiór może zawierać tylko urządzenia dostawcy.")
    if rec.get("zrodlo_danych") == "osm" or rec.get("licencja") == "ODbL-1.0":
        p.append("zrodlo_danych: dane z OpenStreetMap nie mogą trafić do zbioru dostawcy (ODbL).")
    t = rec.get("teryt_terc")
    lat, lon = rec.get("szerokosc_geograficzna"), rec.get("dlugosc_geograficzna")
    if not (isinstance(t, str) and re.fullmatch(r"\d{7}", t)):
        p.append("teryt_terc: wymagany 7-cyfrowy kod TERYT gminy.")
    elif isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        g = coverage.index().teryt(lon, lat)
        if g and g != t:
            p.append(f"teryt_terc: {t} nie zgadza się z położeniem (gmina {g}).")
    return p


# ---------- sources of provider datasets ----------
def _local() -> list[dict]:
    """Prototype: fictional providers' datasets shaped like API 1.4 answers (dataset.json, resources.json, file)."""
    out = []
    for d in sorted(LOCAL.glob("*/dataset.json")):
        ds = json.loads(d.read_text(encoding="utf-8"))["data"]
        res = json.loads((d.parent / "resources.json").read_text(encoding="utf-8"))["data"][0]
        a, ra = ds["attributes"], res["attributes"]
        out.append({"id": str(ds["id"]), "tytul": a["title"], "dostawca": a["institution"]["title"],
                    "regon": a["institution"].get("regon"), "keywords": a.get("keywords") or [],
                    "update_frequency": a.get("update_frequency"), "modified": a.get("modified"),
                    "licencja": {"CC0 1.0": "CC0-1.0", "CC BY 4.0": "CC-BY-4.0"}.get(a.get("license_name"), a.get("license_name")),
                    "zbior_url": f"{PORTAL}/pl/dataset/{ds['id']},{a.get('slug', '')}", "zasob_id": str(res["id"]),
                    "zasob_url": ra.get("file_url"), "data_danych": ra.get("data_date"),
                    "plik": (d.parent / ra["_plik_prototypu"]).read_bytes(), "fikcyjny": True})
    return out


def _remote(online: bool) -> tuple[list[dict], list[dict]]:
    """dane.gov.pl: datasets with the list keyword (→ aggregated) and other AED datasets (→ only a report: what is missing)."""
    if not online:
        return [], []
    from .connectors import dane_gov_pl
    from .connectors.net import fetch
    from urllib.parse import quote
    marked, other = [], []
    try:
        body, _ = fetch(f"{dane_gov_pl.API}/datasets?q={quote(KEYWORD)}&per_page=50", "dgp_lista.json", timeout=20, max_age_h=1)
        for d in json.loads(body).get("data", []):
            if KEYWORD in [k.lower() for k in (d.get("attributes", {}).get("keywords") or [])]:
                marked.append(d)
    except Exception:  # noqa: BLE001
        pass
    try:
        found = dane_gov_pl.search(None, "defibrylator defibrylatory AED", do_import=False)["data"]
        other = [x for x in found if x["id"] not in {str(m["id"]) for m in marked}]
    except Exception:  # noqa: BLE001
        other = []
    return marked, other


def _csv_rows(data: bytes) -> tuple[list[str], list[dict]]:
    text = data.decode("utf-8-sig")
    r = csv.DictReader(io.StringIO(text))
    return [h.strip() for h in (r.fieldnames or [])], list(r)


# ---------- aggregation (P5, P8, P9) ----------
def agreguj(store: Store, online: bool | None = None) -> dict:
    from . import dziennik
    online = (os.environ.get("AED_DGP", "tak") != "brak") if online is None else online
    raport, items = [], []
    marked, other = _remote(online)
    sources = _local()
    for d in marked:  # real datasets marked with the keyword: same path as the local ones (download the CSV resource)
        try:
            from .connectors import dane_gov_pl
            from .connectors.net import fetch
            a = d["attributes"]
            rb, _ = fetch(d["relationships"]["resources"]["links"]["related"], f"dgp_res_{d['id']}.json", timeout=20, max_age_h=1)
            res = next(r for r in json.loads(rb)["data"] if r["attributes"].get("format") == "csv")
            fb, _ = fetch(res["attributes"]["file_url"], f"dgp_file_{res['id']}.csv", timeout=60, max_age_h=1)
            sources.append({"id": str(d["id"]), "tytul": a["title"], "dostawca": dane_gov_pl._institution(str(d["id"])) or "",
                            "keywords": a.get("keywords"), "update_frequency": a.get("update_frequency") or a.get("updateFrequency"),
                            "modified": a.get("modified"), "licencja": dane_gov_pl.LICENCES.get(a.get("license_name")),
                            "zbior_url": f"{PORTAL}/pl/dataset/{d['id']}", "zasob_id": str(res["id"]),
                            "zasob_url": res["attributes"]["file_url"], "data_danych": res["attributes"].get("data_date"), "plik": fb})
        except Exception as e:  # noqa: BLE001
            raport.append({"zbior_id": str(d.get("id")), "tytul": d.get("attributes", {}).get("title"), "status": "blad", "problemy": [str(e)]})
    taken: set[str] = set()
    for s in sources:
        header, rows = _csv_rows(s["plik"])
        ds_problems = sprawdz_zbior(s, header)
        entry = {"zbior_id": s["id"], "tytul": s["tytul"], "dostawca": s["dostawca"], "zbior_url": s["zbior_url"],
                 "zasob_url": s["zasob_url"], "czestotliwosc": s.get("update_frequency"), "zmodyfikowany": (s.get("modified") or "")[:10],
                 "nieaktualny": dataset_nieaktualny(s.get("modified"), s.get("update_frequency")), "fikcyjny": s.get("fikcyjny", False),
                 "rekordy": len(rows), "wlaczone": 0, "odrzucone": 0, "problemy": list(ds_problems), "problemy_rekordow": []}
        if ds_problems:
            entry.update(status="odrzucony", odrzucone=len(rows))
            raport.append(entry)
            continue
        for i, row in enumerate(rows, start=2):
            rec = _typed(row)
            probs = sprawdz_rekord(rec, s["dostawca"])
            if rec.get("id_aed") in taken:
                probs.append("id_aed: identyfikator użyty już przez innego dostawcę.")
            if probs:
                entry["odrzucone"] += 1
                entry["problemy_rekordow"].append({"wiersz": i, "id_aed": rec.get("id_aed"), "problemy": probs})
                continue
            taken.add(rec["id_aed"])
            prov = {"dostawca": s["dostawca"], "regon": s.get("regon") or rec.get("dysponent_regon"), "zbior_id": s["id"],
                    "zbior_tytul": s["tytul"], "zbior_url": s["zbior_url"], "zasob_id": s["zasob_id"], "zasob_url": s["zasob_url"],
                    "data_danych": s.get("data_danych"), "zbior_zmodyfikowany": (s.get("modified") or "")[:10],
                    "czestotliwosc": s.get("update_frequency"), "zbior_nieaktualny": entry["nieaktualny"],
                    "licencja_zbioru": s.get("licencja"), "fikcyjny": s.get("fikcyjny", False), "mozliwe_duplikaty": []}
            items.append((rec, prov))
            entry["wlaczone"] += 1
        entry["status"] = "wlaczony" if entry["wlaczone"] else "odrzucony"
        raport.append(entry)
        if entry["odrzucone"]:
            dziennik.powiadom(s["dostawca"], "walidacja",
                              f"Zbiór „{s['tytul']}”: {entry['odrzucone']} z {entry['rekordy']} rekordów nie spełnia wzorca AED i nie trafiło na mapę.",
                              f"{s['id']}:{s.get('modified')}")
        if entry["nieaktualny"]:
            dziennik.powiadom(s["dostawca"], "przypomnienie",
                              f"Zbiór „{s['tytul']}” przekroczył termin aktualizacji ({s.get('update_frequency')}) o ponad {ZAPAS_DNI} dni – na mapie jest oznaczony jako nieaktualny.",
                              f"{s['id']}:{s.get('modified')}")
    # AED datasets on dane.gov.pl without the keyword: not on the list, report what is missing (invitation to the standard)
    for o in other:
        raport.append({"zbior_id": o["id"], "tytul": o["tytul"], "dostawca": o.get("instytucja"), "zbior_url": o.get("strona"),
                       "status": "poza_lista", "rekordy": None, "wlaczone": 0, "odrzucone": 0, "nieaktualny": None,
                       "problemy": [f"Zbiór nie jest oznaczony słowem kluczowym „{KEYWORD}” i nie ma 44 pól wzorca AED – "
                                    "administrator zaprasza dostawcę do publikacji według wzorca."], "problemy_rekordow": []})
    # P8: possible duplicates between DIFFERENT providers – flag both, notify both, never merge
    grid = dedup.GridIndex()
    for idx, (rec, _) in enumerate(items):
        grid.add(str(idx), rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"])
    for idx, (rec, prov) in enumerate(items):
        for c in grid.near(rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"]):
            j = int(c)
            if j <= idx:
                continue
            r2, p2 = items[j]
            if p2["dostawca"] == prov["dostawca"]:
                continue
            d = dedup.distance_m(rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"], r2["szerokosc_geograficzna"], r2["dlugosc_geograficzna"])
            if d <= PROG_DUPLIKAT_M:
                prov["mozliwe_duplikaty"].append(r2["id_aed"])
                p2["mozliwe_duplikaty"].append(rec["id_aed"])
                pair = "|".join(sorted([rec["id_aed"], r2["id_aed"]]))
                for a_, b_, who in ((rec, r2, prov), (r2, rec, p2)):
                    other_p = p2 if who is prov else prov
                    dziennik.powiadom(who["dostawca"], "duplikat",
                                      f"Możliwy duplikat: Twoje AED {a_['id_aed']} („{a_['nazwa_obiektu']}”) i AED {b_['id_aed']} "
                                      f"dostawcy {other_p['dostawca']} są {round(d)} m od siebie. Oba są widoczne na liście; "
                                      "ustalcie między sobą, czy to to samo urządzenie.", pair)
    store.replace_list(items)
    # reference scope of sources = the providers' datasets
    for e in raport:
        if e["status"] in ("wlaczony", "odrzucony"):
            store.register_source(f"dostawca:{e['zbior_id']}", {
                "nazwa": f"{e['tytul']} ({e['dostawca']})", "typ_zrodla": "dostawca", "format": "CSV (wzorzec AED)",
                "licencja": next((p["licencja_zbioru"] for _, p in items if p["zbior_id"] == e["zbior_id"]), ""),
                "czestotliwosc_aktualizacji": e.get("czestotliwosc"), "obszar": e["dostawca"], "url": e.get("zbior_url"),
                "data_importu": now_min(), "odrzucone": e["odrzucone"]})
    OSTATNI_RAPORT.update(czas=now_min(), zbiory=raport)
    from . import db
    store.conn.execute("INSERT OR REPLACE INTO stan VALUES (?,?)", ("raport_agregacji", db.dumps(OSTATNI_RAPORT)))
    store.conn.commit()
    dziennik.zapisz("system-agregujacy", "agregacja", "wspolna-lista",
                    po={"zbiory": len(raport), "rekordy": len(items), "wlaczone": [e["zbior_id"] for e in raport if e["status"] == "wlaczony"]})
    return {"czas": OSTATNI_RAPORT["czas"], "rekordy": len(items), "zbiory": raport}


# ---------- wizard output: files for publication (P2, P3) ----------
def uzupelnij(rec: dict) -> dict:
    """Wizard help, before the provider downloads the files: TERYT of the gmina from the location, completeness."""
    from . import quality
    r = dict(rec)
    lat, lon = r.get("szerokosc_geograficzna"), r.get("dlugosc_geograficzna")
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        t = coverage.index().teryt(lon, lat)
        if t:
            r["teryt_terc"] = t
            r["wojewodztwo"] = r.get("wojewodztwo") or coverage.WOJ_KOD.get(t[:2])
    r["kompletnosc"] = quality.completeness(r)
    return r


def _csv(records: list[dict]) -> bytes:
    from .publish import to_csv
    return to_csv(sorted(records, key=lambda r: r["id_aed"]), schema.field_order())


def harvester_xml(org: dict, records: list[dict], csv_url: str, slownik_url: str) -> bytes:
    """Harvester XML 1.13 for ONE provider dataset (K3: responsibilities, regions/terytIdent, updateFrequency, https)."""
    ext = f"aed-{slug(org['nazwa'])}"[:36]
    teryt = sorted({r["teryt_terc"] for r in records if r.get("teryt_terc")})[:20]
    regions = "".join(f"<terytIdent>{t}</terytIdent>" for t in teryt)
    resp = org.get("odpowiedzialnosc") or (
        f"{org['nazwa']} odpowiada za jakość, aktualność i poprawność danych o swoich defibrylatorach AED w tym zbiorze. "
        f"Każde urządzenie weryfikujemy na miejscu co najmniej raz na 12 miesięcy, a zmianę stanu (awaria, wycofanie, nowe "
        f"miejsce) wprowadzamy w ciągu 7 dni. Błędy prosimy zgłaszać w komentarzu do zbioru na dane.gov.pl"
        + (f" albo na adres {org['email']}" if org.get("email") else "") + ".")
    lic = {"CC0-1.0": "CC0 1.0", "CC-BY-4.0": "CC BY 4.0"}.get(org.get("licencja", "CC0-1.0"), "CC0 1.0")
    tags = "".join(f'<tag lang="pl">{escape(t)}</tag>' for t in [KEYWORD, "AED", "defibrylator", "pierwsza pomoc"]) + \
        "".join(f'<tag lang="en">{escape(t)}</tag>' for t in ["AED", "defibrillator", "first aid"])
    title = f"Defibrylatory AED – {org['nazwa']}"
    desc = (f"Lokalizacja, dostępność i stan defibrylatorów AED, których właścicielem jest {org['nazwa']}. "
            f"Zbiór zgodny z wzorcem AED v{WZORZEC_WERSJA} (44 pola) i należy do wspólnej listy AED w dane.gov.pl.")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- Plik harmonizatora dane.gov.pl (schemat urn:otwarte-dane:harvester:1.13) wygenerowany kreatorem AED {now_min()}.
     Publikuje go dostawca na SWOIM koncie w dane.gov.pl – nikt inny. -->
<ns:datasets xmlns:ns="{XMLNS}">
  <dataset status="published">
    <extIdent>{escape(ext)}</extIdent>
    <title><polish>{escape(title[:300])}</polish><english>{escape(('AED defibrillators – ' + org['nazwa'])[:300])}</english></title>
    <description><polish>{escape(desc)}</polish><english>{escape(f"Location, availability and status of AED defibrillators owned by {org['nazwa']}. Follows the AED reference data scope v{WZORZEC_WERSJA}.")}</english></description>
    <updateFrequency>{escape(org.get('czestotliwosc', 'monthly'))}</updateFrequency>
    <categories><category>HEAL</category></categories>
    <conditions>
      <source>true</source>
      <modification>true</modification>
      <responsibilities>{escape(resp[:4000])}</responsibilities>
      <dbOrCopyrightedLicenseChosen>{lic}</dbOrCopyrightedLicenseChosen>
    </conditions>
    <resources>
      <resource status="published">
        <extIdent>{escape((ext + '-csv')[:36])}</extIdent>
        <url>{escape(csv_url)}</url>
        <title><polish>Defibrylatory AED – CSV (wzorzec AED v{WZORZEC_WERSJA})</polish><english>AED defibrillators – CSV</english></title>
        <description><polish>Jeden wiersz = jedno urządzenie dostawcy; 44 pola wzorca AED; UTF-8, przecinek, wiersz nagłówka.</polish><english>One row = one device of the provider; 44 fields of the AED standard.</english></description>
        <availability>remote</availability>
        <dataDate>{today()}</dataDate>
        <hasDynamicData>false</hasDynamicData>
        <hasHighValueData>false</hasHighValueData>
        <hasHighValueDataFromEuropeanCommissionList>false</hasHighValueDataFromEuropeanCommissionList>
        <hasResearchData>false</hasResearchData>
        <containsProtectedData>false</containsProtectedData>
        <regions>{regions or '<terytIdent>00</terytIdent>'}</regions>
      </resource>
    </resources>
    <tags>{tags}</tags>
    <lastUpdateDate>{now_min()}:00</lastUpdateDate>
    <hasDynamicData>false</hasDynamicData>
    <hasHighValueData>false</hasHighValueData>
    <hasHighValueDataFromEuropeanCommissionList>false</hasHighValueDataFromEuropeanCommissionList>
    <hasResearchData>false</hasResearchData>
    <supplements>
      <supplement><url>{escape(slownik_url)}</url><name><polish>Słownik pól – wzorzec AED v{WZORZEC_WERSJA}</polish><english>Data dictionary – AED standard v{WZORZEC_WERSJA}</english></name><language>pl</language></supplement>
    </supplements>
  </dataset>
</ns:datasets>
"""
    return xml.encode("utf-8")


INSTRUKCJA = """PLIKI DO PUBLIKACJI – {nazwa}
Wygenerowano: {czas}. Urządzeń w zbiorze: {n}.

To komplet do opublikowania Waszych danych o AED na dane.gov.pl. Publikujecie je SAMI, na koncie
Waszej organizacji – dzięki temu wiadomo, kto odpowiada za dane (jakość, aktualność, poprawność).

1. Konto dostawcy: jeśli Wasza instytucja nie ma konta na dane.gov.pl, załóżcie je według procedury
   portalu (docelowo logowanie przez login.gov.pl).
2. Publikacja – jeden z dwóch sposobów:
   a) dodajcie zbiór na dane.gov.pl i wgrajcie plik aed.csv jako zasób; w opisie podajcie dane z metadane.json,
      a w słowach kluczowych koniecznie „wspolna-lista-aed”;
   b) albo umieśćcie aed.csv pod stałym adresem https (np. na stronie instytucji), wpiszcie ten adres
      w aed_harvester.xml (element <url> zasobu – teraz: {csv_url}) i podajcie adres pliku XML w portalu
      – portal będzie pobierał go cyklicznie.
3. Słownik pól (slownik_danych.csv) dołączcie jako materiał uzupełniający (w XML jest już w <supplements>).
4. Po publikacji zbiór trafi na wspólną listę AED przy najbliższej agregacji (raz na dobę), o ile przejdzie
   walidację. Raport walidacji i zgłoszenia mieszkańców zobaczycie w kreatorze („Moje AED”).
5. Utrzymanie: aktualizujcie ten sam zbiór (nie zakładajcie nowego), zmianę stanu urządzenia wprowadzajcie
   w ciągu 7 dni, a każde urządzenie sprawdzajcie na miejscu co najmniej raz na 12 miesięcy.

Zasady: w zbiorze tylko Wasze urządzenia; żadnych danych z OpenStreetMap; kontakt wyłącznie służbowy;
zdjęcia bez wizerunku osób.
"""


def pakiet(org: dict, records: list[dict], csv_url: str | None = None) -> bytes:
    """ZIP: aed.csv, aed_harvester.xml, slownik_danych.csv, metadane.json, INSTRUKCJA.txt (K11 – download, not publish)."""
    from .publish import to_csv
    s = slug(org["nazwa"])
    csv_url = csv_url if csv_url and csv_url.startswith("https://") else f"https://WPISZ-ADRES-INSTYTUCJI.pl/dane/aed-{s}.csv"
    slownik_url = f"https://WPISZ-ADRES-INSTYTUCJI.pl/dane/slownik_danych_aed_v{WZORZEC_WERSJA}.csv"
    recs = [uzupelnij(r) for r in records]
    rows = schema.data_dictionary()
    meta = {"tytul": f"Defibrylatory AED – {org['nazwa']}", "dostawca": org["nazwa"], "regon": org.get("regon"),
            "slowa_kluczowe": [KEYWORD, "AED", "defibrylator", "pierwsza pomoc"], "kategoria": "HEAL (Zdrowie)",
            "czestotliwosc_aktualizacji": org.get("czestotliwosc", "monthly"), "licencja": org.get("licencja", "CC0-1.0"),
            "wzorzec": f"wzorcowy_zakres_danych_AED v{WZORZEC_WERSJA}", "liczba_urzadzen": len(recs),
            "obszar_teryt": sorted({r["teryt_terc"] for r in recs if r.get("teryt_terc")})}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"aed-{s}.csv", _csv(recs))
        z.writestr("aed_harvester.xml", harvester_xml(org, recs, csv_url, slownik_url))
        z.writestr(f"slownik_danych_aed_v{WZORZEC_WERSJA}.csv", to_csv(rows, list(rows[0].keys())))
        z.writestr("metadane.json", json.dumps(meta, ensure_ascii=False, indent=2))
        z.writestr("INSTRUKCJA.txt", INSTRUKCJA.format(nazwa=org["nazwa"], czas=now_min(), n=len(recs), csv_url=csv_url))
    return buf.getvalue()


_ = Path
