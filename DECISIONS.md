## Podcast: podklady k poslechu jako soukromý feed, ne přehrávač v appce

**Proč vůbec:** materiál se dá číst jen u stolu. Cesta autem, metro a běhání
jsou hodiny denně, kdy se dá poslouchat — a u zkoušky rozhoduje, kolikrát to
projde hlavou.

**Dvě řady, protože se poslouchají jinak.** `quiz` je otázka, ticho a odpověď:
nutí vzpomínat, což je jediné, co se pasivním poslechem opravdu učí — na běh a
do metra. `narration` je souvislý výklad přednášky — do auta, na první
seznámení. Stejný zdroj, jiné sestavení.

**Proč feed a ne přehrávač ve StudyFlow:** podcastová aplikace umí zadarmo to,
co v prohlížeči stojí spoustu práce a stejně je křehké — přehrávání při
zhasnutém displeji, CarPlay a Bluetooth v autě, stažení offline (metro nemá
signál), rychlost, zapamatovanou pozici. Vlastní přehrávač by byl nejvíc práce
a nejhorší výsledek.

**Autorizace tokenem, ne session.** Podcastová aplikace se neumí přihlásit;
jediné, co s sebou nese, je adresa. Token je proto v cestě, porovnává se
v konstantním čase a feed má `<itunes:block>yes</itunes:block>`, aby ho Apple
nezařadil do katalogu. Kdo tu adresu dostane, poslechne si to — je to jediná
cesta serverem, která nechce cookie, a ví to.

**Range requesty se musely napsat ručně.** Přehrávač si o zvuk žádá po kusech;
bez odpovědi 206 se v pětadvacetiminutové epizodě nedá přetáčet a některé
aplikace ji odmítnou stáhnout.

**Text se pro poslech PŘEPISUJE.** Výklad je psaný pod obrázek a ve 12 % vět
(202 z 1724) mluví o tom, co je vidět: „left column", „the photograph beside
the text". Nahlas je to nesmysl. Takové věty jsou v `audio/overrides/<ID>.json`
přepsané nebo vypnuté; zbytek jde do zvuku tak, jak je. Zkratky a ustanovení
řeší `pipeline/speech.py` — „Art. 38(1)(b)" se nahlas říká jinak, než se píše.

**Zvuk dělá systémové `say`:** žádný klíč, žádný text neodchází z notebooku,
rovnou do AAC bez ffmpeg. Kvalitu určuje hlas — Premium hlasy (Ava, Zoe) jsou
zdarma, ale stahují se ručně v Nastavení. Převod je idempotentní přes otisk
textu a hlasu, takže výměna hlasu je jeden příkaz.

## Jeden účet na víc zařízeních: dvě různá „nový kód"

**Co bylo špatně:** `resetUserCode()` vždycky zabil všechny session. Kdo si
vygeneroval kód, aby se přihlásil na mobilu, vyletěl z notebooku — na dvou
zařízeních současně to nešlo nikdy. Druhá půlka problému: `PUT /api/sync`
zapisoval naslepo, takže zařízení, které začalo pracovat nad starší verzí,
tiše přepsalo, co mezitím uložilo to druhé.

**Rozdělení podle úmyslu.** „Potřebuju kód pro další zařízení" (`/reset`)
už session nesahá — starý kód přestane platit, přihlášená zařízení běží dál.
„Někdo mi ten kód viděl" (`/signout`) vydá nový kód a zároveň vyhodí všechno
včetně zařízení, ze kterého se to klikalo. V admin seznamu je u každého účtu
vidět, kolik zařízení je zrovna přihlášených, aby se ta volba dělala s fakty.

**Konflikt sync se řeší optimisticky**, ne zámkem: klient posílá `baseUpdatedAt`
— verzi, ze které vyšel. Když se server mezitím pohnul, vrátí 409 i s aktuálním
snapshotem a klient se jednou zeptá (vzít server, nebo přepsat svým). Klient bez
`baseUpdatedAt` (starší build) projde postaru, ať se mu sync úplně nerozbije.

**Proč ne skutečný merge:** snapshot je celý stav appky v jednom JSONu. Sloučit
dvě historie opakování by znamenalo CRDT nebo per-entitu verzování — na jednoho
člověka se dvěma zařízeními je otázka levnější a poctivější než tichý merge,
který by se občas spletl.

