# StudyFlow — zadání pro Claude Code

> Zdrojové zadání sprintu „podklady → balíček". Popisuje cílový stav; kde se
> skutečná implementace vědomě liší (stack, datový model, modely), je to
> zdůvodněno v `DECISIONS.md`.

## 1. Kdo to bude používat a proč

Jeden uživatel: student práv na Universität Wien, který zároveň studuje zeměpis (25 ECTS hotových) a k tomu na plný úvazek řídí stavební a logistickou firmu. Času má málo, podkladů hodně, a přepínání mezi dvěma obory ho stojí energii.

Aplikace není „další Anki". Anki je přehrávač karet. Tohle je **stroj, který z hromady syrových podkladů udělá hotový učební plán** a pak ho odřídí den po dni. Uživatel do něj hází PDF skripta, fotky poznámek z přednášky, snímky map, vlastní výpisky — a ven leze balíček karet, rozvrh a zpětná vazba, co mu nejde.

Klíčové omezení: **musí to fungovat i bez modelu a bez internetu.** Když API spadne, vypadne kredit, nebo je uživatel ve vlaku, aplikace se učí dál a generuje aspoň pravidlovým fallbackem.

Jazyk UI: čeština. Obsah karet: němčina (Wien) a čeština, občas angličtina — nikdy nepřekládat odborné termíny.

## 2. Technologický stack

Vše aktuální k roku 2026, žádné legacy.

| Vrstva | Volba | Proč |
|---|---|---|
| Framework | Next.js (App Router), React, TypeScript strict | server actions, streaming, jedno nasazení |
| UI | Tailwind + shadcn/ui + Radix primitives | rychlé, přístupné, plná kontrola nad vzhledem |
| Animace | Motion (framer-motion) — jen na potvrzení akce | ne dekorace |
| DB | Postgres (Neon nebo Supabase) + Drizzle ORM | typové migrace |
| Auth | jednouživatelský passkey / magic link, žádné hesla | |
| Offline | PWA + service worker (Serwist) + IndexedDB přes Dexie | učení funguje offline, sync na pozadí |
| Sync | last-write-wins na úrovni karty + fronta operací v IndexedDB | jednoduché, jeden uživatel |
| Plánovač | **FSRS** (`ts-fsrs`), ne SM-2 | výrazně lepší predikce zapamatování |
| AI | Anthropic API výhradně server-side, `claude-sonnet-4-6`; Batch API na hromadné zpracování skript | klíč nikdy do klienta |
| PDF | `unpdf` nebo pdfjs-dist na text + render stránek do PNG | |
| Obrázky | Sharp na server-side resize, AVIF/WebP, blob storage (Vercel Blob / S3) | |
| OCR / vizuální čtení | přímo vision přes Anthropic API (obrázek jako base64), Tesseract.js jen jako offline fallback | model přečte i rukopis a schémata |
| Audio z přednášky | Whisper API → transkript → stejná pipeline jako text | volitelné, fáze 4 |
| Grafy | Recharts nebo Visx | křivky zapomínání, pokrok |
| Testy | Vitest + Playwright na kritické toky (učení, sync) | |
| Kvalita | ESLint, Prettier, `tsc --noEmit` v CI, Husky pre-commit | |

## 3. Datový model (Drizzle, výchozí návrh)

```ts
subjects   { id, name, kind: 'law'|'geography'|'other', color, ectsDone, ectsTarget }
courses    { id, subjectId, name, ects, examDate, weight }        // konkrétní zkouška: IREWI, EGLH…
sources    { id, courseId, kind: 'pdf'|'image'|'text'|'audio'|'url',
             fileKey, pages, extractedText, status, createdAt }
decks      { id, courseId, topic, order, createdFromSourceId }
cards      { id, deckId, type, front, back, explanation,
             level: 1|2|3,                 // 1 vybavení, 2 porozumění, 3 aplikace
             tags: text[], sourceRef,      // strana/odstavec ve zdroji
             images: jsonb,                // viz níže
             occlusion: jsonb | null,      // masky pro image occlusion
             state: 'draft'|'active'|'suspended',
             fsrs: jsonb }                 // stability, difficulty, due, reps, lapses
reviews    { id, cardId, ts, rating: 1..4, elapsedMs, predictedR, wasCorrectSelfReport }
sessions   { id, ts, plannedMin, actualMin, subjectMix, mood: 1..5 | null }
errorLog   { id, cardId, ts, userNote, cluster }   // co si spletl a proč
exams      { id, courseId, date, result, reflection }
```

