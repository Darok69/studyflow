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
npm test           # pure-logic unit suite (scheduler, FSRS, wellbeing, stats)
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

## Visual identity & wellbeing

Sprint 2 makes the app calm, legible, and supportive. The design optimises for
**adherence** and **low strain** — the learning science lives in the scheduler;
this layer is about whether the user keeps coming back and feels okay doing it.

### Colour system — two channels that never clash

Colour carries meaning, and the two meanings are kept strictly separate:

- **Identity** — each subject gets one of **8 curated hues** (violet, teal,
  amber, rose, sky, sage, coral, lavender). The hue is chosen deterministically
  from a hash of the subject id and stored as `colorIndex`, so a subject's colour
  is stable forever. Identity colour appears **only** as a graphical accent —
  the left bar on a subject card and the dot next to the subject label in study —
  never as text, so contrast is never a concern.
- **Urgency** — the deadline countdown and the progress bar use a separate
  far/mid/near scale (`#34C9A3` / `#E3A53A` / `#E5564E`). Urgency text is neutral
  ink on a tinted pill (the hue is the border/tint), and the label itself
  ("za 3 dny" / "dnes" / "po termínu") carries the meaning too, so it never relies
  on colour alone.
- **The study surface is never colourised.** The card face stays warm paper
  (`#F4EFE3`), high-contrast and serif — it's the focus zone.

### Wellbeing decisions

- **Today-focus + overwhelm guardrail.** Home shows today's load as due + new
  counts *and* an estimated time (~8 s/card). When a day is heavy (> 60 cards or
  > 25 min) a gentle banner reassures rather than pressures: *"Klidně to rozlož
  během dne — nemusíš všechno najednou."* It never auto-punishes.
- **Soft daily new-card cap** (Settings, default **off**). When enabled it caps
  total new cards per day so a pre-exam cram never dumps an impossible pile in one
  sitting; due reviews are never capped. The cap is spent nearest-deadline first.
- **Gentle, recoverable streak.** A current streak counts consecutive days with
  ≥1 review (with a one-day grace so it doesn't read 0 before you've studied
  today). Breaking it resets quietly — there is no "you lost it" UI anywhere.
- **Supportive copy, never punitive.** A missed day is met with *"Včera jsi
  vynechal — nevadí, jdeme dál."*, a finished day with calm praise. Empty states
  guide rather than blame.
- **Healthy session rhythm.** After ~22 min of continuous studying, a soft,
  dismissible nudge suggests a break. It's a suggestion — it never blocks.
- **Comfort & accessibility.** Text targets WCAG-AA contrast on the dark base;
  the base is warmed a hair for long-session eye comfort; `prefers-reduced-motion`
  disables transitions/animations.

These signals are computed by small pure modules (`src/lib/wellbeing.ts`,
`src/stats/stats.ts`, `src/lib/encouragement.ts`) and covered by `npm test`.

## Status

Sprints 1–2, fully offline, no backend: import → deadline-weighted schedule →
study → persist, with per-subject colour identity, wellbeing guardrails, a gentle
stats/streak view, and a settings screen. No sync, push, or accounts yet.
