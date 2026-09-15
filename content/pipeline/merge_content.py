# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Vloží didaktický obsah (pipeline/content_*.json) do out/data/*.json.

Obsah se píše zvlášť, protože ho dělá model, ne skript. Merge je idempotentní:
slidy, které v obsahovém souboru nejsou, zůstávají nedotčené, a zapisuje se
jen do slidů, jejichž text_sha sedí — když se přednáška změní, obsah se
nevleze do posunutého slidu.

Spuštění:  uv run pipeline/merge_content.py pipeline/content_IL01.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

ROOT = pack_root()
FIELDS = ("title", "text", "terms", "cards", "vision_used", "note")
# karta: {q, a, difficulty 1-3, kind (slovník StudyFlow), priority core|extra}


def main(paths: list[str]) -> int:
    if not paths:
        print("použití: merge_content.py pipeline/content_IL01.json [...]")
        return 2
    for arg in paths:
        content = json.loads(Path(arg).read_text("utf-8"))
        lid = content["lecture_id"]
        target = ROOT / "out" / "data" / f"{lid}.json"
        if not target.exists():
            print(f"! {lid}: {target} neexistuje — spusť nejdřív run.py")
            return 1
        data = json.loads(target.read_text("utf-8"))
        if "title" in content:
            data["title"] = content["title"]
        by_n = {s["n"]: s for s in data["slides"]}
        written = skipped = 0
        for key, payload in content["slides"].items():
            n = int(key)
            slide = by_n.get(n)
            if slide is None:
                print(f"  ! {lid} s{n:03d}: slide neexistuje")
                skipped += 1
                continue
            expect = payload.pop("text_sha", None)
            if expect and expect != slide["text_sha"]:
                print(f"  ! {lid} s{n:03d}: zdroj se změnil — obsah nevložen")
                skipped += 1
                continue
            for f in FIELDS:
                if f in payload:
                    slide[f] = payload[f]
            slide["status"] = "done"
            written += 1
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")
        print(f"{lid}: vloženo {written} slidů, přeskočeno {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
