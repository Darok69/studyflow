# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Z otázek `mc/<ID>.json` složí banku pro zkušební test v appce.

Karty učí vybavit si odpověď; písemka s výběrem možností chce něco jiného —
rozhodnout o čtyřech tvrzeních, která všechna VYPADAJÍ správně. Otázky se proto
píšou zvlášť (jedna sada na přednášku) a tady se jen slijí, ověří a opatří
tématem, které sedí s tématem karet (název přednášky), aby šel test filtrovat
stejně jako učení.

Spuštění:  ./run.sh <předmět> tests
Výstup:    out/tests/<předmět>.json  → na serveru mc-<předmět>.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

ROOT = pack_root()
SRC = ROOT / "mc"
DEST = ROOT / "out" / "tests"


def check(q: dict, where: str) -> list[str]:
    errs = []
    if q.get("type") not in ("single", "multi"):
        errs.append("type musí být single|multi")
    opts = q.get("options") or []
    if len(opts) < 2:
        errs.append("méně než 2 možnosti")
    right = sum(1 for o in opts if o.get("correct") is True)
    if q.get("type") == "single" and right != 1:
        errs.append(f"single má {right} správných")
    if q.get("type") == "multi" and right < 1:
        errs.append("multi bez správné možnosti")
    texts = [" ".join(str(o.get("t", "")).split()).lower() for o in opts]
    if len(set(texts)) != len(texts):
        errs.append("dvě stejné možnosti")
    if not str(q.get("q", "")).strip():
        errs.append("prázdná otázka")
    return [f"{where}: {e}" for e in errs]


def main() -> int:
    courses = json.loads((ROOT / "courses.json").read_text("utf-8"))
    exam = courses.get("exam", {})
    titles, order, subject = {}, [], None
    for course in courses["courses"]:
        subject = subject or course.get("subject") or course["title"]
        for lec in course["lectures"]:
            # Název, jak ho nesou karty (out/data), aby filtr témat seděl s učením.
            data = ROOT / "out" / "data" / f"{lec['id']}.json"
            titles[lec["id"]] = (json.loads(data.read_text("utf-8")).get("title")
                                 if data.exists() else None) or lec["title"]
            order.append(lec["id"])
    if not SRC.exists():
        print(f"! {SRC} neexistuje — žádné otázky")
        return 1

    questions, errors, ids = [], [], set()
    per = {}
    # Pořadí přednášek z courses.json — appka podle něj řadí témata testu.
    rank = {lid: i for i, lid in enumerate(order)}
    for path in sorted(SRC.glob("*.json"), key=lambda p: (rank.get(p.stem, len(rank)), p.stem)):
        data = json.loads(path.read_text("utf-8"))
        lid = data.get("lecture_id") or path.stem
        topic = titles.get(lid)
        if topic is None:
            errors.append(f"{path.name}: přednáška {lid} není v courses.json")
            continue
        for q in data.get("questions", []):
            where = f"{path.name} {q.get('id', '?')}"
            errors += check(q, where)
            if q.get("id") in ids:
                errors.append(f"{where}: duplicitní id")
            ids.add(q.get("id"))
            questions.append({**q, "topic": topic, "lecture": lid})
            per[lid] = per.get(lid, 0) + 1
    if errors:
        print("\n".join(f"! {e}" for e in errors))
        return 1

    fmt = exam.get("mc_format") or {}
    bank = {"subject": subject, "examDate": exam.get("date"), "format": fmt, "questions": questions}
    DEST.mkdir(parents=True, exist_ok=True)
    out = DEST / f"{ROOT.name}.json"
    out.write_text(json.dumps(bank, ensure_ascii=False, indent=1) + "\n", "utf-8")
    multi = sum(1 for q in questions if q["type"] == "multi")
    print(f"{subject}: {len(questions)} otázek ({multi} multi, {len(questions) - multi} single) · "
          + ", ".join(f"{k} {v}" for k, v in per.items()) + f" → {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
