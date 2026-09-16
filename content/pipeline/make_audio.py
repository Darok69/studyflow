#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# ///
"""Z podkladů udělá poslouchatelné epizody.

Dvě řady, protože se poslouchají v jiné situaci:

  quiz       otázka → ticho → odpověď. Na běhání a do metra: nutí tě si
             vzpomenout, což je jediné, co se při poslechu opravdu učí.
  narration  souvislý výklad přednášky. Do auta, na první seznámení.

Text se NEBERE ze slidů doslova — výklad je psaný pod obrázek a mluví o tom,
co je vidět („left column", „the photograph beside the text"). Takové věty
jsou v overrides/<ID>.json přepsané do mluvené podoby nebo vypnuté; co v
overrides není, jde do zvuku tak, jak je.

Zvuk dělá systémové `say` (žádný klíč, nic neodchází z notebooku) a rovnou
do AAC — ffmpeg není potřeba.

Použití:
    ./make_audio.py --series quiz               # celá kvízová řada
    ./make_audio.py --series narration --only IL02
    ./make_audio.py --series quiz --voice Ava --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

from speech import for_speech, pause  # noqa: E402

ROOT = pack_root()
MATERIALS = ROOT / "out" / "materials"
OVERRIDES = ROOT / "audio" / "overrides"
OUT = ROOT / "out" / "audio"

# Hlas se NEVOLÍ podle nálady, ale podle JAZYKA TEXTU. Čeština přečtená
# anglickým hlasem zní jako blábol — přesně to se stalo právním dějinám, které
# celé čte britský „Daniel". Jazyk říká courses.json (pole `language` u předmětu
# nebo u jednotlivého kurzu), ne parametr na příkazové řádce, aby se na to
# nedalo zapomenout. --voice zůstává jako vědomé přebití.
VOICES = {"en": "Ava", "cs": "Zuzana"}
FALLBACK_VOICE = "Ava"
DEFAULT_RATE = 165

# Ticho na vzpomenutí. Kratší nestačí, delší svádí přetočit.
ANSWER_PAUSE_MS = 4500
BETWEEN_CARDS_MS = 900
BETWEEN_SLIDES_MS = 550


@dataclass
class Episode:
    lecture_id: str
    series: str
    title: str
    subtitle: str
    script: str
    parts: int = 0
    seconds: float = 0.0
    path: Path | None = None
    skipped: list[str] = field(default_factory=list)


def load_overrides(lecture_id: str) -> dict:
    """Ruční opravy pro poslech. Chybějící soubor je v pořádku — většina
    přednášek žádnou nepotřebuje."""
    f = OVERRIDES / f"{lecture_id}.json"
    if not f.exists():
        return {}
    return json.loads(f.read_text(encoding="utf-8"))


def slide_text(slide: dict, ov: dict) -> str | None:
    """Text slidu pro poslech. Override vyhrává; prázdný override slide vypne."""
    replacement = ov.get("slides", {}).get(str(slide["n"]))
    if replacement is not None:
        return replacement.strip() or None
    return (slide.get("text") or "").strip() or None


def build_quiz(lec: dict, ov: dict) -> Episode:
    chunks: list[str] = []
    intro = ov.get("quiz_intro") or (
        f"{lec['course_title']}. {lec['unit']}: {lec['title']}. "
        f"Questions only. After each question there is a pause. "
        f"Say the answer out loud before you hear it."
    )
    chunks.append(for_speech(intro))
    n = 0
    for slide in lec["slides"]:
        for card in slide.get("cards") or []:
            q = ov.get("cards", {}).get(card["q"], card["q"])
            if not q:
                continue  # vypnutá otázka (mluvila o obrázku a nedá se přepsat)
            n += 1
            chunks.append(
                f"Question {n}. {for_speech(q)} "
                f"{pause(ANSWER_PAUSE_MS)} {for_speech(card['a'])} {pause(BETWEEN_CARDS_MS)}"
            )
    chunks.append(for_speech(f"That was {n} questions from {lec['unit']}."))
    return Episode(
        lecture_id=lec["lecture_id"],
        series="quiz",
        title=f"{lec['unit']} — {lec['title']} (questions)",
        subtitle=f"{n} questions with pauses to answer out loud.",
        script="\n\n".join(chunks),
        parts=n,
    )


def build_narration(lec: dict, ov: dict) -> Episode:
    chunks: list[str] = []
    intro = ov.get("intro") or (
        f"{lec['course_title']}. {lec['unit']}: {lec['title']}."
    )
    chunks.append(for_speech(intro))
    n = 0
    skipped: list[str] = []
    for slide in lec["slides"]:
        text = slide_text(slide, ov)
        if not text:
            if (slide.get("text") or "").strip():
                skipped.append(str(slide["n"]))
            continue
        n += 1
        chunks.append(f"{for_speech(text)} {pause(BETWEEN_SLIDES_MS)}")
    outro = ov.get("outro") or f"End of {lec['unit']}."
    chunks.append(for_speech(outro))
    return Episode(
        lecture_id=lec["lecture_id"],
        series="narration",
        title=f"{lec['unit']} — {lec['title']}",
        subtitle=f"The written explanation of {n} slides, read as one piece.",
        script="\n\n".join(chunks),
        parts=n,
        skipped=skipped,
    )


def words(script: str) -> int:
    return len(re.sub(r"\[\[[^\]]*\]\]", " ", script).split())


def render(ep: Episode, voice: str, rate: int, force: bool) -> None:
    out_dir = OUT / ep.series
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{ep.lecture_id}.m4a"
    script_file = out_dir / f"{ep.lecture_id}.txt"

    # Idempotence: stejný text + stejný hlas = nic nepřevádět znovu. Syntéza
    # dlouhé přednášky trvá minuty a při 23 přednáškách to není jedno.
    stamp = f"{voice}|{rate}|{ep.script}"
    stamp_file = out_dir / f"{ep.lecture_id}.stamp"
    if not force and target.exists() and stamp_file.exists():
        if stamp_file.read_text(encoding="utf-8") == stamp:
            ep.path = target
            ep.seconds = duration(target)
            return

    script_file.write_text(ep.script, encoding="utf-8")
    subprocess.run(
        ["say", "-v", voice, "-r", str(rate), "-f", str(script_file),
         "-o", str(target), "--data-format=aac"],
        check=True,
    )
    stamp_file.write_text(stamp, encoding="utf-8")
    ep.path = target
    ep.seconds = duration(target)


def duration(path: Path) -> float:
    out = subprocess.run(["afinfo", str(path)], capture_output=True, text=True).stdout
    m = re.search(r"estimated duration: ([\d.]+)", out)
    return float(m.group(1)) if m else 0.0


def hms(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 3600:d}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60:d}:{s % 60:02d}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--series", choices=["quiz", "narration"], required=True)
    ap.add_argument("--only", help="jen tahle přednáška, např. IL02")
    ap.add_argument("--voice", help="přebije hlas daný jazykem předmětu")
    ap.add_argument("--rate", type=int, default=DEFAULT_RATE)
    ap.add_argument("--force", action="store_true", help="převést znovu i beze změny")
    ap.add_argument("--dry-run", action="store_true", help="jen text, žádný zvuk")
    ap.add_argument("--manifest-only", action="store_true",
                    help="nepřevádět nic, jen dopsat manifest podle hotových souborů")
    args = ap.parse_args()

    index = json.loads((MATERIALS / "index.json").read_text(encoding="utf-8"))
    order = [lec["id"] for course in index["courses"] for lec in course["lectures"]]
    lang_of = {lec["id"]: course.get("language") or "en"
               for course in index["courses"] for lec in course["lectures"]}
    if args.only:
        if args.only not in order:
            print(f"neznámá přednáška {args.only}; mám {', '.join(order)}", file=sys.stderr)
            return 2
        order = [args.only]

    built: list[Episode] = []
    voices: set[str] = set()
    total = 0.0
    for lecture_id in order:
        lec = json.loads((MATERIALS / f"{lecture_id}.json").read_text(encoding="utf-8"))
        ov = load_overrides(lecture_id)
        ep = build_quiz(lec, ov) if args.series == "quiz" else build_narration(lec, ov)
        if ep.parts == 0:
            print(f"  {lecture_id}: nic k namluvení, přeskakuji")
            continue
        if args.dry_run:
            print(f"  {lecture_id}: {ep.parts} částí, {words(ep.script)} slov "
                  f"≈ {hms(words(ep.script) / args.rate * 60)}")
            if ep.skipped:
                print(f"      vypnuté slidy: {', '.join(ep.skipped)}")
            built.append(ep)
            continue
        voice = args.voice or VOICES.get(lang_of.get(lecture_id, ""), FALLBACK_VOICE)
        voices.add(voice)
        if args.manifest_only:
            # Oprava manifestu po běhu s --only: zvuk na disku je hotový,
            # jen o něm manifest neví. Nic se nepřevádí.
            target = OUT / args.series / f"{ep.lecture_id}.m4a"
            if not target.exists():
                print(f"  {lecture_id}: zvuk zatím neexistuje, přeskakuji")
                continue
            ep.path = target
            ep.seconds = duration(target)
            total += ep.seconds
            built.append(ep)
            continue
        render(ep, voice, args.rate, args.force)
        total += ep.seconds
        print(f"  {lecture_id}: {ep.parts} částí, {hms(ep.seconds)}, "
              f"{ep.path.stat().st_size // 1024} kB, hlas {voice}")
        built.append(ep)

    if not args.dry_run and built:
        manifest = OUT / f"{args.series}.json"
        # 🔴 Manifest se SLUČUJE, nikdy nepřepisuje. Při --only se převede jedna
        # přednáška, ale manifest je vstupem pro feed — přepsat ho jedním
        # záznamem znamená feed o jedné epizodě a v Apple Podcasts zmizí
        # zbytek odběru. Přestavěné epizody přepíšou své starší záznamy,
        # ostatní se zachovají v pořadí, které dává rejstřík.
        keep: dict[str, dict] = {}
        if manifest.exists():
            old = json.loads(manifest.read_text(encoding="utf-8"))
            keep = {e["lecture_id"]: e for e in old.get("episodes", [])}
        for e in built:
            keep[e.lecture_id] = {
                "lecture_id": e.lecture_id,
                "title": e.title,
                "subtitle": e.subtitle,
                "file": f"{args.series}/{e.lecture_id}.m4a",
                "seconds": round(e.seconds, 1),
                "bytes": e.path.stat().st_size,
                "parts": e.parts,
            }
        full_order = [lec["id"] for course in index["courses"] for lec in course["lectures"]]
        episodes = [keep[i] for i in full_order if i in keep]
        # Co v rejstříku není (přejmenovaná přednáška), ať se neztratí tiše.
        episodes += [e for i, e in keep.items() if i not in set(full_order)]
        manifest.write_text(json.dumps({
            "series": args.series,
            "voice": args.voice or ", ".join(sorted(voices)),
            "rate": args.rate,
            "episodes": episodes,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nhotovo: {len(built)} epizod převedeno, "
              f"{len(episodes)} v manifestu, {hms(total)} celkem → {manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
