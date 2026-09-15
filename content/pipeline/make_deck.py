# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Z hotových dat udělá balíček karet ve formátu, který umí obrazovka Import.

Jeden soubor na kurz. Kolik kurzů má předmět, rozhoduje zkouška: IREWI se
známkuje po půlkách (30 + 30 bodů, v každé minimum 15), takže jsou dva a je
vidět, jak která polovina stojí; jednotná zkouška má jeden.

Název balíčku bere z `courses.json` (`subject`, jinak `title`) — v appce se
tak předmět pozná a podle názvů přednášek si najde svou učebnici.

Spuštění:  ./run.sh <předmět> deck
Výstup:    out/studyflow/<předmět>-<kód>.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

ROOT = pack_root()
DATA = ROOT / "out" / "data"
DEST = ROOT / "out" / "studyflow"

# slovník karet, který zná src/db/cardKinds.ts; cokoli jiného by appka ztišila na 'basic'
KNOWN_KINDS = {"basic", "cloze", "definice", "znaky", "schema", "pripad", "rozliseni",
               "norma", "judikat", "proces", "mapa", "cisla", "srovnani", "model", "graf"}


def main() -> int:
    index = json.loads((DATA / "index.json").read_text("utf-8"))
    exam_date = index["exam"]["date"]
    DEST.mkdir(parents=True, exist_ok=True)
    total = 0

    for course in index["courses"]:
        code = course["code"]
        cards, unknown = [], set()
        for lec in course["lectures"]:
            d = json.loads((DATA / f"{lec['lecture_id']}.json").read_text("utf-8"))
            for slide in d["slides"]:
                for c in slide["cards"]:
                    kind = c.get("kind", "basic")
                    if kind not in KNOWN_KINDS:
                        unknown.add(kind)
                        kind = "basic"
                    cards.append({
                        "type": "basic",
                        "kind": kind,
                        "level": c.get("difficulty", 1),
                        "topic": d["title"],
                        "front": c["q"],
                        "back": c["a"],
                        "tags": [d["lecture_id"], c.get("priority", "core")],
                        "sourceRef": {"page": slide["n"]},
                    })
        if not cards:
            print(f"{code}: zatím žádné karty — přeskočeno")
            continue
        if unknown:
            print(f"  ! {code}: neznámé druhy karet {sorted(unknown)} → 'basic'")
        deck = {
            "subject": course.get("subject") or course["title"],
            "examDate": exam_date,
            "cards": cards,
        }
        out = DEST / f"{ROOT.name}-{code.lower()}.json"
        out.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")
        core = sum(1 for c in cards if "core" in c["tags"])
        print(f"{code}: {len(cards)} karet ({core} jádro) → {out.relative_to(ROOT)} "
              f"· {out.stat().st_size // 1024} kB")
        total += len(cards)
    print(f"celkem {total} karet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
