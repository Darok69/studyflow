# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf"]
# ///
"""Složí vizuální přehled z HTML částí do PDF (A4 na šířku) a zkontroluje přetečení.

Každá část je HTML fragment: jedna nebo víc `<section class="page …">` stránek
(viz STYLE.md). Skript je slepí za sebou, vloží style.css, vyrenderuje headless
Chromem a u každé stránky změří, jestli text nepřetéká pod patičku.

  uv run content/pipeline/prehled/build.py OUT.pdf part1.html [part2.html …]
       [--title "Název"] [--png DIR]   # --png = náhledy stránek (70 dpi)

Návratový kód 1 = některá stránka přetéká (vypíše které).
"""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


# Měří rozložení v prohlížeči: obsah, který přesahuje patičku nebo pravý okraj
# stránky. (Text z PDF to nepozná — co .page ořízne, v PDF vůbec není.)
MEASURE = """<script>
addEventListener('load', () => {
  const res = [...document.querySelectorAll('.page')].map((p, i) => {
    const r = p.getBoundingClientRect(), f = p.querySelector('.foot');
    const limit = f ? f.getBoundingClientRect().top : r.bottom;
    let b = 0, x = 0;
    p.querySelectorAll('*').forEach(e => {
      if (f && (e === f || f.contains(e))) return;
      const q = e.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) return;
      b = Math.max(b, q.bottom); x = Math.max(x, q.right);
    });
    return [i + 1, Math.round(limit - b), Math.round(r.right - x)];
  });
  const pre = document.createElement('pre'); pre.id = 'measure';
  pre.textContent = JSON.stringify(res); document.body.appendChild(pre);
});
</script>"""


def assemble(parts: list[Path], title: str, measure: bool = False) -> str:
    css = (HERE / "style.css").read_text("utf-8")
    body = "\n".join(p.read_text("utf-8") for p in parts)
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title>'
            f"<style>\n{css}\n</style></head><body>\n{body}\n{MEASURE if measure else ''}</body></html>\n")


def measure(html: str, tmp: Path) -> list[tuple[int, int, int]]:
    """(stránka, rezerva nad patičkou px, rezerva vpravo px) změřené v DOM."""
    import json, re
    src = tmp / "measure.html"
    src.write_text(html, "utf-8")
    dom = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--virtual-time-budget=5000",
                          "--window-size=1123,794", "--dump-dom", src.as_uri()],
                         check=True, capture_output=True, text=True).stdout
    m = re.search(r'<pre id="measure">(.*?)</pre>', dom, re.S)
    return [tuple(x) for x in json.loads(m.group(1))] if m else []


def check(pdf: Path) -> list[tuple[int, int]]:
    """(stránka, rezerva v pt) — záporná rezerva = přetéká pod patičku."""
    out = []
    doc = pymupdf.open(pdf)
    for i, page in enumerate(doc):
        h = page.rect.height
        ys = [b[3] for b in page.get_text("blocks") if b[1] < h - 22]
        out.append((i + 1, round(h - 24 - max(ys)) if ys else 999))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("parts", nargs="+")
    ap.add_argument("--title", default="Visual Overview")
    ap.add_argument("--png")
    ap.add_argument("--html", help="ulož i složené HTML sem")
    a = ap.parse_args()

    html = assemble([Path(p) for p in a.parts], a.title)
    out = Path(a.out).resolve()
    with tempfile.TemporaryDirectory() as tmp:
        dom = measure(assemble([Path(p) for p in a.parts], a.title, measure=True), Path(tmp))
        src = Path(a.html).resolve() if a.html else Path(tmp) / "doc.html"
        src.write_text(html, "utf-8")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={out}", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    res = check(out)
    bad = [(n, s) for n, s in res if s < 0]
    print(f"{out.name}: {len(res)} stran · nejmenší rezerva {min(s for _, s in res)} pt")
    for n, s in bad:
        print(f"  PŘETÉKÁ strana {n} o {-s} pt")
    # DOM měření chytí i obsah oříznutý okrajem stránky (v PDF textu není vidět).
    for n, down, right in dom:
        if down < 0 or right < 0:
            bad.append((n, min(down, right)))
            print(f"  PŘETÉKÁ strana {n} (DOM): pod patičku {-down if down < 0 else 0} px, vpravo {-right if right < 0 else 0} px")
    if not dom:
        print("  (DOM měření se nepovedlo — zkontroluj náhledy ručně)")
    if a.png:
        d = Path(a.png)
        d.mkdir(parents=True, exist_ok=True)
        for i, page in enumerate(pymupdf.open(out)):
            page.get_pixmap(dpi=70).save(d / f"p{i + 1:02d}.png")
        print(f"  náhledy → {d}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
