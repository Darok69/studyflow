"""Který předmět se zpracovává.

Skripty jsou společné, data ne: každý předmět je vlastní „balík" —
`courses.json`, zdrojová PDF, napsaný výklad a výstupy — a skript se dozví,
o který jde, z proměnné prostředí `STUDYFLOW_PACK`. Nastavuje ji `run.sh`,
takže se z příkazové řádky pouští `./run.sh <předmět> …` a nic víc.

Bez toho by se celá pipeline musela pro druhý předmět zkopírovat a od té
chvíle by se každá oprava dělala dvakrát.
"""

from __future__ import annotations

import json
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


def work_index(root: Path) -> dict:
    """Pracovní sklad z kroku `slides`, ale popisky ze zadání.

    Sklad je snímek z doby, kdy se renderovaly slidy — nese si tehdejší názvy
    kurzů, popisky jednotek, pravidla třídění i popis zkoušky. Kdo je čte
    odtud, servíruje po každé úpravě `courses.json` tiše starý text; stálo to
    už jednou české „Téma 7" v anglické učebnici a jednou český popis zkoušky.
    Proto tu zadání přebíjí sklad ve všem, co je JEN popis. Co vzniklo
    zpracováním (slidy, karty, počty, cesty k datům), zůstává ze skladu.
    """
    index = json.loads((root / "out" / "data" / "index.json").read_text("utf-8"))
    spec = json.loads((root / "courses.json").read_text("utf-8"))
    if spec.get("exam"):
        index["exam"] = spec["exam"]
    by_code = {c["code"]: c for c in spec.get("courses", [])}
    for course in index.get("courses", []):
        sc = by_code.get(course["code"])
        if not sc:
            continue
        for key in ("title", "subject", "kind", "filing"):
            if sc.get(key) is not None:
                course[key] = sc[key]
        by_id = {l["id"]: l for l in sc.get("lectures", [])}
        for lec in course.get("lectures", []):
            sl = by_id.get(lec.get("lecture_id"), {})
            for key in ("unit", "title"):
                if sl.get(key):
                    lec[key] = sl[key]
    return index
