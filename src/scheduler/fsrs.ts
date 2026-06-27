// Thin, pure wrapper around ts-fsrs that maps between our stored card shape
// (ISO strings + lowercase state names) and the library's Card/enum types.
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import type { Card as FsrsCard, Grade } from 'ts-fsrs'
import type { Card, FsrsStateName, RatingName } from '../db/db'
import { endOfDay, parseExamDate } from '../lib/date'

// Day-granular intervals: the deadline-driven planner works in whole days, and
// intra-session re-review of "again" cards is handled by the scheduler, so the
// sub-day (re)learning steps are disabled.
const scheduler = fsrs(generatorParameters({ enable_short_term: false }))

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
): FsrsFields {
  const { card: next } = scheduler.next(toFsrsCard(card), now, RATING_GRADE[rating])
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
