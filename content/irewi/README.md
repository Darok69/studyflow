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
