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
from pydantic import BaseModel, Field, StrictBool

from src.core import coverage, db, dedup, hours, importers, linked, mapping, pipeline, publish, schema, template, validate
from src.core.store import TZ, get_store, now_min, today

from . import auth
from .auth import check_login, require

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
    """Model ról: 'lista' = record from a provider's dataset on dane.gov.pl; 'pomocnicza' = OSM etc., "Do sprawdzenia"."""
    return get_store().warstwa(rec["id_aed"])


WARSTWY = ("lista", "pomocnicza", "wszystkie")


def _layer_filter(recs, w: str | None, default: str = "lista"):
    w = w or default
    if w in ("otwarta",):  # older name of the open layer
        w = "lista"
    if w == "osm":
        w = "pomocnicza"
    if w not in WARSTWY:
        err(422, "walidacja", "Parametr warstwa: lista | pomocnicza | wszystkie.", {"warstwa": "Dozwolone: lista, pomocnicza, wszystkie."})
    return recs if w == "wszystkie" else [r for r in recs if warstwa(r) == w]


def lista_meta(rec: dict) -> dict:
    """Provenance shown with every record of the common list (§7, K4)."""
    p = get_store().lista.get(rec["id_aed"])
    if not p:
        return {"warstwa": "pomocnicza", "komunikat_warstwy":
                "Do sprawdzenia: punkt z OpenStreetMap, nie potwierdzony przez właściciela urządzenia. Nie należy do wspólnej listy AED.",
                "atrybucja": "© współtwórcy OpenStreetMap (ODbL 1.0)"}
    return {"warstwa": "lista", "dostawca": p["dostawca"], "dostawca_regon": p.get("regon"), "zbior_id": p["zbior_id"],
            "zbior_tytul": p["zbior_tytul"], "zbior_url": p["zbior_url"], "zasob_url": p["zasob_url"],
            "data_danych": p.get("data_danych"), "zbior_zmodyfikowany": p.get("zbior_zmodyfikowany"),
            "czestotliwosc_aktualizacji": p.get("czestotliwosc"), "zbior_nieaktualny": p.get("zbior_nieaktualny", False),
            "licencja_zbioru": p.get("licencja_zbioru"), "mozliwe_duplikaty": p.get("mozliwe_duplikaty", []),
            "fikcyjny_dostawca": p.get("fikcyjny", False), "zgodnosc": p.get("zgodnosc", "wzorzec"),
            "dostawca_podstawa": podstawa(p["dostawca"])}


def podstawa(dostawca: str) -> str:
    """CR-TL-6: on what basis the provider publishes – declared with its account; without an account the template
    requires dysponent_nazwa = the provider, i.e. the owner."""
    r = get_store().conn.execute("SELECT podstawa FROM konta WHERE lower(dysponent_nazwa)=lower(?) AND podstawa IS NOT NULL "
                                 "ORDER BY utworzono LIMIT 1", (dostawca or "",)).fetchone()
    return r["podstawa"] if r else "wlasciciel"


def available_now(rec: dict, when=None) -> bool | None:
    if rec.get("dostep") == "prywatny" or rec.get("status_urzadzenia") in ("niesprawny", "w_serwisie"):
        return False
    return hours.is_open(rec.get("godziny_dostepnosci"), when)


def resource(rec: dict, extra_meta: dict | None = None) -> dict:
    attrs = {k: rec.get(k) for k in schema.field_order() if k != "id_aed"}
    now = available_now(rec)
    attrs["dostepny_teraz"] = now  # CR-B1: computed by the server, also in attributes
    meta = {"dostepny_teraz": now,
            # CR-TL-1: map mode "aktualność danych"; model ról: record "do weryfikacji" ≠ dataset "nieaktualny"
            "stan_danych": coverage.stan_danych(rec), "wiek_danych_dni": coverage.wiek_danych_dni(rec)} | lista_meta(rec)
    if now is None:
        meta["komunikat_dostepnosci"] = "Sprawdź godziny na miejscu."
    if rec.get("mobilny"):
        meta["komunikat_mobilny"] = "Urządzenie w pojeździe – lokalizacja to miejsce stacjonowania."
    if rec.get("dostep") == "prywatny":
        meta["komunikat_dostepnosci"] = "Urządzenie niedostępne dla osób postronnych (informacja dla dyspozytora 112)."
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
        a = auth.account((body.login or "").strip().lower())
        if a and not a["aktywne"] and auth.verify_password(body.haslo or "", a["haslo"]):
            if str(a.get("utworzyl") or "").startswith("wniosek:"):  # CR-TL-8: request not approved yet
                err(403, "konto_oczekuje", "Konto czeka na zatwierdzenie przez administratora.")
            err(403, "konto_zablokowane", "Konto jest zablokowane. Skontaktuj się z administratorem.")
        err(401, "bledne_dane_logowania", "Nieprawidłowy login lub hasło.")
    u = auth.user_for(body.login.strip().lower())
    return {"token": token, "rola": str(u), "login": u.login, "dysponent_nazwa": u.nazwa}


# ---------- read ----------
@app.get(f"{API}/aed", tags=["aed"], summary="Lista AED ze stronicowaniem i filtrami")
def list_aed(request: Request,
             bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat (WGS 84)"),
             wojewodztwo: Optional[str] = None, gmina: Optional[str] = None,
             dostep: Optional[str] = Query(None, description="publiczny | ograniczony | prywatny"),
             dostepne_teraz: Optional[bool] = None,
             q: Optional[str] = Query(None, description="wyszukiwanie w nazwie, adresie i opisie"),
             warstwa_: Optional[str] = Query(None, alias="warstwa", description="lista (domyślnie: wspólna lista AED dostawców) | pomocnicza (OSM, do sprawdzenia) | wszystkie"),
             zrodlo_danych: Optional[str] = None,
             stan_danych: Optional[str] = Query(None, description="aktualne (weryfikacja ≤ 365 dni) | nieaktualne (starsza lub brak daty) – CR-TL-1"),
             ids: Optional[str] = Query(None, description="lista id_aed rozdzielonych przecinkami (maks. 200) – rekordy w podanej kolejności, np. lista obok mapy"),
             page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=1000)):
    st = get_store()
    if ids:
        wanted = [i.strip() for i in ids.split(",") if i.strip()]
        if len(wanted) > 200:
            err(422, "walidacja", "Parametr ids: maksymalnie 200 identyfikatorów.", {"ids": "Za dużo identyfikatorów."})
        recs = [st.records[i] for i in dict.fromkeys(wanted) if i in st.records]
    else:
        recs = list(st.records.values())
    if bbox:
        try:
            a, b, c, d = (float(x) for x in bbox.split(","))
        except ValueError:
            err(422, "walidacja", "Parametr bbox: minLon,minLat,maxLon,maxLat.", {"bbox": "Nieprawidłowy format."})
        recs = [r for r in recs if a <= r["dlugosc_geograficzna"] <= c and b <= r["szerokosc_geograficzna"] <= d]
    if wojewodztwo:
        # by location in PRG boundaries (OSM records rarely have the field); the field is the fallback
        w = wojewodztwo.lower()
        recs = [r for r in recs if (coverage.wojewodztwo_z_polozenia(r) or r.get("wojewodztwo")) == w]
    if gmina:
        recs = [r for r in recs if (r.get("gmina") or "").lower() == gmina.lower()]
    if dostep:
        recs = [r for r in recs if r.get("dostep") == dostep]
    if zrodlo_danych:
        recs = [r for r in recs if r.get("zrodlo_danych") == zrodlo_danych]
    recs = _layer_filter(recs, warstwa_, "wszystkie" if ids else "lista")
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
    if not ids:
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
            promien_m: int = Query(20000, ge=100, le=200000),
            warstwa_: Optional[str] = Query(None, alias="warstwa", description="lista (domyślnie) | pomocnicza | wszystkie")):
    st = get_store()
    now = datetime.now(TZ)
    layer = warstwa_ or "lista"
    _layer_filter([], layer)
    # cheap prefilter by bounding box, then exact distance
    dlat = promien_m / 111_000
    dlon = promien_m / (111_000 * max(0.2, abs(__import__("math").cos(__import__("math").radians(lat)))))
    cands = []
    for r in st.records.values():
        if abs(r["szerokosc_geograficzna"] - lat) > dlat or abs(r["dlugosc_geograficzna"] - lon) > dlon:
            continue
        if layer != "wszystkie" and warstwa(r) != layer:
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
    return {"data": data, "meta": {"count": len(data), "lat": lat, "lon": lon, "promien_m": promien_m, "warstwa": layer,
                                   "dostepne_teraz_liczone_na": now.strftime("%Y-%m-%dT%H:%M")},
            "links": {"self": f"{API}/aed/najblizsze?lat={lat}&lon={lon}&limit={limit}"}}


_points_cache: dict[tuple, tuple[bytes, bytes, str]] = {}


@app.get(f"{API}/aed/punkty", tags=["aed"], summary="Lekka warstwa punktów do mapy (GeoJSON, gzip, ETag)",
         description="Cała Polska albo `bbox`. Każdy punkt: `id`, współrzędne i pola do kolorowania i filtrowania: "
                     "`dostepny_teraz` (true/false/null), `stan_danych` (aktualne/nieaktualne), `osm` (true = warstwa ODbL), "
                     "`dostep` (publiczny/ograniczony/prywatny), `wiek_danych_dni` (null = brak daty), `mobilny`, "
                     "`wojewodztwo` i `gmina_teryt` (z położenia). "
                     "Odpowiedź skompresowana gzip, gdy klient to obsługuje; nagłówek `ETag` – przy `If-None-Match` serwer zwraca 304. "
                     "`dostepny_teraz` przeliczane co minutę.")
