# System Erde — podklady ke zkoušce STEOP 280001-1

Předmět 2026W **280001-1 VO STEOP: System Erde** (Uni Wien; Grasemann,
Le Heron — geologie, Nasdala — mineralogie). Učebnice Grotzinger/Jordan,
*Allgemeine Geologie* (Springer). Všechno je **německy**, protože německy je
i zkouška.

## Zkouška

Modulprüfung **18. 12. 2026** 15:15–16:45 (další termíny 5. 2. a 19. 2. 2027).
Podle starých zkoušek 2017–2022 (studocu, studentské přepisy) je to multiple
choice a často je správných víc možností. Tip studentů: u Nasdaly teploty
a velikosti zrn, u Grasemanna obecné věci a výšky/velikosti.

**Tempo je jen k datu zkoušky**, ne k přednáškám (Daniel 2026-10-06). Karty
proto nemají `readyBy`.

## Co z podkladů vzniká

| výstup | krok | kde v appce |
|---|---|---|
| výklad ke každému slidu + glosář | `merge` → `materials` | Učebnice |
| karty (definice, rozlišení, čísla…) | `deck` | Import → Připravené balíčky |
| **přehledové tabulky** (UB01, 14 oddílů) | `content_UB01.json` → `materials` | Učebnice → Übersichtstabellen |
| **slepé obrázky** z diagramů | `blind.json` → `blind` → `deck` | karty druhu „mapa“ |
| **zkušební test** (single/multi choice) | `mc/<ID>.json` → `tests` | předmět → Zkušební test |
| podcast kvíz + výklad (neurální hlas) | `audio` → `feed` → `upload` | aplikace na podcasty |

Týdenní dávka: zdrojové PDF do `courses.json`, `./run.sh system-erde`, napsat
`content/content_<ID>.json` a `mc/<ID>.json`, doplnit `blind.json`, pak
`merge`, `blind`, `tests`, `materials`, `deck`, `publish`. Tabulky v UB01
rozšířit o nová čísla.

## Zvláštnosti

- **Handouty Nasdaly mají textovou vrstvu, diagramy Grasemanna ne** (jsou to
  obrázky z učebnice). `make_blind.py` proto hledá popisky nejdřív v textu
  PDF a pak lokálním OCR macOS (`pipeline/ocr/ocr.swift`, Vision, nic
  neodchází ven). Popisek přes víc řádků je v `blind.json` seznam řádků.
- **Studocu materiály nejsou zdroj pravdy**, jen vodítko, co se zkouší. Při
  rozporu rozhoduje slide. Známé rozpory jsou vypsané v tabulkách UB01:
  oceánská kůra 7 vs. 8 km, Everest 8849 vs. 8848 m, „2980 km“ na SE01 s15
  (překlep, platí ~2900), Fe kůra vs. plášť (podle grafu skoro stejně,
  největší rozdíl je Mg).
- **Chyby v handoutu NA06** (Titan není planeta; hmotnost asteroidů „bis
  0,5 M_Erde“) jsou jen ve výkladu, do karet nejdou.
- **Podcast** používá neurální hlas Microsoftu přes edge-tts (`tts_edge.py`),
  protože macOS hlasy se podle Daniela „strašně špatně poslouchají“. Ven odchází
  jen text úseků. Jazyk určuje `"language": "de"` v `courses.json`.
