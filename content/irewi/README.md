# IREWI StEOP — podklady ke zkoušce „Einführung in das internationale Recht“

Ze slidů dvou přednášek dělá čitelný balíček pro StudyFlow: jeden obrázek na
slide, k němu výklad vlastními slovy, glosář pojmů a kartičky.

## Zkouška, pro kterou to je

StEOP MP Einführung in das internationale Recht (IREWI, UG2002, 6 ECTS).
Písemná, **anglicky**, 60 minut = 30 min mezinárodní právo + 30 min unijní
právo. Max 60 bodů (30 + 30), prospěl při 30 bodech **a zároveň** minimálně
15 v každé půlce. Otázky jsou případové („problem questions“), u unijního
práva jeden case s otevřenými otázkami — bez vyřešení aspoň části případu se
neprojde. Proto kartičky cílí na rozlišování pojmů a použití, ne na znění
odrážek; číslo u karty je 1 zapamatovat / 2 porozumět / 3 použít.

## Stav

Hotovo: 23 přednášek, 758 slidů, 479 karet (457 jádro), z toho 76 případových.
Chybí jen Unit III a Unit IX mezinárodního práva — v Moodle exportu nejsou.

## Spuštění

```sh
./run.sh                  # všechny přednášky
./run.sh --only IL01,EU03 # vybrané
./run.sh --force          # přerenderovat i beze změny
```

Závislosti (PyMuPDF, Pillow) si stáhne `uv` sám podle hlavičky v `run.py`,
do systému se nic neinstaluje. Běh je idempotentní: přednáška se přeskočí,
když sedí hash zdrojového PDF, a **hotový výklad se nikdy nepřepíše**.

Výklad a kartičky se píšou zvlášť do `pipeline/content_<ID>.json` a vkládají
se příkazem:

```sh
uv run pipeline/merge_content.py pipeline/content_IL01.json
```

Merge kontroluje hash textu slidu — když se deck změní, obsah se do posunutého
slidu nevleze a nahlásí to.

Balíčky karet pro obrazovku Import v appce:

```sh
uv run pipeline/make_deck.py
```

Vyrobí `out/studyflow/irewi-il.json` a `irewi-eu.json` — jeden předmět na každou
půlku zkoušky, protože se hodnotí zvlášť (30 + 30 bodů, v každé minimum 15).
V appce: Import → vložit obsah souboru → Importovat.

## Co kde je

| cesta | obsah |
|---|---|
| `pipeline/courses.json` | seznam přednášek, pořadí, cesty ke zdrojovým PDF |
| `pipeline/run.py` | render + textová vrstva + výběr pro vision + kontrola |
| `pipeline/merge_content.py` | vkládání výkladu do dat |
| `pipeline/content_*.json` | napsaný výklad, glosář a kartičky |
| `raw/` | kopie zdrojových PDF (Downloads se vymazat může, tohle ne) |
| `out/img/<ID>/<ID>_sNNN.webp` | slidy jako obrázky, 150 dpi, max 1600 px |
| `out/data/<ID>.json` | manifest přednášky — to je ten balíček pro appku |
| `out/data/index.json` | seznam přednášek a postup |
| `out/work/<ID>.md` | surový text po stránkách, podklad pro psaní výkladu |
| `out/studyflow/irewi-*.json` | balíčky karet pro Import v appce |
| `out/REPORT.md` | co se zpracovalo, kde jsou mezery, co na slidech nesedí |

`out/img` má při plném rozsahu kolem 45 MB. Do gitu to zatím **nikdo
nepřidal** — rozhodni, jestli obrázky commitovat, nebo je nechat gitignorované
a nahrávat je do blob úložiště serveru (CLAUDE.md: binárky nepatří do sync
snapshotu, ten má strop 32 MB).

## Vision

Na stránku se model dívá jako na obrázek, když má málo textu, když rastrové
obrázky zabírají víc než pětinu plochy, nebo když má znatelně víc vektorových
kreseb než ostatní stránky téhož decku (schémata, tabulky, pyramidy). Práh je
relativní k mediánu dokumentu, protože každá šablona kreslí jiný počet čar.
`vision_used` v datech říká, kde se model opravdu díval — u pár slidů je
`false` i přes příznak, protože textová vrstva stačila; důvod je pak
v poli `note` a v REPORTu.
