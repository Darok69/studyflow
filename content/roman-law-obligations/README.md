# Roman Law of Obligations — UE (Uni Wien, 2026W, čtvrtky)

Učebnice Benke/Meissel, *Roman Law of Obligations*, 2. vyd. 2025 — Daniel ji nafotil
(220 fotek, iCloud `Uni Wien/IREWI/3. Semester/Roman Law of Obligations/Učebnice /`).

- `out/img/` (JPEG z HEIC) a `out/work/IMG_*.md` (přepis po dvojstranách, `PAGES.md` = rejstřík
  stran) jsou gitignorované. Přepis jsou **podrobné poznámky vlastními slovy**, ne doslovný text
  (autorské právo) — případy, citace D, latina, čísla a otázky cvičení zůstávají přesně.
- `prehled/parts/*.html` → `Roman-Law-of-Obligations-Visual.pdf` (125 stran) přes
  `content/pipeline/prehled/build.py`; `.bridge` boxy vysvětlují pojmy z property law v kontextu.
- `deck/*.json` → `uv run content/roman-law-obligations/build.py` → `out/studyflow/roman-law-obligations.json`
  → na produ `/data/materials/deck-roman-law-obligations.json` (575 karet).
  `readyBy` nastavuje build.py podle rozvrhu (ne agenti): 8.10 kap. I–II + MUTUUM · 15.10 III+IV ·
  22.10 V · 29.10 VI · **midterm 5.11** (I–VI) · 12.11 VII · 19.11 VIII–X · 26.11 XI–XII ·
  3.12 XIII–XIV · 10.12 XV–XVI · **final 17.12** = examDate.
- Učebnice nedává řešení cvičení ani zkouškových případů; karty, kde agent řešení odvodil,
  končí větou „Our application of the rules — the book gives no solution…“.
- `lessons/content_EXO*.json` = 5 lekcí, které byly omylem v předmětu Exegesis (revert 1268ca9);
  dají se použít jako výklad, kdyby předmět dostal učebnici v appce.
