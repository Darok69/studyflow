#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pypdf"]
# ///
"""Stáhne úřední znění smluv a vytáhne z něj texty článků.

Seznam článků v PDF pramenů je bez jejich obsahu k ničemu — „Art. 2(4)" si
u zkoušky nikdo nevybaví. Tenhle skript proto jednou stáhne oficiální texty
(EUR-Lex, un.org, ICJ, ILC, ECHR, UNTS) a uloží je do prameny/articles.json,
odkud si je make_sources.py bere při sazbě.

Stažené soubory se kešují v out/prameny/cache, takže druhý běh nic netahá.
Zdroj je u každé smlouvy zapsaný v JSONu a vytiskne se do PDF — u zkoušky
musí být poznat, odkud znění je.

Použití:  ./run.sh irewi articles        (znovu stáhnout: --refresh)
"""

from __future__ import annotations

import html
import json
from html.parser import HTMLParser
import re
import sys
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

ROOT = pack_root()
CACHE = ROOT / "out" / "prameny" / "cache"
DEST = ROOT / "prameny" / "articles.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
EURLEX = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:"

# Jméno musí sedět na název skupiny v make_sources.CATALOGUE, jinak se text
# k článku nespáruje. `body` ořízne přílohy a protokoly, které mají vlastní
# číslování článků a jinak by přepsaly ta pravá.
SOURCES = [
    # (jméno skupiny, url, formát, popis zdroje, ořez těla)
    ("Treaty on European Union (TEU)", EURLEX + "12016M/TXT", "html",
     "EUR-Lex, konsolidované znění (12016M/TXT)", ("TITLE I", "PROTOCOLS", 1)),
    ("Treaty on the Functioning of the European Union (TFEU)", EURLEX + "12016E/TXT", "html",
     "EUR-Lex, konsolidované znění (12016E/TXT)", ("PART ONE", "PROTOCOLS", 1)),
    ("Charter of Fundamental Rights of the EU", EURLEX + "12016P/TXT", "html",
     "EUR-Lex (12016P/TXT)", None),
    ("Statute of the Court of Justice", EURLEX + "12016E/PRO/03", "html",
     "EUR-Lex, Protokol č. 3 (12016E/PRO/03)", None),
    ("Charter of the United Nations", "https://www.un.org/en/about-us/un-charter/full-text", "html",
     "un.org, plné znění Charty OSN", None),
    ("Statute of the International Court of Justice", "https://www.icj-cij.org/statute", "html",
     "icj-cij.org, Statut MSD", None),
    ("Vienna Convention on the Law of Treaties (VCLT, 1969)",
     "https://legal.un.org/ilc/texts/instruments/english/conventions/1_1_1969.pdf", "pdf",
     "legal.un.org (ILC), Vídeňská úmluva 1969", None),
    ("ILC Articles on State Responsibility (ARSIWA, 2001)",
     "https://legal.un.org/ilc/texts/instruments/english/draft_articles/9_6_2001.pdf", "pdf",
     "legal.un.org (ILC), návrh článků 2001", None),
    ("European Convention on Human Rights (ECHR)",
     "https://www.echr.coe.int/documents/d/echr/convention_ENG", "pdf",
     "echr.coe.int, znění Úmluvy", None),
    ("Rome Statute of the International Criminal Court",
     "https://treaties.un.org/doc/Treaties/1998/07/19980717%2006-33%20PM/"
     "volume-2187-I-38544-English.pdf", "pdf",
     "treaties.un.org, UNTS sv. 2187", None),
    ("Montevideo Convention on the Rights and Duties of States (1933)",
     "https://www.jus.uio.no/english/services/library/treaties/01/1-02/rights-duties-states.html",
     "html", "jus.uio.no, znění Montevidejské úmluvy", None),
]

ART_HEAD = re.compile(r"^Articles?\s+(\d+)\s*[.:]?\s*$", re.I)   # ECHR sází „ARTICLE 6"
# U textů z PDF stojí nadpis a název článku na jednom řádku („Article 86. General…").
ART_INLINE = re.compile(r"^Article\s+(\d+)\s*[.．]\s", re.I)


