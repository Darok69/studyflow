// Exam readiness — the flagship "better than Anki" signal. Instead of counting
// cards, it asks the FSRS forgetting curve directly: "if the exam happened on
// its date, what fraction of this subject would I still recall?" Cards never
// studied contribute 0, so readiness starts low and honestly climbs as both
// coverage (new → learned) and stability (spaced reviews) grow.
import type { Card } from '../db/db'
import { DEFAULT_RETENTION, retrievabilityAt } from '../scheduler/fsrs'
import { endOfDay, parseExamDate } from '../lib/date'

export interface Readiness {
  percent: number // 0..100, mean predicted recall at the exam moment
  learned: number // cards with at least one review
  total: number
}

export type ReadinessBand = 'solid' | 'building' | 'fragile'

/**
 * Mean predicted recall across a subject's cards, evaluated at the exam day
 * (or right now when there is no exam date / the exam already passed).
 * Suspended cards are excluded — they were deliberately parked.
 */
export function subjectReadiness(
  cards: Card[],
  examDate: string | null,
  now: Date = new Date(),
  retention: number = DEFAULT_RETENTION,
): Readiness | null {
  const list = cards.filter((c) => !c.suspended)
  if (list.length === 0) return null

  const examMoment = examDate ? endOfDay(parseExamDate(examDate)) : now
  const at = examMoment.getTime() > now.getTime() ? examMoment : now

  let sum = 0
  let learned = 0
  for (const c of list) {
    const r = retrievabilityAt(c, at, retention)
    sum += r
    if (c.state !== 'new') learned++
  }

  return {
    percent: Math.round((sum / list.length) * 100),
    learned,
    total: list.length,
  }
}

/** Coarse band for colour + copy (uses the urgency scale: it IS an urgency). */
export function readinessBand(percent: number): ReadinessBand {
  if (percent >= 80) return 'solid'
  if (percent >= 55) return 'building'
  return 'fragile'
}
