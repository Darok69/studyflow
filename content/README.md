# Podklady k předmětům

Ze slidů přednášky dělá učebnici a kartičky pro StudyFlow: jeden obrázek na
slide, pod ním výklad vlastními slovy, glosář pojmů a otázky. Z hotového
výkladu se pak dají namluvit epizody podcastu.

Skripty jsou **společné**, předmět je **datový balík**. Balík je adresář
s `courses.json`; všechno ostatní si pipeline dogeneruje.

```sh
./run.sh                          # vypíše, jaké předměty existují
./run.sh irewi                    # render slidů + textová vrstva + REPORT
./run.sh pravni-dejiny --only PD01
./run.sh irewi merge irewi/content/content_IL01.json
./run.sh irewi materials          # balíček pro obrazovku Učebnice
./run.sh irewi deck               # balíček karet pro obrazovku Import
./run.sh irewi audio --series quiz
./run.sh irewi feed --token <token>
./run.sh irewi publish            # učebnice na produkci
./run.sh irewi upload quiz        # řada podcastu na produkci
```

Závislosti (PyMuPDF, Pillow) si stáhne `uv` sám podle hlaviček ve skriptech,
do systému se nic neinstaluje. Běh je idempotentní: přednáška se přeskočí,
když sedí hash zdrojového PDF, a **hotový výklad se nikdy nepřepíše**.

## Předměty

| balík | zkouška | stav |
|---|---|---|
| [`irewi/`](irewi/README.md) | StEOP Einführung in das internationale Recht, 5. 10. 2026 | hotovo — 758 slidů, 479 karet, podcast |
| [`pravni-dejiny/`](pravni-dejiny/README.md) | Modulprüfung European and Global Legal History, březnový termín | 724 slidů vyrenderováno, výklad se píše (1 z 23 témat) |

## Co kde je

| cesta | obsah |
|---|---|
| `pipeline/` | společné skripty (render, merge, učebnice, balíček, zvuk, feed, nahrání) |
| `<předmět>/courses.json` | zkouška, seznam přednášek, cesty ke zdrojovým PDF, mezery v podkladech |
| `<předmět>/content/content_<ID>.json` | ručně psaný výklad, glosář a kartičky |
| `<předmět>/raw/` | kopie zdrojových PDF (Stažené se vymazat můžou, tohle ne) |
| `<předmět>/out/img/<ID>/` | slidy jako obrázky, 150 dpi, max 1600 px |
| `<předmět>/out/data/<ID>.json` | manifest přednášky — slidy + vložený výklad |
| `<předmět>/out/work/<ID>.md` | surový text po stránkách, podklad pro psaní výkladu |
| `<předmět>/out/materials/` | co se nahrává na server pro obrazovku Učebnice |
| `<předmět>/out/studyflow/` | balíčky karet pro obrazovku Import |
| `<předmět>/out/REPORT.md` | co se zpracovalo, kde jsou mezery, co na slidech nesedí |

Do gitu patří jen ručně psané věci a hotová `out/data/`. Rendery, kopie PDF,
zvuk a odvozené balíčky jsou gitignorované — dají se kdykoli přegenerovat.

## Jak přidat předmět

1. `mkdir content/<předmět>` a napsat `courses.json` (vzor v `irewi/`).
   `title` přednášky je to, co se v appce stane **tématem** karet — u zkoušky
   s daným seznamem témat tam patří ta témata, ne názvy prezentací.
2. `./run.sh <předmět>` — vyrenderuje slidy a napíše `out/work/*.md`.
3. Podle `out/work/<ID>.md` napsat `content/content_<ID>.json`, vložit
   `./run.sh <předmět> merge …`.
4. `./run.sh <předmět> materials` + `deck`, pak `publish` a v appce Import.

## Vision

Na stránku se model dívá jako na obrázek, když má málo textu, když rastrové
obrázky zabírají víc než pětinu plochy, nebo když má znatelně víc vektorových
kreseb než ostatní stránky téhož decku (schémata, tabulky, pyramidy). Práh je
relativní k mediánu dokumentu, protože každá šablona kreslí jiný počet čar.
`vision_used` v datech říká, kde se model opravdu díval.
