"""Build brand/ksiega_znaku.pdf (A4 landscape, vector) from SVG pages.

Usage (repo root):  python brand/zrodla/ksiega.py      – needs the same tools as generuj.py plus pdfunite (poppler).
"""
from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).parent))
import znak as Z  # noqa: E402

BRAND = Path(__file__).resolve().parent.parent
W, H = 842, 595  # pt, A4 landscape
M = 48           # page margin
FONT = "Inter"
VERSION = "Wersja 1.0 · 21 listopada 2026"


# ---------- drawing helpers ----------
def t(x, y, s, size=11, weight=400, fill=Z.DEEP, anchor="start", extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}"{extra}>{escape(s)}</text>')


WEIGHT_FILE = {400: "regular", 500: "medium", 600: "semibold", 700: "bold"}


def wrap(s, width, size, weight=400):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        cand = f"{cur} {w_}".strip()
        if Z.text_width(cand, WEIGHT_FILE[weight], size) <= width or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def para(x, y, width, s, size=11, weight=400, fill=Z.DEEP, lh=1.45):
    """Paragraph; returns (svg, y after)."""
    out = ""
    for line in wrap(s, width, size, weight):
        out += t(x, y, line, size, weight, fill)
        y += size * lh
    return out, y + size * 0.4


def embed(svg_doc: str, x, y, w=None, h=None):
    """Place a generated SVG document at (x, y) scaled to width w (or height h)."""
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg_doc)
    vw, vh = float(m.group(1)), float(m.group(2))
    if w is None:
        w = h * vw / vh
    if h is None:
        h = w * vh / vw
    inner = re.sub(r"^<svg[^>]*>", "", svg_doc.strip())[:-6]
    inner = re.sub(r"<title>.*?</title>|<desc>.*?</desc>", "", inner)
    return f'<svg x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" viewBox="0 0 {vw:.0f} {vh:.0f}">{inner}</svg>', w, h


def page(n, title, body, bg="#FFFFFF"):
    head = "" if n == 1 else (
        t(M, 54, title, 22, 700) + f'<rect x="{M}" y="66" width="40" height="4" rx="2" fill="{Z.GREEN}"/>'
        + t(W - M, H - 22, f"{Z.NAME} · Księga znaku · {n}", 8, 500, Z.SAGE, "end"))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 {W} {H}">'
            f'<rect width="{W}" height="{H}" fill="{bg}"/>{head}{body}</svg>')


def card(x, y, w, h, fill=Z.FROST, stroke=None):
    s = f' stroke="{stroke}" stroke-width="1"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}"{s}/>'


def cross_label(x, y, s):
    """'Nie' marker: icon + word (not colour only)."""
    return (f'<circle cx="{x + 8}" cy="{y - 4}" r="8" fill="#B3261E"/>'
            f'<path d="M{x + 4.5} {y - 7.5}l7 7M{x + 11.5} {y - 7.5}l-7 7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'
            + t(x + 22, y, s, 9.5, 600, Z.DEEP))


# ---------- pages ----------
def p1():
    logo, w, h = embed(Z.logo_vertical("kolor", pad=0)[0], 90, 150, w=330)
    b = card(60, 60, 390, 475, Z.FROST) + logo
    b += t(500, 210, "Księga znaku", 40, 700)
    b += t(500, 250, f"Akcja „{Z.NAME}”", 18, 600, Z.GREEN)
    b += t(500, 276, f"Hasło: {Z.SLOGAN}", 14, 500)
    b += para(500, 330, 290, "Akcja zachęca dysponentów defibrylatorów AED do udostępniania danych w otwartym, ogólnopolskim zbiorze w portalu dane.gov.pl.", 11, 400, Z.DEEP)[0]
    b += t(500, 470, VERSION, 10, 500, Z.SAGE)
    b += t(500, 488, "HackNation 2026 · zadanie Ministerstwa Cyfryzacji", 10, 500, Z.SAGE)
    b += t(500, 506, "„Misja AED – dane na ratunek”", 10, 500, Z.SAGE)
    return page(1, "", b)


