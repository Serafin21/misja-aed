"""Boundaries without gaps: shared borders simplified once (topology), nearest-gmina fallback, assignment by location."""
import json
from collections import Counter

from scripts.build_granice import simplify, topo_simplify
from src.core import coverage


def _edges(rings):
    return Counter(tuple(sorted((a, b))) for r in rings for a, b in zip(r, r[1:] + r[:1]))


def test_wspolna_granica_upraszczana_identycznie():
    # two squares sharing a wiggly border x≈1; simplified separately they would differ, with topology they must not
    wiggle = [(1.0 + (0.0004 if i % 2 else -0.0004), i / 20) for i in range(21)]  # bottom→top
    left = [(0.0, 0.0)] + wiggle + [(0.0, 1.0)]
    right = [wiggle[0], (2.0, 0.0), (2.0, 1.0)] + list(reversed(wiggle))[:-1]
    feats = [{"teryt": "L", "polys": [[left]]}, {"teryt": "R", "polys": [[right]]}]
    topo_simplify(feats, 0.001)
    e = _edges([feats[0]["polys"][0][0], feats[1]["polys"][0][0]])
    inner = [k for k in e if k[0][0] > 0.5 and k[1][0] > 0.5 and k[0][0] < 1.5 and k[1][0] < 1.5]
    assert inner and all(e[k] == 2 for k in inner)  # every edge of the shared border used by both squares


def test_enklawa_i_dziura_identyczne():
    hole = [(0.4, 0.4), (0.5, 0.401), (0.6, 0.4), (0.6, 0.6), (0.4, 0.6)]
    outer = [(0, 0), (1, 0), (1, 1), (0, 1)]
    feats = [{"teryt": "W", "polys": [[outer, list(reversed(hole))]]}, {"teryt": "M", "polys": [[hole]]}]
    topo_simplify(feats, 0.01)
    assert set(feats[0]["polys"][0][1]) == set(feats[1]["polys"][0][0]) and len(feats[1]["polys"][0][0]) >= 4


def test_dp_zachowuje_co_najmniej_jeden_punkt():
    assert len(simplify([(0, 0), (0.5, 0.00001), (1, 0)], 1.0)) == 3


def test_brak_szczelin_w_danych_prg():
    """Inland voivodeships: every edge of every gmina is shared with exactly one neighbour (no gaps, no overlaps)."""
    E = Counter()
    for w in coverage.boundary_files():
        for f in coverage.gminy(w)["features"]:
            for poly in f["_polys"]:
                for ring in poly:
                    for a, b in zip(ring, ring[1:]):
                        E[tuple(sorted((tuple(a), tuple(b))))] += 1
    for w in ("kujawsko-pomorskie", "łódzkie", "mazowieckie", "świętokrzyskie", "wielkopolskie"):  # no national border
        for f in coverage.gminy(w)["features"]:
            for poly in f["_polys"]:
                for ring in poly:
                    for a, b in zip(ring, ring[1:]):
                        assert E[tuple(sorted((tuple(a), tuple(b))))] == 2, (w, f["properties"]["gmina"], a, b)


def test_punkt_na_granicy_i_poza_wielokatem():
    # a vertex on the Toruń border: belongs to exactly one gmina
    f = next(f for f in coverage.gminy("kujawsko-pomorskie")["features"] if f["properties"]["gmina"] == "Toruń")
    x, y = f["_polys"][0][0][5]
    assert coverage.index().teryt(x, y) is not None
    # Gdańsk at the coast, 300 m into the Gulf (outside every polygon) → nearest gmina; 30 km into the sea → none
    assert coverage.index().teryt(18.75, 54.418) is not None or coverage.index().teryt(18.75, 54.415) is not None
    assert coverage.index().teryt(18.9, 54.8) is None


def test_wojewodztwo_z_polozenia():
    assert coverage.wojewodztwo_z_polozenia({"szerokosc_geograficzna": 52.2297, "dlugosc_geograficzna": 21.0122}) == "mazowieckie"
    assert coverage.wojewodztwo_z_polozenia({"szerokosc_geograficzna": 50.0614, "dlugosc_geograficzna": 19.9366}) == "małopolskie"
