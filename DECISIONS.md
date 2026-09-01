# Rozhodnutí

Nejnovější nahoře. Formát: co, proč, jaké alternativy zamítnuty.

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