def p2():
    b = t(M, 110, "Nazwa i hasło", 13, 700, Z.GREEN)
    b += t(M, 142, Z.NAME, 26, 700) + t(M, 168, Z.SLOGAN, 16, 600, Z.GREEN) + t(M, 188, Z.SUBTITLE, 11.5, 500)
    b += t(M, 215, "Koncepcja", 13, 700, Z.GREEN)
    concept = [
        "Znak to serce zbudowane z 16 zaokrąglonych kwadratów ułożonych jak komórki arkusza danych.",
        "Każda komórka to jeden wiersz w zbiorze, czyli jeden defibrylator, który ktoś może znaleźć w nagłej sytuacji.",
        "Jedna komórka jest bursztynowa – to „Twoje AED”: brakujący wiersz, który właściciel AED sam publikuje na dane.gov.pl.",
        "Hasło „Dane prosto z serca” łączy oba sensy: AED ratuje serce, a dysponent dzieli się danymi bez wahania, bo wie, że mogą uratować życie.",
        "Na mapie ten sam język przejmuje znacznik: pinezka z sercem i bursztynową błyskawicą.",
    ]
    y = 240
    for s in concept:
        txt, y = para(M, y, 440, s, 11.5)
        b += txt
    mark, _, _ = embed(Z.mark_only("kolor", pad=0)[0], 600, 120, w=170)
    b += card(560, 90, 250, 250) + mark
    b += t(685, 320, "16 komórek = 16 wierszy danych", 9.5, 500, Z.SAGE, "middle")
    b += card(560, 360, 250, 160, Z.WHITE, "#D5DDD6")
    b += t(575, 388, "Ton komunikacji", 11, 700)
    for i, s in enumerate(["hasło zawsze z nazwą lub podtytułem", "prosto i konkretnie, bez żargonu", "„Ty” zamiast urzędowego „Państwo”", "liczby tylko ze źródłem", "zawsze z numerem 112 przy mapie"]):
        b += t(585, 408 + i * 20, "• " + s, 10.5)
    return page(2, "Koncepcja znaku", b)


def p3():
    s = 0.75  # 1 x = 75 pt
    x0, y0 = M + 20, 115
    b = ""
    # grid
    for i in range(6):
        b += f'<line x1="{x0 + i * Z.X * s:.1f}" y1="{y0 - 10}" x2="{x0 + i * Z.X * s:.1f}" y2="{y0 + 5 * Z.X * s + 10:.1f}" stroke="#C9D3CB" stroke-width=".6" stroke-dasharray="3 2"/>'
        b += f'<line x1="{x0 - 10}" y1="{y0 + i * Z.X * s:.1f}" x2="{x0 + 5 * Z.X * s + 10:.1f}" y2="{y0 + i * Z.X * s:.1f}" stroke="#C9D3CB" stroke-width=".6" stroke-dasharray="3 2"/>'
    b += Z.heart(x0, y0, s)
    # dimensions
    yd = y0 + 5 * Z.X * s + 26
    b += f'<path d="M{x0} {yd}h{Z.X * s:.1f}M{x0} {yd - 4}v8M{x0 + Z.X * s:.1f} {yd - 4}v8" stroke="{Z.DEEP}" stroke-width="1"/>'
    b += t(x0 + Z.X * s / 2, yd + 16, "x = krok siatki", 9.5, 600, Z.DEEP, "middle")
    b += f'<path d="M{x0 + 2 * Z.X * s:.1f} {yd}h{Z.CELL * s:.1f}M{x0 + 2 * Z.X * s:.1f} {yd - 4}v8M{x0 + (2 * Z.X + Z.CELL) * s:.1f} {yd - 4}v8" stroke="{Z.DEEP}" stroke-width="1"/>'
    b += t(x0 + (2 * Z.X + Z.CELL / 2) * s, yd + 16, "0,8 x komórka", 9.5, 600, Z.DEEP, "middle")
    b += t(x0 + 4.4 * Z.X * s, yd + 16, "promień 0,14 x", 9.5, 600, Z.DEEP, "middle")
    # rules
    rx = 470
    rules = [
        ("Siatka 5 × 5", "Znak powstaje na siatce 5 × 5 o kroku x. Znak zajmuje 16 komórek tej siatki: w kolejnych wierszach 2, 5, 5, 3 i 1."),
        ("Komórka", "Kwadrat o boku 0,8 x, odstęp 0,2 x, promień zaokrąglenia 0,14 x. Wszystkie komórki są jednakowe."),
        ("Komórka „Twoje AED”", "Bursztynowa komórka stoi zawsze w środku trzeciego wiersza – w sercu znaku."),
        ("Logotyp", "Nazwa: wysokość wersalików = 1 x, odstęp od znaku 0,7 x. Hasło: wysokość wersalików 0,4 x, odstęp od nazwy 0,95 x. Napisy są wyśrodkowane pod znakiem."),
        ("Pliki", "Wszystkie wersje generuje skrypt brand/zrodla/generuj.py z jednej definicji, więc proporcje są zawsze takie same."),
    ]
    y = 112
    for head, txt in rules:
        b += t(rx, y, head, 11.5, 700, Z.GREEN)
        p, y = para(rx, y + 17, 320, txt, 10.5)
        b += p
        y += 6
    return page(3, "Konstrukcja", b)


