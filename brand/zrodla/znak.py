"""Brand system "AED w danych" as code: pixel heart, logotypes, variants and map pins (SVG strings).

Every logo file in brand/ is generated from this module (generuj.py), so all versions share one geometry.
Text in logos is converted to outlines (no font needed to open the files). Typeface: Inter (SIL OFL 1.1).
"""
from __future__ import annotations

import os
from functools import lru_cache

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

NAME = "AED w danych"
SLOGAN = "Dane prosto z serca"

# Palette (team decision, brand/ PDF "Wybrany system")
GREEN = "#1A7A50"      # zieleń ratunkowa
DEEP = "#0F3B2B"       # głęboka zieleń
FROST = "#EDF2EC"      # szron
AMBER = "#E2A23B"      # bursztyn
AMBER_DARK = "#B9791A"  # bursztyn ciemny
SAGE = "#6B7570"       # szałwia szara
WHITE = "#FFFFFF"
BLACK = "#000000"

# 5×5 grid; 'a' = amber cell "Twoje AED"
HEART = [".g.g.", "ggggg", "ggagg", ".ggg.", "..g.."]

# Construction (unit x = grid pitch = one cell + gap)
X = 100.0
CELL = 0.80 * X     # cell side
RADIUS = 0.14 * X   # corner radius
MARK = 4 * X + CELL  # 480 – mark width/height

FONT_DIR = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter")
FONTS = {"bold": "Inter-Bold.otf", "semibold": "Inter-SemiBold.otf", "medium": "Inter-Medium.otf", "regular": "Inter-Regular.otf"}


# ---------- text → outlines ----------
@lru_cache(maxsize=None)
def _font(weight: str) -> TTFont:
    return TTFont(os.path.join(FONT_DIR, FONTS[weight]))


@lru_cache(maxsize=None)
def _kerning(weight: str) -> dict:
    """Pair kerning (GPOS PairPos format 1 and 2, first subtable wins)."""
    f = _font(weight)
    pairs: dict = {}
    if "GPOS" not in f:
        return pairs
    gpos = f["GPOS"].table
    for li in gpos.LookupList.Lookup:
        subs = li.SubTable
        if li.LookupType == 9:
            subs = [s.ExtSubTable for s in subs]
        for st in subs:
            if getattr(st, "LookupType", 2) != 2 or not hasattr(st, "Format"):
                continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for i, g1 in enumerate(cov):
                    for pvr in st.PairSet[i].PairValueRecord:
                        v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                        pairs.setdefault((g1, pvr.SecondGlyph), v)
            elif st.Format == 2:
                c1, c2 = st.ClassDef1.classDefs, st.ClassDef2.classDefs
                for g1 in cov:
                    k1 = c1.get(g1, 0)
                    row = st.Class1Record[k1].Class2Record
                    for g2, k2 in c2.items():
                        v = getattr(row[k2].Value1, "XAdvance", 0) if row[k2].Value1 else 0
                        if v:
                            pairs.setdefault((g1, g2), v)
    return pairs


def text_width(text: str, weight: str, size: float, tracking: float = 0) -> float:
    f = _font(weight)
    cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    kern = _kerning(weight)
    w, prev = 0.0, None
    for ch in text:
        g = cmap[ord(ch)]
        if prev:
            w += kern.get((prev, g), 0)
        w += hmtx[g][0]
        prev = g
    return w * size / upm + tracking * size * (len(text) - 1)


def text_path(text: str, weight: str, size: float, x: float, baseline: float, tracking: float = 0) -> str:
    """SVG path data of `text` with its baseline at y=baseline, starting at x (tracking in em)."""
    f = _font(weight)
    cmap, hmtx, upm, gs = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm, f.getGlyphSet()
    kern = _kerning(weight)
    s = size / upm
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    cur, prev = 0.0, None
    for ch in text:
        g = cmap[ord(ch)]
        if prev:
            cur += kern.get((prev, g), 0)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x + cur * s, baseline)))
        cur += hmtx[g][0] + tracking * upm
        prev = g
    return pen.getCommands()


def cap_height(weight: str, size: float) -> float:
    f = _font(weight)
    return f["OS/2"].sCapHeight * size / f["head"].unitsPerEm