def aed_points(request: Request, bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat (WGS 84)"),
               warstwa_: Optional[str] = Query("wszystkie", alias="warstwa", description="wszystkie (domyślnie) | lista | pomocnicza")):
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
    _layer_filter([], warstwa_)
    key = (box, minute, st.version, warstwa_)
    if key not in _points_cache:
        feats = []
        for r in sorted(st.records.values(), key=lambda r: r["id_aed"]):
            x, y = r["dlugosc_geograficzna"], r["szerokosc_geograficzna"]
            if box and not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                continue
            if warstwa_ not in ("wszystkie", None) and warstwa(r) != warstwa_:
                continue
            feats.append({"type": "Feature", "id": r["id_aed"], "geometry": {"type": "Point", "coordinates": [x, y]},
                          "properties": {"dostepny_teraz": available_now(r, now), "stan_danych": coverage.stan_danych(r),
                                         "osm": warstwa(r) == "pomocnicza",  # older name: helper layer "Do sprawdzenia"
                                         "warstwa": warstwa(r),
                                         "zbior_nieaktualny": bool(st.lista.get(r["id_aed"], {}).get("zbior_nieaktualny")),
                                         "duplikat": bool(st.lista.get(r["id_aed"], {}).get("mozliwe_duplikaty")),
                                         "zgodnosc": (st.lista[r["id_aed"]].get("zgodnosc", "wzorzec") if r["id_aed"] in st.lista else None),
                                         # for client-side filters next to the map (availability, freshness, area)
                                         "dostep": r.get("dostep"), "wiek_danych_dni": coverage.wiek_danych_dni(r),
                                         "mobilny": bool(r.get("mobilny")),
                                         "wojewodztwo": coverage.wojewodztwo_z_polozenia(r) or r.get("wojewodztwo"),
                                         "gmina_teryt": coverage.gmina_teryt(r)}})
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
def aed_jsonld():
    recs = sorted(_layer_filter(list(get_store().records.values()), "lista"), key=lambda r: r["id_aed"])
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


# ---------- provider workspace: the wizard (P2). Writes ONLY there – the common list is read-only (K1, K2) ----------
def _dostawca(user) -> str:
    if str(user) != "dysponent" or not getattr(user, "nazwa", None):
        err(403, "brak_uprawnien", "Dane o AED wprowadza wyłącznie właściciel urządzenia (konto dostawcy). Administrator nie wprowadza danych.")
    return user.nazwa


def _robocze(dostawca: str) -> dict[str, dict]:
    rows = get_store().conn.execute("SELECT id_aed, data FROM robocze WHERE lower(dostawca)=lower(?)", (dostawca,)).fetchall()
    return {r["id_aed"]: db.loads(r["data"]) for r in rows}


def _zapisz_robocze(user, rec: dict, operacja: str, przed: dict | None = None) -> dict:
    from src.core import dostawcy, dziennik
    rec = dostawcy.uzupelnij(rec)
    st = get_store()
    st.conn.execute("INSERT OR REPLACE INTO robocze VALUES (?,?,?,?)", (user.nazwa, rec["id_aed"], db.dumps(rec), now_min()))
    st.conn.commit()
    dziennik.zapisz(user, operacja, rec["id_aed"], przed=przed, po=rec)
    return rec


def _robocze_out(rec: dict, dostawca: str) -> dict:
    from src.core import dostawcy
    probs = dostawcy.sprawdz_rekord(rec, dostawca)
    return {"type": "aed_roboczy", "id": rec["id_aed"], "attributes": {k: rec.get(k) for k in schema.field_order() if k != "id_aed"},
            "meta": {"zgodny_ze_wzorcem": not probs, "problemy": probs,
                     "na_liscie": rec["id_aed"] in get_store().lista and get_store().lista[rec["id_aed"]]["dostawca"].lower() == dostawca.lower()}}


def _nowy_id(dostawca: str, seed: str) -> str:
    return dedup.make_id(f"dostawca:{dostawca}", seed)


@app.post(f"{API}/aed", tags=["kreator"], status_code=201, summary="Dodaj AED do kopii roboczej dostawcy (formularz)",
          description="Tylko dostawca (dysponent), tylko własne urządzenie. Trafia do kopii roboczej kreatora, nie na wspólną listę – "
                      "na listę trafi po opublikowaniu plików na koncie dostawcy w dane.gov.pl. Administrator: 403.")
def create_aed(body: AedIn, role: str = Depends(require("dysponent", "administrator"))):
    dostawca = _dostawca(role)
    data = body.model_dump(exclude_none=True)
    data["dysponent_nazwa"] = dostawca  # only own devices
    data.setdefault("zrodlo_danych", "dysponent")
    rec, probs, _ = _form_record(data)
    if validate.has_errors(probs):
        err(422, "walidacja", "Popraw zaznaczone pola.", problems_to_fields(probs))
    rec["id_aed"] = data.get("id_aed") or _nowy_id(dostawca, rec.get("id_dysponenta_aed") or uuid.uuid4().hex)
    rec = _zapisz_robocze(role, rec, "kreator:dodaj")
    return {"data": _robocze_out(rec, dostawca), "meta": {"ostrzezenia": [p for p in probs if p["poziom"] == "ostrzezenie"],
            "komunikat": "Dodano do kopii roboczej. Pobierz pliki do publikacji i opublikuj je na koncie instytucji w dane.gov.pl."}}


@app.patch(f"{API}/aed/{{id_aed}}", tags=["kreator"], summary="Zmień własne AED (w kopii roboczej dostawcy)",
           description="Dostawca może zmienić tylko swoje urządzenie (rekord innego dostawcy → 403, K1). Administrator nie ma zapisu (403, K2). "
                       "Zmiana trafia do kopii roboczej; wspólna lista pokazuje dane z opublikowanego zbioru.")
def patch_aed(id_aed: str, body: AedIn, role: str = Depends(require("dysponent", "administrator"))):
    dostawca = _dostawca(role)
    st = get_store()
    work = _robocze(dostawca)
    base = work.get(id_aed)
    if base is None:
        rec = st.records.get(id_aed)
        if not rec:
            err(404, "nie_znaleziono", f"Nie znaleziono AED o identyfikatorze {id_aed}.")
        owner = st.lista.get(id_aed, {}).get("dostawca")
        if not owner or owner.lower() != dostawca.lower():
            err(403, "brak_uprawnien", "To urządzenie należy do innego dostawcy (albo nie ma dostawcy) – nie możesz go zmienić.")
        base = {k: rec.get(k) for k in schema.field_order()}
    changes = body.model_dump(exclude_unset=True)
    changes.pop("kod_zrodla", None)
    unknown = [k for k in changes if k not in schema.field_order()]
    if unknown:
        err(422, "walidacja", "Nieznane pola.", {k: "Pole spoza wzorcowego zakresu danych." for k in unknown})
    changes.pop("dysponent_nazwa", None)
    candidate = dict(base) | changes
    if "godziny_dostepnosci" in changes and "dostepny_24h" not in changes:
        candidate["dostepny_24h"] = hours.is_24_7(candidate["godziny_dostepnosci"])
    candidate["data_aktualizacji"] = now_min()
    probs = validate.validate_record(candidate)
    if validate.has_errors(probs):
        err(422, "walidacja", "Popraw zaznaczone pola.", problems_to_fields(probs))
    rec = _zapisz_robocze(role, candidate, "kreator:zmien", przed=base)
    return {"data": _robocze_out(rec, dostawca), "meta": {"ostrzezenia": [p for p in probs if p["poziom"] == "ostrzezenie"],
            "komunikat": "Zmiana jest w kopii roboczej. Opublikuj nowe pliki w dane.gov.pl – wtedy zmieni się na wspólnej liście."}}


@app.get(f"{API}/moje-aed", tags=["kreator"], summary="Kopia robocza dostawcy: moje AED, zgodność ze wzorcem, stan na liście")
def my_aed(role: str = Depends(require("dysponent", "administrator"))):
    from src.core import dostawcy
    dostawca = _dostawca(role)
    work = _robocze(dostawca)
    st = get_store()
    published = [i for i, p in st.lista.items() if p["dostawca"].lower() == dostawca.lower()]
    rap = dostawcy.raport(st)
    raport = [z for z in rap["zbiory"] if (z.get("dostawca") or "").lower() == dostawca.lower()]
    return {"data": [_robocze_out(r, dostawca) for r in sorted(work.values(), key=lambda r: r.get("nazwa_obiektu") or "")],
            "meta": {"dostawca": dostawca, "w_kopii_roboczej": len(work), "na_wspolnej_liscie": len(published),
                     "raport_agregacji": raport, "agregacja_z": rap["czas"]}}


@app.post(f"{API}/moje-aed/z-opublikowanego", tags=["kreator"], summary="Wczytaj do kopii roboczej moje AED z opublikowanego zbioru")
def my_aed_from_list(role: str = Depends(require("dysponent", "administrator"))):
    dostawca = _dostawca(role)
    st = get_store()
    work = _robocze(dostawca)
    n = 0
    for i, p in st.lista.items():
        if p["dostawca"].lower() == dostawca.lower() and i not in work:
            _zapisz_robocze(role, {k: st.records[i].get(k) for k in schema.field_order()}, "kreator:wczytaj_opublikowane")
            n += 1
    return {"data": {"wczytano": n}}


@app.delete(f"{API}/moje-aed/{{id_aed}}", tags=["kreator"], summary="Usuń AED z kopii roboczej (np. wycofane urządzenie)")
def my_aed_delete(id_aed: str, role: str = Depends(require("dysponent", "administrator"))):
    from src.core import dziennik
    dostawca = _dostawca(role)
    work = _robocze(dostawca)
    if id_aed not in work:
        err(404, "nie_znaleziono", "Nie ma takiego AED w Twojej kopii roboczej.")
    st = get_store()
    st.conn.execute("DELETE FROM robocze WHERE lower(dostawca)=lower(?) AND id_aed=?", (dostawca, id_aed))
    st.conn.commit()
    dziennik.zapisz(role, "kreator:usun", id_aed, przed=work[id_aed])
    return {"ok": True}


class OrgIn(BaseModel):
    czestotliwosc: str = Field("monthly", pattern="^(daily|weekly|monthly|quarterly|everyHalfYear|yearly)$")
    licencja: str = Field("CC0-1.0", pattern="^(CC0-1.0|CC-BY-4.0)$")
    csv_url: Optional[str] = Field(None, description="adres https, pod którym opublikujecie plik CSV (dla XML harmonizatora)")
    odpowiedzialnosc: Optional[str] = Field(None, max_length=4000)
    email: Optional[str] = Field(None, max_length=200)
    regon: Optional[str] = Field(None, pattern=r"^\d{9}(\d{5})?$")


@app.post(f"{API}/moje-aed/pakiet", tags=["kreator"], summary="Pobierz pliki do publikacji (ZIP) – K11: pobranie, nie publikacja",
          response_class=Response)
