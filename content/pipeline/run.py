# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf>=1.24", "pillow>=10"]
# ///
"""
StEOP "Einführung in das internationale Recht" — podklady → StudyFlow.

Mechanická část pipeline: render slidů, textová vrstva, výběr stránek pro
vision, sloučení s už vygenerovaným obsahem, kontrola a REPORT.md.

Didaktický obsah (title/text/terms/cards) se do JSONu doplňuje zvlášť —
tento skript ho NIKDY nepřepíše, dokud se nezmění zdrojová stránka.

Spuštění:  uv run pipeline/run.py [--only IL01,EU03] [--force] [--dpi 150]
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import io
import json
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

import pymupdf
from PIL import Image

ROOT = pack_root()
CONFIG = ROOT / "courses.json"
RAW = ROOT / "raw"
OUT = ROOT / "out"
IMG = OUT / "img"
DATA = OUT / "data"
WORK = OUT / "work"
CACHE = ROOT / ".cache" / "manifest.json"

THIN_TEXT_CHARS = 200      # pod tímto prahem se slide posílá na vision
IMAGE_COVER_RATIO = 0.20   # kolik plochy zabírají rastrové obrázky
VECTOR_MARGIN = 4          # o kolik nad šablonou musí být kreseb, aby šlo o schéma
MAX_WIDTH = 1600           # px, kvůli velikosti balíčku pro PWA
WEBP_QUALITY = 80
BLANK_MEAN = 252           # průměrný jas prázdné buňky handoutu (0–255)

FILLER_RE = re.compile(
    r"^(danke|thank you|vielen dank|questions\??|fragen\??|agenda|overview|"
    r"gliederung|inhalt|outline|contents|literatur|literature)\b",
    re.I,
)


# ---------------------------------------------------------------- utilities

def log(msg: str) -> None:
    print(msg, flush=True)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-{2,}", "-", s)[:60]


def load_json(p: Path, default):
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text("utf-8"))
    except json.JSONDecodeError as e:
        log(f"  ! poškozený JSON {p.name}: {e} — beru jako prázdný")
        return default


def write_json(p: Path, obj) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", "utf-8")


# ------------------------------------------------------- handout (n-up) grid

def detect_grid(doc: pymupdf.Document) -> tuple[int, int]:
    """Kolik slidů je na jedné stránce PDF.

    Handout tiskne na stránku několik slidů a s nimi několikrát i patičku,
    logo a jméno přednášejícího. Medián nejčastěji opakovaného řádku napříč
    stránkami tedy říká, kolik slidů na stránce je — a zároveň to vysvětluje,
    proč u takového PDF vychází textová vrstva rozsypaná: čte se přes čtyři
    slidy najednou.
    """
    reps = []
    for i in range(doc.page_count):
        lines = [l.strip() for l in doc[i].get_text().splitlines() if len(l.strip()) >= 10]
        counts = collections.Counter(lines)
        reps.append(counts.most_common(1)[0][1] if counts else 1)
    reps.sort()
    k = reps[len(reps) // 2] if reps else 1
    if k < 2:
        return 1, 1
    rect = doc[0].rect
    landscape = rect.width >= rect.height
    if k >= 6:
        return (3, 2) if landscape else (2, 3)
    if k >= 4:
        return 2, 2
    if k == 3:
        return (3, 1) if landscape else (1, 3)
    return (2, 1) if landscape else (1, 2)


FRAME_PAD = 3          # bod okraje kolem nalezeného rámečku slidu
FRAME_MIN_W = 0.25     # rámeček slidu je aspoň čtvrtina šířky stránky
FRAME_MAX_W = 0.92     # a není to obdélník přes celou stránku (podklad)
FRAME_MIN_H = 0.10


def frame_rects(page: pymupdf.Page) -> list[pymupdf.Rect]:
    """Rámečky slidů nakreslené na stránce handoutu, shora dolů.

    Handout s linkami na poznámky tiskne kolem každého slidu obdélník. Rovnoměrná
    mřížka na takovou stránku nesedí: slidy mají vlastní rozteč a vedle nich je
    prázdný papír na psaní. Rámeček je jediné místo, kde slide opravdu začíná
    a končí, takže se čte i renderuje přesně on. Prázdný seznam = nenašlo se,
    volající spadne zpátky na mřížku.
    """
    r = page.rect
    found: list[pymupdf.Rect] = []
    for dr in page.get_drawings():
        rc = dr["rect"]
        if not (r.width * FRAME_MIN_W <= rc.width <= r.width * FRAME_MAX_W):
            continue
        if rc.height < r.height * FRAME_MIN_H:
            continue
        if any(abs(rc.x0 - g.x0) < 4 and abs(rc.y0 - g.y0) < 4
               and abs(rc.x1 - g.x1) < 4 and abs(rc.y1 - g.y1) < 4 for g in found):
            continue
        found.append(rc)
    found.sort(key=lambda rc: (round(rc.y0), rc.x0))
    # rámečky se nesmí překrývat — vnořený obdélník uvnitř slidu není slide
    out: list[pymupdf.Rect] = []
    for rc in found:
        if any(rc.intersects(g) for g in out):
            continue
        out.append(pymupdf.Rect(max(r.x0, rc.x0 - FRAME_PAD), max(r.y0, rc.y0 - FRAME_PAD),
                                min(r.x1, rc.x1 + FRAME_PAD), min(r.y1, rc.y1 + FRAME_PAD)))
    return out


def cell_rects(page: pymupdf.Page, cols: int, rows: int,
               frames: bool = False) -> list[pymupdf.Rect]:
    if frames:
        rects = frame_rects(page)
        if rects:
            return rects
    if cols == 1 and rows == 1:
        return [page.rect]
    r = page.rect
    w, h = r.width / cols, r.height / rows
    return [
        pymupdf.Rect(r.x0 + c * w, r.y0 + rw * h, r.x0 + (c + 1) * w, r.y0 + (rw + 1) * h)
        for rw in range(rows)
        for c in range(cols)
    ]


# ---------------------------------------------------------------- analysis

def cell_text(page: pymupdf.Page, clip: pymupdf.Rect | None) -> str:
    txt = page.get_text("text", sort=True, clip=clip)
    lines = [ln.strip() for ln in txt.splitlines()]
    out, blank = [], 0
    for ln in lines:
        if ln:
            out.append(ln)
            blank = 0
        else:
            blank += 1
            if blank == 1 and out:
                out.append("")
    return "\n".join(out).strip()


def draw_count(page: pymupdf.Page, clip: pymupdf.Rect | None = None) -> int:
    try:
        drawings = page.get_drawings()
    except Exception:
        return 0
    if clip is None:
        return len(drawings)
    return sum(1 for d in drawings if clip.contains((d["rect"].tl + d["rect"].br) / 2))


def image_cover(page: pymupdf.Page, clip: pymupdf.Rect) -> float:
    covered = 0.0
    for info in page.get_images(full=True):
        for r in page.get_image_rects(info[0]):
            inter = r & clip
            if not inter.is_empty:
                covered += inter.width * inter.height
    return covered / max(clip.width * clip.height, 1.0)


def vision_reason(page, clip, text: str, baseline: int, broken: bool = False) -> str | None:
    """Proč tenhle slide poslat modelu jako obrázek. None = stačí text."""
    if broken:
        return "text-layer-broken"
    if len(text) < THIN_TEXT_CHARS:
        return "thin-text"
    if image_cover(page, clip) > IMAGE_COVER_RATIO:
        return "image-heavy"
    if draw_count(page, clip) >= baseline + VECTOR_MARGIN:
        # Tabulky, pyramidy a organigramy: text v nich JE, ale pořadí čtení
        # je rozsypané a vztahy mezi poli se z textové vrstvy nepoznají.
        return "diagram"
    return None


def looks_like_filler(text: str) -> bool:
    if not text:
        return True
    first = text.splitlines()[0].strip()
    return bool(FILLER_RE.match(first)) and len(text) < 400


# ---------------------------------------------------------------- rendering

def render_cell(page: pymupdf.Page, clip: pymupdf.Rect | None, dpi: int) -> Image.Image:
    pix = page.get_pixmap(dpi=dpi, clip=clip)
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    if im.width > MAX_WIDTH:
        h = round(im.height * MAX_WIDTH / im.width)
        im = im.resize((MAX_WIDTH, h), Image.LANCZOS)
    return im


def is_blank(im: Image.Image) -> bool:
    g = im.convert("L").resize((64, 64))
    px = list(g.getdata())
    return sum(px) / len(px) >= BLANK_MEAN


# ---------------------------------------------------------------- one lecture

GENERATED_FIELDS = ("title", "text", "terms", "cards", "vision_used", "status", "note")
# POZOR: "status" tu MUSÍ být. Bez něj plný běh shodí hotové slidy na "pending"
# a další běh už by je nepoznal jako hotové a obsah by zahodil.


def process(lec: dict, course: dict, dpi: int, force: bool, manifest: dict,
            write_work: bool = True) -> dict:
    lid = lec["id"]
    src = Path(course["root"]) / lec["file"]
    raw_name = f"{lid}_{slugify(Path(lec['file']).stem)}.pdf"
    raw_path = RAW / raw_name
    # Moodle export ve Stažených se smazat může, kopie v raw/ ne — když původní
    # cesta zmizí, běží se z kopie. Bez toho by po úklidu Stažených přestala
    # jít pipeline pustit znovu, i když jsou všechna data v repu.
    if not src.exists():
        if not raw_path.exists():
            log(f"  ! {lid}: zdroj chybí — {src}")
            return {"lecture_id": lid, "error": f"missing source: {src}"}
        log(f"  ~ {lid}: zdroj na původní cestě není, čtu kopii {raw_path.name}")
        src = raw_path

    digest = sha256_file(src)
    if not raw_path.exists() or sha256_file(raw_path) != digest:
        RAW.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, raw_path)

    # Povinná četba není prezentace. Stránka odborného článku jako obrázek je
    # k ničemu — nedá se v ní listovat ani se z ní učit. Z článku se proto
    # vytáhne jen text do out/work (podklad k napsání souhrnu) a data zůstanou
    # bez slidů; oddíly souhrnu vyrobí merge z obsahového souboru.
    if lec.get("kind") == "reading":
        return process_reading(lec, course, src, raw_name, digest, write_work)

    doc = pymupdf.open(src)
    cols, rows = lec["nup"] if lec.get("nup") else detect_grid(doc)
    per_page = cols * rows
    frames = lec.get("cells") == "frames"
    # U některých PDF nesedí souřadnice textové vrstvy s tím, co se vykreslí.
    # Takový text nejde použít ani opravit — slidy se čtou výhradně z obrázků.
    broken = lec.get("text_layer") == "broken"

    data_path = DATA / f"{lid}.json"
    img_dir = IMG / lid
    prev = load_json(data_path, {})
    prev_slides = {s.get("n"): s for s in prev.get("slides", []) if isinstance(s, dict)}

    cached = manifest.get(lid, {})
    unchanged = (
        not force
        and cached.get("sha256") == digest
        and cached.get("dpi") == dpi
        and cached.get("max_width") == MAX_WIDTH
        and cached.get("grid") == [cols, rows]
        and cached.get("frames", False) == frames
        and data_path.exists()
    )
    if unchanged and cached.get("slides"):
        imgs_ok = all(
            (img_dir / f"{lid}_s{i + 1:03d}.webp").exists() for i in range(cached["slides"])
        )
    else:
        imgs_ok = False

    if per_page > 1:
        log(f"  * {lid}: handout {cols}×{rows} slidů na stránku "
            f"({doc.page_count} stránek → až {doc.page_count * per_page} slidů)")
    if imgs_ok:
        log(f"  = {lid}: beze změny ({cached['slides']} slidů) — přeskočeno")
    else:
        log(f"  + {lid}: render @ {dpi} dpi → WebP")
        img_dir.mkdir(parents=True, exist_ok=True)

    # základ vektorových kreseb = medián přes buňky, šablona každého decku je jiná
    counts = []
    for i in range(doc.page_count):
        for clip in cell_rects(doc[i], cols, rows, frames):
            counts.append(draw_count(doc[i], None if per_page == 1 and not frames else clip))
    counts.sort()
    baseline = counts[len(counts) // 2] if counts else 0

    slides, stats = [], {"vision": 0, "filler": 0, "kept": 0, "new": 0, "blank": 0}
    n = 0
    for i in range(doc.page_count):
        page = doc[i]
        for cell, clip in enumerate(cell_rects(page, cols, rows, frames)):
            use_clip = None if per_page == 1 and not frames else clip
            txt = cell_text(page, use_clip)
            im = None
            # U decku s rozbitou textovou vrstvou nejde prázdnou buňku poznat
            # podle textu — musí se podívat na obrázek vždy.
            if not txt or broken:
                im = render_cell(page, use_clip, dpi)
                if is_blank(im):
                    stats["blank"] += 1
                    continue
            n += 1
            name = f"{lid}_s{n:03d}.webp"
            if not imgs_ok:
                if im is None:
                    im = render_cell(page, use_clip, dpi)
                im.save(img_dir / name, "WEBP", quality=WEBP_QUALITY, method=5)
            reason = vision_reason(page, clip, txt, baseline, broken)
            entry = {
                "n": n,
                "img": f"img/{lid}/{name}",
                "title": None,
                "text": None,
                "terms": [],
                "cards": [],
                "vision_used": False,
                "status": "pending",
                "needs_vision": reason is not None,
                "vision_reason": reason,
                "likely_filler": looks_like_filler(txt),
                "text_chars": len(txt),
                "text_sha": sha256_text(txt),
                "pdf_page": i + 1,
            }
            if per_page > 1:
                entry["pdf_cell"] = cell + 1
            old = prev_slides.get(n)
            if old and old.get("text_sha") == entry["text_sha"] and old.get("status") == "done":
                for f in GENERATED_FIELDS:
                    if f in old:
                        entry[f] = old[f]
                stats["kept"] += 1
            else:
                stats["new"] += 1
            if reason:
                stats["vision"] += 1
            if entry["likely_filler"]:
                stats["filler"] += 1
            slides.append(entry)

    # Když se počet slidů zmenší (prázdná buňka handoutu, jiný řez), zůstal by
    # v img/ osiřelý soubor a kontrola by ho hlásila donekonečna.
    keep = {Path(s["img"]).name for s in slides}
    for stale in img_dir.glob(f"{lid}_s*.webp"):
        if stale.name not in keep:
            stale.unlink()
            log(f"    - smazán osiřelý obrázek {stale.name}")

    fallback = next((s for s in slides if s["text_chars"] > 0), None)
    fallback_title = ""
    if fallback:
        for ln in cell_text(doc[fallback["pdf_page"] - 1], None).splitlines():
            if 3 <= len(ln.strip()) <= 90:
                fallback_title = ln.strip()
                break

    out = {
        "lecture_id": lid,
        "course": course["code"],
        "course_title": course["title"],
        "course_number": course["number"],
        "unit": lec.get("unit", ""),
        "title": prev.get("title") or lec.get("title") or fallback_title or lid,
        "source_file": f"raw/{raw_name}",
        "source_sha256": digest,
        "source_pages": doc.page_count,
        "slides_per_page": per_page,
        "slide_count": len(slides),
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "slides": slides,
    }
    write_json(data_path, out)
    if write_work:
        write_work_packet(lid, out, doc, cols, rows, broken)
    doc.close()

    manifest[lid] = {"sha256": digest, "dpi": dpi, "max_width": MAX_WIDTH,
                     "grid": [cols, rows], "frames": frames, "slides": len(slides)}
    log(f"    {len(slides)} slidů · vision {stats['vision']} · filler? {stats['filler']}"
        + (f" · prázdných buněk {stats['blank']}" if stats["blank"] else "")
        + f" · hotové zachované {stats['kept']} · k dopsání {stats['new']}")
    return {"lecture_id": lid, "pages": len(slides), **stats}


def process_reading(lec: dict, course: dict, src: Path, raw_name: str,
                    digest: str, write_work: bool) -> dict:
    """Článek z povinné četby: text ven, obrázky ne, hotový souhrn zachovat."""
    lid = lec["id"]
    doc = pymupdf.open(src)
    data_path = DATA / f"{lid}.json"
    prev = load_json(data_path, {})
    kept = prev.get("slides", []) if prev.get("kind") == "reading" else []

    out = {
        "lecture_id": lid,
        "kind": "reading",
        "course": course["code"],
        "course_title": course["title"],
        "course_number": course["number"],
        "unit": lec.get("unit", ""),
        "title": prev.get("title") or lec.get("title") or lid,
        "source_file": f"raw/{raw_name}",
        "source_sha256": digest,
        "source_pages": doc.page_count,
        "slides_per_page": 1,
        "slide_count": len(kept),
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "slides": kept,
    }
    DATA.mkdir(parents=True, exist_ok=True)
    write_json(data_path, out)

    if write_work:
        WORK.mkdir(parents=True, exist_ok=True)
        lines = [
            f"# {lid} — {out['title']}",
            f"_{out['course_title']} ({out['course_number']}) · {out['unit']} · "
            f"povinná četba, {doc.page_count} stran_",
            "",
        ]
        for i, page in enumerate(doc, 1):
            text = page.get_text().strip()
            if not text:
                continue
            lines += [f"## str. {i}", "```", text, "```", ""]
        (WORK / f"{lid}.md").write_text("\n".join(lines), "utf-8")

    doc.close()
    log(f"  ~ {lid}: povinná četba, {out['source_pages']} stran → text do work/, "
        f"bez obrázků · hotových oddílů {len(kept)}")
    return {"lecture_id": lid, "pages": len(kept), "vision": 0, "filler": 0,
            "kept": len(kept), "new": 0}


def write_work_packet(lid: str, data: dict, doc, cols: int, rows: int,
                      broken: bool = False) -> None:
    """Surový text pro generování obsahu — mimo data/*.json, ať zůstane čistý."""
    WORK.mkdir(parents=True, exist_ok=True)
    per_page = cols * rows
    lines = [
        f"# {lid} — {data['title']}",
        f"_{data['course_title']} ({data['course_number']}) · {data['unit']} · "
        f"{data['slide_count']} slidů_"
        + (f" · handout {cols}×{rows} na stránku" if per_page > 1 else ""),
        "",
    ]
    for s in data["slides"]:
        flags = []
        if s["needs_vision"]:
            flags.append(f"VISION:{s['vision_reason']}")
        if s["likely_filler"]:
            flags.append("FILLER?")
        if s["status"] == "done":
            flags.append("DONE")
        where = f"s{s['n']:03d}"
        if per_page > 1:
            where += f" (PDF str. {s['pdf_page']}, pole {s['pdf_cell']})"
        lines.append(f"## {where}{' · ' + ' '.join(flags) if flags else ''}")
        page = doc[s["pdf_page"] - 1]
        clip = None
        if per_page > 1:
            clip = cell_rects(page, cols, rows)[s["pdf_cell"] - 1]
        if broken:
            lines.append("_Textová vrstva tohoto PDF neodpovídá vykreslenému obsahu "
                         "— čti z obrázku._\n")
            continue
        body = cell_text(page, clip)
        lines += ["```", body if body else "(bez textové vrstvy)", "```", ""]
    (WORK / f"{lid}.md").write_text("\n".join(lines), "utf-8")


# ---------------------------------------------------------------- check + report

def consistency(results: list[dict]) -> list[str]:
    problems = []
    for f in sorted(DATA.glob("*.json")):
        if f.name == "index.json":
            continue
        d = load_json(f, {})
        lid = d.get("lecture_id", f.stem)
        want = {s["img"] for s in d.get("slides", [])}
        for rel in sorted(want):
            if not (OUT / rel).exists():
                problems.append(f"{lid}: chybí obrázek {rel}")
        have = {f"img/{lid}/{p.name}" for p in (IMG / lid).glob("*.webp")}
        for orphan in sorted(have - want):
            problems.append(f"{lid}: obrázek bez záznamu v JSONu — {orphan}")
    return problems


def stats_from_disk(lid: str) -> dict | None:
    """Čísla pro přednášku, která v tomhle běhu nešla přes render.

    Bez toho `--only IL01` přepsal REPORT jediným řádkem a zbytek předmětu
    z něj zmizel — report pak tvrdil, že přednáška je jedna.
    """
    d = load_json(DATA / f"{lid}.json", None)
    if not d:
        return None
    slides = d.get("slides", [])
    done = sum(1 for sl in slides if sl.get("status") == "done")
    return {
        "lecture_id": lid,
        "pages": len(slides),
        "vision": sum(1 for sl in slides if sl.get("needs_vision")),
        "filler": sum(1 for sl in slides if sl.get("likely_filler")),
        "kept": done,
        "new": len(slides) - done,
    }


def write_report(cfg: dict, results: list[dict], problems: list[str]) -> None:
    # Report mluví za celý předmět, i když se právě přerenderovala jedna přednáška.
    seen = {r["lecture_id"] for r in results}
    full: list[dict] = []
    for course in cfg["courses"]:
        for lec in course["lectures"]:
            lid = lec["id"]
            if lid in seen:
                full.append(next(r for r in results if r["lecture_id"] == lid))
            else:
                from_disk = stats_from_disk(lid)
                if from_disk:
                    full.append(from_disk)
    results = full or results

    done = sum(r.get("kept", 0) for r in results)
    todo = sum(r.get("new", 0) for r in results)
    total = sum(r.get("pages", 0) for r in results)
    vision = sum(r.get("vision", 0) for r in results)
    size_mb = sum(p.stat().st_size for p in IMG.rglob("*.webp")) / 1e6

    L = [
        f"# REPORT — podklady pro {cfg['exam']['name']}",
        "",
        f"Běh: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        "",
        "## Zkouška",
        f"- {cfg['exam']['name']}",
        f"- Termín: {cfg['exam']['date']}, jazyk: {cfg['exam']['language']}",
        f"- Formát: {cfg['exam']['format']}",
        "",
        "## Souhrn",
        f"- Přednášek: {len(results)} · slidů: {total} · obrázky celkem: {size_mb:.1f} MB",
        f"- Na vision vybráno: {vision} slidů ({vision / max(total, 1):.0%})",
        f"- Obsah hotový: {done} · čeká na dopsání: {todo}",
        "",
        "## Po přednáškách",
        "",
        "| ID | slidů | vision | filler? | hotovo | zbývá |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in results:
        if "error" in r:
            L.append(f"| {r['lecture_id']} | — | — | — | — | CHYBA |")
        else:
            L.append(f"| {r['lecture_id']} | {r['pages']} | {r['vision']} | "
                     f"{r['filler']} | {r['kept']} | {r['new']} |")
    L += ["", "## Kontrola obrázků vs. JSON", ""]
    L += ["- ✅ Beze zjištění."] if not problems else [f"- ❌ {p}" for p in problems]

    notes = []
    for f in sorted(DATA.glob("*.json")):
        if f.name == "index.json":
            continue
        d = load_json(f, {})
        chars = [sl.get("text_chars", 0) for sl in d.get("slides", [])]
        if chars:
            med = sorted(chars)[len(chars) // 2]
            if med > 2500 and not any(
                sl.get("vision_reason") == "text-layer-broken" for sl in d["slides"]
            ):
                notes.append(f"- **{d['lecture_id']}** má {med} znaků na slide (běžně 300–800) "
                             "— podezření na překrytou textovou vrstvu, prověřit.")
        if d.get("slides_per_page", 1) > 1:
            notes.append(f"- **{d['lecture_id']}** je handout — {d['source_pages']} stránek PDF "
                         f"po {d['slides_per_page']} slidech, rozřezáno na {d['slide_count']} slidů.")
        for sl in d.get("slides", []):
            if sl.get("note"):
                notes.append(f"- **{d.get('lecture_id', f.stem)} s{sl['n']:03d}** — {sl['note']}")
    L += ["", "## Co na slidech nesedí nebo chybí", ""]
    L += notes if notes else ["- Zatím nic označeného."]

    # Co v podkladech chybí, ví předmět, ne skript — jinak by report o jednom
    # předmětu tvrdil mezery druhého.
    gaps = cfg.get("gaps") or []
    L += ["", "## Mezery v podkladech", ""]
    L += [f"- {g}" for g in gaps] if gaps else ["- Zatím nic označeného."]
    L += [""]
    (OUT / "REPORT.md").write_text("\n".join(L), "utf-8")


# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", help="čárkou oddělené ID přednášek (IL01,EU03)")
    ap.add_argument("--force", action="store_true", help="přerenderovat i beze změny")
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--no-work", action="store_true",
                    help="nepřepisovat out/work/*.md (obsah už je hotový)")
    args = ap.parse_args()

    cfg = load_json(CONFIG, None)
    if cfg is None:
        log(f"chybí konfigurace {CONFIG}")
        return 1

    wanted = {s.strip() for s in args.only.split(",")} if args.only else None
    manifest = load_json(CACHE, {})
    results: list[dict] = []

    for course in cfg["courses"]:
        picked = [l for l in course["lectures"] if not wanted or l["id"] in wanted]
        if not picked:
            continue
        log(f"\n== {course['title']} ({course['number']}) — {len(picked)} přednášek")
        for lec in picked:
            results.append(process(lec, course, args.dpi, args.force, manifest,
                                   not args.no_work))

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    write_json(CACHE, manifest)

    index = {"exam": cfg["exam"],
             "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "organisers": cfg.get("organisers", []),
             "courses": []}
    for course in cfg["courses"]:
        entry = {"code": course["code"], "number": course["number"],
                 "title": course["title"], "subject": course.get("subject"),
                 "filing": course.get("filing", []),
                 "lectures": []}
        for lec in course["lectures"]:
            d = load_json(DATA / f"{lec['id']}.json", None)
            if not d:
                continue
            entry["lectures"].append({
                "lecture_id": d["lecture_id"], "unit": d["unit"], "title": d["title"],
                "slides": d["slide_count"], "data": f"data/{d['lecture_id']}.json",
                "done": sum(1 for s in d["slides"] if s.get("status") == "done"),
            })
        index["courses"].append(entry)
    write_json(DATA / "index.json", index)

    problems = consistency(results)
    write_report(cfg, results, problems)
    log(f"\nHotovo. out/REPORT.md · {len(problems)} nesrovnalostí obrázek↔JSON.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