# ---------- mark ----------
def heart(x0: float, y0: float, scale: float = 1.0, green: str = GREEN, amber: str = AMBER, amber_outline: str | None = None) -> str:
    """Pixel heart at (x0, y0); width = MARK*scale. amber_outline → one-colour version (amber cell as outline)."""
    out = []
    c, r = CELL * scale, RADIUS * scale
    for j, row in enumerate(HEART):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            x, y = x0 + i * X * scale, y0 + j * X * scale
            if ch == "a" and amber_outline:
                sw = 0.12 * X * scale
                out.append(f'<rect x="{x + sw/2:.2f}" y="{y + sw/2:.2f}" width="{c - sw:.2f}" height="{c - sw:.2f}" rx="{max(r - sw/2, 0):.2f}" fill="none" stroke="{amber_outline}" stroke-width="{sw:.2f}"/>')
            else:
                out.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{c:.2f}" height="{c:.2f}" rx="{r:.2f}" fill="{amber if ch == "a" else green}"/>')
    return "".join(out)


# Colour schemes for every logo version
SCHEMES = {
    "kolor":       {"cell": GREEN, "amber": AMBER, "name": DEEP, "slogan": GREEN, "bg": None, "outline": None},
    "odwrocony":   {"cell": WHITE, "amber": AMBER, "name": WHITE, "slogan": FROST, "bg": DEEP, "outline": None},
    "achromatyczny": {"cell": "#1A1A1A", "amber": "#8C8C8C", "name": "#1A1A1A", "slogan": "#4D4D4D", "bg": None, "outline": None},
    "czarny":      {"cell": BLACK, "amber": None, "name": BLACK, "slogan": BLACK, "bg": None, "outline": BLACK},
    "bialy":       {"cell": WHITE, "amber": None, "name": WHITE, "slogan": WHITE, "bg": None, "outline": WHITE},
}

NAME_SIZE = X / (1490 / 2048)          # wordmark cap height = 1 x
SLOGAN_SIZE = 0.40 * X / (1490 / 2048)  # slogan cap height = 0.40 x


def _mark(sch: dict, x0: float, y0: float, scale: float = 1.0) -> str:
    return heart(x0, y0, scale, sch["cell"], sch["amber"] or sch["cell"], sch["outline"])


def svg_doc(w: float, h: float, body: str, title: str, bg: str | None = None, desc: str = "") -> str:
    back = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else ""
    d = f"<desc>{desc}</desc>" if desc else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img">'
            f"<title>{title}</title>{d}{back}{body}</svg>\n")


def logo_vertical(scheme: str = "kolor", slogan: bool = True, pad: float = X) -> tuple[str, float, float]:
    """Main logotype: mark over name over slogan. `pad` = clear space (1 x by default). Returns (svg, w, h)."""
    sch = SCHEMES[scheme]
    nw = text_width(NAME, "bold", NAME_SIZE, -0.01)
    sw = text_width(SLOGAN, "semibold", SLOGAN_SIZE) if slogan else 0
    inner = max(nw, sw, MARK)
    w = inner + 2 * pad
    y_mark = pad
    y_name = y_mark + MARK + 0.70 * X + X           # baseline of name (cap top 0.70 x under the mark)
    y_slog = y_name + 0.95 * X + 0.40 * X           # baseline of slogan
    h = (y_slog if slogan else y_name) + 0.30 * X + pad  # room for descenders (y in "danych")
    body = _mark(sch, pad + (inner - MARK) / 2, y_mark)
    body += f'<path fill="{sch["name"]}" d="{text_path(NAME, "bold", NAME_SIZE, pad + (inner - nw) / 2, y_name, -0.01)}"/>'
    if slogan:
        body += f'<path fill="{sch["slogan"]}" d="{text_path(SLOGAN, "semibold", SLOGAN_SIZE, pad + (inner - sw) / 2, y_slog)}"/>'
    t = f"{NAME} – {SLOGAN}" if slogan else NAME
    return svg_doc(w, h, body, t, sch["bg"], "Logotyp akcji: serce z 21 zaokrąglonych kwadratów, jeden bursztynowy."), w, h