def my_package(body: OrgIn, role: str = Depends(require("dysponent", "administrator"))):
    from src.core import dostawcy, dziennik
    dostawca = _dostawca(role)
    work = list(_robocze(dostawca).values())
    if not work:
        err(422, "pusta_kopia", "Kopia robocza jest pusta – dodaj AED albo wgraj plik.")
    bad = [r["id_aed"] for r in (dostawcy.uzupelnij(x) for x in work) if dostawcy.sprawdz_rekord(r, dostawca)]
    if bad:
        err(422, "niezgodne_ze_wzorcem", f"{len(bad)} AED nie spełnia wzorca – popraw je przed pobraniem plików.", {"id_aed": ", ".join(bad[:10])})
    org = {"nazwa": dostawca} | body.model_dump(exclude_none=True)
    st = get_store()
    st.conn.execute("INSERT OR REPLACE INTO organizacje VALUES (?,?)", (dostawca, db.dumps(org)))
    st.conn.commit()
    data = dostawcy.pakiet(org, work, body.csv_url)
    dziennik.zapisz(role, "kreator:pobierz_pliki", dostawca, po={"urzadzenia": len(work), "czestotliwosc": org.get("czestotliwosc")})
    fname = f"aed-{dostawcy.slug(dostawca)}-pliki-do-publikacji.zip"
    return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@app.get(f"{API}/moje-aed/powiadomienia", tags=["kreator"], summary="Powiadomienia dostawcy: zgłoszenia, potwierdzenia, duplikaty, walidacja, przypomnienia")
def my_notifications(role: str = Depends(require("dysponent", "administrator"))):
    from src.core import dziennik
    return {"data": dziennik.powiadomienia(_dostawca(role))}


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
                      role: str = Depends(require("dysponent", "administrator"))):
    dysponent_nazwa = _dostawca(role)  # a provider imports only its own devices (administrator: 403)
    if licencja not in ("CC0-1.0", "CC-BY-4.0"):
        err(422, "walidacja", "Licencja zbioru dostawcy: CC0-1.0 albo CC-BY-4.0 (dane OpenStreetMap/ODbL nie mogą trafić do zbioru).",
            {"licencja": "Dozwolone: CC0-1.0, CC-BY-4.0"})
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
def import_mapping(import_id: str, body: MappingIn, role: str = Depends(require("dysponent", "administrator"))):
    _dostawca(role)
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
def import_commit(import_id: str, role: str = Depends(require("dysponent", "administrator"))):
    dostawca = _dostawca(role)
    imp = _load_import(import_id)
    if imp["status"] == "zatwierdzony":
        err(409, "juz_zatwierdzony", "Ten import został już zatwierdzony.")
    report, results = _report(imp)
    st = get_store()
    counts = {"dodane": 0, "zaktualizowane": 0, "scalone": 0, "odrzucone": 0}
    ids = []
    work = _robocze(dostawca)
    by_ref = {(w.get("id_dysponenta_aed") or ""): i for i, w in work.items() if w.get("id_dysponenta_aed")}
    for r in results:
        if not r["poprawny"]:
            counts["odrzucone"] += 1
            continue
        rec = dict(r["rekord"]) | {"dysponent_nazwa": dostawca, "zrodlo_danych": "dysponent"}
        existing = by_ref.get(rec.get("id_dysponenta_aed") or "\0")
        rec["id_aed"] = existing or _nowy_id(dostawca, rec.get("id_dysponenta_aed") or r["id_w_zrodle"])
        if rec["id_aed"] in work:
            counts["zaktualizowane"] += 1
        else:
            counts["dodane"] += 1
        _zapisz_robocze(role, rec, "kreator:import", przed=work.get(rec["id_aed"]))
        ids.append(rec["id_aed"])
    st.conn.execute("INSERT OR REPLACE INTO mapowania VALUES (?,?)", (imp["kod_zrodla"], db.dumps(imp["mapowanie"])))
    imp["status"] = "zatwierdzony"
    imp["wynik"] = counts
    _save_import(imp)
    return counts | {"id_aed": ids, "raport": {k: report[k] for k in ("wiersze", "poprawne", "bledy", "z_ostrzezeniami")},
                     "komunikat": "Dodano do kopii roboczej. Pobierz pliki do publikacji i opublikuj je na koncie instytucji w dane.gov.pl."}


# ---------- citizen reports & moderation ----------
MAX_ZDJECIE_B = 1_500_000  # after the browser shrinks it (≈1600 px JPEG) a photo is 150–500 kB


TYPY_ZGLOSZEN = ("brak", "awaria", "brak_dostepu", "bledne_polozenie", "inne", "nowe")


class ZgloszenieIn(BaseModel):
    lat: float = Field(..., ge=49.0, le=54.9)
    lon: float = Field(..., ge=14.1, le=24.2)
    opis: str = Field(..., min_length=3, max_length=500)
    id_aed: Optional[str] = Field(None, description="AED, którego dotyczy zgłoszenie (z karty AED); brak = urządzenie spoza listy (P7)")
    typ: str = Field("nowe", description="brak | awaria | brak_dostepu | bledne_polozenie | inne | nowe (urządzenie spoza listy)")
    nazwa_obiektu: Optional[str] = Field(None, max_length=200)
    zdjecie: Optional[str] = Field(None, description="data:image/jpeg|png|webp;base64,… (maks. 1,5 MB) albo URL https://")
    godziny_dostepnosci: Optional[str] = Field(None, max_length=200, description="np. Mo-Fr 08:00-16:00")
    szafka_zamknieta: Optional[bool] = None
    instrukcja_dostepu: Optional[str] = Field(None, max_length=300)
    email: Optional[str] = Field(None, max_length=200, description="opcjonalny, tylko do odpowiedzi; usuwany po zamknięciu zgłoszenia (RODO)")


_RE_EMAIL = __import__("re").compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_RE_PHONE = __import__("re").compile(r"(?<!\d)(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}(?!\d)")
_RE_URL = __import__("re").compile(r"https?://\S+|www\.\S+", __import__("re").I)


def filtr_tresci(t: str) -> str:
    """Abuse filter before a report goes to a provider (§9): no e-mails, phone numbers or links in the description."""
    return _RE_URL.sub("[link usunięty]", _RE_PHONE.sub("[telefon usunięty]", _RE_EMAIL.sub("[e-mail usunięty]", t or "")))


