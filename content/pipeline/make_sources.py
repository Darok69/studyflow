#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fpdf2"]
# ///
"""Přehled pramenů práva: co se v předmětu zmiňuje a v jaké souvislosti.

Zkouška je pramenná — u otevřené otázky se cení, když víš, KTERÝ ČLÁNEK
KTERÉ SMLOUVY to řeší. Tenhle skript projde hotové podklady, najde v nich
zmínky o právních nástrojích a ke každému vypíše, kde a proč padl.

Kontext je VĚTA, ve které nástroj padl, ne celý slide: přehled má sloužit
k orientaci a k rychlému opakování, ne nahradit učebnici.

Použití:  ./run.sh irewi sources
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack import pack_root  # noqa: E402

from fpdf import FPDF  # noqa: E402

ROOT = pack_root()
MATERIALS = ROOT / "out" / "materials"
DEST = ROOT / "out" / "prameny"
FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

# Nástroje se hledají podle JMÉNA, ne podle čísla článku: samotné „Article 38"
# nic neříká, dokud se neví, čeho. Pořadí v seznamu je pořadím ve výstupu.
CATALOGUE: dict[str, list[tuple[str, str]]] = {
    "IL": [
        # Dvě citace se v kurzu píšou bez názvu smlouvy, protože jsou
        # nezaměnitelné — zákaz síly a prameny práva. Bez téhle kotvy by
        # v přehledu chyběl zrovna nejznámější článek Charty.
        ("Charter of the United Nations",
         r"\bUN Charter\b|\bCharter of the United Nations\b|\bthe Charter\b"
         r"|\bArt(?:icle)?s?\.?\s*2\(4\)"),
        ("Statute of the International Court of Justice",
         r"\bICJ Statute\b|\bStatute of the (?:ICJ|International Court)\b"
         r"|\bArt(?:icle)?s?\.?\s*38\(1\)"),
        ("Vienna Convention on the Law of Treaties (VCLT, 1969)", r"\bVCLT\b|\bVienna Convention on the Law of Treaties\b"),
        ("Vienna Convention on Diplomatic Relations (1961)", r"\bVienna Convention on Diplomatic Relations\b"),
        ("ILC Articles on State Responsibility (ARSIWA, 2001)", r"\bARSIWA\b|Articles on (?:the )?Responsibility of States|Draft Articles on State Responsibility|\bstate responsibility\b"),
        ("ILC Draft Articles (further texts)", r"\bILC Draft Articles\b|\bDraft Articles\b", True),
        ("Montevideo Convention on the Rights and Duties of States (1933)", r"\bMontevideo Convention\b"),
        ("UN Convention on the Law of the Sea (UNCLOS, 1982)", r"\bUNCLOS\b|Convention on the Law of the Sea"),
        ("International Covenant on Civil and Political Rights (ICCPR)", r"\bICCPR\b|Covenant on Civil and Political Rights"),
        ("International Covenant on Economic, Social and Cultural Rights (ICESCR)", r"\bICESCR\b|Covenant on Economic, Social"),
        ("Universal Declaration of Human Rights (1948)", r"Universal Declaration"),
        ("European Convention on Human Rights (ECHR)", r"\bECHR\b|European Convention on Human Rights"),
        ("American Convention on Human Rights", r"American Convention"),
        ("African Charter on Human and Peoples' Rights", r"African Charter"),
        ("Convention against Torture (UN-CAT)", r"\bUN-?CAT\b|Convention against Torture"),
        ("Genocide Convention (1948)", r"Genocide Convention"),
        ("Geneva Conventions and Additional Protocols", r"Geneva Convention|Additional Protocol"),
        ("Rome Statute of the International Criminal Court", r"Rome Statute"),
        ("Treaty on the Non-Proliferation of Nuclear Weapons (NPT)", r"Non-Proliferation Treaty|Nuclear Non-Proliferation"),
        ("Comprehensive Nuclear-Test-Ban Treaty (CTBT)", r"Comprehensive Nuclear-Test-Ban"),
        ("Paris Agreement (2015)", r"Paris Agreement"),
        ("Liability Convention (space, 1972)", r"Liability Convention"),
        ("Friendly Relations Declaration (GA Res. 2625)", r"Friendly Relations Declaration|Resolution 2625|Res\. 2625"),
        ("Austrian State Treaty (1955)", r"Austrian State Treaty"),
        ("Unilateral declarations (Ihlen, Maroua, Yaoundé II, Claims Settlement)", r"Ihlen Declaration|Maroua Declaration|Yaound[eé] II|Claims Settlement Declaration"),
        ("GATT / WTO agreements", r"\bGATT\b|\bWTO\b"),
    ],
    "EU": [
        ("Treaty on European Union (TEU)", r"\bTEU\b|Treaty on European Union"),
        ("Treaty on the Functioning of the European Union (TFEU)", r"\bTFEU\b|Treaty on the Functioning"),
        ("Charter of Fundamental Rights of the EU", r"Charter of Fundamental Rights|\bthe Charter\b"),
        ("Statute of the Court of Justice", r"(?-i:Statute) of the Court|Article \d+ of the (?-i:Statute)"),
        ("Rules of Procedure of the Court", r"Rules of\s+Procedure"),
        ("Treaty establishing the ECSC (Paris, 1951)", r"\bECSC Treaty\b|Treaty establishing the European Coal"),
        ("Treaty establishing the EEC (Rome, 1957)", r"\bEEC Treaty\b|Treaty of Rome"),
        ("Single European Act (1986)", r"Single European Act"),
        ("Maastricht Treaty (1992)", r"Maastricht Treaty|Treaty of Maastricht"),
        ("Treaty of Amsterdam / Treaty of Nice", r"Treaty of Amsterdam|Treaty of Nice"),
        ("Treaty establishing a Constitution for Europe (2004)", r"Constitutional Treaty|Constitution for Europe"),
        ("Treaty of Lisbon (2007)", r"Lisbon Treaty|Treaty of Lisbon"),
        ("Comitology Regulation 182/2011", r"comitology regulation|Regulation 182/2011"),
        ("Technical standards directive (notification)", r"technical standards directive"),
        ("GDPR", r"\bGDPR\b"),
        ("Antitrust Damages Directive", r"Antitrust Damages"),
        ("Digital Markets Act", r"Digital Markets Act"),
        ("European Convention on Human Rights (ECHR)", r"\bECHR\b|European Convention on Human Rights"),
    ],
}

# Číslo článku a nic víc. Původní vzorec bral i následující slova, takže
# přehled článků u TEU vypadal jako věta s ulomenými konci.
ART = re.compile(r"\bArts?\.?\s*(\d+(?:\(\d+\))*(?:\([a-z]\))?)|\bArticles?\s+(\d+(?:\(\d+\))*(?:\([a-z]\))?)")


def art_key(a: str) -> tuple[int, str]:
    m = re.match(r"(\d+)", a)
    return (int(m.group(1)) if m else 0, a)
SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z„'(])")


# Smlouvy, jejichž číslování se plete a kde se špatný článek pozná u zkoušky:
# u nich se článek uzná JEN se značkou hned za číslem.
STRICT = (r"\bTEU\b|Treaty on European Union",
          r"\bTFEU\b|Treaty on the Functioning")


def articles_for(sent: str, rx: re.Pattern, all_rx: list[re.Pattern]) -> list[str]:
    """Články, které v té větě patří PRÁVĚ tomuhle nástroji.

    Anglická citace píše značku ZA číslo („Article 13(1) TEU", „Article 103
    of the UN Charter"). Pokud tak ve větě stojí aspoň jeden článek, cituje
    se v ní přesně a berou se JEN tyhle připojené — věta „Article 31(2) …
    and Article 31(3) …, with Article 103 of the UN Charter given as the
    example" jinak přidá Chartě dva články z Vídeňské úmluvy. Teprve když
    žádný článek značku nemá a věta mluví o jediném nástroji, patří mu
    všechny — tím se udrží „the prohibition in Article 2(4)", kde už se
    Charta znovu nejmenuje. Dvojice TEU × TFEU nemá tuhle úlevu nikdy:
    jejich číslování se plete a špatný článek se pozná u zkoušky.
    """
    pool = all_rx if any(r.pattern == rx.pattern for r in all_rx) else [*all_rx, rx]
    marks = sorted((m.start(), r.pattern) for r in pool for m in r.finditer(sent))
    arts = list(ART.finditer(sent))

    attached: set[str] = set()
    labelled = False
    for m in arts:
        after = [mk for mk in marks if mk[0] >= m.end() and mk[0] - m.end() <= 25]
        if not after:
            continue
        labelled = True
        if after[0][1] == rx.pattern:
            attached.add(m.group(1) or m.group(2))

    alone = len({pat for _, pat in marks}) == 1 and rx.pattern not in STRICT
    if not labelled and alone:
        return sorted({m.group(1) or m.group(2) for m in arts}, key=art_key)
    return sorted(attached, key=art_key)



def sentences(text: str) -> list[str]:
    return [s.strip() for s in SENT.split(text or "") if s.strip()]


# Jmenované směrnice a nařízení se nesbírají do jednoho pytle: každý předpis
# dostane vlastní oddíl pojmenovaný tím, co v textu skutečně stojí.
NAMED = re.compile(r"\b((?:Directive|Regulation)\s*(?:\(E[UC]\)\s*)?(?:No\.?\s*)?\d+/\d+)", re.I)


def corpus(course):
    """Věty podkladů kurzu v pořadí přednášek, každá se svým místem."""
    for lec in course["lectures"]:
        data = json.loads((MATERIALS / f"{lec['id']}.json").read_text(encoding="utf-8"))
        for slide in data["slides"]:
            pieces = [slide.get("text") or ""]
            pieces += [f"{c['q']} {c['a']}" for c in (slide.get("cards") or [])]
            for piece in pieces:
                for sent in sentences(piece):
                    yield {
                        "lecture": lec["id"],
                        "unit": lec.get("unit", ""),
                        "title": slide.get("title") or "",
                        "n": slide["n"],
                        "sentence": sent,
                    }


def collect(course_code: str) -> list[tuple[str, list[dict]]]:
    index = json.loads((MATERIALS / "index.json").read_text(encoding="utf-8"))
    course = next(c for c in index["courses"] if c["code"] == course_code)
    items = list(corpus(course))
    all_rx = [re.compile(e[1], re.I) for e in CATALOGUE[course_code]]

    # Jedna věta patří JEDNOMU nástroji — tomu nejkonkrétnějšímu, který ji
    # zabere jako první. Jinak by se ARSIWA opakovala pod obecnými „Draft
    # Articles" a čtenář by nevěděl, který oddíl je ten pravý.
    # Věta smí být pod VÍCE nástroji — je-li v ní TEU i TFEU, patří k oběma;
    # jinak by věta o čtyřech smlouvách zmizela u tří z nich. Výjimkou jsou
    # ZÁLOŽNÍ skupiny (třetí prvek True): obecné „Draft Articles" berou jen
    # to, co si nevzal žádný konkrétní nástroj, aby se ARSIWA neopakovala.
    claimed: set[str] = set()
    out: list[tuple[str, list[dict]]] = []
    fallbacks: list[tuple[str, re.Pattern]] = []

    for entry in CATALOGUE[course_code]:
        name, pattern = entry[0], entry[1]
        rx = re.compile(pattern, re.I)
        if len(entry) > 2 and entry[2]:
            fallbacks.append((name, rx))
            continue
        hits, seen = [], set()
        for item in items:
            key = item["sentence"][:90].lower()
            if key in seen or not rx.search(item["sentence"]):
                continue
            seen.add(key)
            hits.append(dict(item, articles=articles_for(item["sentence"], rx, all_rx)))
        if hits:
            claimed |= seen
            out.append((name, hits))

    for name, rx in fallbacks:
        hits, seen = [], set()
        for item in items:
            key = item["sentence"][:90].lower()
            if key in claimed or key in seen or not rx.search(item["sentence"]):
                continue
            seen.add(key)
            hits.append(dict(item, articles=articles_for(item["sentence"], rx, all_rx)))
        if hits:
            claimed |= seen
            out.append((name, hits))

    # Jmenované předpisy, které nemají vlastní řádek v katalogu.
    covered = " ".join(n for n, _ in out).lower()
    named: dict[str, list[dict]] = {}
    for item in items:
        for m in NAMED.findall(item["sentence"]):
            label = re.sub(r"\s+", " ", m).strip().title().replace("Eu", "EU").replace("Ec", "EC")
            if label.lower() in covered:
                continue
            named.setdefault(label, []).append(item)

    for label in sorted(named):
        hits, seen = [], set()
        rx = re.compile(re.escape(label), re.I)
        for item in named[label]:
            key = item["sentence"][:90].lower()
            if key in seen:
                continue
            seen.add(key)
            hits.append(dict(item, articles=articles_for(item["sentence"], rx, all_rx)))
        out.append((label, hits))
    return out


class Doc(FPDF):
    def __init__(self, heading: str):
        super().__init__(format="A4")
        self.heading = heading
        self.set_auto_page_break(True, margin=18)
        self.add_font("A", "", FONT)
        self.add_font("A", "B", "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
        self.set_margins(18, 16, 18)

    def footer(self):
        self.set_y(-14)
        self.set_font("A", size=8)
        self.set_text_color(130)
        self.cell(0, 6, f"{self.heading}  ·  {self.page_no()}", align="C")
        self.set_text_color(0)

def plural(n: int, one: str, few: str, many: str) -> str:
    """Česká trojice tvarů: 1 článek, 2 články, 5 článků."""
    return f"{n} {one if n == 1 else few if 2 <= n <= 4 else many}"


def where(doc, h) -> None:
    """Jedna zmínka: kde padla a čeho se týká."""
    doc.set_font("A", "B", 8.5)
    doc.set_text_color(70)
    doc.multi_cell(0, 4.2, f"{h['lecture']} · slide {h['n']} · {h['title']}",
                   new_x="LMARGIN", new_y="NEXT")
    doc.set_text_color(0)
    doc.set_font("A", size=9.5)
    doc.multi_cell(0, 4.8, h["sentence"], new_x="LMARGIN", new_y="NEXT")
    doc.ln(1.4)


def render(course_code: str, heading: str, subtitle: str, groups) -> Path:
    doc = Doc(heading)
    doc.add_page()
    doc.set_font("A", "B", 19)
    doc.multi_cell(0, 9, heading, new_x="LMARGIN", new_y="NEXT")
    doc.ln(1)
    doc.set_font("A", size=10)
    doc.set_text_color(90)
    doc.multi_cell(0, 5, subtitle, new_x="LMARGIN", new_y="NEXT")
    doc.set_text_color(0)
    doc.ln(5)

    # obsah
    doc.set_font("A", "B", 11)
    doc.cell(0, 6, "Obsah", new_x="LMARGIN", new_y="NEXT")
    doc.set_font("A", size=9)
    for i, (name, hits) in enumerate(groups, 1):
        arts = len({a for h in hits for a in h["articles"]})
        tail = (f"({plural(arts, 'článek', 'články', 'článků')} · "
                f"{plural(len(hits), 'zmínka', 'zmínky', 'zmínek')})") if arts \
            else f"({plural(len(hits), 'zmínka', 'zmínky', 'zmínek')})"
        doc.cell(0, 4.6, f"{i}.  {name}  {tail}", new_x="LMARGIN", new_y="NEXT")
    doc.ln(4)

    for i, (name, hits) in enumerate(groups, 1):
        if doc.get_y() > 240:
            doc.add_page()
        doc.set_font("A", "B", 12)
        doc.multi_cell(0, 6, f"{i}.  {name}", new_x="LMARGIN", new_y="NEXT")
        doc.ln(1)

        # Uvnitř smlouvy se řadí PODLE ČLÁNKU, ne podle přednášky: u otevřené
        # zkoušky se hledá „který článek co řeší", takže článek musí být
        # nadpisem a přednáška se slidem až údajem pod ním.
        by_art: dict[str, list[dict]] = {}
        loose: list[dict] = []
        for h in hits:
            if h["articles"]:
                for a in h["articles"]:
                    by_art.setdefault(a, []).append(h)
            else:
                loose.append(h)

        for art in sorted(by_art, key=art_key):
            if doc.get_y() > 252:
                doc.add_page()
            doc.set_font("A", "B", 10)
            doc.multi_cell(0, 5, f"Art. {art}", new_x="LMARGIN", new_y="NEXT")
            for h in by_art[art]:
                where(doc, h)
        if loose:
            if doc.get_y() > 252:
                doc.add_page()
            doc.set_font("A", "B", 10)
            doc.set_text_color(110)
            doc.multi_cell(0, 5, "Bez určitého článku", new_x="LMARGIN", new_y="NEXT")
            doc.set_text_color(0)
            for h in loose:
                where(doc, h)
        doc.ln(3)

    DEST.mkdir(parents=True, exist_ok=True)
    path = DEST / f"{course_code}-prameny.pdf"
    doc.output(str(path))
    return path


def main() -> int:
    plan = [
        ("IL", "Mezinárodní právo — prameny a kde se objevily",
         "Právní nástroje zmíněné v přednáškách Foundations of International Law (IREWI, 030721), "
         "řazené podle smlouvy a uvnitř ní podle ČLÁNKU: u každého článku je, na kterém slidu padl "
         "a čeho se týkal. Zkouška je otevřená a pramenná, takže se cení vědět, KTERÝ ČLÁNEK KTERÉ "
         "SMLOUVY věc řeší. Citace jsou z podkladů kurzu, ne z úředního znění — před zkouškou si "
         "zásadní články ověř v textu smlouvy."),
        ("EU", "Unijní právo — prameny a kde se objevily",
         "Právní nástroje zmíněné v přednáškách Introduction to EU Law (IREWI), řazené podle smlouvy "
         "a uvnitř ní podle ČLÁNKU: u každého článku je, na kterém slidu padl a čeho se týkal. Pozor "
         "na dvojici TEU × TFEU: u otevřené otázky se pozná, kdo si je plete. Citace jsou z podkladů "
         "kurzu, ne z úředního znění."),
    ]
    for code, heading, subtitle in plan:
        groups = collect(code)
        path = render(code, heading, subtitle, groups)
        total = sum(len(h) for _, h in groups)
        print(f"  {code}: {len(groups)} nástrojů, {total} zmínek → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
