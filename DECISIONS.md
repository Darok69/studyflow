# Rozhodnutí

Nejnovější nahoře. Formát: co, proč, jaké alternativy zamítnuty.

## 2026-09-02 — Bez modelu je VÝCHOZÍ stav, ne nouzovka

Daniel: „chci aby to bylo nejperfektnější bez AI, nechci za vše platit."

**Model je opt-in per běh.** Server pustí model jen na `?model=1`; bez toho
jedou pravidla a odpověď nese `reason: 'by-choice'`. V UI je přepínač
„Zdarma podle pravidel / S modelem (platí se)", výchozí vypnutý, odhad ceny se
ukazuje jen když je zapnutý. Zamítnuto: „použij model, když je klíč" — to je
přesně ten stav, kdy se platí za věci, které umí pravidla.

**„Bez modelu" ≠ „bez kvality".** Pravidlový generátor umí typy karet obou oborů:
- `definice` (cs/de/en včetně „liegt vor, wenn", „se rozumí", „Unter X versteht man"),
- `znaky` — výčet za dvojtečkou se rozpadne na položky, každá na svůj řádek
  (učení je pak odkrývá po jedné),
- `norma` — věta s § / čl. se ptá „Co stanoví § 823 BGB?" místo aby z toho dělala definici,
- `rozliseni` — „na rozdíl od / im Gegensatz zu" dá kartu na dva zaměnitelné instituty,
- `proces` — „vede k / führt zu" dá kauzální řetěz (úroveň 2),
- `cisla` — číslo s jednotkou v zeměpise (známkuje se řádově),
- letopočty a cloze na nejvýznamnější termín jako záchranná síť.

Každá karta prochází stejnou kontrolou kvality jako výstup modelu; co neprojde,
se zahodí. **Špatná karta je horší než chybějící — naučí se.**

Dvě pasti, které to skoro potopily a jsou pokryté testy:
- 🔴 `sentences()` dělené na `[.!?]` rozsekalo „451 př. n. l." na tři kusy a datum
  zmizelo → `splitSentences` maskuje zkratky (a `\b` v JS je ASCII-only!).
- 🔴 Po reflow PDF odstavce list za dvojtečkou pokračoval přes konec věty →
  položky se berou jen z první věty za dvojtečkou.

Odhad v osnově u pravidel **není odhad** — spočítá se skutečným během generátoru,
takže „7 karet" znamená 7 karet.

## 2026-09-02 — Učení podle briefu §5 + poloviční cena pipeline

**Kalibrace je zároveň odkrytí.** „Vím / Tuším / Nevím" nahradí tlačítko
„Zobrazit odpověď" — jedno klepnutí místo dvou. Zamítnuto: samostatný krok navíc;
u appky, kterou otvíráš unavený po směně, každý klik navíc znamená, že se to
přestane používat. U karet s psaním je to volba nad polem (vypínatelné v Nastavení).

**Jistá chyba se vrací s jednou kartou mezi tím, ne hned.** Okamžitý návrat je
čtení odpovědi, ne vybavování. `HYPERCORRECTION_GAP = 2`.

**Koncept „chybníku" (`errorLog`) místo počítání laps na kartě.** Chyba nese téma
a to, jestli sis byl jistý — jinak by ze Slabých míst nešlo poznat, co přesně
opakovat. Jisté chyby se ve žebříčku počítají dvakrát.

**Série má banku dvou volných dní na měsíc.** Vynulovaná série lidi z appky vyhání
(BRIEF §5.15); jeden vynechaný den ji nesmí smazat. Starý test, který očekával
opak, byl s odůvodněním přepsán.

**Ubírání kroků (worked examples) jede z ŘÁDKŮ odpovědi**, ne ze zvláštní
struktury: generátor je instruovaný psát schéma a případ po krocích, takže
`answerSteps` stačí rozdělit text (řádky → šipky → číslování). Ubírá se podle
`reps`: poprvé celý vyřešený případ, pak o krok míň, nakonec jen zadání.

**Karty `cisla` se známkují řádově.** 84 000 pro 83 879 km² je správně, rozpětí
v odpovědi je rozpětí. Trvat na číslicích by učilo trivia a trestalo znalost.

### Cena: $3,68 → $1,81 za 300stránkové skriptum

**Osnova čte jen výtah bloků** (nadpis + první řádky, `blockDigest`). Rozhodnout,
jaká témata v podkladu jsou, nikdy nevyžadovalo každou větu — a materiál je to,
co ten dotaz prodražuje. Úspora ~75 % vstupu u nejdražšího čtení.

**Kontrola opory je zadarmo.** Každá karta musí vrátit doslovný úryvek podkladu,
na kterém odpověď stojí (`evidence`), a pravidlo ověří, že v bloku opravdu je.
Tím odpadl automatický druhý průchod modelem (~40 % účtu, běžel na Opusu);
zůstal jako **nepovinné tlačítko** „Zkontrolovat modelem" na Haiku 4.5.

**Effort podle úlohy**: psaní karet z bloku je dobře zadaná práce → `low`;
hloubka uvažování se tam platí v output tokenech a nic nepřináší.

## 2026-09-01 — Pipeline podklad → osnova → karty (sprint 1)

**Osnova jde ke schválení dřív, než vznikne jediná karta.** Model vrátí témata
s odhadem času a počtu karet, uživatel je přejmenuje nebo odškrtne a teprve pak
se generuje. Zamítnuto: jedno tlačítko „vygeneruj vše" — z 300stránkového skripta
by vypadly stovky karet, které se pak zahazují po jedné.

**Generuje se po tématech, každé téma samostatný požadavek.** Výpadek stojí jedno
téma, ne celou dávku, a průběh v UI je pravdivý. Výsledek se ukládá pod
`sourceId + topicId`, takže opakované spuštění nic negeneruje (ani neplatí) dvakrát.

**Pravidlový fallback není nouzový režim, je to výchozí chování bez modelu.**
Chybějící klíč, vyčerpaný rozpočet i chyba API končí stejně: vyrobí se karty
z pravidel a odpověď i UI **řeknou, že model neběžel a proč**. Extrakce PDF a textu
má vlastní režim `local` — na čtení PDF žádný model potřeba není, a tvářit se, že
je to fallback, by bylo zavádějící.

**Karty, které neprojdou kontrolou, se nemažou — stanou se koncepty.** Koncept se
neplánuje (`isSchedulable` ho vylučuje), nepočítá se do velikosti balíčku ani do
připravenosti, a v Kartičkách má vlastní filtr, důvod a tlačítko „Použít".
Zamítnuto: tiché zahazování — u vlastní látky je oprava levnější než ztráta.

**Klíč je v `server/src/ai.js` a nikde jinde.** Hlídá to statický test nad `src/**`
(žádný klientský modul nesmí importovat SDK) a grep nad `dist/`.

**Batch API zatím nepoužíváme.** Půlí cenu, ale běží asynchronně; generování je
interaktivní (30 volání s průběhem), takže latence převáží úsporu. `BATCH_DISCOUNT`
v odhadu zůstává připravený.

**Rendery stránek PDF do PNG odloženy do fáze obrázků.** Vyžadovaly by nativní
canvas na serveru; až budou potřeba (occlusion nad schématy), vykreslí je klient
pdf.js a nahraje jako blob — stejnou cestou jako fotky. Náhled zdroje zatím
ukazuje **text** dané strany (`GET /api/sources/:id/pages/:n`).

**Prompt caching zapnutý není.** Systémový prompt má ~200 tokenů, což je pod
minimem cacheovatelného prefixu; posílat celý podklad jako cachovaný prefix ke
každému tématu by vyšlo dráž než poslat jen bloky tématu. Ověřuje se přes
`usage.cache_read_input_tokens`, až se to změní.

## 2026-09-01 — Brief se staví do existující appky, nepřepisuje ji

`BRIEF.md` popisuje Next.js + Postgres + Drizzle + server actions. V repu už ale
běží hotová aplikace (~8,9 tis. řádků, živá na study.dmarka.eu): Vite + React 19,
Dexie jako zdroj pravdy, `ts-fsrs`, PWA offline, Fastify server. Fáze 1 z briefu
je tím z velké části splněná, jen jinými prostředky.

**Rozhodnutí: rozšířit stávající stack.** Offline-first je tvrdý požadavek; v
Next.js by se Dexie vrstva stavěla znovu vedle Postgresu, tedy všechno co tu je
plus SSR navíc. Zamítnuto: přepis do Next.js (2–3× práce, ztráta funkční učicí
smyčky, změna deploye), hybrid s Postgresem pod stávajícím UI (přepisuje sync
vrstvu bez užitku pro jednoho uživatele).

Konkrétní odchylky od briefu:

| Brief | Zde | Proč |
|---|---|---|
| Next.js + Postgres + Drizzle | Vite PWA + Fastify + Dexie | viz výše |
| `courses` jako entita nad `subjects` | `Subject` = kurz/zkouška, přibude `kind` + `ects` | dvouúrovňová hierarchie se dotkne Home, Stats i Browseru; barvu oborů a ECTS dá jedno pole |
| `decks { topic }` mezi kurzem a kartou | `card.topic` | interleaving i filtry potřebují téma, ne tabulku; žádný přepis dotazů |
| `card.state: draft/active/suspended` | `card.draft` + `draftReason` | `Card.state` je v repu FSRS stav (`new/learning/review/relearning`) — kolize jména |
| `claude-sonnet-4-6` | `claude-opus-5` (osnova, QC) + `claude-sonnet-5` (bloky, vision) | Sonnet 5 je novější a levnější ($2/$10 vs $3/$15); Opus tam, kde se rozhoduje o stovkách karet |
| Sharp na server-side resize | downscale na klientu (`src/lib/image.ts`) | komprese už v repu je; nativní závislost navíc bez užitku |
| Vitest + Playwright | stávající pure-suite `test/core.test.ts` (rolldown + node) | běží, je rychlá, nula nových závislostí; Vitest až s prvním testem, který potřebuje DOM |
| Neon/Supabase, Vercel Blob | `/data` volume na prod boxu | volume existuje a je zálohovaný; jeden uživatel, jednotky GB |

Nové závislosti: `@anthropic-ai/sdk` (server — oficiální SDK, bez něj to nejde),
`unpdf` (text po stranách + render stránek PDF do PNG).
