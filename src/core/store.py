"""Repository: source records -> dedup -> merged AED records, with SQLite persistence."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from . import db, dedup, quality

TZ = ZoneInfo("Europe/Warsaw")


def now_min() -> str:
    return datetime.now(TZ).strftime("%Y-%m-%dT%H:%M")


def today() -> str:
    return datetime.now(TZ).date().isoformat()


class Store:
    def __init__(self, conn=None):
        self.conn = conn or db.connect()
        self.lock = db.lock()
        self.records: dict[str, dict] = {}
        self.sources: dict[str, list[dict]] = {}  # id_aed -> provenance rows (with 'dane')
        self.by_key: dict[tuple[str, str], str] = {}  # (kod_zrodla, id_w_zrodle) -> id_aed
        self.master: dict[str, str] = {}  # id_aed -> kod_zrodla of master
        self.grid = dedup.GridIndex()
        self.version = 0  # bumped on every change of records (ETag of GET /aed/punkty)
        self.load()

    # ---------- loading ----------
    def load(self):
        with self.lock:
            self.version += 1
            self.records.clear(); self.sources.clear(); self.by_key.clear(); self.master.clear()
            self.grid = dedup.GridIndex()
            for row in self.conn.execute("SELECT kod_zrodla, id_w_zrodle, id_aed, licencja_zrodla, data_pobrania, dane FROM pochodzenie"):
                src = dict(row)
                src["dane"] = db.loads(src["dane"])
                self.sources.setdefault(src["id_aed"], []).append(src)
                self.by_key[(src["kod_zrodla"], src["id_w_zrodle"])] = src["id_aed"]
            for row in self.conn.execute("SELECT id_aed, data FROM aed"):
                rec = db.loads(row["data"])
                self.records[row["id_aed"]] = rec
                self.grid.add(row["id_aed"], rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"])
            for id_aed, srcs in self.sources.items():
                if id_aed in self.records:
                    _, m = dedup.merge(id_aed, srcs)
                    self.master[id_aed] = m

    # ---------- writes ----------
    def find_duplicate(self, rec: dict, kod_zrodla: str, exclude: str | None = None) -> tuple[str | None, float | None]:
        best, best_d = None, None
        for cand in self.grid.near(rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"]):
            if cand == exclude:
                continue
            same_src = any(s["kod_zrodla"] == kod_zrodla for s in self.sources.get(cand, []))
            same, d = dedup.is_same(rec, self.records[cand])
            # two devices from the same source are different devices – unless it is clearly the same
            # row re-keyed (≤ 5 m and almost identical name)
            if same_src and not (d <= dedup.NEAR_M and dedup.similarity(rec, self.records[cand]) >= 0.9):
                continue
            if same and (best_d is None or d < best_d):
                best, best_d = cand, d
        return best, best_d

    def upsert_source(self, kod_zrodla: str, id_w_zrodle: str, rec: dict, data_pobrania: str | None = None,
                      force_id: str | None = None, commit: bool = True) -> dict:
        """Insert/update one source record. Returns {status, id_aed, duplikat_odleglosc_m}."""
        id_w_zrodle = str(id_w_zrodle)
        data_pobrania = data_pobrania or today()
        with self.lock:
            key = (kod_zrodla, id_w_zrodle)
            dist = None
            if key in self.by_key:
                id_aed, status = self.by_key[key], "zaktualizowane"
                for s in self.sources[id_aed]:
                    if (s["kod_zrodla"], s["id_w_zrodle"]) == key:
                        s.update(dane=rec, data_pobrania=data_pobrania, licencja_zrodla=rec.get("licencja"))
            else:
                id_aed = force_id
                status = "dodane"
                if not id_aed:
                    dup, dist = self.find_duplicate(rec, kod_zrodla)
                    if dup and any(s["kod_zrodla"] == kod_zrodla for s in self.sources[dup]):
                        # same source, re-keyed row: replace the old provenance row
                        id_aed, status = dup, "zaktualizowane"
                        for old in [s for s in self.sources[dup] if s["kod_zrodla"] == kod_zrodla]:
                            self.sources[dup].remove(old)
                            self.by_key.pop((kod_zrodla, old["id_w_zrodle"]), None)
                            self.conn.execute("DELETE FROM pochodzenie WHERE kod_zrodla=? AND id_w_zrodle=?",
                                              (kod_zrodla, old["id_w_zrodle"]))
                    elif dup:
                        id_aed, status = dup, "scalone"
                    else:
                        id_aed = dedup.make_id(kod_zrodla, id_w_zrodle)
                        n = 1
                        while id_aed in self.records:
                            id_aed = dedup.make_id(kod_zrodla, f"{id_w_zrodle}#{n}"); n += 1
                src = {"kod_zrodla": kod_zrodla, "id_w_zrodle": id_w_zrodle, "id_aed": id_aed,
                       "licencja_zrodla": rec.get("licencja"), "data_pobrania": data_pobrania, "dane": rec}
                self.sources.setdefault(id_aed, []).append(src)
                self.by_key[key] = id_aed
            self.conn.execute(
                "INSERT OR REPLACE INTO pochodzenie VALUES (?,?,?,?,?,?)",
                (kod_zrodla, id_w_zrodle, id_aed, rec.get("licencja"), data_pobrania, db.dumps(rec)))
            self._remerge(id_aed)
            if commit:
                self.conn.commit()
            return {"status": status, "id_aed": id_aed,
                    "duplikat_odleglosc_m": round(dist, 1) if dist is not None else None}

    def _remerge(self, id_aed: str):
        merged, master = dedup.merge(id_aed, self.sources[id_aed])
        self.version += 1
        self.records[id_aed] = merged
        self.master[id_aed] = master
        self.grid.add(id_aed, merged["szerokosc_geograficzna"], merged["dlugosc_geograficzna"])
        self.conn.execute("INSERT OR REPLACE INTO aed VALUES (?,?,?,?,?,?)",
                          (id_aed, db.dumps(merged), merged["szerokosc_geograficzna"],
                           merged["dlugosc_geograficzna"], merged["licencja"], merged["data_aktualizacji"]))

    def patch(self, id_aed: str, changes: dict, kod_zrodla: str = "formularz") -> dict:
        """Manual edit (form): stored as an override source record with top priority."""
        with self.lock:
            base = dict(self.records[id_aed])
            base.update(changes)
            base["data_aktualizacji"] = now_min()
            key_id = id_aed
            existing = next((s for s in self.sources[id_aed] if s["kod_zrodla"] == kod_zrodla), None)
            if existing:
                existing["dane"] = base
            else:
                self.sources[id_aed].append({"kod_zrodla": kod_zrodla, "id_w_zrodle": key_id, "id_aed": id_aed,
                                             "licencja_zrodla": base.get("licencja"), "data_pobrania": today(),
                                             "dane": base})
                self.by_key[(kod_zrodla, key_id)] = id_aed
            self.conn.execute("INSERT OR REPLACE INTO pochodzenie VALUES (?,?,?,?,?,?)",
                              (kod_zrodla, key_id, id_aed, base.get("licencja"), today(), db.dumps(base)))
            # the form edit wins: put it first by making it the newest dysponent record
            self._remerge(id_aed)
            self.conn.commit()
            return self.records[id_aed]

    def commit(self):
        with self.lock:
            self.conn.commit()

    # ---------- reads ----------
    def provenance(self, id_aed: str) -> list[dict]:
        master = self.master.get(id_aed)
        out = []
        for s in self.sources.get(id_aed, []):
            out.append({"id_aed": id_aed, "kod_zrodla": s["kod_zrodla"], "id_w_zrodle": s["id_w_zrodle"],
                        "licencja_zrodla": s["licencja_zrodla"], "data_pobrania": s["data_pobrania"],
                        "rekord_nadrzedny": s["kod_zrodla"] == master})
        out.sort(key=lambda r: not r["rekord_nadrzedny"])
        return out

    def all_provenance(self) -> list[dict]:
        out = []
        for id_aed in sorted(self.sources):
            if id_aed in self.records:
                out.extend(self.provenance(id_aed))
        return out

    def is_osm_layer(self, rec: dict) -> bool:
        return rec.get("licencja") == "ODbL-1.0"

    # ---------- sources registry ----------
    def register_source(self, kod_zrodla: str, meta: dict):
        with self.lock:
            row = self.conn.execute("SELECT data FROM zrodla WHERE kod_zrodla=?", (kod_zrodla,)).fetchone()
            data = db.loads(row["data"]) if row else {}
            data.update({k: v for k, v in meta.items() if v is not None})
            self.conn.execute("INSERT OR REPLACE INTO zrodla VALUES (?,?)", (kod_zrodla, db.dumps(data)))
            self.conn.commit()

    def sources_scope(self) -> list[dict]:
        """Reference scope of every source (zrodla.csv)."""
        meta = {r["kod_zrodla"]: db.loads(r["data"]) for r in self.conn.execute("SELECT * FROM zrodla")}
        rows: dict[str, list[dict]] = {}
        included: dict[str, int] = {}
        for id_aed, srcs in self.sources.items():
            for s in srcs:
                rows.setdefault(s["kod_zrodla"], []).append(s["dane"])
            m = self.master.get(id_aed)
            if m:
                included[m] = included.get(m, 0) + 1
        zg = self.conn.execute("SELECT status, COUNT(*) c FROM zgloszenia GROUP BY status").fetchall()
        if zg:
            meta.setdefault("zgloszenia", {"nazwa": "Zgłoszenia obywateli", "typ_zrodla": "obywatel",
                                           "format": "formularz", "licencja": "CC0-1.0",
                                           "czestotliwosc_aktualizacji": "na bieżąco", "obszar": "Polska"})
        # reference dataset (not AED records): municipality boundaries from PRG used by GET /pokrycie (CR-TL-1)
        from . import coverage
        files = coverage.boundary_files()
        if files:
            mds = [coverage.gminy(w).get("metadata", {}) for w in files]
            n_gmin = sum(md.get("liczba_gmin", len(coverage.gminy(w)["features"])) for md, w in zip(mds, files))
            meta["prg-gugik:gminy"] = {
                "nazwa": f"Granice gmin (PRG, GUGiK; uproszczone z zachowaniem topologii). {mds[0].get('atrybucja', '')}",
                "typ_zrodla": "referencyjne", "format": "GeoJSON (z WFS GML PRG)",
                "licencja": "PZGiK – bez opłat i ograniczeń (art. 40a ust. 2 pkt 1 Pgik)",
                "czestotliwosc_aktualizacji": "irregular",
                "obszar": "Polska" if len(files) == 16 else "województwa: " + ", ".join(files),
                "liczba_obiektow": n_gmin} | meta.get("prg-gugik:gminy", {})
        out = []
        for kod in sorted(set(meta) | set(rows)):
            m = meta.get(kod, {})
            recs = rows.get(kod, [])
            req, zal = quality.coverage(recs)
            n = len(recs) + int(m.get("odrzucone", 0))
            if "liczba_obiektow" in m and not recs:  # reference dataset: all objects are used
                n = recs_inc = int(m["liczba_obiektow"])
            elif kod == "zgloszenia":
                n = sum(r["c"] for r in zg)
                recs_inc = sum(r["c"] for r in zg if r["status"] == "zatwierdzone")
            else:
                recs_inc = included.get(kod, 0)
            out.append({
                "kod_zrodla": kod, "nazwa": m.get("nazwa", kod), "typ_zrodla": m.get("typ_zrodla", "inne"),
                "format": m.get("format", ""), "licencja": m.get("licencja", ""),
                "czestotliwosc_aktualizacji": m.get("czestotliwosc_aktualizacji", "irregular"),
                "liczba_rekordow": n, "rekordy_wlaczone": recs_inc,
                "pokrycie_pol_wymaganych_proc": req if recs else int(m.get("pokrycie_pol_wymaganych_proc", 0)),
                "pokrycie_pol_zalecanych_proc": zal if recs else int(m.get("pokrycie_pol_zalecanych_proc", 0)),
                "obszar": m.get("obszar", ""),
            })
        return out


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


def reset_store(conn=None) -> Store:
    global _store
    _store = Store(conn)
    return _store