def _photo(v: str | None) -> tuple[str, bytes] | None:
    """Validate the photo: (mime, bytes) for a data URI, None when absent; 422 when wrong."""
    import base64
    if not v:
        return None
    if v.startswith("https://") and len(v) <= 500:
        return ("url", v.encode())
    m = __import__("re").match(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$", v)
    if not m:
        err(422, "walidacja", "Zdjęcie: JPEG, PNG albo WebP.", {"zdjecie": "Nieobsługiwany format zdjęcia."})
    raw = base64.b64decode(m.group(2))
    if len(raw) > MAX_ZDJECIE_B:
        err(413, "plik_za_duzy", "Zdjęcie jest za duże (maks. 1,5 MB).", {"zdjecie": "Za duże zdjęcie."})
    sig = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png", b"RIFF": "image/webp"}
    if not any(raw.startswith(k) and t == m.group(1) for k, t in sig.items()):
        err(422, "walidacja", "Plik nie jest zdjęciem.", {"zdjecie": "Plik nie jest zdjęciem."})
    return (m.group(1), raw)


def _photo_token(zid: str) -> str:
    import hashlib
    import hmac as _h
    return _h.new(auth.SECRET.encode(), f"zdjecie:{zid}".encode(), hashlib.sha256).hexdigest()[:20]


def _public(data: dict) -> dict:
    return {k: v for k, v in data.items() if k not in ("zdjecie", "email")} | {"ma_zdjecie": bool(data.get("zdjecie")),
                                                                            "podano_email": bool(data.get("email"))}


@app.post(f"{API}/zgloszenia", tags=["zgloszenia"], status_code=201, summary="Zgłoszenie mieszkańca (P6, P7)",
          description="Dotyczy konkretnego AED z listy → trafia do jego dostawcy (powiadomienie). Urządzenie spoza listy "
                      "(albo punkt „Do sprawdzenia”) → kolejka administratora. Zgłoszenie nigdy nie zmienia danych (K7, K8).",
          dependencies=[Depends(rate_limit)])
def create_report(body: ZgloszenieIn):
    from src.core import dziennik
    if body.typ not in TYPY_ZGLOSZEN:
        err(422, "walidacja", "Nieznany typ zgłoszenia.", {"typ": "Dozwolone: " + ", ".join(TYPY_ZGLOSZEN)})
    st = get_store()
    if body.id_aed and body.id_aed not in st.records:
        err(404, "nie_znaleziono", "Nie ma takiego AED.", {"id_aed": "Nieznany identyfikator."})
    zid = uuid.uuid4().hex[:12]
    photo = _photo(body.zdjecie)
    prov = st.lista.get(body.id_aed) if body.id_aed else None
    data = body.model_dump() | {"id": zid, "status": "do_weryfikacji", "czas": now_min(), "opis": filtr_tresci(body.opis),
                                "dostawca": prov["dostawca"] if prov else None,
                                "kolejka": "dostawca" if prov else "administrator"}
    data["zdjecie"] = body.zdjecie if photo else None
    st.conn.execute("INSERT INTO zgloszenia VALUES (?,?,?,?)", (zid, "do_weryfikacji", db.dumps(data), now_min()))
    st.conn.commit()
    if prov:
        dziennik.powiadom(prov["dostawca"], "zgloszenie",
                          f"Nowe zgłoszenie ({body.typ}) o AED {body.id_aed}: {data['opis'][:200]}", zid)
    dziennik.zapisz("mieszkaniec", "zgloszenie:nowe", zid, po=_public(data))
    near = _nearest_aed(st, body.lat, body.lon)
    return {"id": zid, "status": "do_weryfikacji", "data": _public(data),
            "meta": {"mozliwy_duplikat": near[0] if near else None, "odleglosc_m": near[1] if near else None,
                     "trafia_do": prov["dostawca"] if prov else "administrator (urządzenie bez dostawcy)",
                     "komunikat": (f"Dziękujemy! Zgłoszenie trafi do właściciela urządzenia ({prov['dostawca']}), który odpowiada za te dane."
                                   if prov else "Dziękujemy! Tego urządzenia nie ma na wspólnej liście – zaprosimy jego właściciela do publikacji danych.")}}


@app.get(f"{API}/zgloszenia/{{zid}}/zdjecie", tags=["zgloszenia"], summary="Zdjęcie ze zgłoszenia (podpisany link z kolejki moderacji)")
def report_photo(zid: str, t: str = Query(...)):
    import base64
    import hmac as _h
    if not _h.compare_digest(t, _photo_token(zid)):
        err(403, "brak_uprawnien", "Nieprawidłowy link do zdjęcia.")
    row = get_store().conn.execute("SELECT data FROM zgloszenia WHERE id=?", (zid,)).fetchone()
    z = db.loads(row["data"]).get("zdjecie") if row else None
    if not z:
        err(404, "nie_znaleziono", "To zgłoszenie nie ma zdjęcia.")
    if z.startswith("https://"):
        return RedirectResponse(z)
    mime, b64 = z[5:].split(";base64,", 1)
    return Response(base64.b64decode(b64), media_type=mime, headers={"Cache-Control": "private, max-age=3600"})


def _nearest_aed(st, lat: float, lon: float, max_m: float = 30) -> tuple[str, int] | None:
    best = None
    for cand in st.grid.near(lat, lon):
        d = dedup.distance_m(lat, lon, st.records[cand]["szerokosc_geograficzna"], st.records[cand]["dlugosc_geograficzna"])
        if d <= max_m and (best is None or d < best[1]):
            best = (cand, round(d))
    return best


def _same(a: str | None, b: str | None) -> bool:
    return bool(a and b) and a.strip().lower() == b.strip().lower()


@app.get(f"{API}/zgloszenia", tags=["zgloszenia"], summary="Kolejka zgłoszeń: dostawcy – o jego AED; administratora – bez dostawcy",
         description="Dostawca widzi tylko zgłoszenia o swoich AED (P6). Administrator – zgłoszenia urządzeń spoza listy (P7, K8).")
def list_reports(status: Optional[str] = "do_weryfikacji", role: str = Depends(require("administrator", "dysponent"))):
    st = get_store()
    sql, args = "SELECT data, status FROM zgloszenia", ()
    if status:
        sql, args = sql + " WHERE status=?", (status,)
    rows = [db.loads(r["data"]) | {"status": r["status"]} for r in st.conn.execute(sql + " ORDER BY created DESC", args)]
    items = []
    for r in rows:
        if role == "dysponent" and not _same(r.get("dostawca"), role.nazwa):
            continue
        if role == "administrator" and r.get("dostawca"):
            continue
        attrs = {k: v for k, v in r.items() if k not in ("id", "zdjecie", "email")}
        attrs["zdjecie_url"] = f"{API}/zgloszenia/{r['id']}/zdjecie?t={_photo_token(r['id'])}" if r.get("zdjecie") else None
        attrs["podano_email"] = bool(r.get("email"))
        near = _nearest_aed(st, r["lat"], r["lon"])
        items.append({"type": "zgloszenie", "id": r["id"], "attributes": attrs,
                      "meta": {"najblizsze_aed": near[0] if near else None, "odleglosc_m": near[1] if near else None}})
    return {"data": items, "meta": {"count": len(items), "page": 1, "per_page": len(items), "kolejka": str(role)},
            "links": {"self": f"{API}/zgloszenia" + (f"?status={status}" if status else "")}}


class Decyzja(BaseModel):
    decyzja: str = Field(..., description="dostawca: przyjete | odrzucone; administrator: zaproszenie | odrzucone")
    uzasadnienie: Optional[str] = Field(None, max_length=1000)


@app.post(f"{API}/zgloszenia/{{zid}}/decyzja", tags=["zgloszenia"], summary="Rozpatrzenie zgłoszenia – bez zmiany danych (K7)",
          description="Dostawca: „przyjete” (uwzględni zmianę w swoim zbiorze) albo „odrzucone”. Administrator (zgłoszenia bez dostawcy): "
                      "„zaproszenie” (zaprasza właściciela do publikacji, oznacza lukę) albo „odrzucone”. Zgłoszenie nie zmienia żadnego rekordu; "
                      "e-mail zgłaszającego jest usuwany po zamknięciu.")
def decide(zid: str, body: Decyzja, role: str = Depends(require("administrator", "dysponent"))):
    from src.core import dziennik
    st = get_store()
    row = st.conn.execute("SELECT data, status FROM zgloszenia WHERE id=?", (zid,)).fetchone()
    if not row:
        err(404, "nie_znaleziono", "Nie znaleziono zgłoszenia.")
    data = db.loads(row["data"])
    if row["status"] != "do_weryfikacji":
        err(409, "juz_rozpatrzone", "Zgłoszenie zostało już rozpatrzone.")
    if role == "dysponent":
        if not _same(data.get("dostawca"), role.nazwa):
            err(403, "brak_uprawnien", "To zgłoszenie dotyczy urządzenia innego dostawcy.")
        allowed = ("przyjete", "odrzucone")
    else:
        if data.get("dostawca"):
            err(403, "brak_uprawnien", "Zgłoszenie dotyczy AED dostawcy – rozpatruje je dostawca.")
        allowed = ("zaproszenie", "odrzucone")
    if body.decyzja not in allowed:
        err(422, "walidacja", "Niedozwolona decyzja.", {"decyzja": "Dozwolone: " + ", ".join(allowed)})
    przed = _public(data)
    data["status"] = body.decyzja
    data["uzasadnienie"] = body.uzasadnienie
    data["rozpatrzyl"] = getattr(role, "login", str(role))
    data["rozpatrzono"] = now_min()
    data.pop("email", None)  # RODO: the reporter's e-mail is deleted when the report is closed
    st.conn.execute("UPDATE zgloszenia SET status=?, data=? WHERE id=?", (data["status"], db.dumps(data), zid))
    st.conn.commit()
    dziennik.zapisz(role, f"zgloszenie:{body.decyzja}", zid, przed=przed, po=_public(data))
    return {"data": _public(data), "meta": {"komunikat": {
        "przyjete": "Przyjęte. Zmień dane w kopii roboczej i opublikuj nowe pliki – wtedy zmieni się wspólna lista.",
        "odrzucone": "Zgłoszenie odrzucone.",
        "zaproszenie": "Zapisano zaproszenie właściciela do publikacji; miejsce jest oznaczone jako luka."}[body.decyzja]}}


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
                    (id_aed, db.dumps(body.model_dump() | {"komentarz": filtr_tresci(body.komentarz or "") or None}), now_min()))
    st.conn.commit()
    prov = st.lista.get(id_aed)
    if prov:  # information goes back to the source; it never changes the provider's data (§3.7)
        from src.core import dziennik
        dziennik.powiadom(prov["dostawca"], "potwierdzenie",
                          f"Mieszkaniec potwierdził AED {id_aed}: {'jest na miejscu' if body.jest_na_miejscu else 'NIE MA go na miejscu'}"
                          + ("" if body.szafka_dostepna is None else f", szafka {'dostępna' if body.szafka_dostepna else 'niedostępna'}") + ".",
                          f"{id_aed}:{now_min()[:10]}:{body.jest_na_miejscu}")
    return {"ok": True, "data": confirmations(id_aed),
            "meta": {"komunikat": "Dziękujemy za potwierdzenie! Przekażemy je właścicielowi urządzenia." if prov else "Dziękujemy za potwierdzenie!"}}


# ---------- accounts: providers (and administrators), managed by an administrator ----------
class KontoIn(BaseModel):
    login: str = Field(..., description="3–41 znaków: małe litery, cyfry, . _ -")
    dysponent_nazwa: str = Field(..., min_length=3, max_length=200, description="Instytucja – tak jak w polu dysponent_nazwa rekordów")
    email: Optional[str] = Field(None, max_length=200)
    rola: str = Field("dysponent", pattern="^(dysponent|administrator)$")
    regon: Optional[str] = Field(None, pattern=r"^\d{9}(\d{5})?$")
    dostawca_podstawa: Optional[str] = Field(None, pattern="^(wlasciciel|zarzadca|weryfikujacy)$",
                                             description="CR-TL-6: właściciel AED | zarządca z umową | podmiot weryfikujący na miejscu")


def _konto_out(a: dict) -> dict:
    return {k: a.get(k) for k in ("login", "rola", "dysponent_nazwa", "email", "aktywne", "utworzono", "utworzyl", "regon", "telefon")} | \
        {"aktywne": bool(a.get("aktywne")), "dostawca_podstawa": a.get("podstawa"),
         "liczba_aed": sum(1 for p in get_store().lista.values() if _same(p["dostawca"], a.get("dysponent_nazwa")))}


@app.get(f"{API}/konta", tags=["auth"], summary="Konta instytucji (moderator)")
def accounts_list(role: str = Depends(require("administrator"))):
    rows = [_konto_out(dict(r)) for r in get_store().conn.execute("SELECT * FROM konta ORDER BY utworzono DESC")]
    return {"data": rows, "meta": {"count": len(rows)}}


@app.post(f"{API}/konta", tags=["auth"], status_code=201, summary="Załóż konto instytucji (moderator) – hasło pokazywane raz")
def account_create(body: KontoIn, role: str = Depends(require("administrator"))):
    login = body.login.strip().lower()
    if not auth.LOGIN_RE.match(login) or login in auth.DEMO or login == "demo":
        err(422, "walidacja", "Nieprawidłowy login.", {"login": "3–41 znaków: małe litery, cyfry, kropka, _ i -; inny niż konta demo."})
    if auth.account(login):
        err(409, "konto_istnieje", "Takie konto już istnieje.", {"login": "Login zajęty."})
    haslo = auth.new_password()
    st = get_store()
    if body.rola == "dysponent" and not body.dostawca_podstawa:
        err(422, "walidacja", "Podaj podstawę publikacji.", {"dostawca_podstawa": "wlasciciel | zarzadca | weryfikujacy"})
    st.conn.execute("INSERT INTO konta (login, rola, dysponent_nazwa, haslo, aktywne, utworzono, utworzyl, email, podstawa, regon) "
                    "VALUES (?,?,?,?,1,?,?,?,?,?)",
                    (login, body.rola, body.dysponent_nazwa.strip(), auth.hash_password(haslo), now_min(), getattr(role, "login", str(role)),
                     body.email, body.dostawca_podstawa if body.rola == "dysponent" else None, body.regon))
    st.conn.commit()
    from src.core import dziennik
    dziennik.zapisz(role, "konto:zalozenie", login, po=_konto_out(auth.account(login)))
    return {"data": _konto_out(auth.account(login)), "haslo_jednorazowe": haslo,
            "meta": {"komunikat": "Przekaż login i hasło instytucji bezpiecznym kanałem. Hasła nie da się później odczytać – tylko zresetować."}}


@app.post(f"{API}/konta/{{login}}/reset-hasla", tags=["auth"], summary="Nowe hasło dla konta instytucji (moderator)")
def account_reset(login: str, role: str = Depends(require("administrator"))):
    if not auth.account(login):
        err(404, "nie_znaleziono", "Nie ma takiego konta.")
    haslo = auth.new_password()
    st = get_store()
    st.conn.execute("UPDATE konta SET haslo=? WHERE login=?", (auth.hash_password(haslo), login))
    st.conn.commit()
    from src.core import dziennik
    dziennik.zapisz(role, "konto:reset_hasla", login)
    return {"data": _konto_out(auth.account(login)), "haslo_jednorazowe": haslo}


