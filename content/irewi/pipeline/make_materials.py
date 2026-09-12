# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Payload pro čtecí obrazovku v appce.

Z out/data/*.json udělá ořezanou verzi: bez hashů, příznaků vision a dalších
polí, která appka nepotřebuje. Slidy bez učební látky (titulky, oddělovače)
se vypouštějí — čtecí režim je stejně přeskakuje.

Spuštění:  uv run pipeline/make_materials.py
Výstup:    out/materials/{index.json, <ID>.json}
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "out" / "data"
DEST = ROOT / "out" / "materials"


def main() -> int:
    index = json.loads((DATA / "index.json").read_text("utf-8"))
    DEST.mkdir(parents=True, exist_ok=True)
    out_index = {"exam": index["exam"], "courses": []}
    total_slides = total_cards = 0

    for course in index["courses"]:
        entry = {"code": course["code"], "number": course["number"],
                 "title": course["title"], "lectures": []}
        for lec in course["lectures"]:
            d = json.loads((DATA / f"{lec['lecture_id']}.json").read_text("utf-8"))
            slides = []
            for s in d["slides"]:
                has = (s.get("text") or "").strip() or s.get("terms") or s.get("cards")
                if not has:
                    continue
                slide = {"n": s["n"], "img": s["img"], "title": s.get("title") or ""}
                if (s.get("text") or "").strip():
                    slide["text"] = s["text"]
                if s.get("terms"):
                    slide["terms"] = s["terms"]
                if s.get("cards"):
                    slide["cards"] = s["cards"]
                if s.get("note"):
                    slide["note"] = s["note"]
                slides.append(slide)
            cards = sum(len(s.get("cards", [])) for s in slides)
            payload = {
                "lecture_id": d["lecture_id"],
                "course": d["course"],
                "course_title": d["course_title"],
                "unit": d["unit"],
                "title": d["title"],
                "slides": slides,
            }
            (DEST / f"{d['lecture_id']}.json").write_text(
                json.dumps(payload, ensure_ascii=False) + "\n", "utf-8")
            entry["lectures"].append({
                "id": d["lecture_id"], "unit": d["unit"], "title": d["title"],
                "slides": len(slides), "cards": cards,
            })
            total_slides += len(slides)
            total_cards += cards
        out_index["courses"].append(entry)

    (DEST / "index.json").write_text(json.dumps(out_index, ensure_ascii=False) + "\n", "utf-8")
    size = sum(p.stat().st_size for p in DEST.glob("*.json"))
    print(f"{sum(len(c['lectures']) for c in out_index['courses'])} přednášek · "
          f"{total_slides} slidů · {total_cards} karet · {size // 1024} kB JSON")
    return 0


if __name__ == "__main__":
    sys.exit(main())
