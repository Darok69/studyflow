# StudyFlow

A local-first, offline study PWA. Import a JSON deck and study with a
deadline-weighted, multi-subject scheduler powered by **FSRS** (modern spaced
repetition). All state lives in **IndexedDB** — there is no backend.

UI language is Czech.

## Stack

- **Vite + React + TypeScript**
- **vite-plugin-pwa** — manifest, service worker, offline app-shell precache
- **dexie** — IndexedDB wrapper
- **ts-fsrs** — FSRS scheduling algorithm

## Run

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # type-check + production build → dist/ (installable PWA)
npm run preview    # serve the production build locally
npm run lint       # oxlint
```

### Try it

1. `npm run dev`, open the app, go to **Import**.
2. Click **Načíst ukázkový balíček** (load sample deck) → **Importovat**.
3. Back on the home screen press **Studovat vše** and rate cards
   (Znovu / Těžké / Dobré / Snadné, or keys `1`–`4`; `Space` reveals).
4. Refresh the page — all progress is preserved (IndexedDB).

### Offline / installable

`npm run build && npm run preview`, open it, then throttle the network to
**Offline** in DevTools and reload — the app shell loads from the service-worker
precache. The browser also offers to **install** the app (standalone window).

## Project structure

```
src/
  db/          Dexie database + data-access repository
    db.ts        schema & types: subjects, cards, reviews
    repo.ts      queries + mutations (import, rating, delete)
  scheduler/   pure scheduling core (no DB / no React)
    fsrs.ts      ts-fsrs wrapper: rating → next state + deadline clamp
    scheduler.ts new-card quota, interleaved queue, session helpers
  import/      deck ingestion
    parseDeck.ts   JSON → cards (incl. {{cloze}} parsing)
    sanitizeSvg.ts allowlist sanitizer for inline SVG
    sampleDeck.ts  demo deck + copyable AI-generation prompt
  components/  ProgressBar, CardFace, SvgView, RatingButtons, SubjectCard
  pages/       Home, Import, Study
  lib/         date helpers (countdown, urgency), theme palette
```

## Import format

```jsonc
{
  "subject": "Roman Law",
  "examDate": "2026-07-15",        // YYYY-MM-DD | null
  "reminderTime": "18:30",          // HH:MM | null (stored; not yet used)
  "cards": [
    { "type": "basic", "front": "Q?", "back": "A", "tags": [] },
    { "type": "cloze", "text": "The {{Twelve Tables}} were from 451 BC.", "tags": [] },
    { "type": "basic", "front": "Court stages?", "back": "...", "svg": "<svg ...>...</svg>" }
  ]
}
```

- **cloze**: each `{{answer}}` shows as `［ ___ ］` on the front and `［ answer ］`
  on the back.
- **svg**: inline SVG markup is sanitized (script / foreign content / event
  handlers / external refs stripped) and rendered above the card text.
- **image**: an image URL rendered as-is (reserved for later).

The Import screen also includes a copyable prompt for generating decks with an AI.

## Scheduler

The scheduling logic is a pure, dependency-free module (`src/scheduler`).

- **New-card quota per subject** = `ceil(remaining new / max(1, daysUntilExam))`.
  An exam today or in the past crams all remaining new cards; subjects without an
  exam date pace over a default 14-day horizon.
- **Today's queue** = every due review (across **all** subjects) + each subject's
  new-card quota.
- **Interleaving**: round-robin across subjects so no single subject blocks the
  others; within each round, nearer-deadline subjects take the earlier slots.
- **FSRS** computes the next due / stability / difficulty on each rating.
- **Deadline clamp**: a review is never scheduled *after* the subject's exam day —
  the interval is capped so the card is still seen before the exam.
- **"Znovu" (again)** re-inserts the card a few positions later in the current
  session.

> Note: FSRS runs with `enable_short_term: false` so intervals are day-granular
> (a natural fit for a deadline-driven planner); same-session re-review of "again"
> cards is handled by the scheduler's re-insertion rather than sub-day steps.

## Data model (IndexedDB via Dexie)

- **subjects** — `id, name, examDate, reminderTime, createdAt`
- **cards** — `id, subjectId, type, front, back, raw?, tags[], svg?, image?` +
  FSRS state `due, stability, difficulty, reps, lapses, state, lastReview`
- **reviews** — `id, cardId, rating, ts` (for stats / streaks)

## Status

Sprint 1 scaffold: import → schedule → study → persist, fully offline. No
backend, sync, notifications, or stats screens yet.
