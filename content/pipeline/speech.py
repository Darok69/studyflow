"""Převod psaného textu do podoby, kterou má smysl poslouchat.

Text v materiálech je psaný pro OKO: zkratky, odkazy na článek v závorce,
paragrafy. Hlasová syntéza to čte doslova, takže „Art. 13(1) TEU" vyjde jako
„art třináct jedna T E U". Tenhle modul je jediné místo, kde se řeší, jak se
co vyslovuje — pipeline i testy sahají sem, ne do vlastních regulárů.

POZOR: `say` má vlastní řídicí příkazy v hranatých dvojzávorkách ([[slnc 500]]).
Kdyby se dvojzávorka objevila ve zdrojovém textu, mluvila by do výsledku.
Proto se ze vstupu vždycky odstraní — viz strip_commands().
"""

from __future__ import annotations

import re

# Zkratky, které se v psaném textu čtou očima, ale nahlas se říkají celé.
ABBREV = [
    (r"\bArt\.\s*", "Article "),
    (r"\bArts\.\s*", "Articles "),
    (r"\bpara\.\s*", "paragraph "),
    (r"\bparas\.\s*", "paragraphs "),
    (r"\bch\.\s*", "chapter "),
    (r"\bNo\.\s*", "number "),
    (r"\bpp\.\s*", "pages "),
    (r"\bp\.\s*(?=\d)", "page "),
    (r"\be\.g\.,?\s*", "for example, "),
    (r"\bi\.e\.,?\s*", "that is, "),
    (r"\bcf\.\s*", "compare "),
    (r"\betc\.", "and so on."),
    (r"\bvs\.\s*", "versus "),
    (r"\bibid\.", "the same source"),
    (r"§§\s*", "sections "),
    (r"§\s*", "section "),
]

# Číslovaná ustanovení: 13(1)(a) se nahlas říká „13, paragraph 1, subparagraph a".
_PROVISION = re.compile(r"(\d+)\((\d+)\)(?:\(([a-z])\))?")
_LETTER_ONLY = re.compile(r"(?<=\bparagraph )\(([a-z])\)")


def strip_commands(text: str) -> str:
    """Zneškodní řídicí příkazy syntézy, které by přišly ze zdrojového textu."""
    return text.replace("[[", "").replace("]]", "")


def _provisions(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        out = f"{m.group(1)}, paragraph {m.group(2)}"
        if m.group(3):
            out += f", subparagraph {m.group(3)}"
        return out

    text = _PROVISION.sub(repl, text)
    # „Paragraph (a)" na začátku odpovědi — závorka kolem samotného písmene.
    return re.sub(r"\b([Pp]aragraph|[Ss]ubparagraph)\s*\(([a-z])\)", r"\1 \2", text)


def for_speech(text: str) -> str:
    """Jedna věta textu připravená k předání syntéze."""
    out = strip_commands(text)
    for pattern, replacement in ABBREV:
        out = re.sub(pattern, replacement, out)
    out = _provisions(out)
    # Uvozovky: nejdřív zahodit celé PÁRY, teprve pak zbylý ’ jako apostrof.
    # Opačné pořadí nechá za slovem viset apostrof („subsidiary means'").
    out = re.sub(r"[‘']([^‘’']{1,80})[’']", r"\1", out)
    out = re.sub(r"[“”]([^“”]{1,200})[“”]", r"\1", out)
    out = out.replace("‘", "").replace("“", "").replace("”", "").replace("’", "'")
    out = out.replace("—", ", ").replace(" -- ", ", ")
    # Odrážky a zalomení uvnitř odstavce.
    out = re.sub(r"\s*\n\s*", " ", out)
    out = re.sub(r"\s{2,}", " ", out)
    # Náhrada pomlčky čárkou umí vyrobit „slovo , slovo" a dvojitou čárku.
    out = re.sub(r"\s+([,.;:!?])", r"\1", out)
    out = re.sub(r",\s*,", ",", out)
    return out.strip()


def pause(ms: int) -> str:
    """Ticho v délce ms. Pauza je to jediné, čím se v audiu dá „otočit kartu"."""
    return f"[[slnc {int(ms)}]]"
