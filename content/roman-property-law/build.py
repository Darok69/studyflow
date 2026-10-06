# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Složí balíček Roman Law z deck/*.json do out/studyflow/roman-property-law.json.

Pořadí učení (`learnOrder`) — Daniel 2026-10-06: „nejdřív věci na pochopení,
až potom cases; cases nechápu, dokud nemám znalosti, které k nim potřebuji".
Uvnitř jedné hodiny (`readyBy`) se proto učí:

  1. znalosti (definice, znaky, rozliseni, schema, norma, basic) — v pořadí
     učebnice, doplňky z deck/grundlagen.json na konci téže hodiny,
  2. prameny (judikat = Digest-Quellen, „Case N"),
  3. případy (pripad = Beispiele, Übungsfälle Ex, Fallblatt, Prüfungsfälle).

learnOrder = stupeň × 100 000 + pozice karty v balíčku. Aby to platilo i pro
karty, které Daniel UŽ má naimportované (identita karty = otázka), nese
balíček `updates` s learnOrder ke každé otázce — mění jen pořadí, FSRS
historie zůstává.

Spuštění:  uv run content/roman-property-law/build.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECK = ROOT / "deck"
OUT = ROOT / "out" / "studyflow" / "roman-property-law.json"

STAGE = {"judikat": 2, "pripad": 3}


def main() -> None:
    files = sorted(DECK.glob("[0-9][0-9]-*.json"))
    extra = sorted((DECK / "faelle").glob("*.json"))
    grund = DECK / "grundlagen.json"
    sources = files + extra + ([grund] if grund.exists() else [])

    meta, cards = None, []
    for f in sources:
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
            "updates": [{"match": c["front"], "learnOrder": c["learnOrder"]} for c in cards]}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")
    by = {s: sum(1 for c in cards if STAGE.get(c.get("kind"), 1) == s) for s in (1, 2, 3)}
    print(f"{len(cards)} karet (znalosti {by[1]}, prameny {by[2]}, případy {by[3]}) "
          f"z {len(sources)} souborů → {OUT.relative_to(ROOT)} · {OUT.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