def p4():
    sv, w, h = Z.logo_vertical("kolor")
    sc = 300 / w
    x0, y0 = M + 10, 95
    logo, lw, lh = embed(sv, x0, y0, w=300)
    pad = Z.X * sc
    b = f'<rect x="{x0}" y="{y0}" width="{lw:.1f}" height="{lh:.1f}" fill="{Z.FROST}"/>'
    b += f'<rect x="{x0 + pad:.1f}" y="{y0 + pad:.1f}" width="{lw - 2 * pad:.1f}" height="{lh - 2 * pad:.1f}" fill="#FFFFFF"/>'
    b += logo
    b += f'<rect x="{x0}" y="{y0}" width="{lw:.1f}" height="{lh:.1f}" fill="none" stroke="{Z.GREEN}" stroke-dasharray="4 3"/>'
    b += f'<path d="M{x0} {y0 + lh + 12:.1f}h{pad:.1f}" stroke="{Z.DEEP}"/>' + t(x0 + pad + 6, y0 + lh + 16, "x – pole ochronne z każdej strony", 9.5, 600)
    b += para(x0, y0 + lh + 42, 300, "Pole ochronne ma szerokość jednego kroku siatki (x = bok komórki z odstępem). W tym polu nie umieszczamy tekstu, innych logotypów ani krawędzi zdjęć. Pliki w brand/ mają pole ochronne już wliczone.", 10)[0]

    rx = 420
    b += t(rx, 110, "Minimalna wielkość", 13, 700, Z.GREEN)
    b += t(rx, 128, "Szerokość samego logotypu, bez pola ochronnego.", 9.5, 400, Z.SAGE)
    rows = [("Logotyp pionowy z hasłem", "260 px", "36 mm", "logo_vertical"),
            ("Logotyp pionowy bez hasła", "120 px", "20 mm", "logo_vertical_ns"),
            ("Logotyp poziomy z hasłem", "320 px", "45 mm", "logo_horizontal"),
            ("Sam znak (serce)", "24 px", "8 mm", "mark")]
    y = 156
    b += t(rx, y, "Wersja", 9.5, 700) + t(rx + 210, y, "ekran", 9.5, 700) + t(rx + 270, y, "druk", 9.5, 700)
    for name, px, mm, kind in rows:
        y += 24
        b += f'<line x1="{rx}" y1="{y - 15}" x2="{W - M}" y2="{y - 15}" stroke="#D5DDD6"/>'
        b += t(rx, y, name, 10.5) + t(rx + 210, y, px, 10.5, 600) + t(rx + 270, y, mm, 10.5, 600)
    b += para(rx, y + 30, 370, "Poniżej tych wielkości hasło lub odstępy między komórkami przestają być czytelne. Wysokość wersalików hasła nie powinna być mniejsza niż 11 px na ekranie. Jako favikona (16 px) dopuszczalny jest sam znak.", 10)[0]
    # small-size samples at real minimum sizes (1 px ≈ 0.75 pt)
    sy = 440
    b += t(rx, sy - 12, "Podgląd w minimalnej wielkości: logotyp bez hasła 120 px, znak 24 px", 9.5, 600, Z.SAGE)
    e, _, _ = embed(Z.logo_vertical("kolor", slogan=False, pad=0)[0], rx, sy, w=120 * 0.75)
    b += e
    e, _, _ = embed(Z.mark_only("kolor", pad=0)[0], rx + 130, sy, w=24 * 0.75)
    b += e
    return page(4, "Pole ochronne i minimalna wielkość", b)