`images` na kartě:

```jsonc
[{ "key":"blob/xyz.avif", "role":"prompt"|"answer"|"context",
   "alt":"slepá mapa Alp", "focus":{"x":0.4,"y":0.6,"zoom":1.8} }]
```

`occlusion`:

```jsonc
{ "imageKey":"blob/mapa.avif",
  "masks":[{"id":"m1","shape":"rect","x":.12,"y":.44,"w":.09,"h":.05,"label":"Dunaj"}],
  "mode":"hide-one-guess-one" | "hide-all-guess-one" }
```

## 4. Pipeline: ze surového podkladu na balíček

Toto je jádro aplikace. Musí být viditelné jako proces, ne jako jedno tlačítko s točítkem.

1. **Příjem.** Drag & drop nebo focení telefonem. PDF, foto skript, screenshot mapy, čistý text, URL, .apkg z Anki, existující StudyFlow JSON.
2. **Extrakce.** PDF → text po stránkách + render stránky do PNG (kvůli schématům a mapám). Obrázky → vision přepis včetně popisu grafiky, ne jen textu. Vše se ukládá se stránkovou referencí, aby šlo u každé karty skočit na zdroj.
3. **Segmentace.** Rozdělení na sémantické bloky (nadpisy, definice, případy). Ne po znacích — po struktuře.
4. **Návrh osnovy.** Model nejdřív vrátí **osnovu témat s odhadem obtížnosti a časem**, uživatel ji odklikne nebo přepíše. Až pak se generují karty. (Tohle je zásadní: uživatel spolurozhoduje ještě než vzniknou stovky karet.)
5. **Generování karet po blocích.** Paralelně, s progresem po blocích. Každý blok = samostatné volání, aby výpadek nezničil celou dávku.
6. **Deduplikace.** Embeddingy nebo prosté normalizované porovnání — nikdy dvě karty na totéž.
7. **Kontrola kvality.** Druhý průchod modelem: „je otázka odpověditelná z hlavy? je odpověď kratší než tři věty? plyne z podkladu?" Karty, které neprojdou, jdou do fronty `draft` s vyznačeným důvodem.
8. **Fallback bez modelu.** Pravidlový generátor: definiční vzory (`X ist / je / bezeichnet`), dvojtečkové definice, letopočty, číselné údaje, cloze na nejvýznamnější termín v odstavci. Vždy označit tagem `koncept`.

### Typy karet podle oboru

**Právo** — samotná definice nestačí, u zkoušky se podřazuje:

- `definice` — pojem
- `znaky` — výčet znaků skutkové podstaty
- `schema` — Prüfungsschema jako obrázek s postupným odkrýváním kroků
- `pripad` — krátký skutkový stav → norma, znaky, subsumpce, výsledek
- `rozliseni` — dva podobné instituty vedle sebe
- `norma` — co stojí v § a co z toho plyne
- `judikat` — rozhodnutí a jeho věta
- `cloze`

**Zeměpis** — pojmy jsou nejmíň důležité:

- `proces` — kauzální řetěz příčina → mechanismus → důsledek
- `mapa` — image occlusion nad mapou nebo profilem
- `cisla` — řádový odhad, ne přesná čísla (rozpětí se považuje za správné)
- `srovnani` — dva regiony podle stejných kritérií
- `model` — teorie a její limity
- `graf` — čtení grafu nebo klimadiagramu
- `cloze`

## 5. Lernpsychologie — co konkrétně implementovat

Tohle je hlavní odlišnost od běžné kartičkovací aplikace. Každý mechanismus má být implementovaný funkčně, ne jako popisek v UI.

### Co prokazatelně funguje

