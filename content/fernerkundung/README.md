# Bildverarbeitung und Fernerkundung — podklady ke zkoušce VO 290234

Ze slidů jedenácti přednášek dělá čitelný balíček pro StudyFlow: jeden obrázek
na slide, k němu výklad vlastními slovy, glosář pojmů a kartičky.

Skripty jsou společné pro všechny předměty a leží v `content/pipeline/`;
tenhle adresář je jen data. Obecný popis je v [../README.md](../README.md).

## Zkouška, pro kterou to je

VO 290234 Bildverarbeitung und Fernerkundung (Universität Wien, Institut für
Geographie und Regionalforschung, Oliver Rehberger). Digitální test v Moodlu,
**německy**, píše se na místě v GIS-Laboru (1. patro NIG).

- 15× single choice (právě 1 správná ze 3) po 1 bodu
- 15× multiple choice (aspoň 1 správná ze 4, **částečné body**) po 2 bodech
- dohromady **45 bodů**, čtyři termíny za rok (konec června, říjen, leden, březen)
- Notenschlüssel: < 23 = 5 · ≥ 23 = 4 · ≥ 28,5 = 3 · ≥ 34 = 2 · ≥ 39,5 = 1

Dvě třetiny bodů (30 ze 45) jsou v multiple choice, kde se u každé ze čtyř
možností rozhoduje zvlášť pravda/nepravda. Proto karty cílí na **rozlišení
pojmů**, ne na odříkání odrážek — `rozliseni` je nejčastější druh karty
(136 z 349). Číslo u karty je 1 zapamatovat / 2 porozumět / 3 použít.

Moodle k rozsahu říká výslovně: „Für die Prüfung sind sämtliche Inhalte der
Folien relevant.“ Seznam `Terminologie Vorlesungseinheiten` je **doporučená,
ne povinná** příprava — je to ale dobrá kostra a všech 49 pojmů z něj balíček
pokrývá definicí i kartou.

## Stav

Hotovo: 11 přednášek, 599 slidů, 349 karet (338 jádro). Do učebnice jde 464
slidů — zbylých 135 jsou titulky, kontakty, seznamy zdrojů a screenshoty
softwaru bez vlastního obsahu.

`examDate` v `courses.json` je zatím `null` — doplnit, až bude známý termín.

## Zvláštnosti tohoto předmětu

- **Slidy jsou handout se třemi slidy na stránku a linkami na poznámky vpravo.**
  Rovnoměrná mřížka na ně nesedí: rozteč slidů je 244 pt, třetina A4 je 281 pt,
  takže ořez po třetinách uřízne titulek a nechá půl stránky prázdného papíru.
  Proto má každá přednáška v `courses.json` `"nup": [1, 3]` a `"cells": "frames"`
  — pipeline si najde nakreslený rámeček slidu a renderuje přesně jeho.
- **Zdroje k ověření zkouškových otázek** (ve složce předmětu na iCloudu, mimo
  repo): skutečný pokus ze 4. termínu 14. 3. 2024 z Moodlu (29 otázek v přesném
  znění, bez vyznačených správných odpovědí — ty jsou dohledané ze slidů) a čtyři
  `.docx` se seznamem terminologie po jednotkách.
- **Studocu materiály jsou k ničemu nebo zavádějící.** „Prüfung – Bildverarbeitung
  und Fernerkundung" je AI vygenerovaný cvičný test (generiert am 23. 6. 2026),
  ne skutečná zkouška. „Selbsttest Lösungen 2014" je ze starší, fotogrammetricky
  zaměřené verze předmětu (Kamerakonstante, Umklappeffekt, x-Parallaxe) —
  s dnešní terminologií se nepřekrývá. Při rozporu rozhodují slidy.
- **Dvě místa si ve slidech protiřečí:** Notenschlüssel na FE00 s008 píše
  „>23 = 4", FE10 s047 „≥23 = 4". Platí přesnější FE10. A rozlišení
  panchromatického kanálu WorldView-2 je na FE03 s036 uvedeno jako 46 cm,
  na FE05 s026 jako 40 cm; v kartách je vždy hodnota z toho slidu, o který jde.
