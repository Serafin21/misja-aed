"""List licences of runtime dependencies (transitively) and flag anything outside MIT/BSD/Apache/ISC/PSF."""
from __future__ import annotations

import re
import sys
from importlib import metadata

ROOTS = ["fastapi", "uvicorn", "python-multipart", "jsonschema", "openpyxl", "rapidfuzz", "tzdata"]
OK = re.compile(r"MIT|BSD|Apache|ISC|PSF|Python Software Foundation|Unlicense|0BSD", re.I)


def licence(dist) -> str:
    m = dist.metadata
    expr = m.get("License-Expression")
    if expr:
        return expr
    cls = [c.split("::")[-1].strip() for c in m.get_all("Classifier") or [] if c.startswith("License ::")]
    if cls:
        return "; ".join(cls)
    lic = (m.get("License") or "").strip().splitlines()
    return lic[0][:60] if lic else "?"


def walk(name, seen):
    key = name.lower().replace("_", "-")
    if key in seen:
        return
    try:
        d = metadata.distribution(name)
    except metadata.PackageNotFoundError:
        return
    seen[key] = (d.version, licence(d))
    for req in d.requires or []:
        if "extra ==" in req:
            continue
        walk(re.split(r"[ ;<>=!\[~(]", req, maxsplit=1)[0], seen)


def main():
    seen: dict = {}
    for r in ROOTS:
        walk(r, seen)
    bad = 0
    for k in sorted(seen):
        v, lic = seen[k]
        flag = "OK " if OK.search(lic) else "?? "
        bad += flag == "?? "
        print(f"{flag} {k}=={v}  {lic}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
