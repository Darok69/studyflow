# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Z balíčků karet udělá zálohu ve formátu, který appka umí obnovit a který
drží server jako sync snapshot (jeden soubor na uživatele).

Tvar je opsaný z toho, co appka sama vyrobí — ověřeno tak, že se oba balíčky
naimportovaly přes její vlastní obrazovku Import a výsledek se přečetl
z IndexedDB.

Spuštění:  uv run pipeline/make_backup.py
Výstup:    out/studyflow/irewi-backup.json
"""

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "out" / "studyflow"

# barva předmětu se v appce odvozuje z id; 0–7, stačí stabilní volba
COLORS = {"irewi-il.json": 3, "irewi-eu.json": 5}


def fsrs_new(now_iso: str) -> dict:
    """Čerstvá karta podle ts-fsrs: splatná hned, bez historie."""
    return {"due": now_iso, "stability": 0, "difficulty": 0, "reps": 0,
            "lapses": 0, "state": "new", "lastReview": None}


def main() -> int:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    subjects, cards = [], []

    for name in ("irewi-il.json", "irewi-eu.json"):
        src = DEST / name
        if not src.exists():
            print(f"chybí {src} — spusť nejdřív make_deck.py")
            return 1
        deck = json.loads(src.read_text("utf-8"))
        sid = str(uuid.uuid4())
        subjects.append({
            "id": sid,
            "name": deck["subject"],
            "examDate": deck["examDate"],
            "reminderTime": None,
            "createdAt": now_iso,
            "colorIndex": COLORS[name],
        })
        for c in deck["cards"]:
            card = {
                "id": str(uuid.uuid4()),
                "subjectId": sid,
                "type": c["type"],
                "kind": c["kind"],
                "level": c["level"],
                "topic": c["topic"],
                "front": c["front"],
                "back": c["back"],
                "tags": c["tags"],
                **fsrs_new(now_iso),
            }
            if "sourceRef" in c:
                card["sourceRef"] = c["sourceRef"]
            cards.append(card)

    backup = {
        "kind": "studyflow-backup",
        "version": 1,
        "exportedAt": now_iso,
        "subjects": subjects,
        "cards": cards,
        "reviews": [],
        "errorLog": [],
        "settings": None,
    }
    out = DEST / "irewi-backup.json"
    out.write_text(json.dumps(backup, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"{len(subjects)} předměty · {len(cards)} karet → {out.relative_to(ROOT)} "
          f"· {out.stat().st_size // 1024} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
