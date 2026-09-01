// Wellbeing-first guardrails. Turns raw card counts into humane, low-strain
// signals (a time estimate + an "is today heavy?" check) so the UI can reassure
// and inform rather than overwhelm. Pure + testable.

export const AVG_SECONDS_PER_CARD = 8
export const HEAVY_CARD_THRESHOLD = 60
export const HEAVY_MINUTES_THRESHOLD = 25
export const BREAK_NUDGE_MINUTES = 22
export const DEFAULT_DAILY_NEW_CAP = 20
/** Minutes a normal day really has for studying — the plan is measured against this. */
export const DEFAULT_DAILY_MINUTES = 25

/** Rough minutes for a number of cards (≈8 s each), min 1 when there are any. */
export function estimateMinutes(cardCount: number): number {
  if (cardCount <= 0) return 0
  return Math.max(1, Math.round((cardCount * AVG_SECONDS_PER_CARD) / 60))
}

export interface LoadAssessment {
  cards: number
  minutes: number
  heavy: boolean
}

/** Assess today's load: a heavy day is a lot of cards OR a long estimate. */
export function assessLoad(cardCount: number): LoadAssessment {
  const minutes = estimateMinutes(cardCount)
  return {
    cards: cardCount,
    minutes,
    heavy: cardCount > HEAVY_CARD_THRESHOLD || minutes > HEAVY_MINUTES_THRESHOLD,
  }
}

/**
 * Past this multiple of today's planned batch the app says stop. Grinding on
 * past the plan the night before an exam lowers the result — the extra hour is
 * paid for with the next day (BRIEF §5, healthy boundaries).
 */
export const OVERLOAD_FACTOR = 1.5

export function isOverdoing(reviewedToday: number, planned: number): boolean {
  return planned > 0 && reviewedToday >= Math.ceil(planned * OVERLOAD_FACTOR)
}

// ---- Leech detection ----
// A card that keeps lapsing is a formulation problem, not a willpower problem.
// Anki suspends leeches; we instead surface a gentle "rewrite me" suggestion.
export const LEECH_LAPSES = 6

export function isLeech(card: { lapses: number; state: string }): boolean {
  return card.state !== 'new' && card.lapses >= LEECH_LAPSES
}
