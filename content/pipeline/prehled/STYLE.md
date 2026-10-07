# Vizuální přehled (PDF) — pravidla pro psaní stránek

Vzor, který Daniel schválil („je to bomba“):
`content/roman-property-law/prehled/roman-property-overview.html`.
Přečti ho celý, než začneš psát. Stejný jazyk, stejné komponenty, stejná hustota.

## Formát
- A4 na šířku, **pevná velikost stránky** (297 × 210 mm). Co se nevejde, se ořízne →
  každá stránka se MUSÍ vejít. Kontroluje to `build.py` (níže).
- Část = HTML fragment, jen `<section class="page …">…</section>` za sebou (bez `<html>`,
  `<head>`, `<style>`). Styl je v `style.css`, nepiš inline `<style>` bloky.
- Kostra stránky:
```html
<section class="page c2" style="--c:var(--own)">
  <div class="hd"><span class="tag">Topic 7</span><h1>Krátký nadpis — max. 1 řádek</h1>
    <div class="meta">pomocný řádek<br>druhý řádek</div></div>
  … obsah …
  <div class="foot"><span>Název stránky</span><span class="pn"></span></div>
</section>
```
  Číslo stránky doplní CSS (`.pn`). Do textu nepiš čísla stránek PDF — odkazuj na
  téma/kapitolu: `<span class="link">→ Topic 9</span>` nebo `<span class="link">→ Ch. VIII</span>`.

## Barvy
`.c1`–`.c8` na `<section>` (nebo na boxu) nastaví barvu tématu: c1 teal, c2 modrá, c3 fialová,
c4 zelená, c5 červená, c6 okrová, c7 růžová, c8 tmavá (metoda/přehled). Na `<section>` dej
k třídě i `style="--c:var(--…)"` jako ve vzoru (pos/own/usu/nat/pro/ser/pig/exg = c1…c8).

## Komponenty (všechny jsou ve vzoru)
- `.g .g2/.g3/.g4/.g21/.g12/.g32/.g23` mřížky, `.col` sloupec.
- `.box` (rámeček s barevným levým okrajem), `.box.f` (podbarvený), `h3` uvnitř.
- `.flow` + `.arr` (➜) = proces / příčina → následek. `.down` = šipka dolů.
- `.tree` + `.node` + `.kids` = strom (dělení pojmů).
- `.gates` + `.gate` + `.n` = podmínky, které musí platit všechny.
- `table` (`th` v barvě tématu, `td.h` = zvýrazněný první sloupec) = srovnání.
- `.case` (čárkovaný) = případ / pramen / úryvek s výsledkem.
- `.mx` = latinská/dobová formule kurzívou, `.L` = odborný termín kapitálkami.
- `.exq` = „Exam: … — ask“ otázky, které si položit (u každého tématu jedna).
- `.tl` + `.st` = vodorovná časová osa; `.vt` + `.ev` + `b.y` = svislá časová osa:
  `<div class="vt"><div class="ev"><b class="y">1648</b> Peace of Westphalia</div></div>`
- `.src` = citace pramene (kurzíva, šedý okraj) + `<span class="who">Autor, rok</span>`.
- `.yes` / `.no` zelené/červené zvýraznění výsledku. `.small` = menší text.

## Obsah
- Cíl: **přehled, ve kterém si věci spojí i vizuálně** — schéma, strom, tabulka, osa, ne
  odstavce. Každá stránka má aspoň jeden vizuální prvek. Text v odrážkách, krátké věty.
- **Jen fakta z podkladů**, nic nevymýšlej. Když si nejsi jistý, vynech.
- Anglicky (zkoušky jsou anglicky); odborné termíny a latina jak v podkladu.
- Hustota jako vzor: stránka nesmí přetékat, ale ani být z půlky prázdná.

## Kontrola (povinná)
```
uv run content/pipeline/prehled/build.py /tmp/…/part.pdf <tvoje-cast>.html --png /tmp/…/png
```
Spouštěj z `/Users/danielmarek/studyflow`. Headless Chrome může potřebovat vypnutý sandbox.
Exit 1 = přetéká (vypíše stránky) → zkrať nebo rozděl stránku. Pak si **prohlédni náhledy**
(nástroj Read na PNG): nic nepřekrývá, tabulky nejsou zmačkané, nadpis na jeden řádek.
