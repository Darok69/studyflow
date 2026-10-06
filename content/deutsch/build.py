# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Složí balíček „Deutsch auf Muttersprachniveau" z deck/*.json.

Daniel (2026-10-06): „nešetři mě, hlavně ať se zlepším." Moduly jdou za sebou
podle jeho skutečných chyb z ukázky psaní; každý modul má termín (`readyBy`),
takže appka bere nové karty modul po modulu a drží tempo. Uvnitř modulu platí
pořadí v souboru (`learnOrder`): nejdřív pravidlo, pak dril od snadného.

Dril je typu cloze se štítkem `streng`: odpověď se vždycky PÍŠE a kontroluje
přesně (koncovka, člen, velké písmeno, přehláska — to je ta látka).

Spuštění:  uv run content/deutsch/build.py
Výstup:    out/studyflow/deutsch.json → /data/materials/deck-deutsch.json
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECK = ROOT / "deck"
OUT = ROOT / "out" / "studyflow" / "deutsch.json"
SUBJECT = "Deutsch auf Muttersprachniveau"
EXAM = "2027-01-31"

# modul → (soubor, termín). Pořadí = pořadí učení; m0 = jeho vlastní chyby.
MODULES = [
    ("m0", "m0-fehler.json", "2026-10-13"),
    ("m1", "m1-genus.json", "2026-10-27"),
    ("m2", "m2-adjektiv.json", "2026-11-15"),
    ("m3", "m3-praepositionen.json", "2026-11-30"),
    ("m4", "m4-wortstellung.json", "2026-12-15"),
    ("m5", "m5-konjunktiv-pronomen.json", "2027-01-06"),
    ("m6", "m6-rechtschreibung.json", "2027-01-20"),
]

CLOZE = re.compile(r"\{\{[\s\S]+?\}\}")


def main() -> None:
    cards, seen, problems = [], set(), []
    for mod, name, ready in MODULES:
        path = DECK / name
        if not path.exists():
            print(f"  ! {name} chybí — modul {mod} přeskočen")
            continue
        for c in json.loads(path.read_text("utf-8"))["cards"]:
            if c.get("type") == "cloze":
                n = len(CLOZE.findall(c.get("text", "")))
                if n != 1:
                    problems.append(f"{name}: {n}× mezera — {c.get('text', '')[:70]}")
                    continue
                key = CLOZE.sub("___", c["text"])
            else:
                key = c["front"]
            key = " ".join(key.split()).lower()
            if key in seen:
                problems.append(f"{name}: duplicita — {key[:70]}")
                continue
            seen.add(key)
            c["readyBy"] = ready
            c["learnOrder"] = len(cards)
            cards.append(c)
    if problems:
        print("\n".join(f"  ! {p}" for p in problems))

    # Opravy odpovědí se propíšou i do už importovaných karet (identita = otázka).
    updates = []
    for c in cards:
        if c.get("type") == "cloze":
            continue  # u cloze je otázka i odpověď v textu — oprava = nová karta
        updates.append({"match": c["front"], "back": c["back"], "learnOrder": c["learnOrder"],
                        "readyBy": c["readyBy"]})
    deck = {"subject": SUBJECT, "examDate": EXAM, "cards": cards, "updates": updates}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")
    by = {}
    for c in cards:
        by[c["readyBy"]] = by.get(c["readyBy"], 0) + 1
    strict = sum(1 for c in cards if "streng" in c.get("tags", []))
    print(f"{len(cards)} karet ({strict} dril se psaním) · po termínech {by} → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
