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
from pack import pack_root, work_index  # noqa: E402

ROOT = pack_root()
DATA = ROOT / "out" / "data"
DEST = ROOT / "out" / "studyflow"

# slovník karet, který zná src/db/cardKinds.ts; cokoli jiného by appka ztišila na 'basic'
KNOWN_KINDS = {"basic", "cloze", "definice", "znaky", "schema", "pripad", "rozliseni",
               "norma", "judikat", "proces", "mapa", "cisla", "srovnani", "model", "graf"}


def main() -> int:
    index = work_index(ROOT)
    exam_date = index["exam"]["date"]
    DEST.mkdir(parents=True, exist_ok=True)
    total = 0

    # Kurzy se stejným názvem předmětu patří do JEDNOHO balíčku: přednáška
    # a její cvičení pokrývají tutéž zkoušku a v appce mají být jeden předmět.
    groups: dict[str, list[dict]] = {}
    for course in index["courses"]:
        key = course.get("subject") or course["title"]
        groups.setdefault(key, []).append(course)

    for subject_name, group in groups.items():
        course = group[0]
        code = course["code"]
        cards, unknown = [], set()
        lectures = [lec for c in group for lec in c["lectures"]]
        for lec in lectures:
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
                        # Téma karty je zkouškové téma, ne nutně název přednášky:
                        # jedna jednotka cvičení pokrývá několik témat naráz.
                        "topic": c.get("topic") or d["title"],
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
            "subject": subject_name,
            "examDate": exam_date,
            "cards": cards,
        }
        # Pravidla, jak zařadit karty, které uživatel v předmětu UŽ má z dřívějška
        # a nemají téma. Appka je použije jen na prázdné téma, nikdy nepřepisuje.
        filing = [r for c in group for r in c.get("filing", [])]
        if filing:
            deck["filing"] = filing
        out = DEST / f"{ROOT.name}-{code.lower()}.json"
        out.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")
        core = sum(1 for c in cards if "core" in c["tags"])
        print(f"{code}: {len(cards)} karet ({core} jádro, {len(group)} "
              f"{'kurz' if len(group) == 1 else 'kurzy'}) → {out.relative_to(ROOT)} "
              f"· {out.stat().st_size // 1024} kB")
        total += len(cards)
    # Balíčky bez karet: jen roztřídí, co už uživatel má. Starší balíček bez
    # témat je jinak jedna nerozlišená hromada a nová obrazovka předmětu s ním
    # neumí nic udělat.
    for org in index.get("organisers", []):
        deck = {
            "subject": org["subject"],
            "examDate": org.get("examDate", exam_date),
            "cards": [],
            "filing": org.get("filing", []),
        }
        out = DEST / f"{ROOT.name}-{org['id']}.json"
        out.write_text(json.dumps(deck, ensure_ascii=False, indent=1) + "\n", "utf-8")
        print(f"{org['id']}: 0 karet, {len(deck['filing'])} pravidel třídění "
              f"→ {out.relative_to(ROOT)}")

    print(f"celkem {total} karet")
    return 0


if __name__ == "__main__":
    sys.exit(main())