def logo_horizontal(scheme: str = "kolor", slogan: bool = True, pad: float = X) -> tuple[str, float, float]:
    """Mark on the left, name (+ slogan) on the right."""
    sch = SCHEMES[scheme]
    size = NAME_SIZE * 1.25
    ssize = SLOGAN_SIZE * 1.6
    nw = text_width(NAME, "bold", size, -0.01)
    sw = text_width(SLOGAN, "semibold", ssize) if slogan else 0
    tx = pad + MARK + 0.9 * X
    w = tx + max(nw, sw) + pad
    h = MARK + 2 * pad
    ch_name = cap_height("bold", size)
    if slogan:
        block = ch_name + 0.55 * X + cap_height("semibold", ssize)
        y_name = pad + (MARK - block) / 2 + ch_name
        y_slog = y_name + 0.55 * X + cap_height("semibold", ssize)
    else:
        y_name = pad + (MARK + ch_name) / 2
    body = _mark(sch, pad, pad)
    body += f'<path fill="{sch["name"]}" d="{text_path(NAME, "bold", size, tx, y_name, -0.01)}"/>'
    if slogan:
        body += f'<path fill="{sch["slogan"]}" d="{text_path(SLOGAN, "semibold", ssize, tx, y_slog)}"/>'
    t = f"{NAME} – {SLOGAN}" if slogan else NAME
    return svg_doc(w, h, body, t, sch["bg"]), w, h


def mark_only(scheme: str = "kolor", pad: float = X) -> tuple[str, float, float]:
    sch = SCHEMES[scheme]
    w = MARK + 2 * pad
    return svg_doc(w, w, _mark(sch, pad, pad), f"{NAME} – znak", sch["bg"]), w, w


def app_icon(dark: bool = False) -> tuple[str, float, float]:
    """Rounded-square icon: white (or green on dark) heart with the amber cell."""
    s = 1024.0
    bg = DEEP if dark else GREEN
    cell = GREEN if dark else WHITE
    scale = (s * 0.62) / MARK
    off = (s - MARK * scale) / 2
    body = f'<rect width="{s:.0f}" height="{s:.0f}" rx="{s * 0.225:.0f}" fill="{bg}"/>' + heart(off, off + 0.02 * s, scale, cell, AMBER)
    return svg_doc(s, s, body, f"{NAME} – ikona"), s, s


# ---------- map pins (logo 2: pin with heart and bolt) – same geometry as src/ui Brand.tsx ----------
def pin(kind: str = "ok") -> str:
    outline = SAGE if kind == "unknown" else WHITE
    fill = GREEN if kind == "ok" else WHITE if kind == "unknown" else AMBER_DARK
    hrt = SAGE if kind == "unknown" else WHITE
    bolt = WHITE if kind == "unknown" else AMBER if kind == "ok" else AMBER_DARK
    badge = ('<circle cx="33" cy="8" r="6.5" fill="#fff" stroke="#0F3B2B" stroke-width="1.6"/>'
             '<path d="M33 4.8V8l2.2 1.4" stroke="#0F3B2B" stroke-width="1.6" fill="none" stroke-linecap="round"/>') if kind == "closed" else ""
    return ('<path d="M20 50S4 32.5 4 19.5a16 16 0 0 1 32 0C36 32.5 20 50 20 50z" fill="%s" stroke="%s" stroke-width="2.6"/>'
            '<path d="M20 29.5s-8.6-5.3-8.6-11.2a4.6 4.6 0 0 1 8.6-2.3 4.6 4.6 0 0 1 8.6 2.3c0 5.9-8.6 11.2-8.6 11.2z" fill="%s"/>'
            '<path d="M21.2 14.2l-4.4 7.2h3.2l-1.2 5.4 4.4-7.4H20z" fill="%s"/>%s') % (fill, outline, hrt, bolt, badge)


PIN_LABELS = {"ok": "AED dostępne teraz", "closed": "AED z ograniczeniami lub teraz zamknięte", "unknown": "AED – brak godzin lub dane niezweryfikowane"}


def pin_svg(kind: str) -> str:
    return svg_doc(40, 52, pin(kind), PIN_LABELS[kind])


# ---------- colour helpers (for the brand book) ----------
def rgb(hex_: str) -> tuple[int, int, int]:
    h = hex_.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def cmyk(hex_: str) -> tuple[int, int, int, int]:
    """Naive RGB→CMYK (no ICC profile) – approximation to be checked with the print house."""
    r, g, b = (v / 255 for v in rgb(hex_))
    k = 1 - max(r, g, b)
    if k >= 1:
        return 0, 0, 0, 100
    return tuple(round(100 * v) for v in ((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k))  # type: ignore


def contrast(a: str, b: str) -> float:
    def lum(h):
        def ch(c):
            c /= 255
            return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        r, g, bb = rgb(h)
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bb)
    l1, l2 = sorted((lum(a), lum(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)
