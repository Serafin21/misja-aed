"""Validate the dane.gov.pl import XML against the portal's XSD (docs/tech/otwarte_dane_1_13.xsd).

Usage: python scripts/check_xml.py [deliverables/pakiet_dostawcy_przyklad/aed_harvester.xml]   (needs: pip install lxml)
"""
import sys
from pathlib import Path

from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
xml = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "deliverables" / "pakiet_dostawcy_przyklad" / "aed_harvester.xml")
xsd = etree.XMLSchema(etree.parse(str(ROOT / "docs" / "tech" / "otwarte_dane_1_13.xsd")))
ok = xsd.validate(etree.parse(str(xml)))
print(("OK  " if ok else "BŁĄD ") + str(xml))
for e in xsd.error_log:
    print(f"  wiersz {e.line}: {e.message}")
sys.exit(0 if ok else 1)
