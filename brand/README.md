# Akcja „AED w danych” – logotyp i księga znaku

**Hasło:** Dane prosto z serca · decyzje twórcze (nazwa, hasło, znak): zespół. Pliki wygenerowane z jednej definicji wektorowej (`zrodla/znak.py`).

| Plik | Co to jest |
|---|---|
| `logo.svg` | plik główny, format otwarty, napisy zamienione na krzywe |
| `logo.png` | 2400 px szerokości, przezroczyste tło |
| `logo.jpg` | białe tło, 2400 px |
| `logo.pdf` | wektor do druku |
| `ksiega_znaku.pdf` | księga znaku (11 stron A4): koncepcja, konstrukcja, pole ochronne, minimalna wielkość (px i mm), kolory HEX/RGB/CMYK, typografia, wersje (pełna, achromatyczna, odwrócona, jednobarwna), 8 niedozwolonych użyć, znaczniki mapy w obu trybach, zastosowania |
| `haslo.txt` | nazwa akcji i hasło |
| `warianty/` | logo pionowe i poziome w wersjach: `kolor`, `odwrocony`, `achromatyczny`, `czarny`, `bialy` (SVG, PNG, PDF; JPG dla jasnych), sam znak, ikony aplikacji, znaczniki mapy |
| `zrodla/` | `znak.py` (geometria i kolory), `generuj.py` (pliki logo), `ksiega.py` (księga znaku) |

Krój pisma: Inter (SIL Open Font License 1.1). Odtworzenie plików: `python brand/zrodla/generuj.py && python brand/zrodla/ksiega.py` (wymaga fontTools, Pillow, `rsvg-convert`, `pdfunite` i plików Inter OTF; ścieżka w zmiennej `INTER_DIR`).

Wartości CMYK w księdze przeliczono z RGB bez profilu ICC – przed drukiem do potwierdzenia z drukarnią.
