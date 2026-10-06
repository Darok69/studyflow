# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf>=1.24", "pillow>=10"]
# ///
"""Slepé obrázky: diagram ze slidu, popisky zakryté, karta na každý popisek.

Ruční kreslení obdélníků (v appce) je u desítek popisků zdlouhavé a nepřesné.
Popisky diagramu ale v PDF obvykle leží jako TEXT — `search_for` vrátí přesný
obdélník, kde slovo je. Zadání proto říká jen co hledat; polohu si skript najde
sám. Popisek, který je součástí rastrového obrázku (v textové vrstvě není), se
zadá ručně jako `rect` v relativních souřadnicích stránky.

Zadání:  <předmět>/blind.json
  [{"id": "erdaufbau", "lecture": "SE01", "slide": 12, "title": "Schalenbau der Erde",
    "mode": "hide-all-guess-one",            # nebo hide-one-guess-one (výchozí)
    "clip": [0.05, 0.15, 0.95, 0.9],         # volitelný výřez stránky (x0,y0,x1,y1, 0–1)
    "labels": ["Erdkern",                     # text, jak stojí v PDF
               {"find": "Mantel", "label": "Erdmantel", "hit": 1},
               {"rect": [0.4, 0.5, 0.1, 0.04], "label": "Moho"}]}]

Spuštění:  ./run.sh <předmět> blind
Výstup:    out/blind/cards.json — `deck` je přibalí k balíčku předmětu;
           výřez diagramu jako out/img/<ID>/<ID>_b<hash>.webp — nahraje ho
           `publish` spolu se slidy a karta na něj jen ODKAZUJE. Obrázek
           vložený do karty (data URL) by se zkopíroval do každé karty téhož
           diagramu a jel by v synchronizaci; servisní worker si obrázky
           učebnice drží offline (CacheFirst), takže odkaz stačí.
"""

import hashlib
import io
import json
import subprocess
import sys
import tempfile
from functools import cache
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

ROOT = pack_root()
SPEC = ROOT / "blind.json"
DEST = ROOT / "out" / "blind"
MAX_W = 1000  # px; víc telefon nepotřebuje a každý obrázek jede v synchronizaci
PAD = 1.5  # pt kolem nalezeného textu, ať maska zakryje i dotahy písmen


def raw_pdf(lid: str) -> Path:
    hits = sorted((ROOT / "raw").glob(f"{lid}_*.pdf"))
    if not hits:
        sys.exit(f"! {lid}: v raw/ chybí PDF — pusť nejdřív ./run.sh {ROOT.name}")
    return hits[0]


OCR = Path(__file__).resolve().parent / "ocr" / "ocr.swift"