**Odhlášení při zavření záložky:** `pagehide` posílá `keepalive` fetch, který
409 jen zahodí. Zeptat se není koho a `dirty` zůstává nastavené, takže se
konflikt vyřeší s otázkou hned při dalším startu.

## Učebnice: podklady se čtou v appce, ale nežijí v sync snapshotu

**Co:** Nová obrazovka „Učebnice" (`src/pages/Reader.tsx`) ukazuje slide,
pod ním psaný výklad, glosář pojmů a na konci přednášky otázky. Data servíruje
server z `/data/materials` (`server/src/materials-routes.js`), obrázky slidů
jako běžné soubory za session cookie.

**Proč ne do snapshotu:** slidů je 758 a jejich rendery váží 55 MB. Sync
snapshot nese celý stav appky v jednom requestu se stropem 32 MB — materiál by
ho roztrhl. Navíc je pro všechna zařízení stejný, takže nemá důvod cestovat
s uživatelským stavem.

**Proč ne do `sources`:** ta tabulka je pipeline na výrobu karet (nahrát →
extrahovat → vygenerovat), ne čtečka; její obrazovka neumí zobrazit stranu.

**Pozice ve čtení** je v `localStorage`, ne v datech: je to pohodlí jednoho
zařízení, ne studijní stav, a nemá co dělat v FSRS ani v záloze.

**Zamítnuto:** vykreslovat podklady jako pozastavené karty v prohlížeči karet —
bez obrázků by to nebyla učebnice, a plnit kartami něco, co se nemá opakovat,
je zneužití plánovače.

# Rozhodnutí

Nejnovější nahoře. Formát: co, proč, jaké alternativy zamítnuty.

## 2026-09-02 — Dotažení: plán, hranice, slepé mapy, vlastní poznámky

**Plán do zkoušek počítá potřebu proti SKUTEČNÉMU času** (Nastavení „kolik času
denně mám"), a když se to nevejde, řekne co škrtnout — od nejvzdálenější zkoušky.
🔴 První verze radila „škrtni 300 karet ze zeměpisu" a ušetřila tím 3 minuty,
zatímco problém dělalo právo. Teď se škrtá **jen tak hluboko, jak je potřeba**,
postupně přes předměty, a když ani to nestačí (hromada už naučených karet, které
se prostě musí opakovat), appka to **přizná** místo aby vymyslela další radu.

**Den před zkouškou žádné nové karty** (`isExamImminent`) — jen opakování.
Nabifloval bys nové věci na úkor spánku a výsledek by to zhoršilo.

**Nad 150 % dnešní dávky appka sama řekne dost** (`isOverdoing`) — dá se odklepnout,
ale ne přehlédnout. Přeučení před zkouškou výsledek snižuje.

**Zeigarnik**: konec uprostřed tématu uloží nit („Dnes jsi skončil u tématu X"),
druhý den zní „Začni tématem X". Dokončená dávka nit smaže — není co dotahovat.

**Nová etapa** (pondělí / 1. v měsíci / den po zkoušce) se nabídne **jednou za den**,
jinak by z toho bylo otravování.

**Slepé mapy jsou zdarma a offline.** Prst nakreslí obdélník, název je odpověď,
z každého pojmenovaného místa vznikne karta se **stejnou mapou pro kontext**.
Souřadnice jsou relativní (0–1), takže maska nakreslená na mobilu sedí i na
notebooku. Dva režimy: odkrytý zbytek mapy (poznáváš podle okolí) vs. zakryté
všechno (sousedi nenapoví).

**Import vlastních poznámek bez modelu**: „Pojem — význam" na řádek, tabulka
z tabulkového editoru, markdown tabulka, věty s {{vynechávkou}} nebo otázka a
odpověď na dvou řádcích. Formát se **hádá** (oddělovač musí sedět aspoň na
polovině řádků), místo aby si uživatel vybíral z menu.

**Připomínka říká tvou vlastní větu** (implementation intention ze Plánu), ne
„čas na učení". Server ji čte ze sync snapshotu, vyhrává předmět s nejbližší
zkouškou.

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
