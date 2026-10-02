# IREWI StEOP — podklady ke zkoušce „Einführung in das internationale Recht“

Ze slidů dvou přednášek dělá čitelný balíček pro StudyFlow: jeden obrázek na
slide, k němu výklad vlastními slovy, glosář pojmů a kartičky.

Skripty jsou společné pro všechny předměty a leží v `content/pipeline/`;
tenhle adresář je jen data. Obecný popis je v [../README.md](../README.md).

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

**Kompaktní verze (2026-10-02, platná)**: `exam-kompakt/{il,eu}.json` — 99 + 233 karet
(všechny podotázky skutečných zkoušek + 20 doplňků na kurz; EU navíc otázky ke každé
kapitole ve stylu „3.6 Questions" ze slidu přednášející a 6 celých case exercises), odpověď v délce, jakou
člověk stihne napsat (≤ 25 slov × body + 15), první řádek závěr, pak „• pravidlo +
přesný článek → fakta". Priorita 1/2/3 (P1 = musíš umět na 100 %, ~39 %), podle
ní appka dávkuje nové karty. Když `exam-kompakt/` existuje, `make_deck` staví
zkouškový balíček z něj (`updates` s novou odpovědí + `prune`).

**Zkouškové otázky (plná verze, archiv)** — samostatné předměty „IREWI — zkouška: mezinárodní
právo" (336 karet) a „… unijní právo" (285), `courses.json` → `exam_subject`.
Tři vrstvy témat:
1. `exam/papers/*.json` — skutečné zkoušky po podotázkách v pořadí papíru
   (IL: 5/2025, 6/2025, 1/2026, 3/2026 + 2/2024, 3/2024, 4/2024, 6/2024;
   EU: sady A–E ze studocu), otázka začíná `[Jan 2026 · Q1(a)]`;
   `exact` = odkaz na kartu z oblasti, `new` = věrná karta jen pro papír,
2. `exam/mocks/*.json` — 4 + 4 modelové 30bodové zkoušky,
3. `exam/*.json` — procvičování po oblastech (co není v papíru).
Všechno prošlo nezávislým ověřením + skeptickým rozhodčím. Odpověď začíná
`Short answer:`, u IL končí `Memorise:` (bez kodexu), u EU `Codex:`.
Balíčky přednášek nesou `remove: [{tag: zkouska}]` (dřív se do nich otázky
přimíchaly), zkouškové `updates` (přejmenování na `[termín · Qx]` se
zachovanou historií).

Podcast: obě řady namluvené (23 + 23 epizod, 3,2 h a 4,3 h).

## Zvláštnosti tohoto předmětu

- **Dva balíčky karet**, `irewi-il.json` a `irewi-eu.json` — zkouška se
  známkuje po půlkách a v každé je vlastní minimum, takže je potřeba vidět,
  jak která stojí zvlášť.
- **Řady podcastu se jmenují `quiz` a `narration` bez prefixu.** Jsou starší
  než ostatní předměty a adresa je zapsaná v odběru v podcastové aplikaci.
  Nepřejmenovávat — ostatní předměty mají prefix (`pravni-dejiny-quiz`).
- **IL02 je handout** — 18 stránek po 4 slidech a textová vrstva PDF
  neodpovídá vykreslenému obsahu, takže se čte výhradně z obrázků
  (`text_layer: "broken"` v `courses.json`).