1. **Retrieval practice.** Odpověď se nikdy nezobrazí dřív, než uživatel klikne „ukázat". U karet úrovně 3 je povinné napsat aspoň pár slov, než se odkryje — generation effect. Prázdné pole = tlačítko zůstává neaktivní 3 vteřiny.
2. **Spacing přes FSRS.** Intervaly počítá `ts-fsrs`, ne pevná tabulka. Parametry se optimalizují z historie recenzí, jakmile jich je přes 400.
3. **Interleaving.** Fronta na den se míchá napříč předměty a tématy podle poměru práva a zeměpisu. Nikdy 30 karet z jednoho tématu za sebou. V UI ukázat, že je to záměr — uživateli to připadá horší, výsledek je lepší.
4. **Desirable difficulties.** Krátká prodleva před odkrytím, občasné přeformulování otázky jiným slovosledem, u zeměpisu náhodné otočení směru (z mapy na název i naopak).
5. **Hypercorrection.** Když si uživatel byl jistý a spletl se, karta se vrací ještě tentýž den a označí se v `errorLog`. Chyby s vysokou jistotou se opravují nejlépe ze všech.
6. **Kalibrace úsudku.** Před odkrytím jednoduchá volba „vím / tuším / nevím". Porovnávat s výsledkem a ukazovat, jak přesně uživatel odhaduje vlastní znalost. Nadhodnocení je hlavní příčina propadnutí.
7. **Elaborace a self-explanation.** U karet úrovně 3 se po odpovědi zeptat „proč to tak je?" a odpověď uložit. Model ji jednou týdně vyhodnotí a upozorní na chybné modely uvažování.
8. **Worked examples s postupným ubíráním.** U práva: první případ celý vyřešený, druhý s vynechanou subsumpcí, třetí jen zadání. Automaticky podle počtu opakování.
9. **Dual coding.** Text plus obrázek u všeho, kde to dává smysl. Ne dekorativní fotky — schémata, mapy, profily, časové osy.
10. **Chunking.** Karta má jednu myšlenku. Pokud odpověď přesáhne tři věty, kontrola kvality ji rozdělí.

### Motivace a chování — bez temných vzorců

Cílem je, aby si sedl k učení i unavený po směně. Ne aby v aplikaci trávil co nejvíc času.

11. **Implementation intentions.** Při zakládání kurzu se uživatel zaváže ke konkrétní formulaci: „V úterý v 19:00 u kuchyňského stolu 25 minut práva." Tahle věta se zobrazuje v notifikaci, ne obecné „čas na učení".
12. **Goal gradient.** Ukazatel postupu do konce dnešní dávky, ne do konce semestru. Zrychlené vnímání blízkého cíle.
13. **Zeigarnik.** Den se ukončuje **uprostřed** rozdělaného tématu s poznámkou „zítra začneš tímhle". Nedokončené se drží v paměti.
14. **Fresh start effect.** Pondělí, první den měsíce a den po zkoušce nabídnout restart plánu jako novou etapu.
15. **Streak bez trestu.** Sledovat sérii, ale nikdy ji nenulovat za jeden vynechaný den — „banka volných dní", 2 za měsíc. Vynulovaný streak lidi z aplikace vyhání.
16. **Temptation bundling.** Umožnit párování bloku s odměnou (káva, epizoda seriálu) a připomenout ji v plánu.
17. **Precommitment na zkouškové datum.** Odpočet + přepočet denní dávky. Když se dávka nevejde do dostupných hodin, aplikace to řekne rovnou a nabídne, co škrtnout (nejdřív karty úrovně 1 u nejvzdálenější zkoušky).
18. **Efekt vlastnictví.** Karty, které uživatel sám upravil, mají viditelnou značku. Vlastnoručně upravený materiál se učí líp a ochotněji.
19. **Sociální závazek volitelně.** Sdílení týdenního souhrnu jednomu člověku (parta, partnerka). Vypnutelné, výchozí vypnuto.
20. **Bez manipulací.** Žádné falešné notifikace, žádné umělé odpočty typu „nabídka končí za 2:00", žádné vynucené série, žádné vibrace na dopamin. Uživatel musí aplikaci věřit i po roce.

### Zdravé hranice

- Denní strop. Když překročí plánovanou dávku o 50 %, aplikace to sama zastaví a doporučí konec — přeučení před zkouškou snižuje výkon.
- Únava. Po 3 blocích povinná pauza s odpočtem, přeskočitelná jedním klikem, ale se zaznamenáním do `sessions`.
- Před zkouškou poslední den jen odlehčené opakování, žádné nové karty.

## 6. Obrazovky

1. **Dnešek** — jedna věta, co se dnes děje, tlačítko Začít, odpočty ke zkouškám, dnešní dávka po předmětech.
2. **Učení** — celoobrazovkové, jedna karta, palcem ovladatelné (swipe = hodnocení, dole velká tlačítka). Obrázky zoomovatelné gestem. Klávesové zkratky na desktopu (mezerník, 1–4).
3. **Podklady** — nahrávání, stav zpracování, náhled stránek, tlačítko „vygenerovat balíček".
4. **Balíčky a karty** — seznam, hromadné úpravy, filtr podle úrovně, typu, tagů a stavu, editor karty s náhledem zdrojové stránky vedle.
5. **Editor image occlusion** — obrázek na plátně, kreslení obdélníků a polygonů, popisky, volba režimu. Musí být použitelný prstem na telefonu.
6. **Plán** — týdenní rozvrh, kapacita vs. potřeba, doporučení co škrtnout, křivka predikované znalosti do dne zkoušky.
7. **Slabá místa** — clustery chyb z `errorLog`, kalibrace jistoty, témata s nejnižší predikovanou retencí.
8. **Nastavení** — API rozpočet, offline chování, notifikace, export.