class AktywneIn(BaseModel):
    aktywne: bool


@app.patch(f"{API}/konta/{{login}}", tags=["auth"], summary="Zablokuj / odblokuj konto instytucji (moderator)")
def account_toggle(login: str, body: AktywneIn, role: str = Depends(require("administrator"))):
    if not auth.account(login):
        err(404, "nie_znaleziono", "Nie ma takiego konta.")
    st = get_store()
    przed = _konto_out(auth.account(login))
    st.conn.execute("UPDATE konta SET aktywne=? WHERE login=?", (1 if body.aktywne else 0, login))
    st.conn.commit()
    from src.core import dziennik
    dziennik.zapisz(role, "konto:odblokowanie" if body.aktywne else "konto:blokada", login, przed=przed, po=_konto_out(auth.account(login)))
    return {"data": _konto_out(auth.account(login))}


class ZmianaHasla(BaseModel):
    stare: str
    nowe: str = Field(..., min_length=10, max_length=200)


@app.post(f"{API}/konta/ja/haslo", tags=["auth"], summary="Zmiana własnego hasła (konto instytucji)")
def account_password(body: ZmianaHasla, role: str = Depends(require("dysponent", "administrator"))):
    a = auth.account(getattr(role, "login", ""))
    if not a:
        err(422, "walidacja", "Konta demo nie mają zmiany hasła (hasło w .env).")
    if not auth.verify_password(body.stare, a["haslo"]):
        err(422, "walidacja", "Obecne hasło jest nieprawidłowe.", {"stare": "Nieprawidłowe hasło."})
    st = get_store()
    st.conn.execute("UPDATE konta SET haslo=? WHERE login=?", (auth.hash_password(body.nowe), a["login"]))
    st.conn.commit()
    from src.core import dziennik
    dziennik.zapisz(role, "konto:zmiana_hasla", a["login"])
    return {"ok": True}


@app.get(f"{API}/konta/ja", tags=["auth"], summary="Kim jestem (po zalogowaniu)")
def account_me(role: str = Depends(require("dysponent", "administrator"))):
    return {"data": {"login": getattr(role, "login", None), "rola": str(role), "dysponent_nazwa": getattr(role, "nazwa", None)}}


# ---------- sources & connectors ----------
@app.get(f"{API}/zrodla", tags=["zrodla"], summary="Zakres referencyjny źródeł")
def sources():
    rows = get_store().sources_scope()
    return {"data": rows, "meta": {"count": len(rows)}}


@app.on_event("startup")
def _scheduler():
    from src.core import refresh
    refresh.start_scheduler(get_store)


@app.post(f"{API}/zrodla/odswiez", tags=["zrodla"], status_code=202,
          summary="Odśwież teraz: agregacja zbiorów dostawców + warstwa pomocnicza OSM (w tle)")
def refresh_now(role: str = Depends(require("administrator"))):
    from src.core import refresh
    started = refresh.run_in_background(get_store(), f"na żądanie ({role})")
    return {"data": refresh.STATUS | {"uruchomiono": started},
            "meta": {"komunikat": "Odświeżanie trwa w tle (ok. 30 s)." if started else "Odświeżanie już trwa."}}


@app.get(f"{API}/zrodla/odswiezanie", tags=["zrodla"], summary="Stan odświeżania źródeł (ostatnie, następne, wynik)")
def refresh_status():
    from src.core import refresh
    return {"data": refresh.STATUS}


@app.post(f"{API}/zrodla/osm/odswiez", tags=["zrodla"], summary="Konektor OpenStreetMap (eksport AED OSM Polska)")
def osm_refresh(role: str = Depends(require("administrator"))):
    from src.core.connectors import osm
    return osm.refresh(get_store())


class Szukaj(BaseModel):
    q: str = "defibrylator AED"
    importuj: bool = False


@app.post(f"{API}/zrodla/dane-gov-pl/szukaj", tags=["zrodla"], summary="Wyszukiwanie zbiorów AED w dane.gov.pl (tylko podgląd)",
          description="Model ról: nikt poza dostawcą nie wprowadza jego danych – import cudzych zbiorów do listy jest niedostępny. "
                      "Zbiory trafiają na listę wyłącznie przez agregację (POST /admin/agregacja).")
def dgp_search(body: Szukaj, role: str = Depends(require("administrator"))):
    from src.core.connectors import dane_gov_pl
    if body.importuj:
        err(422, "niedozwolone", "Administrator nie importuje danych. Zbiory dostawców trafiają na listę przez agregację.",
            {"importuj": "Niedostępne w modelu ról."})
    return dane_gov_pl.search(None, body.q, False)


# ---------- administrator: system, not data (§4) ----------
@app.post(f"{API}/admin/agregacja", tags=["administrator"], summary="Uruchom agregację: zbiory dostawców z dane.gov.pl → wspólna lista (P5)")
def run_aggregation(role: str = Depends(require("administrator"))):
    from src.core import dostawcy, dziennik
    r = dostawcy.agreguj(get_store())
    dziennik.zapisz(role, "agregacja:uruchomienie", "wspolna-lista", po={"rekordy": r["rekordy"], "zbiory": len(r["zbiory"])})
    return {"data": r}


STATUS_ZBIORU = {"wlaczony": "wzorzec", "przejsciowy": "przejsciowy"}


@app.get(f"{API}/zbiory", tags=["zrodla"], summary="Dostawcy i zbiory wspólnej listy (CR-TL-5)",
         description="Zbiory AED dostawców z dane.gov.pl i ich status na wspólnej liście: `wzorzec` (zgodny ze wzorcem, na liście), "
                     "`przejsciowy` (opublikowany przed wzorcem – rekordy pokazane bez zmian z etykietą), `poza_lista` (nie spełnia "
                     "wymagań albo nie da się go odczytać – nie jest na liście; `problemy` mówią dlaczego). Publiczne, bez logowania.")
def datasets():
    from src.core import dostawcy
    st = get_store()
    rep = dostawcy.raport(st)
    rows = []
    for e in rep.get("zbiory", []):
        rows.append({"zbior_id": e.get("zbior_id"), "tytul": e.get("tytul"), "dostawca": e.get("dostawca"), "zbior_url": e.get("zbior_url"),
                     "status": STATUS_ZBIORU.get(e.get("status"), "poza_lista"), "nieaktualny": bool(e.get("nieaktualny")),
                     "rekordy": e.get("wlaczone") if e.get("status") in STATUS_ZBIORU else (e.get("rekordy") or 0),
                     "data_danych": e.get("data_danych") or e.get("zmodyfikowany") or None, "licencja": e.get("licencja"),
                     "problemy": list(e.get("problemy") or []) + ([f"{e['odrzucone']} rekordów nie trafiło na listę (błędy wzorca)."]
                                                                  if e.get("odrzucone") and e.get("status") in STATUS_ZBIORU else []),
                     "fikcyjny": bool(e.get("fikcyjny"))})
    order = {"wzorzec": 0, "przejsciowy": 1, "poza_lista": 2}
    rows.sort(key=lambda r: (order[r["status"]], (r["dostawca"] or "").lower()))
    osm = sum(1 for r in st.records.values() if warstwa(r) == "pomocnicza")
    return {"data": rows, "meta": {"count": len(rows), "agregacja": rep.get("czas"),
                                   "warstwa_pomocnicza": {"zrodlo": "OpenStreetMap", "licencja": "ODbL-1.0", "obiekty": osm}}}


@app.get(f"{API}/admin/agregacja", tags=["administrator"], summary="Raport ostatniej agregacji (walidacja każdego zbioru)")
def aggregation_report(role: str = Depends(require("administrator"))):
    from src.core import dostawcy
    return {"data": dostawcy.raport(get_store())}


@app.get(f"{API}/admin/luki", tags=["administrator"], summary="Mapa luk: gminy bez żadnego zbioru dostawcy (cel akcji promocyjnej)",
         description="Luka = gmina bez AED na wspólnej liście. `do_sprawdzenia` = punkty z OSM w tej gminie: wskazówka, gdzie są "
                     "urządzenia, których właściciele jeszcze nie publikują danych (§8, §10).")
def gaps(wojewodztwo: Optional[str] = None, limit: int = Query(100, ge=1, le=3000), role: str = Depends(require("administrator"))):
    st = get_store()
    lista = [r for r in st.records.values() if warstwa(r) == "lista"]
    pom = [r for r in st.records.values() if warstwa(r) == "pomocnicza"]
    cl, cp = coverage.counts_by_gmina(lista), coverage.counts_by_gmina(pom)
    out = []
    for woj in ([wojewodztwo.lower()] if wojewodztwo else list(coverage.boundary_files())):
        fc = coverage.gminy(woj)
        if not fc:
            continue
        for f in fc["features"]:
            t = f["properties"]["teryt"]
            if sum(cl.get(t, (0, 0))) == 0:
                out.append({"teryt": t, "gmina": f["properties"]["gmina"], "wojewodztwo": woj, "rodzaj": f["properties"].get("rodzaj"),
                            "do_sprawdzenia": sum(cp.get(t, (0, 0)))})
    out.sort(key=lambda x: -x["do_sprawdzenia"])
    gm_all = sum(len(coverage.gminy(w)["features"]) for w in coverage.boundary_files())
    return {"data": out[:limit], "meta": {"luki": len(out), "gminy": gm_all if not wojewodztwo else None,
                                          "zaproszenia": st.conn.execute("SELECT COUNT(*) FROM zgloszenia WHERE status='zaproszenie'").fetchone()[0]}}


@app.get(f"{API}/admin/przypomnienia", tags=["administrator"], summary="Zbiory po terminie aktualizacji (P9)")
def reminders(role: str = Depends(require("administrator"))):
    from src.core import dostawcy
    late = [z for z in dostawcy.raport(get_store())["zbiory"] if z.get("nieaktualny") and z["status"] in ("wlaczony", "odrzucony")]
    return {"data": late, "meta": {"count": len(late)}}


@app.post(f"{API}/admin/przypomnienia", tags=["administrator"], summary="Wyślij przypomnienia dostawcom zbiorów po terminie (symulacja P9)")
def send_reminders(role: str = Depends(require("administrator"))):
    from src.core import dostawcy, dziennik
    sent = []
    for z in dostawcy.raport(get_store())["zbiory"]:
        if z.get("nieaktualny") and z.get("dostawca"):
            if dziennik.powiadom(z["dostawca"], "przypomnienie",
                                 f"Przypomnienie: zbiór „{z['tytul']}” wymaga aktualizacji (częstotliwość: {z.get('czestotliwosc')}, "
                                 f"ostatnia zmiana: {z.get('zmodyfikowany')}).", f"{z['zbior_id']}:{today()}"):
                sent.append(z["dostawca"])
    dziennik.zapisz(role, "przypomnienia:wyslanie", "zbiory", po={"do": sent})
    return {"data": {"wyslano": sent}}


