# Einführung in die Geoinformation (MEGIDA) — podklady ke zkoušce

Kurz s prezentacemi po jednotkách a skriptem k ArcGIS Pro (Uni Wien, LV-Leitung
Schwab, Rauscha). Všechno je **německy**. Nástroje ArcGIS Pro jsou **anglicky**,
tak jak jsou v programu.

## Zkouška a dávkování

**Prüfung 1: út 1. 12. 2026**, 70 minut, praktický příklad v ArcGIS Pro (40 %).
Prüfung 2 je 15. 12., odevzdání Semesterarbeit 16. 1. 2027. Mitarbeit (20 %)
tvoří Mitarbeitskontrollen a Hausübungen.

Daniel (2026-10-06): „dávkuj rozumně, ale hlavní termín je test“. Proto:
- `examDate` = 1. 12. 2026 — cíl tempa celého předmětu.
- Lekce v `courses.json` nese `readyBy` = jednotka, která na ní STAVÍ (ne ta, na
  které se probírala). `make_deck` ho dá jen kartám `core`; organizační karty
  a slepé obrázky jdou volným tempem ke zkoušce.
- Strop rozumného tempa je cca 15 nových karet denně (vedle dalších předmětů).
  1. dávka: EH01 + SK02 (168 karet) do 20. 10., ne do 13. 10. — to by bylo
  28 denně. SK01 (101) do 27. 10. Vychází to na ~14 denně.

| jednotka | datum | téma (EH1 s5–s9) | skript |
|---|---|---|---|
| EH1 | 6. 10. | Organisatorisches, Koordinatensysteme, Geodatabase | Teil I–II |
| EH2 | 13. 10. | Georeferenzieren: Rasterdaten, Transformation | Kap. 9–11 |
| EH3 | 20. 10. | Georeferenzieren: Arten, Bild zu Bild, Passpunkte | Kap. 12 |
| EH4 | 27. 10. | Digitalisieren: Objektschlüssel, Domains, Symbolisierung | 7.4–7.6, 13–15, 26–27 |
| EH5 | 3. 11. | Linien: Fehler bereinigen, Snapping | 14, 16 |
| EH6 | 10. 11. | Flächen und Topologie | 17–18 |
| EH7 | 17. 11. | Open Source Data, Semesterarbeit, AGOL | Teil VI–VII |
| EH8 | 24. 11. | Visualisierung: Symbole, Layout, Kartenelemente | Teil V |

## Zdroje

- `EH<n>_gruppe1.pdf` — prezentace, přibývají po týdnech (lekce `EH0n`).
- `Skript.pdf` (duben 2026) — aktuální postupový skript kurzu. V pipeline je
  rozdělený na lekce `SK0n` přes `"pages": [od, do]` (stránky PDF, včetně).
  Slidy lekce se číslují od 1.
- `GIS_Skript_SJ2020_21_v1.pdf`, `EGI_Tutorial_ArcGIS Pro_SS21.pdf` a studocu
  jsou ze STARŠÍCH verzí kurzu (VO EKGI, PS 2020/21) a slouží jen jako
  doplněk. Při rozporu rozhoduje prezentace a aktuální skript.