def download(url: str, kind: str) -> Path:
    name = re.sub(r"\W+", "_", url)[-80:] + ("." + kind)
    path = CACHE / name
    if path.exists() and path.stat().st_size > 2000:
        return path
    CACHE.mkdir(parents=True, exist_ok=True)
    # Přes curl, ne urllib: legal.un.org má v cestě certifikát, který Pythonu
    # nesedí, a echr.coe.int bez prohlížečové hlavičky vrací 403.
    subprocess.run(["curl", "-sL", "--max-time", "90", "-A", UA, url, "-o", str(path)],
                   check=True)
    if path.stat().st_size < 2000:
        path.unlink(missing_ok=True)
        raise RuntimeError("zdroj vrátil skoro prázdnou odpověď")
    return path


class Lists(HTMLParser):
    """HTML na text se zachovaným číslováním seznamů.

    Odstavce článků jsou na un.org i v EUR-Lexu <li> v <ol> — číslo dělá CSS,
    v textu není. Bez něj nelze vytáhnout „čl. 1 odst. 2", proto se čísla
    dopisují tady: první úroveň 1., 2., vnořená (a), (b).
    """

    BLOCK = {"p", "div", "br", "tr", "table", "h1", "h2", "h3", "h4", "li", "ol", "ul"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.counters: list[int] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("ol", "ul"):
            self.counters.append(0)
        elif tag == "li" and self.counters:
            self.counters[-1] += 1
            n = self.counters[-1]
            mark = f"{n}. " if len(self.counters) == 1 else f"({chr(96 + n)}) "
            self.out.append("\n" + mark)
            return
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("ol", "ul") and self.counters:
            self.counters.pop()
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        self.out.append(data)


def to_lines(path: Path, kind: str) -> list[str]:
    if kind == "pdf":
        from pypdf import PdfReader
        text = "\n".join((p.extract_text() or "") for p in PdfReader(str(path)).pages)
    else:
        raw = path.read_text(encoding="utf-8", errors="replace")
        raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
        parser = Lists()
        parser.feed(raw)
        text = html.unescape("".join(parser.out))
    text = re.sub(r"[ \t]+", " ", text)
    return [l.strip() for l in text.split("\n") if l.strip()]


def trim(lines: list[str], body) -> list[str]:
    """Ořízne na vlastní tělo smlouvy; protokoly mají svoje Article 1."""
    if not body:
        return lines
    start_mark, end_mark, skip = body
    starts = [i for i, l in enumerate(lines) if l == start_mark]
    ends = [i for i, l in enumerate(lines) if l == end_mark]
    if len(starts) <= skip:
        return lines
    s = starts[skip]
    e = next((i for i in ends if i > s), len(lines))
    return lines[s:e]


def articles(lines: list[str]) -> dict[str, str]:
    out: dict[str, list[str]] = {}
    cur = None
    for line in lines:
        m = ART_HEAD.match(line)
        if m:
            cur = m.group(1)
            out.setdefault(cur, [])
            continue
        m = ART_INLINE.match(line)
        if m:
            cur = m.group(1)
            out.setdefault(cur, [])
            out[cur].append(line[m.end():])
            continue
        if cur and not re.fullmatch(r"(TITLE|CHAPTER|SECTION|PART|ANNEX)\b.*", line):
            out[cur].append(line)
    return {k: clean(" ".join(v)) for k, v in out.items() if " ".join(v).strip()}


# Výtah z PDF rozlamuje slova v místech, kde měl font ligaturu nebo kerning.
SPLITS = [(re.compile(rf"\b{a}\b"), b) for a, b in (
    ("an d", "and"), ("with out", "without"), ("th e", "the"), ("o f", "of"),
    ("i n", "in"), ("t o", "to"), ("OBSERV ANCE", "OBSERVANCE"),
)]


def clean(text: str) -> str:
    for rx, repl in SPLITS:
        text = rx.sub(repl, text)
    text = re.sub(r"\s*\[\s*\d+\s*\]\s*", " ", text)   # čísla stránek z PDF
    return re.sub(r"\s{2,}", " ", text).strip()


def main() -> int:
    refresh = "--refresh" in sys.argv
    if refresh and CACHE.exists():
        for f in CACHE.iterdir():
            f.unlink()
    data: dict[str, dict] = {}
    for name, url, kind, label, body in SOURCES:
        try:
            path = download(url, kind)
            arts = articles(trim(to_lines(path, kind), body))
        except Exception as exc:                                  # noqa: BLE001
            print(f"  {name}: nestaženo ({exc})", file=sys.stderr)
            continue
        if not arts:
            print(f"  {name}: zdroj nemá rozpoznatelné články", file=sys.stderr)
            continue
        data[name] = {"source": label, "articles": arts}
        print(f"  {name}: {len(arts)} článků")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"→ {DEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