Vzhled: klidný, hodně bílého prostoru, žádné gamifikační cetky. Rozlišení předmětů barvou (právo indigo, zeměpis zelená). Tmavý režim povinný — učí se večer. Vše v dosahu palce, primární akce dole.

## 7. Práce s obrázky — detailně

- **Image occlusion** pro mapy, schémata, geologické profily, Prüfungsschemata. Masky ukládat v relativních souřadnicích (0–1), aby fungovaly na jakémkoli rozlišení.
- **Automatický návrh masek**: nahranou mapu poslat modelu s prosbou o seznam pojmenovaných objektů a jejich přibližných pozic → předvyplněné masky, uživatel je jen posune.
- **Fotky skript**: uživatel vyfotí stránku, model přepíše text i popíše schéma, karta si drží výřez originálu jako kontext.
- **Generované vizuály**: kauzální řetězce a Prüfungsschemata vykreslovat jako SVG z JSON struktury, ne obrázek — jsou pak zoomovatelné, dají se odkrývat po krocích a váží nic.
- Vše převádět na AVIF s WebP fallbackem, ukládat i malý náhled, lazy loading, u offline režimu předstáhnout obrázky karet splatných na dalších 7 dní.
- Přístupnost: každý obrázek povinně `alt`, u occlusion i textová varianta otázky.

## 8. Náklady a spolehlivost API

- Server-side rate limiting a měsíční strop v nastavení. Při dosažení stropu se přepne na pravidlový generátor a řekne to.
- Hromadné zpracování skript přes Batch API (levnější, běží na pozadí, uživatel dostane notifikaci).
- Prompt caching pro sdílený systémový prompt.
- Každý požadavek s retry a exponenciálním backoffem; výsledky ukládat, ať se nic negeneruje dvakrát.
- Odhad ceny za balíček zobrazit **před** spuštěním.

## 9. Import a export

- Import: existující StudyFlow JSON, Anki `.apkg`, CSV/TSV, Markdown.
- Export: JSON s **konfigurovatelnými názvy polí**, Anki-kompatibilní TSV včetně obrázků v ZIP, tisk balíčku do PDF na papírové opakování.
- Zálohy: nightly export celé DB do JSON souboru do blob storage.

## 10. Fázování

| Fáze | Obsah | Hotovo znamená |
|---|---|---|
| 1 | Datový model, auth, CRUD balíčků a karet, ruční tvorba, FSRS učící smyčka, PWA offline | Dá se s tím reálně učit |
| 2 | Pipeline: text a PDF → osnova → karty → kontrola kvality, pravidlový fallback | Skripta na vstupu, balíček na výstupu |
| 3 | Obrázky: upload, vision extrakce, image occlusion editor, SVG schémata | Zeměpisné mapy plně použitelné |
| 4 | Plánovač, kalibrace, slabá místa, notifikace s implementation intentions | Aplikace řídí týden |
| 5 | Audio přednášek, optimalizace FSRS parametrů z vlastních dat, tisk, sdílení souhrnu | |

Po každé fázi commit, běžící build a krátký záznam do `DECISIONS.md`.

## 11. Co má Claude Code dodržet

- TypeScript strict, žádné `any`, žádné `@ts-ignore`.
- Server actions místo REST, kde to jde. API klíč nikdy v klientském bundlu — ověřit.
- Žádná knihovna navíc bez důvodu; před přidáním závislosti napsat proč.
- Testy na: FSRS plánování, sync konflikt, pipeline fallback při chybě API, occlusion souřadnice.
- Mobilní zobrazení testovat na šířce 380 px, ne jen na desktopu.
- Přístupnost: viditelný focus, ovládání klávesnicí, respektovat `prefers-reduced-motion`.
- Commity v češtině nebo angličtině, ale konzistentně.
- Nic nedeployovat bez zeleného `tsc --noEmit`, lintu a testů.
