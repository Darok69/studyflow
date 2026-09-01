// Precommitment (BRIEF §5.17): the exam date decides the daily dose, and when
// the dose does not fit into the time that actually exists, the app says so
// BEFORE the last week — and names what to cut, instead of leaving the student
// to discover it the hard way.
import { AVG_SECONDS_PER_CARD } from './wellbeing'
import { DEFAULT_HORIZON_DAYS } from '../scheduler/scheduler'

/**
 * How many reviews one new card drags behind it before the exam. FSRS spaces a
 * fresh card several times over the first days; two and a half is the honest
 * middle for a horizon of weeks.
 */
export const REVIEWS_PER_NEW_CARD = 2.5
/** A learned card comes round roughly once a week while it is still young. */
export const REVIEW_ROTATION_DAYS = 7

export interface PlanCard {
  subjectId: string
  state: string
  level?: 1 | 2 | 3
  suspended?: boolean
  draft?: boolean
}

export interface PlanSubject {
  id: string
  name: string
  daysUntilExam: number | null
}

export interface SubjectLoad {
  subjectId: string
  name: string
  daysUntilExam: number | null
  /** Days the plan is spread over — the exam, or a default horizon. */
  horizon: number
  cardsRemaining: number
  newPerDay: number
  minutesPerDay: number
}

export interface PlanCut {
  subjectId: string
  name: string
  /** Level-1 cards that would have to go for the rest to fit. */
  cards: number
}

export interface CapacityPlan {
  perSubject: SubjectLoad[]
  neededMinutes: number
  availableMinutes: number
  fits: boolean
  /** What to drop, most distant exam first — empty when the plan fits. */
  cuts: PlanCut[]
  /**
   * True when even dropping everything that can be dropped is not enough: the
   * nearest deadline alone overflows the day. Then the honest answer is more
   * time or a smaller deck, not another cut.
   */
  notEnough: boolean
}

function minutesFor(cards: number): number {
  return (cards * AVG_SECONDS_PER_CARD) / 60
}

/**
 * Daily minutes each subject really needs, and whether the total fits into the
 * time available. Cutting starts with recall-level cards of the MOST DISTANT
 * exam: the near deadline is untouchable, and level 1 is what a summary can
 * replace at a push.
 */
export function capacityPlan(
  subjects: PlanSubject[],
  cards: PlanCard[],
  availableMinutes: number,
): CapacityPlan {
  const perSubject: SubjectLoad[] = subjects.map((s) => {
    const own = cards.filter((c) => c.subjectId === s.id && !c.suspended && !c.draft)
    const fresh = own.filter((c) => c.state === 'new').length
    const learned = own.length - fresh
    const horizon =
      s.daysUntilExam === null ? DEFAULT_HORIZON_DAYS : Math.max(1, s.daysUntilExam)
    const newPerDay = Math.ceil(fresh / horizon)
    const reviewsPerDay = newPerDay * REVIEWS_PER_NEW_CARD + learned / REVIEW_ROTATION_DAYS
    return {
      subjectId: s.id,
      name: s.name,
      daysUntilExam: s.daysUntilExam,
      horizon,
      cardsRemaining: fresh,
      newPerDay,
      minutesPerDay: Math.round(minutesFor(newPerDay + reviewsPerDay) * 10) / 10,
    }
  })

  const neededMinutes = Math.round(perSubject.reduce((n, p) => n + p.minutesPerDay, 0) * 10) / 10
  const fits = neededMinutes <= availableMinutes

  const cuts: PlanCut[] = []
  let over = neededMinutes - availableMinutes

  if (!fits) {
    // The most distant exam gives way first; a deadline this week does not.
    // Each subject is cut only as deep as it needs to be, and dropping every
    // card of a subject saves exactly what that subject costs per day — no
    // more. Suggesting "drop all 300 geography cards" to win three minutes is
    // not advice, it is noise.
    const candidates = [...perSubject]
      .filter((p) => p.cardsRemaining > 0)
      .sort(
        (a, b) =>
          (b.daysUntilExam ?? DEFAULT_HORIZON_DAYS) - (a.daysUntilExam ?? DEFAULT_HORIZON_DAYS),
      )

    for (const target of candidates) {
      if (over <= 0) break
      // Every dropped new card also drops the reviews it would have pulled in.
      const minutesPerCard = minutesFor(1 + REVIEWS_PER_NEW_CARD) / target.horizon
      const cardsNeeded = Math.ceil(over / Math.max(minutesPerCard, 0.001))
      const cards = Math.min(target.cardsRemaining, Math.max(1, cardsNeeded))
      cuts.push({ subjectId: target.subjectId, name: target.name, cards })
      over = Math.round((over - cards * minutesPerCard) * 10) / 10
    }
  }

  return { perSubject, neededMinutes, availableMinutes, fits, cuts, notEnough: !fits && over > 0 }
}
