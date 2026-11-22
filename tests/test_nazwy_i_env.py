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
    for n, d in (("Defibrylator AED", None), ("AED – Lipowa 4, Kraków", None), ("Burmistrz Szubina", "Burmistrz Szubina"),
                 ("na wyposażeniu samochodu", None)):
        r = {"nazwa_obiektu": n, "dysponent_nazwa": d}
        clean_name(r)
        assert r["nazwa_obiektu"] is None, n
    r = {"nazwa_obiektu": "Hala Sportowa", "dysponent_nazwa": "Gmina X"}
    clean_name(r)
    assert r["nazwa_obiektu"] == "Hala Sportowa"


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
