# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Složí PŘEHLEDOVÝ balíček Roman Law of Property (anglicky) z kompakt/*.json.

Daniel 2026-10-07: potřebuje Roman Law of Property rychle projet na exegezi
(PKU 030116, Assessment I 4. 11. 2026). Vyučující řekl, že stačí znát každé
téma plošně, ne do hloubky. Proto samostatný předmět vedle německého
podrobného balíčku: karta = jeden pojem, odpověď = věta + max. 3 odrážky.

Tempo podle hodin exegeze (readyBy = den hodiny, appka učí den předem):
  kap. I–IV possession → 14. 10. · V–VII traditio → 21. 10.
  VIII–IX usucapio, accessio → 28. 10. · X–XII, XV → 3. 11.

Uvnitř hodiny: znalosti → prameny → případy (learnOrder, stejně jako build.py).
`prune: true` — balíček je celý předmět, takže po úpravě a reimportu zmizí
karty, které už v balíčku nejsou.

Spuštění:  uv run content/roman-property-law/build_kompakt.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "kompakt"
OUT = ROOT / "out" / "studyflow" / "roman-property-overview.json"

SUBJECT = "Roman Law of Property — Overview for Exegesis"
EXAM = "2026-11-04"
STAGE = {"judikat": 2, "pripad": 3}
MAX_WORDS = 60


def main() -> None:
    cards = []
    for f in sorted(SRC.glob("[0-9][0-9]-*.json")):
        cards += json.loads(f.read_text("utf-8"))["cards"]

    seen, errors = set(), []
    for i, c in enumerate(cards):
        key = " ".join(c["front"].split()).lower()
        if key in seen:
            errors.append(f"duplicitní otázka: {c['front'][:80]}")
        seen.add(key)
        if len(c["back"].split()) > MAX_WORDS:
            errors.append(f"{len(c['back'].split())} slov: {c['front'][:80]}")
        if not c.get("readyBy") or not c.get("topic"):
            errors.append(f"chybí readyBy/topic: {c['front'][:80]}")
        c.pop("page", None)
        c["learnOrder"] = STAGE.get(c.get("kind"), 1) * 100_000 + i
    if errors:
        raise SystemExit("\n".join(errors))

    deck = {"subject": SUBJECT, "examDate": EXAM, "prune": True, "cards": cards,
            "updates": [{"match": c["front"], "back": c["back"], "learnOrder": c["learnOrder"]} for c in cards]}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")

    by_day: dict[str, int] = {}
    for c in cards:
        by_day[c["readyBy"]] = by_day.get(c["readyBy"], 0) + 1
    p1 = sum(1 for c in cards if c.get("priority") == 1)
    print(f"{len(cards)} karet (P1 {p1}) → {OUT.relative_to(ROOT)} · {OUT.stat().st_size // 1024} kB")
    for day, n in sorted(by_day.items()):
        print(f"  do {day}: {n}")


if __name__ == "__main__":
    main()
