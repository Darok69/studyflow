# Roman Law of Property — Römisches Sachenrecht (IREWI, 3. semestr)

Balíček karet ke kurzu Roman Law of Property (Uni Wien, Dr. Michael Binder,
úterý 12:30–14:30, HS U11, 2026/27). Karty jsou **německy**, latinské termíny
zůstávají latinsky.

- **Zdroj pravdy:** učebnice Benke/Meissel, *Roman Law of Property*, 2. vyd.
  (Manz, Wien 2024) — anglický překlad *Übungsbuch Römisches Sachenrecht*.
  Každá odpověď musí mít oporu v učebnici. Studocu podklady (zkouškové případy
  z června 2023, kontroverze, revision notes) slouží jen k tomu, **co** se
  zkouší; kde se s učebnicí neshodují, rozhoduje učebnice.
- Přepis vyfocených stránek učebnice se do gitu nedává (autorské právo,
  velikost) — leží lokálně v `out/work/` (gitignorováno).

## Soubory

Každý soubor v `deck/` je samostatně importovatelný (stejný `subject`), takže
dávky jdou do appky postupně — import do existujícího předmětu přidá jen nové
otázky (identita karty = otázka).

| soubor | jednotka | `readyBy` |
|---|---|---|
| `deck/01-besitz-1.json` | Besitz I | 2026-10-13 |
| `deck/faelle/2026-10-13-einheit-1.json` | fallblatt k 1. jednotce | 2026-10-13 |

Fallblatty dalších jednotek patří do `deck/faelle/<datum>-einheit-<n>.json`
(štítky `fall` + `einheit-<n>`, priorita 1, `readyBy` = datum jednotky).

Pole karet: `priority` 1 = umět na 100 % (typická zkoušková látka), 2 = důležité,
3 = detail; `topic` = „DD.MM. Jednotka — podtéma“; `readyBy` = datum hodiny,
na které se látka probírá (plánovač podle něj dávkuje nové karty).
