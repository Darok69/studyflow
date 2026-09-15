"""Který předmět se zpracovává.

Skripty jsou společné, data ne: každý předmět je vlastní „balík" —
`courses.json`, zdrojová PDF, napsaný výklad a výstupy — a skript se dozví,
o který jde, z proměnné prostředí `STUDYFLOW_PACK`. Nastavuje ji `run.sh`,
takže se z příkazové řádky pouští `./run.sh <předmět> …` a nic víc.

Bez toho by se celá pipeline musela pro druhý předmět zkopírovat a od té
chvíle by se každá oprava dělala dvakrát.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

CONTENT = Path(__file__).resolve().parent.parent


def pack_root() -> Path:
    """Kořen zpracovávaného balíku. Chybějící nebo neznámý = srozumitelná smrt."""
    name = (os.environ.get("STUDYFLOW_PACK") or "").strip()
    if not name:
        packs = sorted(p.name for p in CONTENT.iterdir() if (p / "courses.json").exists())
        sys.exit(
            "Není zvolený předmět. Pusť ./run.sh <předmět> …, nebo nastav "
            f"STUDYFLOW_PACK. Dostupné: {', '.join(packs) or 'žádný'}"
        )
    root = Path(name) if Path(name).is_absolute() else CONTENT / name
    if not (root / "courses.json").exists():
        sys.exit(f"Předmět {name}: chybí {root / 'courses.json'}")
    return root