@cache
def ocr_page(pdf: str, n: int) -> list[dict]:
    """Řádky textu na vykreslené stránce, souřadnice 0–1 vůči celé stránce."""
    page = pymupdf.open(pdf)[n - 1]
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "page.png"
        page.get_pixmap(dpi=200, alpha=False).save(png)
        out = subprocess.run(["swift", str(OCR), str(png), "de-DE"],
                             capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def norm(t: str) -> str:
    return " ".join(t.replace("₂", "2").split()).lower()


def find_rects(page: pymupdf.Page, pdf: Path, n: int, text: str,
               clip: pymupdf.Rect) -> list[pymupdf.Rect]:
    """Všechny výskyty: nejdřív z textové vrstvy, za nimi z OCR (u OCR má přesná
    shoda celého řádku přednost před výskytem uvnitř řádku).

    Obojí, ne „buď, anebo": `search_for` nerozlišuje velikost písmen a na
    rastrovém diagramu najde „Gesteine" v NADPISU, zatímco popisek pod
    „saure" je jen v obrázku. Z kandidátů pak vybírá volající."""
    found = [h + (-PAD, -PAD, PAD, PAD) for h in page.search_for(text) if clip.intersects(h)]
    pw, ph = page.rect.width, page.rect.height
    lines = ocr_page(str(pdf), n)
    exact = [o for o in lines if norm(o["text"]) == norm(text)]
    loose = [o for o in lines if norm(text) in norm(o["text"])]
    hits = [pymupdf.Rect(o["x"] * pw, o["y"] * ph, (o["x"] + o["w"]) * pw, (o["y"] + o["h"]) * ph)
            for o in (exact or loose)]
    return found + [h + (-PAD, -PAD, PAD, PAD) for h in hits if clip.intersects(h)]


def gap(a: pymupdf.Rect, b: pymupdf.Rect) -> float:
    """Jak daleko je řádek b od a — pokračování popisku leží těsně POD ním."""
    dy = b.y0 - a.y1
    # Řádky s okrajem PAD se smí překrývat — o půl výšky řádku, ne víc.
    below = dy >= -0.5 * a.height and b.y0 > a.y0
    return (abs(dy) if below else 1000 + abs(dy)) + abs(b.x0 - a.x0) * 0.5


def main() -> int:
    if not SPEC.exists():
        print(f"{SPEC.name} neexistuje — žádné slepé obrázky")
        return 0
    courses = json.loads((ROOT / "courses.json").read_text("utf-8"))
    # Téma = název přednášky TAK, JAK HO NESOU KARTY (out/data — merge ho smí
    # přepsat), jinak by slepé karty založily druhé téma vedle karet výkladu.
    titles = {}
    for c in courses["courses"]:
        for lec in c["lectures"]:
            data = ROOT / "out" / "data" / f"{lec['id']}.json"
            titles[lec["id"]] = (json.loads(data.read_text("utf-8")).get("title")
                                 if data.exists() else None) or lec["title"]
    cards, errors, total_kb = [], [], 0
    written: set[str] = set()
    for item in json.loads(SPEC.read_text("utf-8")):
        lid, n = item["lecture"], item["slide"]
        pdf = raw_pdf(lid)
        doc = pymupdf.open(pdf)
        page = doc[n - 1]
        pw, ph = page.rect.width, page.rect.height
        cx0, cy0, cx1, cy1 = item.get("clip", [0, 0, 1, 1])
        clip = pymupdf.Rect(cx0 * pw, cy0 * ph, cx1 * pw, cy1 * ph)

        masks = []
        for i, spec in enumerate(item["labels"]):
            spec = {"find": spec} if isinstance(spec, str) else spec
            label = spec.get("label") or spec.get("find")
            if "rect" in spec:
                x, y, w, h = spec["rect"]
                r = pymupdf.Rect(x * pw, y * ph, (x + w) * pw, (y + h) * ph)
            else:
                parts = spec["find"] if isinstance(spec["find"], list) else [spec["find"]]
                if not spec.get("label") and isinstance(spec["find"], list):
                    label = " ".join(parts)
                r, missing = None, None
                last = None
                for j, part in enumerate(parts):
                    hits = find_rects(page, pdf, n, part, clip)
                    if j == 0:
                        k = spec.get("hit", 0)
                        hit = hits[k] if len(hits) > k else None
                    else:
                        # Další řádky téhož popisku: ten nejbližší pod předchozím,
                        # ne první na stránce („Gesteine“ je tam pětkrát).
                        hit = min(hits, key=lambda h: gap(last, h)) if hits else None
                    if hit is None:
                        missing = part
                        break
                    last = hit
                    r = hit if r is None else r | hit
                if missing is not None or r is None:
                    errors.append(f"{item['id']}: „{missing}“ na {lid} s{n} nenalezeno "
                                  "ani v textu, ani OCR — zadej rect")
                    continue
            r = r & clip
            masks.append({
                "id": f"m{i + 1}",
                "x": round((r.x0 - clip.x0) / clip.width, 4),
                "y": round((r.y0 - clip.y0) / clip.height, 4),
                "w": round(r.width / clip.width, 4),
                "h": round(r.height / clip.height, 4),
                "label": label,
            })
        if not masks:
            continue

        zoom = min(3.0, MAX_W / clip.width)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, alpha=False)
        buf = io.BytesIO()
        Image.open(io.BytesIO(pix.tobytes("png"))).save(buf, "WEBP", quality=82, method=6)
        webp = buf.getvalue()
        name = f"{lid}_b{hashlib.sha256(webp).hexdigest()[:10]}.webp"
        img_dir = ROOT / "out" / "img" / lid
        img_dir.mkdir(parents=True, exist_ok=True)
        for old in img_dir.glob(f"{lid}_b*.webp"):
            if old.name not in written:
                old.unlink()  # starý výřez téhož diagramu by na serveru jen ležel
        (img_dir / name).write_bytes(webp)
        written.add(name)
        total_kb += len(webp) // 1024
        image = f"/api/materials/img/{lid}/{name}"
        mode = item.get("mode", "hide-one-guess-one")
        for i, target in enumerate(masks, 1):
            cards.append({
                "type": "basic",
                "kind": "mapa",
                "level": 1,
                "topic": titles.get(lid, lid),
                # Otázka je identita karty — číslo drží karty téhož obrázku od sebe.
                "front": f"{item['title']}: Was ist verdeckt? ({i}/{len(masks)})",
                "back": target["label"],
                "tags": [lid, "core", "blind"],
                "sourceRef": {"page": n},
                "image": image,
                "occlusion": {"mode": mode,
                              "masks": [target] + [m for m in masks if m is not target]},
            })
        print(f"  {item['id']}: {lid} s{n} · {len(masks)} popisků · {len(webp) // 1024} kB · {name}")

    if errors:
        print("\n".join(f"! {e}" for e in errors))
        return 1
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "cards.json").write_text(json.dumps(cards, ensure_ascii=False) + "\n", "utf-8")
    print(f"slepé obrázky: {len(cards)} karet, obrázky {total_kb} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