def p5():
    cols = [(Z.GREEN, "Zieleń ratunkowa", "logo, znacznik „dostępne”, przyciski"),
            (Z.DEEP, "Głęboka zieleń", "nazwa w logotypie, tekst, nagłówki"),
            (Z.FROST, "Szron", "tło"),
            (Z.AMBER, "Bursztyn", "komórka „Twoje AED”, błyskawica"),
            (Z.AMBER_DARK, "Bursztyn ciemny", "znacznik „ograniczone”"),
            (Z.SAGE, "Szałwia szara", "znacznik „brak danych”, opisy")]
    b = ""
    cw, ch = 236, 150
    for i, (hx, name, use) in enumerate(cols):
        x = M + (i % 3) * (cw + 14)
        y = 92 + (i // 3) * (ch + 14)
        stroke = ' stroke="#C9D3CB"' if hx == Z.FROST else ""
        b += f'<rect x="{x}" y="{y}" width="{cw}" height="62" rx="8" fill="{hx}"{stroke}/>'
        r, g, bl = Z.rgb(hx)
        c, m, yy, k = Z.cmyk(hx)
        b += t(x, y + 82, name, 12, 700)
        b += t(x, y + 100, f"HEX {hx}   RGB {r} {g} {bl}", 10, 500)
        b += t(x, y + 116, f"CMYK {c} {m} {yy} {k}", 10, 500)
        b += t(x, y + 134, use, 9.5, 400, Z.SAGE)
    y = 430
    b += t(M, y, "Kontrast (WCAG 2.2)", 12, 700, Z.GREEN)
    pairs = [("Głęboka zieleń na szronie", Z.DEEP, Z.FROST, "tekst"), ("Biel na zieleni ratunkowej", "#FFFFFF", Z.GREEN, "tekst"),
             ("Zieleń ratunkowa na szronie", Z.GREEN, Z.FROST, "tekst"), ("Bursztyn na głębokiej zieleni", Z.AMBER, Z.DEEP, "grafika, duży tekst"),
             ("Pinezka zielona na mapie (#F2EFE6)", Z.GREEN, "#F2EFE6", "grafika"), ("Pinezka bursztynowa na mapie", Z.AMBER_DARK, "#F2EFE6", "grafika"),
             ("Pinezka szara na mapie", Z.SAGE, "#F2EFE6", "grafika")]
    for i, (n, a, bb, use) in enumerate(pairs):
        x = M + (i % 2) * 380
        yy = y + 22 + (i // 2) * 18
        v = Z.contrast(a, bb)
        b += t(x, yy, f"{n}: {v:.1f}:1".replace(".", ","), 10, 500) + t(x + 265, yy, use, 9.5, 400, Z.SAGE)
    b += para(M, y + 108, 740, "CMYK przeliczono z RGB bez profilu ICC – przed drukiem potwierdź wartości z drukarnią (np. dobór Pantone). Bursztynowa komórka na zieleni (2,4:1) jest ozdobna – znak czyta się bez niej.", 9, 400, Z.SAGE)[0]
    return page(5, "Kolorystyka", b)


def p6():
    b = ""
    samples = [("Inter Bold", 700, 34, Z.NAME, "nazwa akcji w logotypie, nagłówki"),
               ("Inter SemiBold", 600, 24, Z.SLOGAN, "hasło w logotypie, śródtytuły"),
               ("Inter Regular", 400, 14, "Dysponent dopisuje swoje AED do zbioru – jeden wiersz wystarczy.", "teksty, materiały akcji")]
    y = 120
    for name, wt, sz, txt, use in samples:
        b += t(M, y, f"{name} · {use}", 10, 600, Z.SAGE)
        b += t(M, y + sz + 8, txt, sz, wt, Z.DEEP)
        y += sz + 56
    b += t(M, y, "AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ  aąbcćdeęfghijklłmnńoóprsśtuwyzźż  0123456789", 12, 500)
    b += para(M, y + 40, 740,
              "Krój Inter jest udostępniony na licencji SIL Open Font License 1.1 – można go swobodnie używać, także komercyjnie, i dołączać do materiałów. "
              "W plikach logotypu napisy są zamienione na krzywe, więc logo wyświetla się poprawnie bez instalowania czcionki. "
              "Aplikacja internetowa używa krojów systemowych (szybkie ładowanie, dobra czytelność na każdym urządzeniu).", 10.5)[0]
    return page(6, "Typografia", b)


def p7():
    items = [("Pełna kolorowa – pionowa", Z.logo_vertical("kolor", pad=0)[0], Z.WHITE),
             ("Pełna kolorowa – pozioma", Z.logo_horizontal("kolor", pad=0)[0], Z.WHITE),
             ("Odwrócona (na głębokiej zieleni)", Z.logo_vertical("odwrocony", pad=0)[0].replace(f'fill="{Z.DEEP}"/>', 'fill="none"/>', 1), Z.DEEP),
             ("Achromatyczna (skala szarości)", Z.logo_vertical("achromatyczny", pad=0)[0], Z.WHITE),
             ("Jednobarwna czarna", Z.logo_vertical("czarny", pad=0)[0], Z.WHITE),
             ("Jednobarwna biała", Z.logo_vertical("bialy", pad=0)[0], Z.DEEP)]
    b = ""
    cw, ch = 236, 190
    for i, (name, doc, bg) in enumerate(items):
        x = M + (i % 3) * (cw + 14)
        y = 88 + (i // 3) * (ch + 34)
        b += f'<rect x="{x}" y="{y}" width="{cw}" height="{ch}" rx="10" fill="{bg}" stroke="#D5DDD6"/>'
        m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', doc)
        vw, vh = float(m.group(1)), float(m.group(2))
        sc = min((cw - 50) / vw, (ch - 40) / vh)
        e, ew, eh = embed(doc, x + (cw - vw * sc) / 2, y + (ch - vh * sc) / 2, w=vw * sc)
        b += e + t(x, y + ch + 18, name, 10.5, 600)
    b += para(M, 556, 740, "W wersjach jednobarwnych bursztynowa komórka jest obrysem – tak znak zachowuje „Twoje AED” przy druku jednym kolorem, grawerze i tłoczeniu.", 9.5, 400, Z.SAGE)[0]
    return page(7, "Wersje logotypu", b)


def p8():
    base = Z.logo_vertical("kolor", pad=0)[0]
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', base)
    vw, vh = float(m.group(1)), float(m.group(2))
    inner = re.sub(r"^<svg[^>]*>", "", base.strip())[:-6]
    inner = re.sub(r"<title>.*?</title>|<desc>.*?</desc>", "", inner)
    # wrong heart: amber cell moved
    moved = Z.logo_vertical("kolor", pad=0)[0]
    bad = [
        ("Nie rozciągaj ani nie ściskaj", lambda x, y, w, h: f'<svg x="{x}" y="{y + h * .2}" width="{w}" height="{h * .6}" viewBox="0 0 {vw:.0f} {vh:.0f}" preserveAspectRatio="none">{inner}</svg>'),
        ("Nie zmieniaj kolorów", lambda x, y, w, h: embed(base.replace(Z.GREEN, "#C0392B").replace(Z.DEEP, "#1F3A93"), x, y, h=h)[0]),
        ("Nie obracaj", lambda x, y, w, h: f'<g transform="rotate(-18 {x + w / 2} {y + h / 2})">{embed(base, x + (w - h * vw / vh) / 2, y, h=h)[0]}</g>'),
        ("Nie przestawiaj komórek", lambda x, y, w, h: embed(moved.replace(f'fill="{Z.AMBER}"', f'fill="{Z.GREEN}"', 1).replace(f'rx="14.00" fill="{Z.GREEN}"/>', f'rx="14.00" fill="{Z.AMBER}"/>', 1), x + (w - h * vw / vh) / 2, y, h=h)[0]),
        ("Nie dodawaj cieni ani efektów", lambda x, y, w, h: '<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="14" dy="14" stdDeviation="6" flood-opacity=".55"/></filter></defs>'
         + f'<g filter="url(#sh)">{embed(base, x + (w - h * vw / vh) / 2, y, h=h)[0]}</g>'),
        ("Nie zmieniaj kroju pisma", lambda x, y, w, h: embed(Z.mark_only("kolor", pad=0)[0], x + w / 2 - h * .3, y, h=h * .6)[0]
         + f'<text x="{x + w / 2}" y="{y + h * .85}" font-family="DejaVu Serif" font-style="italic" font-size="{h * .17:.0f}" fill="{Z.DEEP}" text-anchor="middle">AED w danych</text>'),
        ("Nie kładź na niespokojnym tle", lambda x, y, w, h: "".join(f'<rect x="{x - 10 + i * 18}" y="{y - 6}" width="9" height="{h + 12}" fill="{Z.AMBER if i % 2 else "#7FB89A"}"/>' for i in range(int(w / 18) + 1)) + embed(base, x + (w - h * vw / vh) / 2, y, h=h)[0]),
        ("Nie zmieniaj hasła ani nazwy", lambda x, y, w, h: embed(Z.mark_only("kolor", pad=0)[0], x + w / 2 - h * .3, y, h=h * .6)[0]
         + f'<text x="{x + w / 2}" y="{y + h * .84}" font-family="{FONT}" font-weight="700" font-size="{h * .15:.0f}" fill="{Z.DEEP}" text-anchor="middle">Defibrylatory PL</text>'),
    ]
    b = ""
    cw, ch = 176, 160
    for i, (label, draw) in enumerate(bad):
        x = M + (i % 4) * (cw + 12)
        y = 90 + (i // 4) * (ch + 50)
        b += f'<svg x="{x}" y="{y}" width="{cw}" height="{ch}" overflow="hidden"><rect width="{cw}" height="{ch}" rx="10" fill="{Z.FROST}"/>{draw(18, 22, cw - 36, ch - 44)}</svg>'
        b += cross_label(x, y + ch + 22, label)
    b += para(M, 548, 740, "Używaj tylko plików z katalogu brand/. Nie przerysowuj znaku i nie składaj go z innych kształtów. Znaku nie łączymy z symbolem ISO 7010 (zielony znak AED) – akcja ma własny, autorski znak.", 9.5, 400, Z.SAGE)[0]
    return page(8, "Niedozwolone użycia", b)


def p9():
    b = ""
    states = [("ok", "Dostępne teraz", "zielona pinezka, białe serce, bursztynowa błyskawica"),
              ("closed", "Ograniczone lub teraz zamknięte", "bursztynowa pinezka + znaczek zegara"),
              ("unknown", "Brak godzin lub dane niezweryfikowane", "biała pinezka, szary obrys i serce")]
    y = 100
    for k, name, desc in states:
        e, _, _ = embed(Z.pin_svg(k), M, y, w=44)
        b += e + t(M + 62, y + 24, name, 12, 700) + t(M + 62, y + 42, desc, 10, 400, Z.SAGE)
        y += 82
    b += t(M, y + 6, "Wielkości: 56, 40 i 28 px (wysokość pinezki).", 10, 600)
    xs = M
    for hgt in (56, 40, 28):
        e, ew, _ = embed(Z.pin_svg("ok"), xs, y + 22 + (56 - hgt) * .75, h=hgt * .75)
        b += e
        xs += ew + 18
    b += para(M, y + 90, 330, "Stan rozróżnia kolor i kształt (pełna, ze znaczkiem, obrysowana), więc informacja nie opiera się tylko na kolorze (WCAG 1.4.1). Biała obwódka oddziela pinezkę od kafelków mapy. Każda pinezka ma też tekstową nazwę dla czytników ekranu, a obok mapy jest lista z tymi samymi danymi.", 10)[0]
    # mini map
    mx, my, mw, mh = 450, 95, 344, 300
    b += f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="10" fill="#F2EFE6"/>'
    b += f'<path d="M{mx} {my + 120}h{mw}M{mx + 170} {my}v{mh}" stroke="#FFFFFF" stroke-width="14"/>'
    b += f'<rect x="{mx + 240}" y="{my + 190}" width="104" height="110" fill="#DDE8D8"/>'
    for k, px, py in (("ok", 90, 140), ("closed", 250, 40), ("unknown", 100, 220), ("ok", 290, 140)):
        b += embed(Z.pin_svg(k), mx + px, my + py, w=30)[0]
    b += t(mx, my + mh + 20, "Kontrast z jasnym podkładem mapy #F2EFE6: zielona 4,6:1, bursztynowa 3,1:1, szara 4,1:1", 9, 400, Z.SAGE)
    b += t(mx, my + mh + 34, "– wszystkie powyżej 3:1 wymaganego dla grafiki (WCAG 1.4.11).", 9, 400, Z.SAGE)
    return page(9, "Znaczniki na mapie", b)


def p9b():
    b = para(M, 100, 740, "Drugi tryb mapy odpowiada na pytanie „jak dobrze znamy to AED?”. Znacznik ma ten sam kształt pinezki, a w środku serce z komórek z logo głównego – każda komórka to wiersz danych. Tryb wybiera się przełącznikiem nad mapą; legenda zmienia się razem z nim.", 10.5)[0]
    states = [("aktualne", "Dane aktualne", "weryfikacja w ostatnich 12 miesiącach: zielona pinezka, białe komórki"),
              ("nieaktualne", "Dane nieaktualne", "starsze niż 12 miesięcy albo bez daty: biała pinezka, obrys i komórki w bursztynie ciemnym, zegar")]
    y = 160
    for k, name, desc in states:
        e, _, _ = embed(Z.data_pin_svg(k), M, y, w=44)
        b += e + t(M + 62, y + 20, name, 12, 700) + para(M + 62, y + 38, 300, desc, 10, 400, Z.SAGE)[0]
        y += 82
    b += ('<defs><pattern id="h" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
          '<rect width="10" height="10" fill="#F2EFE6"/><rect width="5" height="10" fill="#D9DDDA"/></pattern></defs>')
    b += f'<rect x="{M}" y="{y}" width="44" height="30" rx="4" fill="url(#h)" stroke="{Z.SAGE}" stroke-width="1.5" stroke-dasharray="5 4"/>'
    b += t(M + 62, y + 12, "Gmina bez danych", 12, 700) + para(M + 62, y + 30, 300, "żadnego AED w zbiorze: kreskowanie #D9DDDA / #F2EFE6, przerywana granica #6B7570", 10, 400, Z.SAGE)[0]
    b += para(M, y + 78, 360, "Kolor nie jest jedynym nośnikiem informacji: stan rozróżnia też wypełnienie pinezki (pełna / obrysowana), znaczek zegara i kreskowanie. Pod mapą jest lista gmin bez danych jako alternatywa tekstowa, a nazwa każdej pinezki zawiera stan danych i datę weryfikacji.", 10)[0]
    b += para(M, y + 158, 360, "Komórki w pinezce „nieaktualne” są w bursztynie ciemnym (#B9791A, 3,6:1 na bieli) zamiast jasnego bursztynu (2,2:1), żeby spełnić WCAG 1.4.11.", 9.5, 400, Z.SAGE)[0]
    # mini map
    mx, my, mw, mh = 450, 150, 344, 300
    b += f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="10" fill="#F2EFE6"/>'
    b += f'<path d="M{mx + 180} {my}h{mw - 180}v{mh}h-{mw - 160}l20-120-60-60z" fill="url(#h)" stroke="{Z.SAGE}" stroke-width="1.5" stroke-dasharray="5 4"/>'
    for k, px, py in (("aktualne", 40, 60), ("nieaktualne", 110, 150), ("aktualne", 60, 210), ("nieaktualne", 20, 140)):
        b += embed(Z.data_pin_svg(k), mx + px, my + py, w=30)[0]
    b += t(mx + 220, my + 160, "gmina bez danych", 10, 700, Z.DEEP)
    return page(10, "Znaczniki: tryb „aktualność danych”", b)


def p10():
    b = ""
    e1, _, _ = embed(Z.app_icon()[0], M, 100, w=110)
    e2, _, _ = embed(Z.app_icon(dark=True)[0], M + 130, 100, w=110)
    b += e1 + e2 + t(M, 232, "Ikona aplikacji i favikona", 11, 700) + t(M, 248, "jasna i ciemna, zaokrąglony kwadrat 22,5%", 9.5, 400, Z.SAGE)
    # provider badge (same layout as in the app)
    bx, by = 330, 100
    badge = (f'<rect x="{bx}" y="{by}" width="400" height="146" rx="16" fill="{Z.GREEN}"/>'
             + Z.heart(bx + 24, by + 30, 0.18, Z.WHITE, Z.AMBER)
             + t(bx + 130, by + 52, Z.NAME, 20, 700, "#FFFFFF") + t(bx + 130, by + 77, "Udostępniamy dane o naszych AED", 13, 500, "#FFFFFF")
             + t(bx + 130, by + 101, "Szkoła Podstawowa nr 999", 13, 700, "#FFFFFF") + t(bx + 130, by + 124, Z.SLOGAN, 11, 500, Z.FROST))
    b += badge + t(bx, 270, "Odznaka dysponenta", 11, 700) + t(bx, 286, "generowana w aplikacji po publikacji danych (przykład z fikcyjną nazwą)", 9.5, 400, Z.SAGE)
    b += t(M, 340, "Pliki do pobrania (katalog brand/)", 12, 700, Z.GREEN)
    files = ["logo.svg – plik główny (format otwarty), logo.pdf – wektor do druku",
             "logo.png – 2400 px, przezroczyste tło; logo.jpg – białe tło",
             "warianty/ – wersje pionowe i poziome: kolor, odwrócona, achromatyczna, czarna, biała; sam znak",
             "warianty/ikona_aplikacji*.png, warianty/znacznik_*.svg – ikony i znaczniki mapy (oba tryby)",
             "haslo.txt – nazwa akcji i hasło; zrodla/ – skrypty, które generują wszystkie pliki"]
    y = 362
    for f in files:
        b += t(M, y, "• " + f, 10.5)
        y += 20
    b += para(M, y + 14, 740, "Logotyp, hasło i system znaku przygotował zespół na HackNation 2026. Zgodnie z regulaminem zadania autorskie prawa majątkowe do zwycięskiego rozwiązania przechodzą na Ministra Cyfryzacji.", 9.5, 400, Z.SAGE)[0]
    return page(11, "Zastosowania i pliki", b)


def main():
    pages = [p1(), p2(), p3(), p4(), p5(), p6(), p7(), p8(), p9(), p9b(), p10()]
    with tempfile.TemporaryDirectory() as d:
        pdfs = []
        for i, svg in enumerate(pages, 1):
            s = Path(d) / f"p{i:02d}.svg"
            s.write_text(svg, encoding="utf-8")
            p = s.with_suffix(".pdf")
            subprocess.run(["rsvg-convert", "-f", "pdf", str(s), "-o", str(p)], check=True)
            pdfs.append(str(p))
        subprocess.run(["pdfunite", *pdfs, str(BRAND / "ksiega_znaku.pdf")], check=True)
    print("OK:", BRAND / "ksiega_znaku.pdf")


if __name__ == "__main__":
    main()
