"""Owner's decision 22.11: an AED without a real name has no name (the app shows "Brak nazwy urządzenia"); the operator,
the description or the address are never used as the name. The server reads .env (fallback: ADMIN_PASSWORD from .env.example)."""
import os

from src.core import envfile
from src.core.connectors.osm import _name, clean_name


def test_nazwa_tylko_z_tagu_name():
    assert _name({"name": "Biblioteka Miejska"}) == "Biblioteka Miejska"
    assert _name({"operator": "Burmistrz Szubina"}) is None  # owner ≠ name of the place
    assert _name({"description": "Aby dostać się do budynku należy użyć domofonu"}) is None
    assert _name({"addr:street": "Lipowa", "addr:housenumber": "4", "addr:city": "Kraków"}) is None
    assert _name({"name": "AED na ścianie budynku"}) is None
    assert _name({"name": "na wyposażeniu samochodu ratowniczo-gaśniczego"}) is None
    assert _name({"name": "- AED zamontowane w holu"}) is None
    assert _name({"name": "112"}) is None
    assert _name({"name": "MOSiR w Pile - Recepcja"}) == "MOSiR w Pile - Recepcja"


def test_stare_nazwy_czyszczone():
    for n, d in (("Defibrylator AED", None), ("AED – Lipowa 4, Kraków", None), ("na wyposażeniu samochodu", None)):
        r = {"nazwa_obiektu": n, "dysponent_nazwa": d}
        clean_name(r)
        assert r["nazwa_obiektu"] is None, n
    r = {"nazwa_obiektu": "Castorama", "dysponent_nazwa": "Castorama"}  # a real name may equal the operator
    clean_name(r)
    assert r["nazwa_obiektu"] == "Castorama"


def test_migracja_nazw_ze_starej_bazy(tmp_path, monkeypatch):
    """A database from an older import had the operator / address as the name; on load names are recomputed once."""
    import json

    from src.core import db
    from src.core.connectors import osm
    from src.core.store import Store
    f = {"type": "Feature", "properties": {"osm_id": "node/1", "operator": "Burmistrz Szubina"},
         "geometry": {"type": "Point", "coordinates": [17.73, 53.0]}}
    g = {"type": "Feature", "properties": {"osm_id": "node/2", "operator": "Castorama", "name": "Castorama"},
         "geometry": {"type": "Point", "coordinates": [17.74, 53.0]}}
    src = tmp_path / "osm.geojson"
    src.write_text(json.dumps({"type": "FeatureCollection", "features": [f, g]}), encoding="utf-8")
    monkeypatch.setattr(osm, "SAMPLE", src)
    conn = db.connect(tmp_path / "a.sqlite3")
    for oid, aid, name, op in (("node/1", "AED-PL-1", "Burmistrz Szubina", "Burmistrz Szubina"),
                               ("node/2", "AED-PL-2", "Castorama", "Castorama"),
                               ("node/3", "AED-PL-3", "Defibrylator AED", None)):
        rec = {"id_aed": aid, "nazwa_obiektu": name, "dysponent_nazwa": op, "szerokosc_geograficzna": 53.0, "dlugosc_geograficzna": 17.7}
        conn.execute("INSERT INTO aed (id_aed, data) VALUES (?,?)", (aid, json.dumps(rec)))
        conn.execute("INSERT INTO pochodzenie VALUES (?,?,?,?,?,?)", ("osm", oid, aid, "ODbL-1.0", "2026-11-21", json.dumps(rec)))
    conn.commit()
    st = Store(conn)
    assert st.records["AED-PL-1"]["nazwa_obiektu"] is None
    assert st.records["AED-PL-2"]["nazwa_obiektu"] == "Castorama"
    assert st.records["AED-PL-3"]["nazwa_obiektu"] is None
    assert osm.migrate_names(conn) == 0  # only once


def test_env_plik_i_wzor(tmp_path, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("AED_DGP", raising=False)
    (tmp_path / ".env.example").write_text("ADMIN_PASSWORD=demo123\nAED_DGP=tak\n", encoding="utf-8")
    assert envfile.load(tmp_path) == ".env.example"
    assert os.environ["ADMIN_PASSWORD"] == "demo123" and "AED_DGP" not in os.environ  # only the admin password from the example
    monkeypatch.delenv("ADMIN_PASSWORD")
    (tmp_path / ".env").write_text("# komentarz\nADMIN_PASSWORD='tajne haslo'\nAED_DGP=tak\n", encoding="utf-8")
    assert envfile.load(tmp_path) == ".env"
    assert os.environ["ADMIN_PASSWORD"] == "tajne haslo" and os.environ["AED_DGP"] == "tak"
    monkeypatch.setenv("ADMIN_PASSWORD", "z-srodowiska")
    envfile.load(tmp_path)
    assert os.environ["ADMIN_PASSWORD"] == "z-srodowiska"  # the environment wins
