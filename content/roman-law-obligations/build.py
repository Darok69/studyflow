# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Složí balíček Roman Law of Obligations z deck/*.json do out/studyflow/roman-law-obligations.json.

Uvnitř jedné hodiny (readyBy) se učí: znalosti → prameny (judikat) → případy
(pripad), stejně jako u Roman Law of Property (build.py tam). Karty s tagem
`property-link` vysvětlují pojmy z věcného práva v kontextu — Daniel ho zatím
neumí dobře, tak jdou mezi znalosti.

Spuštění:  uv run content/roman-law-obligations/build.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECK = ROOT / "deck"
OUT = ROOT / "out" / "studyflow" / "roman-law-obligations.json"
STAGE = {"judikat": 2, "pripad": 3}


def main() -> None:
    meta, cards = None, []
    for f in sorted(DECK.glob("[0-9][0-9]-*.json")):
        d = json.loads(f.read_text("utf-8"))
        meta = meta or {"subject": d["subject"], "examDate": d.get("examDate")}
        if d["subject"] != meta["subject"]:
            raise SystemExit(f"{f.name}: jiný subject {d['subject']!r}")
        cards += d["cards"]

    seen = set()
    for i, c in enumerate(cards):
        key = " ".join(c["front"].split()).lower()
        if key in seen:
            raise SystemExit(f"duplicitní otázka: {c['front'][:80]}")
        seen.add(key)
        c["learnOrder"] = STAGE.get(c.get("kind"), 1) * 100_000 + i

    deck = {**meta, "cards": cards,
            "updates": [{"match": c["front"], "back": c["back"], "learnOrder": c["learnOrder"]} for c in cards]}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")
    by = {}
    for c in cards:
        by[c.get("readyBy", "(ke zkoušce)")] = by.get(c.get("readyBy", "(ke zkoušce)"), 0) + 1
    print(f"{len(cards)} karet → {OUT.relative_to(ROOT)} · {OUT.stat().st_size // 1024} kB")
    for k, v in sorted(by.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
