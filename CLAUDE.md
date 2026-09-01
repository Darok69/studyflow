# StudyFlow

Jednouživatelská aplikace pro souběžné studium práv (Uni Wien) a zeměpisu.
Ze surových podkladů dělá učební balíčky a řídí denní plán. Musí fungovat offline.

Zadání: [BRIEF.md](BRIEF.md) — cílový stav. [DECISIONS.md](DECISIONS.md) — co se
od zadání liší a proč. Při rozporu rozhoduje DECISIONS.md, protože popisuje kód,
který tu opravdu je.

## Skutečný stack (brief popisuje jiný — viz DECISIONS.md)

Vite + React 19 + TypeScript strict · Dexie/IndexedDB jako zdroj pravdy ·
`ts-fsrs` · vite-plugin-pwa · Fastify server (`server/`, plain JS) s JSON soubory
v `/data` · jeden Docker kontejner za Caddy na study.dmarka.eu.

## Příkazy

```
npm run dev      # dev server na :5173 (VITE_SERVER=1 = režim s loginem a syncem)
npm run build    # tsc -b + vite build → dist/
npm test         # čistá logická suite (rolldown + node), bez DOM a bez IndexedDB
npm run lint     # oxlint
```

Před commitem: `npm run build && npm test && npm run lint` — všechno zelené.

## Pravidla

- TypeScript strict, žádné `any`, žádné `@ts-ignore`.
- **Anthropic API výhradně server-side** (`server/src/ai.js`). Klíč nikdy do
  klientského bundlu — ověřuje se grepem nad `dist/` a statickým testem, že
  `src/**` neimportuje `@anthropic-ai/sdk`.
- Každá funkce závislá na API má pravidlový fallback a **řekne**, že jel fallback.
- Plánování opakování dělá výhradně `ts-fsrs` (`src/scheduler/fsrs.ts`), nikde
  vlastní intervaly.
- Souřadnice masek u obrázků jsou vždy relativní (0–1).
- Sdílená čistá logika pipeline žije v `src/pipeline/*.ts` a pro server se
  bundluje rolldownem do `server/gen/` — nepsat ji dvakrát.
- Binárky (PDF, rendery stránek, fotky) patří do blob úložiště serveru, **ne**
  do sync snapshotu — ten má strop 32 MB a nese celý stav appky.
- UI česky (i18n cs/en/de v `src/i18n/`), obsah karet v původním jazyce podkladů;
  odborné termíny se nepřekládají.
- Mobile-first: testovat na šířce 380 px, primární akce v dosahu palce.
- Přístupnost: viditelný focus, ovládání klávesnicí, `prefers-reduced-motion`.

## Rozhodnutí

Zapisuj do [DECISIONS.md](DECISIONS.md): co, proč, jaké alternativy zamítnuty.
Nejnovější nahoře.
