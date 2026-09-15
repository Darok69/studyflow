#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Z hotových epizod udělá soukromý podcast feed + obal.

Proč feed a ne přehrávač v appce: podcastová aplikace umí to, co se v autě a
v metru počítá — stahování offline, CarPlay, rychlost, zapamatovanou pozici a
přehrávání při zhasnutém displeji. Nic z toho bych v appce nedostal zadarmo.

Soukromí: feed NENÍ veřejný katalog. Adresa nese náhodný token a feed má
<itunes:block>yes</itunes:block>, což Applu říká „neindexovat". Kdo ale tu
adresu dostane, poslechne si to — proto se token nikam nesdílí.

Použití:
    ./make_feed.py --base https://study.dmarka.eu --token <token>
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont

ROOT = pack_root()
AUDIO = ROOT / "out" / "audio"

SERIES = {
    "quiz": {
        "suffix": "Questions",
        "desc": ("Exam questions from {course} (University of Vienna). Question, a pause "
                 "to answer out loud, then the answer. Made for running and for the metro."),
        "colour": (106, 94, 232),
    },
    "narration": {
        "suffix": "Lectures",
        "desc": ("The written explanation of every slide of {course} (University of "
                 "Vienna), read as one piece. Made for the car."),
        "colour": (52, 52, 74),
    },
}

# Adresa feedu je zapsaná v odběru v podcastové aplikaci; přejmenovat řadu
# znamená odběr tiše rozbít. Řady IREWI se proto jmenují pořád `quiz` a
# `narration`, každý další předmět dostane vlastní řadu s prefixem.
LEGACY_PACK = "irewi"


def series_id(series: str) -> str:
    return series if ROOT.name == LEGACY_PACK else f"{ROOT.name}-{series}"


def show_name(cfg: dict, series: str) -> tuple[str, str]:
    """Název a popis pořadu. Bere je z předmětu, ne z konstanty ve skriptu."""
    podcast = cfg.get("podcast", {})
    course = cfg["courses"][0]
    short = podcast.get("short") or course.get("code") or ROOT.name.upper()
    long = podcast.get("course") or course.get("title") or short
    meta = SERIES[series]
    return f"{short} — {meta['suffix']}", meta["desc"].format(course=long)

AUTHOR = "StudyFlow"
# Datum, od kterého se epizody číslují. Podcastová aplikace řadí podle data,
# takže první přednáška musí být nejstarší — jinak by se poslouchalo pozpátku.
EPOCH = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)


def cover(path: Path, title: str, subtitle: str, colour: tuple[int, int, int]) -> None:
    """Obal 1500×1500. Apple chce nejmíň 1400 a čtverec."""
    size = 1500
    img = Image.new("RGB", (size, size), colour)
    d = ImageDraw.Draw(img)
    for i in range(size):  # jemný přechod, ať to není placka
        f = i / size
        d.line([(0, i), (size, i)],
               fill=tuple(int(c * (1 - 0.35 * f)) for c in colour))

    def font(px: int) -> ImageFont.FreeTypeFont:
        for candidate in ("/System/Library/Fonts/SFNSDisplay.ttf",
                          "/System/Library/Fonts/Helvetica.ttc",
                          "/Library/Fonts/Arial.ttf"):
            if Path(candidate).exists():
                return ImageFont.truetype(candidate, px)
        return ImageFont.load_default(px)

    d.text((110, 980), "IREWI", font=font(210), fill=(255, 255, 255))
    d.text((110, 1200), title, font=font(78), fill=(212, 208, 255))
    d.text((110, 1300), subtitle, font=font(56), fill=(168, 162, 220))
    img.save(path, "JPEG", quality=88)


def feed_xml(series: str, cfg: dict, manifest: dict, base: str, token: str) -> str:
    # GUID se NESMÍ měnit: podle něj pozná podcastová aplikace, že epizodu už
    # má. Proto <předmět>-<řada>-<ID>, a ne id pořadu — to je u IREWI kvůli
    # zpětné kompatibilitě holé „quiz" a GUIDy by se přepsaly.
    title, desc = show_name(cfg, series)
    sid = series_id(series)
    root = f"{base}/podcast/{token}/{sid}"
    items = []
    for i, ep in enumerate(manifest["episodes"]):
        published = EPOCH + timedelta(days=i)
        url = f"{root}/{Path(ep['file']).name}"
        items.append(f"""    <item>
      <title>{escape(ep['title'])}</title>
      <description>{escape(ep['subtitle'])}</description>
      <itunes:summary>{escape(ep['subtitle'])}</itunes:summary>
      <enclosure url="{escape(url)}" length="{ep['bytes']}" type="audio/x-m4a"/>
      <guid isPermaLink="false">{ROOT.name}-{series}-{ep['lecture_id']}</guid>
      <pubDate>{format_datetime(published)}</pubDate>
      <itunes:duration>{int(round(ep['seconds']))}</itunes:duration>
      <itunes:episode>{i + 1}</itunes:episode>
      <itunes:explicit>false</itunes:explicit>
    </item>""")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{escape(title)}</title>
    <link>{escape(base)}</link>
    <atom:link href="{escape(root)}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <description>{escape(desc)}</description>
    <itunes:summary>{escape(desc)}</itunes:summary>
    <itunes:author>{AUTHOR}</itunes:author>
    <itunes:owner><itunes:name>{AUTHOR}</itunes:name></itunes:owner>
    <itunes:image href="{escape(root)}/cover.jpg"/>
    <itunes:category text="Education"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>serial</itunes:type>
    <!-- Soukromý feed: Apple ho nesmí zařadit do katalogu. -->
    <itunes:block>yes</itunes:block>
{chr(10).join(items)}
  </channel>
</rss>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://study.dmarka.eu")
    ap.add_argument("--token", required=True)
    args = ap.parse_args()

    cfg = json.loads((ROOT / "courses.json").read_text(encoding="utf-8"))
    made = 0
    for series, meta in SERIES.items():
        manifest_file = AUDIO / f"{series}.json"
        if not manifest_file.exists():
            print(f"  {series}: zatím není {manifest_file.name}, přeskakuji")
            continue
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        out_dir = AUDIO / series
        title, _ = show_name(cfg, series)
        cover(out_dir / "cover.jpg", title.split("—")[-1].strip(),
              f"{len(manifest['episodes'])} episodes", meta["colour"])
        (out_dir / "feed.xml").write_text(
            feed_xml(series, cfg, manifest, args.base.rstrip("/"), args.token),
            encoding="utf-8")
        total = sum(e["seconds"] for e in manifest["episodes"])
        print(f"  {series_id(series)}: {len(manifest['episodes'])} epizod, "
              f"{total / 3600:.1f} h → {out_dir / 'feed.xml'}")
        made += 1
    if made:
        print(f"\nadresa k odběru: {args.base.rstrip('/')}/podcast/{args.token}/<řada>/feed.xml")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
