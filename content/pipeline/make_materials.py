# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Payload pro čtecí obrazovku v appce.

Z out/data/*.json udělá ořezanou verzi: bez hashů, příznaků vision a dalších
polí, která appka nepotřebuje. Slidy bez učební látky (titulky, oddělovače)
se vypouštějí — čtecí režim je stejně přeskakuje.

Spuštění:  uv run pipeline/make_materials.py
Výstup:    out/materials/{index.json, <ID>.json}
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

from PIL import Image

ROOT = pack_root()
DATA = ROOT / "out" / "data"
IMG = ROOT / "out" / "img"
DEST = ROOT / "out" / "materials"


def size_of(rel: str) -> tuple[int, int] | None:
    """Rozměry renderu. Bez nich prohlížeč nezná poměr stran a text při
    scrollování poskakuje, dokud se obrázek nenačte."""
    path = ROOT / "out" / rel
    if not path.exists():
        return None
    with Image.open(path) as im:
        return im.width, im.height



# --- Témata zkoušky ---------------------------------------------------------
# Zkouší se po tématech, ne po kurzech: ke každému z 24 témat patří přednáška,
# povinná četba a cvičení. Aby šly v učebnici otevřít pohromadě, dostane každá
# položka seznam témat, do kterých patří.
#
# Čísla témat nesou přednášky samy ve svém `unit` („Topic 7"); četba je má taky
# („Téma 18–19"); cvičení jedno téma nemají, protože jedna hodina projde několik
# — u nich je seznam vypsaný ručně v courses.json.
UNIT_NUMS = re.compile(r"\d+")


def unit_numbers(unit: str) -> list[int]:
    """Čísla témat z označení jednotky: „Topic 11/12" → [11, 12],
    „Téma 9–11" → [9, 10, 11]. Rozsah se pozná podle pomlčky."""
    nums = [int(n) for n in UNIT_NUMS.findall(unit or "")]
    if len(nums) == 2 and re.search(r"\d\s*[–-]\s*\d", unit or ""):
        return list(range(nums[0], nums[1] + 1))
    return nums


def topic_map(courses: list[dict]) -> tuple[dict[int, str], list[dict]]:
    """Z přednášek udělá skupiny témat. Vrací (číslo tématu → klíč skupiny)
    a seznam skupin v pořadí zkoušky.

    Skupina je obvykle jedno téma. Když ale jedna přednáška pokrývá dvě
    („Topic 11/12"), tvoří ta dvě témata jednu skupinu — dělit je by znamenalo
    vypsat tutéž přednášku dvakrát pod dvěma polovinami jejího názvu.

    Klíč nese číslo kurzu, ne holé číslo tématu: server slévá rejstříky všech
    předmětů, na které uživatel dosáhne, a „téma 1" má v každém předmětu jiný
    význam. Bez toho prefixu by se přednáška z jednoho předmětu vypsala pod
    tématem druhého.
    """
    by_number: dict[int, str] = {}
    groups: list[dict] = []
    for course in courses:
        if course.get("kind", "lecture") != "lecture":
            continue
        scope = course.get("number") or course["code"]
        for lec in course["lectures"]:
            nums = unit_numbers(lec.get("unit", ""))
            if not nums:
                continue
            key = f"{scope}-{nums[0]}"
            groups.append({"key": key, "numbers": nums, "title": lec["title"]})
            for n in nums:
                by_number[n] = key
    return by_number, groups


def topics_of(lec_meta: dict, unit: str, by_number: dict[int, str]) -> list[str]:
    """Klíče skupin, do kterých položka patří. Ručně vypsaná čísla
    v courses.json mají přednost před tím, co jde vyčíst z názvu jednotky."""
    nums = lec_meta.get("topics")
    if nums is None:
        nums = unit_numbers(unit)
    keys: list[str] = []
    for n in nums:
        key = by_number.get(n)
        if key is not None and key not in keys:
            keys.append(key)
    return keys


def main() -> int:
    index = json.loads((DATA / "index.json").read_text("utf-8"))
    spec = json.loads((ROOT / "courses.json").read_text("utf-8"))
    by_number, groups = topic_map(spec["courses"])
    meta = {
        l["id"]: l
        for c in spec["courses"]
        for l in c["lectures"]
    }
    DEST.mkdir(parents=True, exist_ok=True)
    out_index = {"exam": index["exam"], "topics": groups, "courses": []}
    total_slides = total_cards = 0

    for course in index["courses"]:
        spec_course = next(
            (c for c in spec["courses"] if c["code"] == course["code"]), {})
        entry = {"code": course["code"], "number": course["number"],
                 "title": course["title"], "subject": course.get("subject"),
                 "kind": spec_course.get("kind", "lecture"),
                 "lectures": []}
        for lec in course["lectures"]:
            d = json.loads((DATA / f"{lec['lecture_id']}.json").read_text("utf-8"))
            slides = []
            for s in d["slides"]:
                has = (s.get("text") or "").strip() or s.get("terms") or s.get("cards")
                if not has:
                    continue
                slide = {"n": s["n"], "title": s.get("title") or ""}
                # Povinná četba nemá obrázky — je to souhrn, ne prezentace.
                if s.get("img"):
                    slide["img"] = s["img"]
                    wh = size_of(s["img"])
                    if wh:
                        slide["w"], slide["h"] = wh
                if (s.get("text") or "").strip():
                    slide["text"] = s["text"]
                if s.get("terms"):
                    slide["terms"] = s["terms"]
                if s.get("cards"):
                    slide["cards"] = s["cards"]
                if s.get("note"):
                    slide["note"] = s["note"]
                slides.append(slide)
            # Přednáška, ke které ještě není napsaný výklad, do učebnice nepatří:
            # v seznamu by byl řádek „0 stran · 0 karet", který otevře prázdnou
            # stránku. Co chybí, hlídá REPORT, ne čtenář.
            if not slides:
                continue
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
                "topics": topics_of(meta.get(d["lecture_id"], {}), d["unit"], by_number),
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
