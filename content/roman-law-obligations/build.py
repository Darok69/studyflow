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
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECK = ROOT / "deck"
OUT = ROOT / "out" / "studyflow" / "roman-law-obligations.json"
STAGE = {"judikat": 2, "pripad": 3}

# Rozvrh kurzu (UE Roman Law of Obligations, čtvrtky 2026W; Daniel 2026-10-07):
# kapitola má být naučená k hodině, kde se probírá (appka učí den předem).
# Midterm 5. 11. (jednotky 1–4 = kap. I–VI), final 17. 12. (vše) = examDate.
EXAM = "2026-12-17"
READY = {"I": "2026-10-08", "II": "2026-10-08", "III": "2026-10-15", "IV": "2026-10-15",
         "V": "2026-10-22", "VI": "2026-10-29", "VII": "2026-11-12", "VIII": "2026-11-19",
         "IX": "2026-11-19", "X": "2026-11-19", "XI": "2026-11-26", "XII": "2026-11-26",
         "XIII": "2026-12-03", "XIV": "2026-12-03", "XV": "2026-12-10", "XVI": "2026-12-10"}
# MUTUUM (str. 37–50) je už na 1. hodinu, zbytek kap. III až na 2.
EARLY_III = ("MUTUUM", "MACEDONIAN", "loan for consumption")
OWN_SOLUTION = "• Our application of the rules — the book gives no solution to this exercise."


def ready_by(card: dict) -> str:
    chap = next((t[4:] for t in card.get("tags", []) if t.startswith("kap-")), "")
    if chap == "III" and any(k.lower() in (card["topic"] + card["front"]).lower() for k in EARLY_III):
        return "2026-10-08"
    return READY.get(chap, EXAM)


def main() -> None:
    meta, cards = None, []
    for f in sorted(DECK.glob("[0-9][0-9]-*.json")):
        d = json.loads(f.read_text("utf-8"))
        meta = meta or {"subject": d["subject"], "examDate": EXAM}
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
        c["readyBy"] = ready_by(c)
        # Řešení cvičení si agent odvodil sám (kniha je nedává) — musí to být vidět.
        if c.get("kind") == "pripad" and re.search(r"\b(Ex|Exercise)\.? ?\d", c["front"]) \
                and OWN_SOLUTION not in c["back"]:
            c["back"] = c["back"].rstrip() + "\n" + OWN_SOLUTION

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
