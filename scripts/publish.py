"""Generate the dane.gov.pl publication package into deliverables/dataset/.

Usage: python -m scripts.publish [--out deliverables/dataset]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.core import publish  # noqa: E402
from src.core.store import get_store  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "deliverables" / "dataset"))
    a = ap.parse_args(argv)
    paths = publish.write_package(get_store(), Path(a.out))
    for p in paths:
        print(f"{p.relative_to(ROOT) if p.is_relative_to(ROOT) else p}  {p.stat().st_size} B")


if __name__ == "__main__":
    main()