@app.get(f"{API}/dziennik", tags=["administrator"], summary="Dziennik zdarzeń (tylko odczyt): kto, kiedy, co, na czym, przed i po (K10)")
def event_log(obiekt: Optional[str] = None, limit: int = Query(200, ge=1, le=1000), role: str = Depends(require("administrator"))):
    from src.core import dziennik
    return {"data": dziennik.lista(limit, obiekt)}


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


@app.get(f"{API}/statystyki", tags=["publikacja"], summary="Statystyki wspólnej listy i mierniki akcji (§10)")
def stats():
    st = get_store()
    all_recs = list(st.records.values())
    recs = [r for r in all_recs if warstwa(r) == "lista"]
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
        "liczba_dysponentow": len({p["dostawca"] for p in st.lista.values()}),
        "liczba_dostawcow": len({p["dostawca"] for p in st.lista.values()}),
        "liczba_zbiorow": len({p["zbior_id"] for p in st.lista.values()}),
        "zbiory_nieaktualne": len({p["zbior_id"] for p in st.lista.values() if p.get("zbior_nieaktualny")}),
        "mozliwe_duplikaty": sum(1 for p in st.lista.values() if p.get("mozliwe_duplikaty")),
        "warstwa_lista": len(recs),
        "warstwa_pomocnicza": len(all_recs) - len(recs),
        "gminy_z_dostawca_proc": round(100 * (1 - gminy_bez / max(1, sum(g["gminy"] for g in gminy_obj.values()))), 1),
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
        "liczba_zrodel": len([z for z in st.sources_scope() if z["kod_zrodla"].startswith("dostawca:")]),
    }, "meta": {"liczone_na": now.strftime("%Y-%m-%dT%H:%M"), "prog_aktualnosci_dni": coverage.PROG_DNI,
                 "gminy_liczone_dla": gminy_obj}}


@app.get(f"{API}/pokrycie", tags=["aed"], summary="Pokrycie gmin danymi o AED (GeoJSON) – tryb mapy „aktualność danych” (CR-TL-1)")
def coverage_map(wojewodztwo: str = Query("kujawsko-pomorskie", description="nazwa województwa; granice: data/granice/")):
    st = get_store()
    lista = [r for r in st.records.values() if warstwa(r) == "lista"]
    fc = coverage.coverage(lista, wojewodztwo)
    if fc is None:
        err(404, "brak_granic", f"Brak granic gmin dla województwa „{wojewodztwo}”. Dostępne: "
            + ", ".join(coverage.boundary_files()) + ".")
    pom = coverage.counts_by_gmina([r for r in st.records.values() if warstwa(r) == "pomocnicza"])
    for f in fc["features"]:  # helper layer: where there are devices whose owners do not publish yet (§8)
        f["properties"]["do_sprawdzenia"] = sum(pom.get(f["properties"]["teryt"], (0, 0)))
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


_counts_cache: dict[str, Any] = {"version": None}


def _area_counts() -> tuple[dict, dict]:
    """AED per gmina (TERYT) and per voivodeship, by location; recomputed when the dataset changes."""
    st = get_store()
    if _counts_cache["version"] != st.version:
        gm = {t: a + n for t, (a, n) in coverage.counts_by_gmina(st.records.values()).items()}
        woj: dict[str, int] = {}
        for t, c in gm.items():
            w = coverage.WOJ_KOD.get(t[:2])
            woj[w] = woj.get(w, 0) + c
        _counts_cache.update(version=st.version, gm=gm, woj=woj)
    return _counts_cache["gm"], _counts_cache["woj"]


@app.get(f"{API}/miejsca", tags=["aed"], summary="Wyszukiwarka miejsc: województwa, gminy, miejscowości, ulice, adresy",
         description="Województwa i gminy z granic PRG (bez sieci, bez polskich znaków też działa: „lodz”), miejscowości, ulice "
                     "(„Kraków, Floriańska”) i adresy („Kraków, Floriańska 3”) z geokodera GUGiK. `blisko=lat,lon` (środek mapy): "
                     "sama nazwa ulicy szuka jej w gminie na środku mapy. Każdy wynik: `typ`, `nazwa`, `opis`, `lat`, `lon`, "
                     "`bbox` [minLon,minLat,maxLon,maxLat] albo null, dla gmin `teryt`, dla gmin i województw `liczba_aed`.")
def places(q: str = Query(..., min_length=2), limit: int = Query(8, ge=1, le=20),
           blisko: Optional[str] = Query(None, description="lat,lon środka mapy")):
    from src.core import geocode
    near = None
    if blisko:
        try:
            a, b = (float(x) for x in blisko.split(","))
            near = (a, b)
        except ValueError:
            err(422, "walidacja", "Parametr blisko: lat,lon.", {"blisko": "Nieprawidłowy format."})
    online = os.environ.get("AED_GEOKODER", "gugik") != "brak"
    items = geocode.search(q, limit=limit, blisko=near, online=online)
    gm, woj = _area_counts()
    for i in items:
        if i["typ"] == "gmina":
            i["teryt_terc"] = i.get("teryt")
        elif i["typ"] in ("miejscowosc", "ulica", "adres"):
            i["teryt_terc"] = coverage.index().teryt(i["lon"], i["lat"])
        if i["typ"] == "gmina":
            i["liczba_aed"] = gm.get(i["teryt"], 0)
        elif i["typ"] == "wojewodztwo":
            i["liczba_aed"] = woj.get(i["nazwa"], 0)
    return {"data": items, "meta": {"count": len(items), "q": q,
                                    "zrodla": "granice: PRG (GUGiK); miejscowości, ulice, adresy: usługa geokodowania GUGiK"}}

@app.get(f"{API}/miejsca/odwrotnie", tags=["aed"], summary="Najbliższy adres dla współrzędnych (przycisk „Użyj mojej lokalizacji”)",
         description="Punkty adresowe GUGiK (promień 100 m): `ulica`, `numer_budynku`, `kod_pocztowy`, `miejscowosc`, `odleglosc_m`; "
                     "gmina, województwo i `teryt_terc` (7 cyfr) z granic PRG – także bez sieci. Brak adresu w pobliżu → pola adresu `null`.")
def places_reverse(lat: float = Query(..., ge=49.0, le=54.9), lon: float = Query(..., ge=14.1, le=24.2)):
    from src.core import geocode
    r = geocode.reverse(lat, lon, online=os.environ.get("AED_GEOKODER", "gugik") != "brak")
    return {"data": r, "meta": {"zrodla": "adres: punkty adresowe GUGiK (PRG); gmina: Państwowy Rejestr Granic"}}


# ---------- CR-TL-8: trusted institution accounts (request → administrator approval) ----------
PODSTAWY = ("wlasciciel", "zarzadca", "weryfikujacy")
_NIE_WIEM = {"nie wiem", "nie_wiem", "niewiem", "nieznane", "nieznany", "nieznana", "brak danych", "?", "-"}


def _bez_nie_wiem(fields: dict[str, Any]) -> None:
    """CR-TL-8: an institution states facts – „nie wiem” / „nieznane” is never a valid answer."""
    bad = {k: "Podaj konkretną wartość (bez „nie wiem” i „nieznane”)." for k, v in fields.items()
           if isinstance(v, str) and v.strip().lower() in _NIE_WIEM}
    if bad:
        err(422, "walidacja", "Uzupełnij wszystkie pola konkretnymi danymi.", bad)


