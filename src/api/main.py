"""REST API /api/v1 – CONTRACT v1.0 §5."""
from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, Field

from src.core import coverage, db, dedup, hours, importers, linked, mapping, pipeline, publish, schema, template, validate
from src.core.store import TZ, get_store, now_min, today

from .auth import DYSPONENT_NAZWA, check_login, require

API = "/api/v1"
app = FastAPI(
    title="Misja AED – API zbioru defibrylatorów",
    version="1.0.0",
    description="Otwarty, ogólnopolski zbiór danych o AED: odczyt, import od dysponentów, zgłoszenia, publikacja dla dane.gov.pl.",
    openapi_url=f"{API}/openapi.json", docs_url=f"{API}/docs", redoc_url=None,
)
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("AED_CORS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def jsonld_context_link(request: Request, call_next):
    """Standard techniczny §5 (poziom 4): kontekst JSON-LD przekazywany w nagłówku HTTP Link."""
    response = await call_next(request)
    if request.url.path.startswith(f"{API}/aed") and response.headers.get("content-type", "").startswith("application/json"):
        response.headers["Link"] = (f'<{API}/kontekst.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; '
                                    f'type="application/ld+json"')
    return response


# ---------- simple rate limit for anonymous writes (citizen reports, QR confirmations) ----------
_hits: dict[str, list[float]] = {}
RATE = int(os.environ.get("AED_RATE_PER_MIN", "20"))


def rate_limit(request: Request):
    import time
    ip = request.client.host if request.client else "?"
    now = time.time()
    hits = [t for t in _hits.get(ip, []) if now - t < 60]
    if len(hits) >= RATE:
        err(429, "za_duzo_zadan", "Za dużo zgłoszeń z tego adresu. Spróbuj ponownie za minutę.")
    hits.append(now)
    _hits[ip] = hits


# ---------- errors (CONTRACT §1) ----------
def err(status: int, code: str, message: str, fields: dict | None = None):
    raise HTTPException(status, detail={"code": code, "message": message, "fields": fields or {}})


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    d = exc.detail if isinstance(exc.detail, dict) else {"code": "blad", "message": str(exc.detail)}
    d.setdefault("fields", {})
    return JSONResponse({"error": d}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def req_error(_: Request, exc: RequestValidationError):
    fields = {}
    for e in exc.errors():
        loc = [str(x) for x in e.get("loc", []) if x not in ("body", "query", "path", "form")]
        fields[".".join(loc) or "zadanie"] = "Nieprawidłowa lub brakująca wartość."
    return JSONResponse({"error": {"code": "walidacja", "message": "Nieprawidłowe dane w żądaniu.", "fields": fields}},
                        status_code=422)


# ---------- helpers ----------
def warstwa(rec: dict) -> str:
    return "osm" if rec.get("licencja") == "ODbL-1.0" else "otwarta"


def available_now(rec: dict, when=None) -> bool | None:
    if rec.get("dostep") == "prywatny" or rec.get("status_urzadzenia") in ("niesprawny", "w_serwisie"):
        return False
    return hours.is_open(rec.get("godziny_dostepnosci"), when)


def resource(rec: dict, extra_meta: dict | None = None) -> dict:
    attrs = {k: rec.get(k) for k in schema.field_order() if k != "id_aed"}
    now = available_now(rec)
    attrs["dostepny_teraz"] = now  # CR-B1: computed by the server, also in attributes
    meta = {"dostepny_teraz": now, "warstwa": warstwa(rec),
            # CR-TL-1: map mode "aktualność danych"
            "stan_danych": coverage.stan_danych(rec), "wiek_danych_dni": coverage.wiek_danych_dni(rec)}
    if now is None:
        meta["komunikat_dostepnosci"] = "Sprawdź godziny na miejscu."
    if rec.get("mobilny"):
        meta["komunikat_mobilny"] = "Urządzenie w pojeździe – lokalizacja to miejsce stacjonowania."
    if rec.get("dostep") == "prywatny":
        meta["komunikat_dostepnosci"] = "Urządzenie niedostępne dla osób postronnych (informacja dla dyspozytora 112)."
    if warstwa(rec) == "osm":
        meta["atrybucja"] = "© autorzy OpenStreetMap (ODbL)"
    if extra_meta:
        meta.update(extra_meta)
    return {"type": "aed", "id": rec["id_aed"], "attributes": attrs, "meta": meta}


def page_links(request: Request, page: int, per_page: int, total: int) -> dict:
    params = dict(request.query_params)
    def link(p):
        params.update(page=str(p), per_page=str(per_page))
        return f"{request.url.path}?{urlencode(params)}"
    last = max(1, -(-total // per_page))
    return {"self": link(page), "first": link(1), "last": link(last),
            "next": link(page + 1) if page < last else None, "prev": link(page - 1) if page > 1 else None}


def problems_to_fields(problems: list[dict]) -> dict:
    return {(p.get("pole") or "rekord"): p["komunikat"] for p in problems if p["poziom"] == "blad"}


# ---------- auth ----------
class Login(BaseModel):
    login: str
    haslo: str


@app.post(f"{API}/auth/login", tags=["auth"], summary="Logowanie na konto demo (dysponent, moderator)")
def login(body: Login):
    token = check_login(body.login, body.haslo)
    if not token:
        err(401, "bledne_dane_logowania", "Nieprawidłowy login lub hasło.")
    return {"token": token, "rola": body.login}


# ---------- read ----------
@app.get(f"{API}/aed", tags=["aed"], summary="Lista AED ze stronicowaniem i filtrami")
def list_aed(request: Request,
             bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat (WGS 84)"),
             wojewodztwo: Optional[str] = None, gmina: Optional[str] = None,
             dostep: Optional[str] = Query(None, description="publiczny | ograniczony | prywatny"),
             dostepne_teraz: Optional[bool] = None,
             q: Optional[str] = Query(None, description="wyszukiwanie w nazwie, adresie i opisie"),
             warstwa_: Optional[str] = Query(None, alias="warstwa", description="otwarta | osm (domyślnie obie)"),
             zrodlo_danych: Optional[str] = None,
             stan_danych: Optional[str] = Query(None, description="aktualne (weryfikacja ≤ 365 dni) | nieaktualne (starsza lub brak daty) – CR-TL-1"),
             page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=1000)):
    st = get_store()
    recs = list(st.records.values())
    if bbox:
        try:
            a, b, c, d = (float(x) for x in bbox.split(","))
        except ValueError:
            err(422, "walidacja", "Parametr bbox: minLon,minLat,maxLon,maxLat.", {"bbox": "Nieprawidłowy format."})
        recs = [r for r in recs if a <= r["dlugosc_geograficzna"] <= c and b <= r["szerokosc_geograficzna"] <= d]
    if wojewodztwo:
        recs = [r for r in recs if r.get("wojewodztwo") == wojewodztwo.lower()]
    if gmina:
        recs = [r for r in recs if (r.get("gmina") or "").lower() == gmina.lower()]
    if dostep:
        recs = [r for r in recs if r.get("dostep") == dostep]
    if zrodlo_danych:
        recs = [r for r in recs if r.get("zrodlo_danych") == zrodlo_danych]
    if warstwa_:
        recs = [r for r in recs if warstwa(r) == warstwa_]
    if stan_danych:
        if stan_danych not in coverage.STANY_DANYCH:
            err(422, "walidacja", "Parametr stan_danych: aktualne | nieaktualne.", {"stan_danych": "Dozwolone: aktualne, nieaktualne."})
        recs = [r for r in recs if coverage.stan_danych(r) == stan_danych]
    if q:
        ql = q.lower()
        recs = [r for r in recs if ql in " ".join(str(r.get(f) or "") for f in
                ("nazwa_obiektu", "opis_lokalizacji", "miejscowosc", "ulica", "dysponent_nazwa", "id_aed")).lower()]
    now = datetime.now(TZ)
    if dostepne_teraz is not None:
        recs = [r for r in recs if (available_now(r, now) is True) == dostepne_teraz]
    recs.sort(key=lambda r: r["id_aed"])
    total = len(recs)
    chunk = recs[(page - 1) * per_page: page * per_page]
    return {"data": [resource(r) for r in chunk],
            "meta": {"count": total, "page": page, "per_page": per_page,
                     "dostepne_teraz_liczone_na": now.strftime("%Y-%m-%dT%H:%M")},
            "links": page_links(request, page, per_page, total)}


@app.get(f"{API}/aed/najblizsze", tags=["aed"], summary="Najbliższe AED (posortowane po odległości)")
def nearest(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
            limit: int = Query(5, ge=1, le=50), tylko_dostepne_teraz: bool = False,
            promien_m: int = Query(20000, ge=100, le=200000)):
    st = get_store()
    now = datetime.now(TZ)
    # cheap prefilter by bounding box, then exact distance
    dlat = promien_m / 111_000
    dlon = promien_m / (111_000 * max(0.2, abs(__import__("math").cos(__import__("math").radians(lat)))))
    cands = []
    for r in st.records.values():
        if abs(r["szerokosc_geograficzna"] - lat) > dlat or abs(r["dlugosc_geograficzna"] - lon) > dlon:
            continue
        d = dedup.distance_m(lat, lon, r["szerokosc_geograficzna"], r["dlugosc_geograficzna"])
        if d > promien_m:
            continue
        a = available_now(r, now)
        if tylko_dostepne_teraz and a is not True:
            continue
        cands.append((d, r, a))
    cands.sort(key=lambda x: x[0])
    data = []
    for d, r, a in cands[:limit]:
        res = resource(r, {"odleglosc_m": round(d), "dostepny_teraz": a})
        res["attributes"]["odleglosc_m"] = round(d)
        res["attributes"]["dostepny_teraz"] = a
        data.append(res)
    return {"data": data, "meta": {"count": len(data), "lat": lat, "lon": lon, "promien_m": promien_m,
                                   "dostepne_teraz_liczone_na": now.strftime("%Y-%m-%dT%H:%M")},
            "links": {"self": f"{API}/aed/najblizsze?lat={lat}&lon={lon}&limit={limit}"}}


_points_cache: dict[tuple, tuple[bytes, bytes, str]] = {}


@app.get(f"{API}/aed/punkty", tags=["aed"], summary="Lekka warstwa punktów do mapy (GeoJSON, gzip, ETag)",
         description="Cała Polska albo `bbox`. Każdy punkt: `id`, współrzędne i trzy pola do kolorowania: "
                     "`dostepny_teraz` (true/false/null), `stan_danych` (aktualne/nieaktualne), `osm` (true = warstwa ODbL). "
                     "Odpowiedź skompresowana gzip, gdy klient to obsługuje; nagłówek `ETag` – przy `If-None-Match` serwer zwraca 304. "
                     "`dostepny_teraz` przeliczane co minutę.")
def aed_points(request: Request, bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat (WGS 84)")):
    import gzip
    import hashlib
    import json as _json
    st = get_store()
    box = None
    if bbox:
        try:
            box = tuple(float(x) for x in bbox.split(","))
            assert len(box) == 4
        except (ValueError, AssertionError):
            err(422, "walidacja", "Parametr bbox: minLon,minLat,maxLon,maxLat.", {"bbox": "Nieprawidłowy format."})
    now = datetime.now(TZ)
    minute = now.strftime("%Y-%m-%dT%H:%M")
    key = (box, minute, st.version)
    if key not in _points_cache:
        feats = []
        for r in sorted(st.records.values(), key=lambda r: r["id_aed"]):
            x, y = r["dlugosc_geograficzna"], r["szerokosc_geograficzna"]
            if box and not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                continue
            feats.append({"type": "Feature", "id": r["id_aed"], "geometry": {"type": "Point", "coordinates": [x, y]},
                          "properties": {"dostepny_teraz": available_now(r, now), "stan_danych": coverage.stan_danych(r),
                                         "osm": warstwa(r) == "osm"}})
        body = _json.dumps({"type": "FeatureCollection", "features": feats,
                            "meta": {"count": len(feats), "liczone_na": minute, "prog_aktualnosci_dni": coverage.PROG_DNI,
                                     "atrybucja_osm": "© autorzy OpenStreetMap (ODbL)"}},
                           ensure_ascii=False, separators=(",", ":")).encode()
        if len(_points_cache) > 32:
            _points_cache.clear()
        _points_cache[key] = (body, gzip.compress(body, 6), '"' + hashlib.sha1(body).hexdigest()[:20] + '"')
    body, gz, etag = _points_cache[key]
    use_gz = "gzip" in request.headers.get("accept-encoding", "")
    etag = etag[:-1] + ('-gz"' if use_gz else '"')
    headers = {"ETag": etag, "Cache-Control": "no-cache", "Vary": "Accept-Encoding"}
    inm = request.headers.get("if-none-match", "")
    if etag in [t.strip() for t in inm.split(",")] or inm.strip() == "*":
        return Response(status_code=304, headers=headers)
    if use_gz:
        headers["Content-Encoding"] = "gzip"
        return Response(gz, media_type="application/geo+json", headers=headers)
    return Response(body, media_type="application/geo+json", headers=headers)


@app.get(f"{API}/aed.jsonld", tags=["aed"], summary="Zbiór AED jako JSON-LD (schema.org) – poziom 4 otwartości")
def aed_jsonld(warstwa_: Optional[str] = Query("otwarta", alias="warstwa")):
    recs = sorted((r for r in get_store().records.values() if not warstwa_ or warstwa(r) == warstwa_), key=lambda r: r["id_aed"])
    return JSONResponse(linked.collection(recs, publish.BASE_URL), media_type="application/ld+json")


@app.get(f"{API}/kontekst.jsonld", tags=["aed"], summary="Kontekst JSON-LD (mapowanie pól na schema.org)")
def jsonld_context():
    return JSONResponse({"@context": linked.context(publish.BASE_URL)}, media_type="application/ld+json")


def confirmations(id_aed: str) -> dict:
    conn = get_store().conn
    rows = conn.execute("SELECT data, created FROM potwierdzenia WHERE id_aed=? ORDER BY id DESC", (id_aed,)).fetchall()
    items = [db.loads(r["data"]) | {"czas": r["created"]} for r in rows]
    on_site = [i for i in items if i.get("jest_na_miejscu") is not None]
    return {"liczba": len(items), "ostatnie": items[0]["czas"] if items else None,
            "jest_na_miejscu_proc": round(100 * sum(1 for i in on_site if i["jest_na_miejscu"]) / len(on_site)) if on_site else None,
            "szafka_dostepna_proc": round(100 * sum(1 for i in items if i.get("szafka_dostepna")) / len(items)) if items else None}


@app.get(f"{API}/aed/{{id_aed}}", tags=["aed"], summary="Rekord AED z pochodzeniem i potwierdzeniami")
def get_aed(id_aed: str, request: Request):
    st = get_store()
    rec = st.records.get(id_aed)
    if not rec:
        err(404, "nie_znaleziono", f"Nie znaleziono AED o identyfikatorze {id_aed}.")
    if "application/ld+json" in request.headers.get("accept", ""):
        return JSONResponse(linked.record(rec, publish.BASE_URL), media_type="application/ld+json")
    prov, conf = st.provenance(id_aed), confirmations(id_aed)
    return {"data": resource(rec, {"pochodzenie": prov, "potwierdzenia": conf}),
            "pochodzenie": prov, "potwierdzenia": conf,  # CR-B3: also top-level
            "links": {"self": f"{API}/aed/{id_aed}"}}


# ---------- write: form ----------
class AedIn(BaseModel):
    model_config = {"extra": "allow"}
    kod_zrodla: Optional[str] = Field(None, description="np. dysponent:urzad-gminy-x; domyślnie formularz")


def _form_record(body: dict, base: dict | None = None) -> tuple[dict, list[dict]]:
    kod = body.pop("kod_zrodla", None) or "dysponent:formularz"
    unknown = [k for k in body if k not in schema.field_order()]
    if unknown:
        err(422, "walidacja", "Nieznane pola spoza zakresu danych.", {k: "Pole spoza wzorcowego zakresu danych." for k in unknown})
    row = dict(base or {})
    row.update(body)
    row.pop("kompletnosc", None)
    m = {k: k for k in row if k in schema.field_order() and k not in ("id_aed",)}
    defaults = {"kod_zrodla": kod, "licencja": row.get("licencja") or "CC0-1.0",
                "data_weryfikacji": row.get("data_weryfikacji") or today()}
    rec, probs = pipeline.transform(row, m, defaults, 1)
    if base:
        rec["id_aed"] = base["id_aed"]
    probs += pipeline.check(rec, 1)
    return rec, probs, kod


@app.post(f"{API}/aed", tags=["aed"], status_code=201, summary="Formularz pojedynczego AED")
def create_aed(body: AedIn, role: str = Depends(require("dysponent", "moderator"))):
    data = body.model_dump(exclude_none=True)
    rec, probs, kod = _form_record(data)
    if validate.has_errors(probs):
        err(422, "walidacja", "Popraw zaznaczone pola.", problems_to_fields(probs))
    sid = rec.get("id_dysponenta_aed") or uuid.uuid4().hex[:12]
    res = get_store().upsert_source(kod, sid, rec)
    get_store().register_source(kod, {"nazwa": f"Formularz – {rec.get('dysponent_nazwa')}", "typ_zrodla": "dysponent",
                                      "format": "formularz", "licencja": rec["licencja"],
                                      "czestotliwosc_aktualizacji": "na bieżąco"})
    return {"data": resource(get_store().records[res["id_aed"]]), "meta": {"status": res["status"],
            "ostrzezenia": [p for p in probs if p["poziom"] == "ostrzezenie"]}}


@app.patch(f"{API}/aed/{{id_aed}}", tags=["aed"], summary="Aktualizacja rekordu AED")
def patch_aed(id_aed: str, body: AedIn, role: str = Depends(require("dysponent", "moderator"))):
    st = get_store()
    base = st.records.get(id_aed)
    if not base:
        err(404, "nie_znaleziono", f"Nie znaleziono AED o identyfikatorze {id_aed}.")
    changes = body.model_dump(exclude_unset=True)
    changes.pop("kod_zrodla", None)
    unknown = [k for k in changes if k not in schema.field_order()]
    if unknown:
        err(422, "walidacja", "Nieznane pola.", {k: "Pole spoza wzorcowego zakresu danych." for k in unknown})
    candidate = dict(base) | changes
    if "godziny_dostepnosci" in changes and "dostepny_24h" not in changes:
        candidate["dostepny_24h"] = hours.is_24_7(candidate["godziny_dostepnosci"])
    candidate["data_aktualizacji"] = now_min()
    probs = validate.validate_record(candidate)
    if validate.has_errors(probs):
        err(422, "walidacja", "Popraw zaznaczone pola.", problems_to_fields(probs))
    rec = st.patch(id_aed, {k: candidate[k] for k in candidate if k in changes or k == "dostepny_24h"},
                   kod_zrodla=f"formularz:{role}")
    return {"data": resource(rec), "meta": {"ostrzezenia": [p for p in probs if p["poziom"] == "ostrzezenie"]}}


# ---------- import (F1) ----------
def _load_import(import_id: str) -> dict:
    row = get_store().conn.execute("SELECT data FROM importy WHERE id=?", (import_id,)).fetchone()
    if not row:
        err(404, "nie_znaleziono", "Nie znaleziono importu.")
    return db.loads(row["data"])


def _save_import(imp: dict):
    st = get_store()
    st.conn.execute("INSERT OR REPLACE INTO importy VALUES (?,?,?)", (imp["import_id"], db.dumps(imp), now_min()))
    st.conn.commit()


@app.post(f"{API}/import", tags=["import"], summary="Wgranie pliku dysponenta (CSV, XLSX, JSON, GeoJSON)")
async def import_file(plik: UploadFile = File(...), kod_zrodla: str = Form(...), licencja: str = Form("CC0-1.0"),
                      nazwa_zrodla: Optional[str] = Form(None), dysponent_nazwa: Optional[str] = Form(None),
                      dysponent_typ: Optional[str] = Form(None), status_urzadzenia: Optional[str] = Form(None),
                      data_weryfikacji: Optional[str] = Form(None), metoda_weryfikacji: Optional[str] = Form(None),
                      czestotliwosc_aktualizacji: Optional[str] = Form(None), obszar: Optional[str] = Form(None),
                      role: str = Depends(require("dysponent", "moderator"))):
    if licencja not in schema.dictionaries()["licencja"]:
        err(422, "walidacja", "Nieznana licencja.", {"licencja": "Dozwolone: " + ", ".join(schema.dictionaries()["licencja"])})
    raw = await plik.read()
    if len(raw) > 20 * 1024 * 1024:
        err(413, "plik_za_duzy", "Plik jest za duży (maks. 20 MB).")
    try:
        rows, fmt = importers.read_any(plik.filename or "", raw)
    except Exception as e:  # noqa: BLE001
        err(422, "nieczytelny_plik", f"Nie udało się odczytać pliku: {e}")
    if not rows:
        err(422, "pusty_plik", "Plik nie zawiera wierszy z danymi.")
    saved = get_store().conn.execute("SELECT mapowanie FROM mapowania WHERE kod_zrodla=?", (kod_zrodla,)).fetchone()
    proposal = mapping.propose(rows, db.loads(saved["mapowanie"]) if saved else None)
    imp = {"import_id": uuid.uuid4().hex[:12], "plik": plik.filename, "kod_zrodla": kod_zrodla, "wykryty_format": fmt,
           "rows": rows, "mapowanie": proposal, "status": "wgrany",
           "defaults": {k: v for k, v in dict(kod_zrodla=kod_zrodla, licencja=licencja, dysponent_nazwa=dysponent_nazwa,
                        dysponent_typ=dysponent_typ, status_urzadzenia=status_urzadzenia, data_weryfikacji=data_weryfikacji,
                        metoda_weryfikacji=metoda_weryfikacji).items() if v},
           "zrodlo": {"nazwa": nazwa_zrodla or dysponent_nazwa or kod_zrodla, "format": fmt.get("format"),
                      "licencja": licencja, "czestotliwosc_aktualizacji": czestotliwosc_aktualizacji or "monthly",
                      "obszar": obszar or "", "typ_zrodla": pipeline.zrodlo_from_kod(kod_zrodla)}}
    _save_import(imp)
    return {"import_id": imp["import_id"], "wykryty_format": fmt, "liczba_wierszy": len(rows),
            "kolumny": list(proposal.keys()), "mapowanie_proponowane": proposal,
            "mapowanie_opis": mapping.describe(proposal), "podglad": rows[:5],
            "pola_docelowe": schema.field_order()}


SYSTEM_FIELDS = {"id_aed", "zrodlo_danych", "licencja", "data_aktualizacji", "metoda_weryfikacji", "data_weryfikacji"}
INFERRED = {"wewnatrz_budynku", "wojewodztwo", "gmina", "dostep", "mobilny", "szafka_zamknieta", "dostepny_24h"}


def _report(imp: dict) -> tuple[dict, list[dict]]:
    first = 1 if imp["wykryty_format"].get("format") in ("JSON", "GeoJSON") else 2
    results = pipeline.process_rows(imp["rows"], imp["mapowanie"], imp["defaults"], first_row=first)
    st = get_store()
    dups = []
    for r in results:
        if r["poprawny"]:
            key = (imp["kod_zrodla"], r["id_w_zrodle"])
            if key in st.by_key:
                r["decyzja"] = "aktualizacja"
                continue
            d, dist = st.find_duplicate(r["rekord"], imp["kod_zrodla"])
            if d:
                other = st.records[d]
                dups.append({"wiersz": r["wiersz"], "id_aed": d, "zrodlo": other.get("zrodlo_danych"),
                             "odleglosc_m": round(dist, 1),
                             "decyzja": "scalono – nadrzędne dane dysponenta" if pipeline.zrodlo_from_kod(imp["kod_zrodla"]) == "dysponent"
                             else "scalono z istniejącym rekordem"})
    mapped = set()
    for t in imp["mapowanie"].values():
        mapped.update(t if isinstance(t, list) else [t] if t else [])
    problems = [p for r in results for p in r["problemy"] if p["poziom"] != "informacja"]
    report = {
        "import_id": imp["import_id"], "plik": imp["plik"], "wykryty_format": imp["wykryty_format"],
        "mapowanie": imp["mapowanie"], "wiersze": len(results),
        "poprawne": sum(r["poprawny"] for r in results),
        "z_ostrzezeniami": sum(1 for r in results if any(p["poziom"] == "ostrzezenie" for p in r["problemy"])),
        "bledy": sum(not r["poprawny"] for r in results),
        "problemy": problems,
        "uzupelnienia": [p for r in results for p in r["problemy"] if p["poziom"] == "informacja"],
        "brakujace_pola_wymagane": [f for f in schema.required_fields() if f not in mapped and f not in SYSTEM_FIELDS
                                    and f not in imp["defaults"] and f not in INFERRED],
        "pola_uzupelnione_automatycznie": [f for f in schema.required_fields() if f not in mapped and f in INFERRED],
        "duplikaty": dups,
        "podglad_rekordow": [r["rekord"] for r in results[:5]],
    }
    return report, results


class MappingIn(BaseModel):
    mapowanie: Optional[dict[str, Any]] = None


@app.post(f"{API}/import/{{import_id}}/mapowanie", tags=["import"], summary="Zatwierdzenie mapowania → raport walidacji")
def import_mapping(import_id: str, body: MappingIn, role: str = Depends(require("dysponent", "moderator"))):
    imp = _load_import(import_id)
    if body.mapowanie is not None:
        bad = {c: "Nieznane pole docelowe." for c, t in body.mapowanie.items()
               if t and any(x not in schema.field_order() for x in (t if isinstance(t, list) else [t]))}
        if bad:
            err(422, "walidacja", "Mapowanie wskazuje pola spoza zakresu danych.", bad)
        imp["mapowanie"] = body.mapowanie
    report, _ = _report(imp)
    imp["status"] = "zmapowany"
    imp["raport"] = {k: report[k] for k in ("wiersze", "poprawne", "bledy", "z_ostrzezeniami")}
    _save_import(imp)
    return report


@app.post(f"{API}/import/{{import_id}}/zatwierdz", tags=["import"], summary="Włączenie poprawnych wierszy do zbioru")
def import_commit(import_id: str, role: str = Depends(require("dysponent", "moderator"))):
    imp = _load_import(import_id)
    if imp["status"] == "zatwierdzony":
        err(409, "juz_zatwierdzony", "Ten import został już zatwierdzony.")
    report, results = _report(imp)
    st = get_store()
    counts = {"dodane": 0, "zaktualizowane": 0, "scalone": 0, "odrzucone": 0}
    ids = []
    for r in results:
        if not r["poprawny"]:
            counts["odrzucone"] += 1
            continue
        res = st.upsert_source(imp["kod_zrodla"], r["id_w_zrodle"], r["rekord"], commit=False)
        counts[res["status"]] += 1
        ids.append(res["id_aed"])
    st.commit()
    st.register_source(imp["kod_zrodla"], imp["zrodlo"] | {"odrzucone": counts["odrzucone"]})
    st.conn.execute("INSERT OR REPLACE INTO mapowania VALUES (?,?)", (imp["kod_zrodla"], db.dumps(imp["mapowanie"])))
    imp["status"] = "zatwierdzony"
    imp["wynik"] = counts
    _save_import(imp)
    return counts | {"id_aed": ids, "raport": {k: report[k] for k in ("wiersze", "poprawne", "bledy", "z_ostrzezeniami")}}


# ---------- citizen reports & moderation ----------
class ZgloszenieIn(BaseModel):
    lat: float = Field(..., ge=49.0, le=54.9)
    lon: float = Field(..., ge=14.1, le=24.2)
    opis: str = Field(..., min_length=3, max_length=500)
    nazwa_obiektu: Optional[str] = Field(None, max_length=200)
    zdjecie: Optional[str] = Field(None, description="URL https:// albo data URI (opcjonalnie)")


@app.post(f"{API}/zgloszenia", tags=["zgloszenia"], status_code=201, summary="Zgłoszenie AED przez obywatela",
          dependencies=[Depends(rate_limit)])
def create_report(body: ZgloszenieIn):
    zid = uuid.uuid4().hex[:12]
    data = body.model_dump() | {"id": zid, "status": "do_weryfikacji", "czas": now_min()}
    # no personal data stored: no reporter contact
    st = get_store()
    st.conn.execute("INSERT INTO zgloszenia VALUES (?,?,?,?)", (zid, "do_weryfikacji", db.dumps(data), now_min()))
    st.conn.commit()
    near, dist = None, None
    probe = {"szerokosc_geograficzna": body.lat, "dlugosc_geograficzna": body.lon, "nazwa_obiektu": body.nazwa_obiektu or ""}
    for cand in st.grid.near(body.lat, body.lon):
        d = dedup.distance_m(body.lat, body.lon, st.records[cand]["szerokosc_geograficzna"], st.records[cand]["dlugosc_geograficzna"])
        if d <= 30 and (dist is None or d < dist):
            near, dist = cand, d
    _ = probe
    return {"id": zid, "status": "do_weryfikacji", "data": data, "meta": {"mozliwy_duplikat": near, "odleglosc_m": round(dist) if dist is not None else None,
                                   "komunikat": "Dziękujemy! Zgłoszenie trafi do weryfikacji przed dodaniem do zbioru."}}


def _nearest_aed(st, lat: float, lon: float, max_m: float = 30) -> tuple[str, int] | None:
    best = None
    for cand in st.grid.near(lat, lon):
        d = dedup.distance_m(lat, lon, st.records[cand]["szerokosc_geograficzna"], st.records[cand]["dlugosc_geograficzna"])
        if d <= max_m and (best is None or d < best[1]):
            best = (cand, round(d))
    return best


def _is_own(st, id_aed: str | None) -> bool:
    """AED operated by the logged-in provider (demo account → DEMO_DYSPONENT_NAZWA)."""
    rec = st.records.get(id_aed) if id_aed else None
    return bool(rec) and (rec.get("dysponent_nazwa") or "").strip().lower() == DYSPONENT_NAZWA.strip().lower()


@app.get(f"{API}/zgloszenia", tags=["zgloszenia"], summary="Kolejka zgłoszeń do moderacji",
         description="Moderator widzi wszystkie zgłoszenia. Dysponent – tylko dotyczące jego AED (najbliższy AED w promieniu 30 m).")
def list_reports(status: Optional[str] = "do_weryfikacji", role: str = Depends(require("moderator", "dysponent"))):
    st = get_store()
    sql, args = "SELECT data, status FROM zgloszenia", ()
    if status:
        sql, args = sql + " WHERE status=?", (status,)
    rows = [db.loads(r["data"]) | {"status": r["status"]} for r in st.conn.execute(sql + " ORDER BY created DESC", args)]
    items = []
    for r in rows:
        near = _nearest_aed(st, r["lat"], r["lon"])
        target = r.get("id_aed") or (near[0] if near else None)
        if role == "dysponent" and not _is_own(st, target):
            continue
        items.append({"type": "zgloszenie", "id": r["id"], "attributes": {k: v for k, v in r.items() if k != "id"},
                      "meta": {"mozliwy_duplikat": near[0] if near else None, "odleglosc_m": near[1] if near else None}})
    return {"data": items, "meta": {"count": len(items), "page": 1, "per_page": len(items)},
            "links": {"self": f"{API}/zgloszenia" + (f"?status={status}" if status else "")}}


class Decyzja(BaseModel):
    decyzja: str = Field(..., pattern="^(zatwierdz|odrzuc|scal)$")
    id_aed_docelowy: Optional[str] = Field(None, description="dla „scal”: istniejący AED; domyślnie najbliższy w promieniu 30 m")
    uzasadnienie: Optional[str] = None
    rekord: Optional[dict[str, Any]] = Field(None, description="Pola rekordu uzupełnione przez moderatora (adres, dostęp…)")


@app.post(f"{API}/zgloszenia/{{zid}}/decyzja", tags=["zgloszenia"], summary="Decyzja moderatora albo dysponenta",
          description="Moderator: każde zgłoszenie. Dysponent: tylko dla swoich AED – `scal`/`odrzuc`, gdy zgłoszenie dotyczy "
                      "jego AED (wskazany `id_aed_docelowy` albo najbliższy w 30 m); `zatwierdz` – nowy AED z jego `dysponent_nazwa`. "
                      "Inaczej 403 `brak_uprawnien`.")
def decide(zid: str, body: Decyzja, role: str = Depends(require("moderator", "dysponent"))):
    st = get_store()
    row = st.conn.execute("SELECT data, status FROM zgloszenia WHERE id=?", (zid,)).fetchone()
    if not row:
        err(404, "nie_znaleziono", "Nie znaleziono zgłoszenia.")
    data = db.loads(row["data"])
    if row["status"] != "do_weryfikacji":
        err(409, "juz_rozpatrzone", "Zgłoszenie zostało już rozpatrzone.")
    if role == "dysponent":
        if body.decyzja == "zatwierdz":
            # a provider may add only its own device to the dataset
            nazwa = (body.rekord or {}).get("dysponent_nazwa")
            if nazwa and nazwa.strip().lower() != DYSPONENT_NAZWA.strip().lower():
                err(403, "brak_uprawnien", "Dysponent może zatwierdzić zgłoszenie tylko jako swój AED.",
                    {"rekord.dysponent_nazwa": f"Dozwolone: {DYSPONENT_NAZWA}."})
            body.rekord = (body.rekord or {}) | {"dysponent_nazwa": DYSPONENT_NAZWA}
        else:
            near = _nearest_aed(st, data["lat"], data["lon"])
            target = body.id_aed_docelowy or (near[0] if near else None)
            if not _is_own(st, target):
                err(403, "brak_uprawnien", "Dysponent rozpatruje tylko zgłoszenia dotyczące swoich AED.")
    result = {}
    if body.decyzja == "zatwierdz":
        r = {"nazwa_obiektu": data.get("nazwa_obiektu"), "opis_lokalizacji": data["opis"][:250],
             "szerokosc_geograficzna": data["lat"], "dlugosc_geograficzna": data["lon"]} | (body.rekord or {})
        m = {k: k for k in r}
        rec, probs = pipeline.transform(r, m, {"kod_zrodla": "zgloszenia", "zrodlo_danych": "zgloszenie_obywatela",
                                               "licencja": "CC0-1.0", "metoda_weryfikacji": "zgloszenie_obywatela"}, 1)
        probs += pipeline.check(rec, 1)
        if validate.has_errors(probs):
            err(422, "walidacja", "Uzupełnij brakujące pola rekordu przed zatwierdzeniem.", problems_to_fields(probs))
        result = st.upsert_source("zgloszenia", zid, rec)
        data["id_aed"] = result["id_aed"]
    if body.decyzja == "scal":
        target = body.id_aed_docelowy
        if not target:
            best = _nearest_aed(st, data["lat"], data["lon"])
            target = best[0] if best else None
        if not target or target not in st.records:
            err(422, "walidacja", "Brak istniejącego AED do scalenia (w promieniu 30 m). Wskaż id_aed_docelowy.",
                {"id_aed_docelowy": "Wskaż istniejący AED."})
        # the report confirms an existing device (counts as a QR-style confirmation)
        st.conn.execute("INSERT INTO potwierdzenia (id_aed, data, created) VALUES (?,?,?)",
                        (target, db.dumps({"jest_na_miejscu": True, "komentarz": f"zgłoszenie obywatela scalone ({role})"}), now_min()))
        data["id_aed"] = target
        result = {"status": "scalone", "id_aed": target}
    data["status"] = {"zatwierdz": "zatwierdzone", "odrzuc": "odrzucone", "scal": "scalone"}[body.decyzja]
    data["uzasadnienie"] = body.uzasadnienie
    data["decyzje_podjal"] = role
    st.conn.execute("UPDATE zgloszenia SET status=?, data=? WHERE id=?", (data["status"], db.dumps(data), zid))
    st.conn.commit()
    return {"data": data, "meta": result}


# ---------- AED passport (QR) ----------
class Potwierdzenie(BaseModel):
    jest_na_miejscu: bool
    szafka_dostepna: Optional[bool] = None
    komentarz: Optional[str] = Field(None, max_length=300)


@app.post(f"{API}/aed/{{id_aed}}/potwierdzenia", tags=["aed"], status_code=201, summary="Paszport AED – potwierdzenie z kodu QR",
          dependencies=[Depends(rate_limit)])
def confirm(id_aed: str, body: Potwierdzenie):
    st = get_store()
    if id_aed not in st.records:
        err(404, "nie_znaleziono", f"Nie znaleziono AED o identyfikatorze {id_aed}.")
    st.conn.execute("INSERT INTO potwierdzenia (id_aed, data, created) VALUES (?,?,?)",
                    (id_aed, db.dumps(body.model_dump()), now_min()))
    st.conn.commit()
    return {"ok": True, "data": confirmations(id_aed), "meta": {"komunikat": "Dziękujemy za potwierdzenie!"}}


# ---------- sources & connectors ----------
@app.get(f"{API}/zrodla", tags=["zrodla"], summary="Zakres referencyjny źródeł")
def sources():
    rows = get_store().sources_scope()
    return {"data": rows, "meta": {"count": len(rows)}}


@app.post(f"{API}/zrodla/osm/odswiez", tags=["zrodla"], summary="Konektor OpenStreetMap (eksport AED OSM Polska)")
def osm_refresh(role: str = Depends(require("moderator"))):
    from src.core.connectors import osm
    return osm.refresh(get_store())


class Szukaj(BaseModel):
    q: str = "defibrylator AED"
    importuj: bool = False


@app.post(f"{API}/zrodla/dane-gov-pl/szukaj", tags=["zrodla"], summary="Wyszukiwanie zbiorów AED w dane.gov.pl")
def dgp_search(body: Szukaj, role: str = Depends(require("moderator"))):
    from src.core.connectors import dane_gov_pl
    return dane_gov_pl.search(get_store(), body.q, body.importuj)


# ---------- publication ----------
@app.get(f"{API}/eksport/{{plik}}", tags=["publikacja"], summary="Zasoby do publikacji w dane.gov.pl")
def export(plik: str):
    if plik not in publish.FILES:
        err(404, "nie_znaleziono", "Nieznany plik eksportu. Dostępne: " + ", ".join(publish.FILES))
    body = publish.build(get_store(), plik)
    ext = "." + plik.rsplit(".", 1)[1]
    return Response(body, media_type=publish.MIME[ext],
                    headers={"Content-Disposition": f'inline; filename="{plik}"', "Cache-Control": "no-cache"})


@app.get(f"{API}/eksport", tags=["publikacja"], summary="Lista zasobów eksportu (CR-B9)")
def export_list():
    st = get_store()
    out = []
    for f in publish.FILES:
        info = publish.resource_info(f)
        out.append({"plik": f, "url": f"{API}/eksport/{f}", "format": info["format"], "licencja": info["licencja"],
                    "rozmiar_b": len(publish.build(st, f)), "opis": info["opis"], "tytul": info["tytul"]})
    return {"data": out, "meta": {"count": len(out)}}


@app.get(f"{API}/szablon.csv", tags=["publikacja"], summary="Pusty szablon CSV dla dysponentów")
def template_csv():
    return Response(publish.template_csv(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="szablon_aed.csv"'})


@app.get(f"{API}/szablon.xlsx", tags=["publikacja"], summary="Szablon XLSX z listami wyboru dla dysponentów")
def template_xlsx():
    return Response(template.template_xlsx(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="szablon_aed.xlsx"'})


@app.get(f"{API}/statystyki", tags=["publikacja"], summary="Statystyki zbioru")
def stats():
    st = get_store()
    recs = list(st.records.values())
    by_woj, by_src, buckets = {}, {}, {"0-49": 0, "50-69": 0, "70-89": 0, "90-100": 0}
    verified = 0
    now = datetime.now(TZ)
    avail = {"true": 0, "false": 0, "null": 0}
    fresh = {coverage.AKTUALNE: 0, coverage.NIEAKTUALNE: 0}
    for r in recs:
        fresh[coverage.stan_danych(r)] += 1
        by_woj[r.get("wojewodztwo") or "brak"] = by_woj.get(r.get("wojewodztwo") or "brak", 0) + 1
        by_src[r.get("zrodlo_danych")] = by_src.get(r.get("zrodlo_danych"), 0) + 1
        k = r.get("kompletnosc") or 0
        buckets["0-49" if k < 50 else "50-69" if k < 70 else "70-89" if k < 90 else "90-100"] += 1
        verified += coverage.stan_danych(r) == coverage.AKTUALNE
        a = available_now(r, now)
        avail[str(a).lower() if a is not None else "null"] += 1
    n = len(recs) or 1
    gminy_bez, gminy_obj = 0, {}
    counts = coverage.counts_by_gmina(recs)
    by_woj_loc: dict[str, int] = {}
    for r in recs:
        w = coverage.wojewodztwo_z_polozenia(r) or "poza_granicami"
        by_woj_loc[w] = by_woj_loc.get(w, 0) + 1
    for woj in coverage.boundary_files():
        fc = coverage.coverage(recs, woj, counts=counts)
        bez = sum(1 for f in fc["features"] if f["properties"]["stan"] == "brak_danych")
        gminy_bez += bez
        gminy_obj[woj] = {"gminy": len(fc["features"]), "gminy_bez_danych": bez}
    return {"data": {
        "liczba_aed": len(recs),
        "liczba_dysponentow": len({r.get("dysponent_nazwa") for r in recs if r.get("dysponent_nazwa")}),
        "warstwa_otwarta": sum(1 for r in recs if warstwa(r) == "otwarta"),
        "warstwa_osm": sum(1 for r in recs if warstwa(r) == "osm"),
        "wg_wojewodztw": dict(sorted(by_woj.items())), "wg_zrodel": by_src,
        # by location in PRG boundaries (OSM records often have no address, so the field-based count shows "brak")
        "wg_wojewodztw_polozenie": dict(sorted(by_woj_loc.items())),
        "kompletnosc_rozklad": buckets,
        "srednia_kompletnosc": round(sum(r.get("kompletnosc") or 0 for r in recs) / n),
        "zweryfikowane_12m_proc": round(100 * verified / n),
        "szafka_zamknieta": sum(1 for r in recs if r.get("szafka_zamknieta")),
        "dostepne_teraz": avail,
        # CR-TL-1
        "aktualne": fresh[coverage.AKTUALNE], "nieaktualne": fresh[coverage.NIEAKTUALNE],
        "gminy_bez_danych": gminy_bez,
        "zgloszenia_do_weryfikacji": st.conn.execute("SELECT COUNT(*) FROM zgloszenia WHERE status='do_weryfikacji'").fetchone()[0],
        "liczba_zrodel": len(st.sources_scope()),
    }, "meta": {"liczone_na": now.strftime("%Y-%m-%dT%H:%M"), "prog_aktualnosci_dni": coverage.PROG_DNI,
                 "gminy_liczone_dla": gminy_obj}}


@app.get(f"{API}/pokrycie", tags=["aed"], summary="Pokrycie gmin danymi o AED (GeoJSON) – tryb mapy „aktualność danych” (CR-TL-1)")
def coverage_map(wojewodztwo: str = Query("kujawsko-pomorskie", description="nazwa województwa; granice: data/granice/")):
    fc = coverage.coverage(get_store().records.values(), wojewodztwo)
    if fc is None:
        err(404, "brak_granic", f"Brak granic gmin dla województwa „{wojewodztwo}”. Dostępne: "
            + ", ".join(coverage.boundary_files()) + ".")
    summary = {s: sum(1 for f in fc["features"] if f["properties"]["stan"] == s) for s in coverage.STANY_GMINY}
    return JSONResponse({**fc, "meta": {"wojewodztwo": wojewodztwo.lower(), "liczba_gmin": len(fc["features"]),
                                        "gminy_wg_stanu": summary, "prog_aktualnosci_dni": coverage.PROG_DNI,
                                        "atrybucja": fc["metadata"].get("atrybucja"),
                                        "liczone_na": now_min()}},
                        media_type="application/geo+json")


@app.get(f"{API}/slowniki", tags=["publikacja"], summary="Słowniki wartości i słownik danych (dla formularzy)")
def dictionaries():
    return {"data": {"slowniki": schema.dictionaries(), "pola": schema.data_dictionary(),
                     "wymagane": schema.required_fields(), "zalecane": schema.recommended_fields()}}


@app.get(f"{API}/miejsca", tags=["aed"], summary="Wyszukiwanie miejscowości (środek rekordów AED) – CR-B2")
def places(q: str = Query(..., min_length=2), limit: int = Query(10, ge=1, le=50)):
    """No geocoding: localities known from the dataset, centre = mean of their AED coordinates."""
    ql = q.lower()
    groups: dict[tuple, list] = {}
    for r in get_store().records.values():
        m = r.get("miejscowosc")
        if m and ql in m.lower():
            groups.setdefault((m, r.get("wojewodztwo")), []).append(r)
    out = []
    for (m, w), rs in groups.items():
        out.append({"nazwa": m, "wojewodztwo": w, "liczba_aed": len(rs),
                    "lat": round(sum(x["szerokosc_geograficzna"] for x in rs) / len(rs), 6),
                    "lon": round(sum(x["dlugosc_geograficzna"] for x in rs) / len(rs), 6)})
    out.sort(key=lambda x: (not x["nazwa"].lower().startswith(ql), -x["liczba_aed"]))
    return {"data": out[:limit], "meta": {"count": min(len(out), limit)}}


@app.get("/api/docs", include_in_schema=False)
def docs_alias():
    return RedirectResponse(f"{API}/docs")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(f"{API}/docs")


@app.get(f"{API}/health", tags=["system"])
def health():
    return {"status": "ok", "liczba_aed": len(get_store().records)}
