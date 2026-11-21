# Architektura – Misja AED (rdzeń, Model A)

```
 Źródła                         Agregator (src/core)                                  Publikacja
 ───────                        ─────────────────────                                 ──────────
 plik dysponenta CSV/XLSX/JSON ─┐
 formularz pojedynczego AED  ───┤  importers → mapping → pipeline (normalize, infer) → validate
 zgłoszenie obywatela (moder.) ─┤        │                                              │
 OpenStreetMap (ODbL)        ───┤        └──────────── store: dedup + merge ◄───────────┘
 zbiory w dane.gov.pl        ───┘                        │  (SQLite + pamięć podręczna)
                                                         ├─► REST API /api/v1 (FastAPI, JSON API)
                                                         └─► publish: CSV, GeoJSON, JSON-LD, CSVW,
                                                              XML importu, DCAT-AP-PL → dane.gov.pl
```

## Moduły

| Moduł | Rola |
|---|---|
| `schema.py` | Wczytuje `docs/schema/` (JSON Schema, słownik danych, słowniki). Kod nie zawiera kopii definicji pól. |
| `importers.py` | CSV (wykrywanie kodowania UTF-8/CP1250/ISO-8859-2, separatora i przecinka dziesiętnego), XLSX, JSON (także zagnieżdżony i w stylu JSON API), GeoJSON. |
| `mapping.py` | Propozycja mapowania kolumn: nazwa pola, synonimy (rapidfuzz) i próbki wartości (współrzędne w jednym polu, adres w jednym polu, godziny, kod pocztowy). Mapowanie zapisuje się dla każdego źródła. |
| `normalize.py` | true/false, kropka dziesiętna, daty, rozbiór adresu, kod pocztowy → województwo, piętro i „na zewnątrz” z opisu. |
| `hours.py` | Podzbiór opening_hours: parser, „dostępne teraz” (Europe/Warsaw), zamiana zapisów typu „pn-pt 8-16” i „całodobowo”. |
| `pipeline.py` | Wiersz → rekord: mapowanie, konwersja typów, uzupełnienia oznaczone w raporcie jako „informacja”, wartości domyślne z importu, walidacja. |
| `validate.py` | JSON Schema 2020-12 + reguły dodatkowe (długości, piętro, e-mail, https, przeterminowane elektrody, zamknięta szafka bez instrukcji). Komunikaty po polsku. |
| `dedup.py` | Odległość haversine, podobieństwo nazw i adresów, siatka przestrzenna, scalanie pole po polu według priorytetu źródeł, stały `id_aed`. |
| `store.py` | Rekordy źródłowe (`pochodzenie`) → rekord scalony (`aed`). Pamięć podręczna w RAM z zapisem do SQLite (WAL). |
| `quality.py` | Kompletność rekordu i pokrycie pól dla każdego źródła (zakres referencyjny). |
| `publish.py`, `linked.py`, `template.py` | Pakiet publikacji, JSON-LD (schema.org), szablon XLSX dla dysponentów. |
| `connectors/osm.py`, `connectors/dane_gov_pl.py` | Konektory z cache w `data/cache/` (Wi-Fi na sali). |
| `src/api/main.py`, `auth.py` | REST API zgodne z CONTRACT §5, błędy `{"error": …}`, konta demo, limit zgłoszeń anonimowych. |

## Kluczowe decyzje

- **Jeden schemat:** walidacja, kolejność kolumn CSV, szablony i JSON-LD powstają z `docs/schema/`. Zmiana schematu nie wymaga zmian w kodzie.
- **Rekordy źródłowe są przechowywane osobno.** Rekord scalony da się zawsze odtworzyć, a ponowny import aktualizuje rekordy zamiast tworzyć duplikaty.
- **Izolacja ODbL:** wartości z OpenStreetMap nigdy nie trafiają do rekordu na CC0/CC-BY. OSM występuje wtedy tylko w pochodzeniu (CR-5).
- **`id_aed`** = `AED-PL-` + 10 znaków SHA-1(`kod_zrodla|id_w_zrodle`) pierwszego źródła. Nie zmienia się przy scalaniu i aktualizacjach.
- **Wydajność:** 20 000 punktów (skala całej warstwy OSM): wczytanie 14 s, najbliższe AED 0,04 s, `GET /aed?per_page=1000` 0,1 s, eksport CSV 0,3 s.
- **Bez danych osobowych:** zgłoszenie obywatela nie ma pola kontaktu; telefonów i e-maili z OSM nie importujemy.
