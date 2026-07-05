// Thin, pure wrapper around ts-fsrs that maps between our stored card shape
// (ISO strings + lowercase state names) and the library's Card/enum types.
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import type { Card as FsrsCard, Grade } from 'ts-fsrs'
import type { Card, FsrsStateName, RatingName } from '../db/db'
import { endOfDay, parseExamDate, startOfDay } from '../lib/date'

/** Default FSRS target retention; user-tunable in Settings (0.80–0.95). */
export const DEFAULT_RETENTION = 0.9

// Day-granular intervals: the deadline-driven planner works in whole days, and
// intra-session re-review of "again" cards is handled by the scheduler, so the
// sub-day (re)learning steps are disabled.
const schedulers = new Map<number, ReturnType<typeof fsrs>>()

function schedulerFor(retention: number): ReturnType<typeof fsrs> {
  const key = Math.round(retention * 100) / 100
  let s = schedulers.get(key)
  if (!s) {
    s = fsrs(generatorParameters({ enable_short_term: false, request_retention: key }))
    schedulers.set(key, s)
  }
  return s
}

const STATE_NAME: Record<number, FsrsStateName> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}

const NAME_STATE: Record<FsrsStateName, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}

const RATING_GRADE: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

export interface FsrsFields {
  due: string
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: FsrsStateName
  lastReview: string | null
}

/** Fresh FSRS state for a brand-new card. */
export function newFsrsFields(now: Date = new Date()): FsrsFields {
  return toFields(createEmptyCard(now), now)
}

function toFsrsCard(card: Card): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    // These are recomputed by FSRS from last_review + now, so the value is moot.
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: NAME_STATE[card.state],
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  }
}

function toFields(c: FsrsCard, now: Date): FsrsFields {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
    state: STATE_NAME[c.state],
    lastReview: (c.last_review ?? (c.reps > 0 ? now : null))?.toISOString() ?? null,
  }
}

/**
 * Run FSRS for a rating and return the next scheduling state.
 * Deadline clamp: a review is never scheduled past the subject's exam day — if
 * the computed interval overshoots, the due date is pulled back to the exam day
 * so the card is still seen at least once before the exam.
 */
export function rate(
  card: Card,
  rating: RatingName,
  examDate: string | null,
  now: Date = new Date(),
  retention: number = DEFAULT_RETENTION,
): FsrsFields {
  const { card: next } = schedulerFor(retention).next(toFsrsCard(card), now, RATING_GRADE[rating])
  const fields = toFields(next, now)

  if (examDate) {
    const cap = endOfDay(parseExamDate(examDate))
    const dueMs = new Date(fields.due).getTime()
    // Only clamp toward a future exam; a past exam leaves FSRS scheduling alone.
    if (cap.getTime() > now.getTime() && dueMs > cap.getTime()) {
      fields.due = cap.toISOString()
    }
  }

  return fields
}

const DAY_MS = 86_400_000

/**
 * Anki-style interval preview: for each rating, the calendar-day distance to
 * the due date it would produce (deadline clamp included), so the rating
 * buttons can show what each choice means before it is made.
 */
export function previewIntervals(
  card: Card,
  examDate: string | null,
  now: Date = new Date(),
  retention: number = DEFAULT_RETENTION,
): Record<RatingName, number> {
  const days = (r: RatingName): number => {
    const due = new Date(rate(card, r, examDate, now, retention).due)
    return Math.max(0, Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY_MS))
  }
  return { again: days('again'), hard: days('hard'), good: days('good'), easy: days('easy') }
}

/**
 * FSRS forgetting-curve recall probability of a card at a moment (0..1).
 * A card never studied has nothing to recall yet → 0.
 */
export function retrievabilityAt(
  card: Card,
  at: Date,
  retention: number = DEFAULT_RETENTION,
): number {
  if (card.state === 'new' || card.reps === 0) return 0
  const r = schedulerFor(retention).get_retrievability(toFsrsCard(card), at, false)
  return Math.min(1, Math.max(0, r))
}
