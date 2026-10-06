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

| soubor | jednotka | `readyBy` | karet |
|---|---|---|---|
| `deck/01-besitz-1.json` | Besitz I (kap. I, II.A–D, III + Ex 1–16) | 2026-10-13 | 118 |
| `deck/faelle/2026-10-13-einheit-1.json` | Fallblatt Dr. Binder k 1. jednotce | 2026-10-13 | 10 |
| `deck/02-besitz-2.json` | Besitz II (II.E–F, IV.A–C) | 2026-10-20 | 38 |
| `deck/03-besitz-3.json` | Besitz III (IV.D–E + Ex 17–22) | 2026-10-27 | 15 |
| `deck/04-eigentumserwerb-1.json` | Eigentumserwerb I (V, VI, VII + Ex 23–28) | 2026-10-27 | 57 |
| `deck/05-eigentumserwerb-2.json` | Eigentumserwerb II (VIII + Ex 29–34, MP 6/2023 Fall 2) | 2026-11-03 | 54 |
| `deck/06-klausur-1-faelle.json` | zkouškové případy z učebnice (XIV) k 1. Klausur | 2026-11-10 | 10 |
| `deck/07-eigentumserwerb-3-eigentumsschutz.json` | Eigentumserwerb III / Eigentumsschutz (IX, X, XI + Ex 35–52) | 2026-11-17 | 107 |
| `deck/08-pfandrecht-1.json` | Pfandrecht I (XII.A–H + Ex 53–56) | 2026-11-24 | 32 |
| `deck/09-pfandrecht-2.json` | Pfandrecht II (XII.J–L + Ex 57–62, MP 6/2023 exegeze D 20.4.5) | 2026-12-01 | 24 |
| `deck/10-klausur-2-faelle.json` | zkouškové případy z učebnice (XIV) k 2. Klausur | 2026-12-15 | 16 |
| `deck/11-gemischte-faelle.json` | metoda řešení případů, exegeze, přehled kontroverzí | 2027-01-12 | 16 |

Rozdělení látky do jednotek je odhad podle sylabu (Fallblatt 1. jednotky pokrývá
celou kap. III, proto Besitz I = kap. I–III). Učebnice str. 160–161 (X.E–F,
pasivní legitimace) nejsou vyfocené.

Fallblatty dalších jednotek patří do `deck/faelle/<datum>-einheit-<n>.json`
(štítky `fall` + `einheit-<n>`, priorita 1, `readyBy` = datum jednotky).

Pole karet: `priority` 1 = umět na 100 % (typická zkoušková látka), 2 = důležité,
3 = detail; `topic` = „DD.MM. Jednotka — podtéma“; `readyBy` = datum hodiny,
na které se látka probírá (plánovač podle něj dávkuje nové karty).

## Pořadí učení — nejdřív znalosti, pak případy

Daniel (2026-10-06): „dávkuj nejdřív věci na pochopení a až potom cases — cases
nechápu, dokud mi tam nedáš znalosti, které k nim potřebuji“.

- Balíček se skládá skriptem `uv run content/roman-property-law/build.py` (ne ručně).
  Každá karta dostane `learnOrder`: uvnitř jedné hodiny (`readyBy`) jdou nejdřív
  znalosti v pořadí učebnice, pak prameny (`judikat`, Digest „Case N“), nakonec
  případy (`pripad`: Beispiele, Ex, Fallblatt, Prüfungsfälle). Balíček nese `updates`
  s learnOrder ke každé otázce, takže se pořadí přenastaví i u už importovaných karet.
- `deck/grundlagen.json` — 26 karet s pojmy, které případy předpokládají, ale
  balíček je dřív nevysvětloval (nebo až o několik hodin později), např. RES FURTIVA,
  NEMO PLUS IURIS, IUSTA CAUSA u TRADITIO, ACTIO AD EXHIBENDUM, FACULTAS RESTITUENDI.
  `readyBy` = nejdřívější případ, který pojem potřebuje.
- Učebnice NEOBSAHUJE znalost k: C117/Ex 44a (INTERDICTUM QUEM FUNDUM, str. 160–161
  chybí), C50/C45/C90 (obsah UNDE VI a UTI POSSIDETIS jen jmenován), C57 (STIPULATIO),
  C86 (směna jako IUSTA CAUSA). Doplnit, až budou podklady.
- Nový Fallblatt nebo nová jednotka: přidat soubor, pustit `build.py`, nahrát
  `out/studyflow/roman-property-law.json` jako `/data/materials/deck-roman-property-law.json`.
