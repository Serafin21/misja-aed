"""Generate all logo files in brand/ from znak.py.

Usage (from the repo root):  python brand/zrodla/generuj.py
Needs: Python 3.10+, fontTools, Pillow, rsvg-convert (librsvg) and Inter OTF files (SIL OFL) – set INTER_DIR if they
are not in /usr/share/fonts/opentype/inter. The brand book is built by ksiega.py.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import znak  # noqa: E402

BRAND = Path(__file__).resolve().parent.parent
VAR = BRAND / "warianty"


def export(svg: str, stem: Path, png_w: int = 2400, jpg: bool = False, pdf: bool = True):
    stem.parent.mkdir(parents=True, exist_ok=True)
    s = stem.with_suffix(".svg")
    s.write_text(svg, encoding="utf-8")
    png = stem.with_suffix(".png")
    subprocess.run(["rsvg-convert", "-w", str(png_w), str(s), "-o", str(png)], check=True)
    if pdf:
        subprocess.run(["rsvg-convert", "-f", "pdf", str(s), "-o", str(stem.with_suffix(".pdf"))], check=True)
    if jpg:
        im = Image.open(png).convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        bg.save(stem.with_suffix(".jpg"), quality=95, dpi=(300, 300))


def main():
    # main files required by the task (logo.svg / .png ≥2000 px transparent / .jpg white / .pdf)
    export(znak.logo_vertical("kolor")[0], BRAND / "logo", jpg=True)

    for scheme in ("kolor", "odwrocony", "achromatyczny", "czarny", "bialy"):
        export(znak.logo_vertical(scheme)[0], VAR / f"logo_pionowe_{scheme}", jpg=scheme in ("kolor", "achromatyczny", "czarny"))
        export(znak.logo_horizontal(scheme)[0], VAR / f"logo_poziome_{scheme}", png_w=3000, jpg=scheme in ("kolor", "achromatyczny", "czarny"))
        export(znak.mark_only(scheme)[0], VAR / f"znak_{scheme}", png_w=2000)
    export(znak.logo_vertical("kolor", slogan=False)[0], VAR / "logo_pionowe_kolor_bez_hasla", jpg=True)
    export(znak.app_icon()[0], VAR / "ikona_aplikacji", png_w=1024, pdf=False)
    export(znak.app_icon(dark=True)[0], VAR / "ikona_aplikacji_ciemna", png_w=1024, pdf=False)
    for k in ("ok", "closed", "unknown"):
        name = {"ok": "dostepne", "closed": "ograniczone", "unknown": "brak_danych"}[k]
        export(znak.pin_svg(k), VAR / f"znacznik_{name}", png_w=280, pdf=False)

    (BRAND / "haslo.txt").write_text(f"Nazwa akcji: {znak.NAME}\nHasło: {znak.SLOGAN}\n", encoding="utf-8")
    print("OK:", BRAND)


if __name__ == "__main__":
    main()