class WniosekIn(BaseModel):
    nazwa_instytucji: str = Field(..., min_length=3, max_length=200)
    regon: str = Field(..., pattern=r"^\d{9}(\d{5})?$")
    podstawa: str = Field(..., pattern="^(wlasciciel|zarzadca|weryfikujacy)$",
                          description="właściciel AED | zarządca z umową | podmiot weryfikujący AED na miejscu")
    email_sluzbowy: str = Field(..., max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    telefon: str = Field(..., pattern=r"^\+?[\d\s-]{9,16}$")
    login: str
    haslo: str = Field(..., min_length=10, max_length=200)


def _wniosek_out(w: dict) -> dict:
    return {k: v for k, v in w.items() if k != "haslo"}


@app.post(f"{API}/konta/wnioski", tags=["konta"], status_code=201, summary="Wniosek instytucji o konto dostawcy (bez logowania)",
          description="Właściciel, zarządca albo podmiot weryfikujący AED zakłada konto sam; konto jest nieaktywne, dopóki administrator "
                      "nie zatwierdzi wniosku (sprawdza instytucję, REGON i podstawę). Logowanie przed zatwierdzeniem → 403 `konto_oczekuje`.",
          dependencies=[Depends(rate_limit)])
def account_request(body: WniosekIn):
    from src.core import dziennik
    _bez_nie_wiem(body.model_dump())
    login = body.login.strip().lower()
    if not auth.LOGIN_RE.match(login) or login in auth.DEMO or login == "demo":
        err(422, "walidacja", "Nieprawidłowy login.", {"login": "3–41 znaków: małe litery, cyfry, kropka, _ i -; inny niż konta demo."})
    if auth.account(login):
        err(409, "konto_istnieje", "Takie konto już istnieje.", {"login": "Login zajęty."})
    st = get_store()
    wid = uuid.uuid4().hex[:12]
    w = {"id": wid, "status": "oczekuje", "nazwa_instytucji": body.nazwa_instytucji.strip(), "regon": body.regon,
         "podstawa": body.podstawa, "email_sluzbowy": body.email_sluzbowy.strip(), "telefon": body.telefon.strip(), "login": login,
         "utworzono": now_min(), "decyzja": None, "uzasadnienie": None, "kto": None, "kiedy": None}
    st.conn.execute("INSERT INTO konta (login, rola, dysponent_nazwa, haslo, aktywne, utworzono, utworzyl, email, podstawa, regon, telefon) "
                    "VALUES (?,?,?,?,0,?,?,?,?,?,?)", (login, "dysponent", w["nazwa_instytucji"], auth.hash_password(body.haslo), now_min(),
                                                       f"wniosek:{wid}", w["email_sluzbowy"], body.podstawa, body.regon, w["telefon"]))
    st.conn.execute("INSERT INTO wnioski VALUES (?,?,?,?)", (wid, "oczekuje", db.dumps(w), now_min()))
    st.conn.commit()
    dziennik.zapisz(f"wniosek:{login}", "konto:wniosek", wid, po=_wniosek_out(w))
    return {"id": wid, "status": "oczekuje", "data": _wniosek_out(w),
            "meta": {"komunikat": "Wniosek przyjęty. Administrator sprawdzi instytucję i podstawę publikacji; do tego czasu konto jest nieaktywne."}}


@app.get(f"{API}/konta/wnioski", tags=["konta"], summary="Wnioski o konto (administrator)")
def account_requests(status: Optional[str] = Query(None, description="oczekuje | zatwierdzony | odrzucony"),
                     role: str = Depends(require("administrator"))):
    q, args = "SELECT data FROM wnioski", ()
    if status:
        q, args = q + " WHERE status=?", (status,)
    rows = [_wniosek_out(db.loads(r["data"])) for r in get_store().conn.execute(q + " ORDER BY utworzono DESC", args)]
    return {"data": rows, "meta": {"count": len(rows)}}


class DecyzjaWnioskuIn(BaseModel):
    decyzja: str = Field(..., pattern="^(zatwierdz|odrzuc)$")
    uzasadnienie: Optional[str] = Field(None, max_length=500)


@app.post(f"{API}/konta/wnioski/{{wid}}/decyzja", tags=["konta"], summary="Zatwierdź albo odrzuć wniosek o konto (administrator)")
def account_request_decide(wid: str, body: DecyzjaWnioskuIn, role: str = Depends(require("administrator"))):
    from src.core import dziennik
    st = get_store()
    row = st.conn.execute("SELECT data FROM wnioski WHERE id=?", (wid,)).fetchone()
    if not row:
        err(404, "nie_znaleziono", "Nie ma takiego wniosku.")
    w = db.loads(row["data"])
    if w["status"] != "oczekuje":
        err(409, "juz_rozpatrzony", f"Wniosek został już rozpatrzony ({w['status']}).")
    if body.decyzja == "odrzuc" and not (body.uzasadnienie or "").strip():
        err(422, "walidacja", "Podaj uzasadnienie odrzucenia.", {"uzasadnienie": "Wymagane przy odrzuceniu."})
    przed = dict(w)
    w.update(status="zatwierdzony" if body.decyzja == "zatwierdz" else "odrzucony", decyzja=body.decyzja,
             uzasadnienie=(body.uzasadnienie or "").strip() or None, kto=getattr(role, "login", str(role)), kiedy=now_min())
    if body.decyzja == "zatwierdz":
        st.conn.execute("UPDATE konta SET aktywne=1, utworzyl=? WHERE login=?", (w["kto"], w["login"]))
        dziennik.powiadom(w["nazwa_instytucji"], "konto", f"Konto „{w['login']}” zostało zatwierdzone. Możesz się zalogować.", f"wniosek:{wid}")
    else:
        st.conn.execute("DELETE FROM konta WHERE login=? AND aktywne=0", (w["login"],))  # the login can be requested again
    st.conn.execute("UPDATE wnioski SET status=?, data=? WHERE id=?", (w["status"], db.dumps(w), wid))
    st.conn.commit()
    dziennik.zapisz(role, f"konto:wniosek_{w['status']}", wid, przed=_wniosek_out(przed), po=_wniosek_out(w))
    return {"data": _wniosek_out(w)}


class PracownikIn(BaseModel):
    login: str
    email: Optional[str] = Field(None, max_length=200)


@app.post(f"{API}/konta/ja/uzytkownicy", tags=["konta"], status_code=201,
          summary="Dodaj pracownika do swojej instytucji (P2) – te same uprawnienia, hasło jednorazowe pokazywane raz")
def account_add_employee(body: PracownikIn, role: str = Depends(require("dysponent"))):
    from src.core import dziennik
    me = auth.account(getattr(role, "login", ""))
    if not me or not me.get("aktywne"):
        err(403, "brak_uprawnien", "Pracowników dodaje zatwierdzone konto instytucji (nie konto demo).")
    login = body.login.strip().lower()
    if not auth.LOGIN_RE.match(login) or login in auth.DEMO or login == "demo":
        err(422, "walidacja", "Nieprawidłowy login.", {"login": "3–41 znaków: małe litery, cyfry, kropka, _ i -."})
    if auth.account(login):
        err(409, "konto_istnieje", "Takie konto już istnieje.", {"login": "Login zajęty."})
    haslo = auth.new_password()
    st = get_store()
    st.conn.execute("INSERT INTO konta (login, rola, dysponent_nazwa, haslo, aktywne, utworzono, utworzyl, email, podstawa, regon, telefon) "
                    "VALUES (?,?,?,?,1,?,?,?,?,?,?)", (login, "dysponent", me["dysponent_nazwa"], auth.hash_password(haslo), now_min(),
                                                       me["login"], body.email, me.get("podstawa"), me.get("regon"), None))
    st.conn.commit()
    dziennik.zapisz(role, "konto:pracownik", login, po=_konto_out(auth.account(login)))
    return {"data": _konto_out(auth.account(login)), "haslo_jednorazowe": haslo,
            "meta": {"komunikat": "Przekaż login i hasło pracownikowi. Hasła nie da się później odczytać."}}


# ---------- CR-TL-8: "Zgłoś AED" – only for a logged-in institution, formal approval by the administrator ----------
class ZgloszenieAedIn(BaseModel):
    model_config = {"extra": "forbid"}
    nazwa_obiektu: str = Field(..., min_length=3, max_length=200)
    ulica: Optional[str] = Field(None, max_length=120, description="puste tylko w miejscowości bez ulic")
    numer_budynku: str = Field(..., min_length=1, max_length=20)
    kod_pocztowy: str = Field(..., pattern=r"^\d{2}-\d{3}$")
    miejscowosc: str = Field(..., min_length=2, max_length=100)
    szerokosc: float = Field(..., ge=49.0, le=54.9, description="z geokodowania adresu (GET /miejsca) albo z pinezki")
    dlugosc: float = Field(..., ge=14.1, le=24.2)
    opis_lokalizacji: str = Field(..., min_length=5, max_length=250, description="gdzie dokładnie wisi urządzenie")
    wewnatrz_budynku: bool = True
    dostep: str = Field(..., pattern="^(publiczny|ograniczony|prywatny)$")
    dostepny_24h: StrictBool
    godziny: Optional[str] = Field(None, max_length=200, description="wymagane, gdy dostepny_24h = false; np. „pn-pt 8-16”")
    szafka_zamknieta: StrictBool = Field(..., description="true | false – bez „nie wiem”")
    instrukcja_dostepu: Optional[str] = Field(None, max_length=250, description="wymagana, gdy szafka zamknięta")
    zdjecie: str = Field(..., description="WYMAGANE: data:image/jpeg|png|webp;base64,… (maks. 1,5 MB); metadane (EXIF, GPS) są usuwane")


def _sprawdz_zgloszenie_aed(body: ZgloszenieAedIn) -> tuple[dict, str]:
    from src.core import normalize as N, zdjecia
    _bez_nie_wiem(body.model_dump(exclude={"zdjecie"}))
    fields, godziny = {}, "24/7"
    if not body.dostepny_24h:
        godziny, _ = N.opening_hours(body.godziny or "")
        if not body.godziny:
            fields["godziny"] = "Podaj godziny dostępności (albo zaznacz „całą dobę”)."
        elif not godziny or hours.is_open(godziny) is None:  # not interpretable → ask for a clear form
            fields["godziny"] = "Nie rozumiem godzin – wpisz np. „pn-pt 8-16; sob 9-13”."
    if body.szafka_zamknieta and not (body.instrukcja_dostepu or "").strip():
        fields["instrukcja_dostepu"] = "Szafka jest zamknięta – napisz, jak ją otworzyć (np. kod podaje dyspozytor 112)."
    if not body.zdjecie:
        fields["zdjecie"] = "Zdjęcie jest wymagane."
    teryt = coverage.index().teryt(body.dlugosc, body.szerokosc)
    if not teryt:
        fields["szerokosc"] = "Położenie poza granicami gmin w Polsce."
    if fields:
        err(422, "walidacja", "Zgłoszenie jest niekompletne.", fields)
    photo = _photo(body.zdjecie)
    if not photo or photo[0] == "url":
        err(422, "walidacja", "Dołącz zdjęcie urządzenia (plik JPEG, PNG albo WebP).", {"zdjecie": "Wymagany plik zdjęcia."})
    try:
        clean = zdjecia.bez_metadanych(photo[0], photo[1])
    except Exception:  # noqa: BLE001 – any parsing error = broken file
        err(422, "walidacja", "Plik nie jest poprawnym zdjęciem.", {"zdjecie": "Uszkodzony plik."})
    d = body.model_dump() | {"godziny": godziny, "teryt_terc": teryt, "zdjecie": zdjecia.data_uri(photo[0], clean)}
    return d, teryt


def _zgl_aed_out(z: dict) -> dict:
    out = {k: v for k, v in z.items() if k != "zdjecie"}
    out["zdjecie_url"] = f"{API}/zgloszenia-aed/{z['id']}/zdjecie?t={_photo_token('aed:' + z['id'])}" if z.get("zdjecie") else None
    return out


@app.post(f"{API}/zgloszenia-aed", tags=["zgloszenia-aed"], status_code=201, summary="Zgłoś AED (tylko zalogowana instytucja)",
          description="Nowe AED zgłasza instytucja (właściciel, zarządca albo podmiot weryfikujący) po zalogowaniu; bez logowania 401. "
                      "Wszystkie pola konkretne (bez „nie wiem”), zdjęcie wymagane (metadane usuwane). Administrator sprawdza zgłoszenie "
                      "formalnie i zatwierdza albo odsyła do poprawy; zatwierdzone AED trafia do kopii roboczej instytucji, która publikuje je sama.")
def aed_submission_create(body: ZgloszenieAedIn, role: str = Depends(require("dysponent"))):
    from src.core import dziennik
    org = _dostawca(role)
    d, _ = _sprawdz_zgloszenie_aed(body)
    st = get_store()
    zid = uuid.uuid4().hex[:12]
    z = d | {"id": zid, "status": "oczekuje", "nadawca_login": role.login, "organizacja": org, "utworzono": now_min(),
             "decyzja": None, "komentarz": None, "kto": None, "kiedy": None, "id_aed": None, "historia": []}
    st.conn.execute("INSERT INTO zgloszenia_aed VALUES (?,?,?,?,?)", (zid, "oczekuje", org, db.dumps(z), now_min()))
    st.conn.commit()
    dziennik.zapisz(role, "zgloszenie_aed:nowe", zid, po=_zgl_aed_out(z))
    return {"id": zid, "status": "oczekuje", "data": _zgl_aed_out(z),
            "meta": {"komunikat": "Zgłoszenie wysłane do administratora. Po zatwierdzeniu AED pojawi się w „Moje AED” – opublikujesz je sam na dane.gov.pl."}}


def _zgl_aed(zid: str) -> dict:
    row = get_store().conn.execute("SELECT data FROM zgloszenia_aed WHERE id=?", (zid,)).fetchone()
    if not row:
        err(404, "nie_znaleziono", "Nie ma takiego zgłoszenia AED.")
    return db.loads(row["data"])


def _zapisz_zgl(z: dict) -> None:
    st = get_store()
    st.conn.execute("UPDATE zgloszenia_aed SET status=?, data=? WHERE id=?", (z["status"], db.dumps(z), z["id"]))
    st.conn.commit()


@app.put(f"{API}/zgloszenia-aed/{{zid}}", tags=["zgloszenia-aed"], summary="Popraw i wyślij ponownie (instytucja, status do_poprawy)",
         description="Tylko instytucja, która zgłosiła AED. Administrator nie edytuje pól zgłoszenia (403).")
def aed_submission_fix(zid: str, body: ZgloszenieAedIn, role: str = Depends(require("dysponent", "administrator"))):
    from src.core import dziennik
    if str(role) == "administrator":
        err(403, "brak_uprawnien", "Administrator nie zmienia danych zgłoszenia – może je zatwierdzić albo odesłać do poprawy z komentarzem.")
    org = _dostawca(role)
    z = _zgl_aed(zid)
    if not _same(z["organizacja"], org):
        err(403, "brak_uprawnien", "To zgłoszenie innej instytucji.")
    if z["status"] != "do_poprawy":
        err(409, "zly_status", "Poprawić można tylko zgłoszenie odesłane do poprawy.")
    d, _ = _sprawdz_zgloszenie_aed(body)
    przed = _zgl_aed_out(z)
    z["historia"].append({"decyzja": z["decyzja"], "komentarz": z["komentarz"], "kto": z["kto"], "kiedy": z["kiedy"]})
    z.update(d)
    z.update(status="oczekuje", decyzja=None, komentarz=None, kto=None, kiedy=None, nadawca_login=role.login, poprawiono=now_min())
    _zapisz_zgl(z)
    dziennik.zapisz(role, "zgloszenie_aed:poprawa", zid, przed=przed, po=_zgl_aed_out(z))
    return {"data": _zgl_aed_out(z)}


@app.patch(f"{API}/zgloszenia-aed/{{zid}}", tags=["zgloszenia-aed"], include_in_schema=False)
@app.patch(f"{API}/admin/zgloszenia-aed/{{zid}}", tags=["zgloszenia-aed"], include_in_schema=False)
def aed_submission_patch(zid: str, role: str = Depends(require("dysponent", "administrator"))):
    err(403, "brak_uprawnien", "Pól zgłoszenia nie edytuje się: instytucja poprawia całe zgłoszenie (PUT), administrator tylko decyduje.")


@app.get(f"{API}/moje-zgloszenia", tags=["zgloszenia-aed"], summary="Zgłoszenia AED mojej instytucji: status, decyzja, komentarz, kto i kiedy")
def my_aed_submissions(role: str = Depends(require("dysponent"))):
    org = _dostawca(role)
    rows = [_zgl_aed_out(db.loads(r["data"])) for r in get_store().conn.execute(
        "SELECT data FROM zgloszenia_aed WHERE lower(organizacja)=lower(?) ORDER BY utworzono DESC", (org,))]
    return {"data": rows, "meta": {"count": len(rows)}}


@app.get(f"{API}/admin/zgloszenia-aed", tags=["zgloszenia-aed"], summary="Zgłoszenia AED instytucji do zatwierdzenia (administrator)")
def admin_aed_submissions(status: Optional[str] = Query("oczekuje", description="oczekuje | zatwierdzone | do_poprawy | wszystkie"),
                          role: str = Depends(require("administrator"))):
    q, args = "SELECT data FROM zgloszenia_aed", ()
    if status and status != "wszystkie":
        q, args = q + " WHERE status=?", (status,)
    rows = [_zgl_aed_out(db.loads(r["data"])) for r in get_store().conn.execute(q + " ORDER BY utworzono", args)]
    return {"data": rows, "meta": {"count": len(rows), "kryteria": "kompletność, zdjęcie, położenie zgodne z adresem – bez edycji danych"}}


@app.get(f"{API}/zgloszenia-aed/{{zid}}/zdjecie", tags=["zgloszenia-aed"], summary="Zdjęcie ze zgłoszenia AED (podpisany link)")
def aed_submission_photo(zid: str, t: str = ""):
    import base64
    import hmac as _h
    if not _h.compare_digest(t, _photo_token("aed:" + zid)):
        err(403, "brak_uprawnien", "Nieprawidłowy link do zdjęcia.")
    z = _zgl_aed(zid)
    mime, b64 = z["zdjecie"].split(";base64,")
    return Response(base64.b64decode(b64), media_type=mime[5:], headers={"Cache-Control": "private, max-age=3600"})


class DecyzjaZglAedIn(BaseModel):
    model_config = {"extra": "allow"}
    decyzja: str = Field(..., pattern="^(zatwierdz|do_poprawy)$")
    komentarz: Optional[str] = Field(None, max_length=500)


def _rekord_ze_zgloszenia(z: dict) -> dict:
    from src.core import normalize as N
    rec = schema.empty_record()
    cecha, ulica = N.street(z["ulica"]) if z.get("ulica") else (None, None)
    rec.update(id_aed=dedup.make_id(f"dostawca:{z['organizacja']}", f"zgloszenie:{z['id']}"), nazwa_obiektu=z["nazwa_obiektu"],
               opis_lokalizacji=z["opis_lokalizacji"], wewnatrz_budynku=z.get("wewnatrz_budynku", True),
               ulica_cecha=cecha, ulica=ulica, numer_budynku=z["numer_budynku"], kod_pocztowy=z["kod_pocztowy"],
               miejscowosc=z["miejscowosc"], gmina=None, teryt_terc=z["teryt_terc"],
               szerokosc_geograficzna=round(z["szerokosc"], 6), dlugosc_geograficzna=round(z["dlugosc"], 6),
               dostep=z["dostep"], godziny_dostepnosci=z["godziny"], dostepny_24h=z["dostepny_24h"],
               szafka_zamknieta=z["szafka_zamknieta"], instrukcja_dostepu=z.get("instrukcja_dostepu") or None, mobilny=False,
               status_urzadzenia="sprawny", dysponent_nazwa=z["organizacja"], dysponent_typ="inny", zrodlo_danych="dysponent",
               licencja="CC0-1.0", data_weryfikacji=z["utworzono"][:10], metoda_weryfikacji="zdjecie",
               data_aktualizacji=now_min())
    gm = next((i["nazwa"] for _, i in __import__("src.core.geocode", fromlist=["x"])._offline_index() if i.get("teryt") == z["teryt_terc"]), None)
    rec["gmina"] = gm
    rec["wojewodztwo"] = coverage.WOJ_KOD.get(z["teryt_terc"][:2])
    return rec


@app.post(f"{API}/admin/zgloszenia-aed/{{zid}}/decyzja", tags=["zgloszenia-aed"],
          summary="Zatwierdź albo odeślij do poprawy (administrator – bez edycji pól)",
          description="Zatwierdzenie formalne (kompletność, zdjęcie, położenie). `do_poprawy` wymaga komentarza. Próba zmiany pól → 403. "
                      "Zatwierdzone AED trafia do kopii roboczej instytucji nadawcy; publikuje ona sama, odpowiedzialność zostaje po jej stronie.")
def admin_aed_submission_decide(zid: str, body: DecyzjaZglAedIn, role: str = Depends(require("administrator"))):
    from src.core import dostawcy, dziennik
    extra = sorted(set((body.model_extra or {}).keys()))
    if extra:
        err(403, "brak_uprawnien", "Administrator nie edytuje danych zgłoszenia – tylko decyzja i komentarz.", {k: "Pole tylko do odczytu." for k in extra})
    z = _zgl_aed(zid)
    if z["status"] != "oczekuje":
        err(409, "zly_status", f"Zgłoszenie ma status {z['status']} – decyzję podejmuje się dla oczekujących.")
    if body.decyzja == "do_poprawy" and not (body.komentarz or "").strip():
        err(422, "walidacja", "Napisz, co trzeba poprawić.", {"komentarz": "Wymagany przy odesłaniu do poprawy."})
    przed = _zgl_aed_out(z)
    z.update(decyzja=body.decyzja, komentarz=(body.komentarz or "").strip() or None, kto=getattr(role, "login", str(role)), kiedy=now_min(),
             status="zatwierdzone" if body.decyzja == "zatwierdz" else "do_poprawy")
    st = get_store()
    if body.decyzja == "zatwierdz":
        rec = dostawcy.uzupelnij(_rekord_ze_zgloszenia(z))
        st.conn.execute("INSERT OR REPLACE INTO robocze VALUES (?,?,?,?)", (z["organizacja"], rec["id_aed"], db.dumps(rec), now_min()))
        z["id_aed"] = rec["id_aed"]
        dziennik.zapisz(role, "zgloszenie_aed:do_kopii_roboczej", rec["id_aed"], po={"organizacja": z["organizacja"], "zgloszenie": zid})
        tresc = (f"Zgłoszenie AED „{z['nazwa_obiektu']}” zatwierdzone. Urządzenie jest w „Moje AED” – pobierz pliki i opublikuj je "
                 "na swoim koncie w dane.gov.pl.")
    else:
        tresc = f"Zgłoszenie AED „{z['nazwa_obiektu']}” wymaga poprawy: {z['komentarz']}"
    _zapisz_zgl(z)
    dziennik.powiadom(z["organizacja"], "zgloszenie_aed", tresc, f"{zid}:{z['kiedy']}:{z['status']}")
    dziennik.zapisz(role, f"zgloszenie_aed:{z['status']}", zid, przed=przed, po=_zgl_aed_out(z))
    return {"data": _zgl_aed_out(z)}



@app.get("/api/docs", include_in_schema=False)
def docs_alias():
    return RedirectResponse(f"{API}/docs")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(f"{API}/docs")


@app.get(f"{API}/health", tags=["system"])
def health():
    return {"status": "ok", "liczba_aed": len(get_store().records)}
