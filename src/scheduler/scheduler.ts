// Pure scheduling core. No DB, no React, no side effects — easy to test and
// reason about. Builds today's interleaved study queue across subjects.
import type { FsrsStateName } from '../db/db'
import { dayKey, daysUntil, endOfDay } from '../lib/date'

export interface SchedSubject {
  id: string
  examDate: string | null
  /** Manual "new cards per day" for this subject; null/undefined = auto from exam date. */
  dailyNewLimit?: number | null
}

export interface SchedCard {
  id: string
  subjectId: string
  state: FsrsStateName
  due: string // ISO
  suspended?: boolean
  buriedUntil?: string | null // YYYY-MM-DD
}

/**
 * A card takes part in scheduling unless it is suspended or still buried.
 * (Day keys are ISO dates, so string comparison is chronological.)
 */
export function isSchedulable(card: SchedCard, now: Date): boolean {
  if (card.suspended) return false
  if (card.buriedUntil && card.buriedUntil >= dayKey(now)) return false
  return true
}

export interface SubjectPlan {
  subjectId: string
  daysUntilExam: number | null
  total: number // all cards in the subject
  studied: number // cards no longer in the "new" state
  dueReviews: number
  newRemaining: number
  newQuota: number // new cards actually scheduled today (after any cap)
}

export interface SessionPlan {
  order: string[] // ordered card ids for today
  total: number
  dueReviews: number
  newCards: number
  perSubject: SubjectPlan[]
}

export interface SessionOptions {
  /** Soft daily cap on TOTAL new cards across subjects (wellbeing guardrail). */
  newCardCap?: number | null
  /**
   * New cards already introduced (first-ever review) today, per subject id.
   * Makes quotas and the global cap hold across sessions — re-opening the app
   * mid-day no longer offers a fresh batch on top of what was studied.
   */
  introducedToday?: Map<string, number>
}

/**
 * Count cards whose FIRST review ever happened today, grouped by subject.
 * Pure companion for SessionOptions.introducedToday.
 */
export function introducedTodayBySubject(
  reviews: { cardId: string; ts: string }[],
  cards: Pick<SchedCard, 'id' | 'subjectId'>[],
  now: Date = new Date(),
): Map<string, number> {
  const firstTs = new Map<string, string>()
  for (const r of reviews) {
    const prev = firstTs.get(r.cardId)
    if (!prev || r.ts < prev) firstTs.set(r.cardId, r.ts)
  }
  const today = dayKey(now)
  const subjectOf = new Map(cards.map((c) => [c.id, c.subjectId]))
  const out = new Map<string, number>()
  for (const [cardId, ts] of firstTs) {
    if (dayKey(new Date(ts)) !== today) continue
    const subjectId = subjectOf.get(cardId)
    if (!subjectId) continue
    out.set(subjectId, (out.get(subjectId) ?? 0) + 1)
  }
  return out
}

// Horizon used to pace new cards for subjects without an exam date.
export const DEFAULT_HORIZON_DAYS = 14

/**
 * Per-subject daily new-card quota = ceil(remaining new / days until exam).
 * An exam today/in the past (days <= 0) collapses the horizon to 1 → cram all
 * remaining new cards today. No exam → pace over a default horizon.
 */
export function newCardQuota(newRemaining: number, daysUntilExam: number | null): number {
  if (newRemaining <= 0) return 0
  const horizon = daysUntilExam === null ? DEFAULT_HORIZON_DAYS : Math.max(1, daysUntilExam)
  return Math.ceil(newRemaining / horizon)
}

function isDueReview(card: SchedCard, now: Date): boolean {
  return card.state !== 'new' && new Date(card.due).getTime() <= endOfDay(now).getTime()
}

function byDueAsc(a: SchedCard, b: SchedCard): number {
  return new Date(a.due).getTime() - new Date(b.due).getTime()
}

/** Sort subjects nearer-deadline first; subjects without an exam date go last. */
function byDeadline(now: Date) {
  return (a: SchedSubject, b: SchedSubject): number => {
    const da = daysUntil(a.examDate, now)
    const db = daysUntil(b.examDate, now)
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return da - db
  }
}

/**
 * Build today's queue: every due review (all subjects) + each subject's new
 * quota, interleaved round-robin. Within each round subjects are visited in
 * deadline order, so nearer-deadline subjects take the earlier slots.
 */
export function buildSession(
  subjects: SchedSubject[],
  cards: SchedCard[],
  now: Date = new Date(),
  opts: SessionOptions = {},
): SessionPlan {
  const bySubject = new Map<string, SchedCard[]>()
  for (const c of cards) {
    const arr = bySubject.get(c.subjectId)
    if (arr) arr.push(c)
    else bySubject.set(c.subjectId, [c])
  }

  const ordered = [...subjects].sort(byDeadline(now))
  const perSubject: SubjectPlan[] = []
  const lanes: string[][] = []

  // Soft daily cap on new cards, spent in deadline order so nearer exams keep
  // their share. Due reviews are never capped — only the new-card intake.
  // Cards already introduced today count against both the cap and the quotas.
  const introduced = opts.introducedToday ?? new Map<string, number>()
  const introducedTotal = [...introduced.values()].reduce((a, b) => a + b, 0)
  let capRemaining =
    typeof opts.newCardCap === 'number'
      ? Math.max(0, Math.floor(opts.newCardCap) - introducedTotal)
      : Infinity

  for (const s of ordered) {
    // Suspended cards leave the subject entirely; buried ones only sit out the
    // queue for today but still count toward the subject's totals.
    const list = (bySubject.get(s.id) ?? []).filter((c) => !c.suspended)
    const active = list.filter((c) => isSchedulable(c, now))
    const due = active.filter((c) => isDueReview(c, now)).sort(byDueAsc)
    const news = active.filter((c) => c.state === 'new')
    const dExam = daysUntil(s.examDate, now)
    const alreadyToday = introduced.get(s.id) ?? 0
    // Manual per-day limit wins over the auto pace; the auto pace is computed
    // over the day's full pool (remaining + already introduced) so finishing
    // today's batch and reopening the app doesn't top the quota back up.
    const wanted =
      s.dailyNewLimit != null
        ? Math.max(0, Math.floor(s.dailyNewLimit))
        : newCardQuota(news.length + alreadyToday, dExam)
    const quota = Math.min(Math.max(0, wanted - alreadyToday), news.length, capRemaining)
    capRemaining -= quota

    // Within a subject: clear the backlog (due reviews) first, then new cards.
    const lane = [...due.map((c) => c.id), ...news.slice(0, quota).map((c) => c.id)]

    perSubject.push({
      subjectId: s.id,
      daysUntilExam: dExam,
      total: list.length,
      studied: list.filter((c) => c.state !== 'new').length,
      dueReviews: due.length,
      newRemaining: news.length,
      newQuota: quota,
    })
    if (lane.length) lanes.push(lane)
  }

  const order: string[] = []
  const cursors = new Array(lanes.length).fill(0)
  let remaining = lanes.reduce((n, l) => n + l.length, 0)
  while (remaining > 0) {
    for (let i = 0; i < lanes.length; i++) {
      const c = cursors[i]
      if (c < lanes[i].length) {
        order.push(lanes[i][c])
        cursors[i] = c + 1
        remaining--
      }
    }
  }

  return {
    order,
    total: order.length,
    dueReviews: perSubject.reduce((n, p) => n + p.dueReviews, 0),
    newCards: perSubject.reduce((n, p) => n + p.newQuota, 0),
    perSubject,
  }
}

export interface SubjectStats {
  total: number
  studied: number // cards no longer in the "new" state
  dueToday: number
  newToday: number
  daysUntilExam: number | null
}

/** Lightweight per-subject counts for the home screen. */
export function subjectStats(
  subject: SchedSubject,
  cards: SchedCard[],
  now: Date = new Date(),
  introducedToday = 0,
): SubjectStats {
  const list = cards.filter((c) => c.subjectId === subject.id && !c.suspended)
  const active = list.filter((c) => isSchedulable(c, now))
  const news = active.filter((c) => c.state === 'new')
  const dExam = daysUntil(subject.examDate, now)
  const wanted =
    subject.dailyNewLimit != null
      ? Math.max(0, Math.floor(subject.dailyNewLimit))
      : newCardQuota(news.length + introducedToday, dExam)
  return {
    total: list.length,
    studied: list.filter((c) => c.state !== 'new').length,
    dueToday: active.filter((c) => isDueReview(c, now)).length,
    newToday: Math.min(Math.max(0, wanted - introducedToday), news.length),
    daysUntilExam: dExam,
  }
}

const REINSERT_GAP = 3

/**
 * Re-insert an "again" card a few positions later in the remaining queue so it
 * comes back this session without immediately repeating. Pure helper used by
 * the live study session.
 */
export function reinsertAgain(queue: string[], index: number, gap: number = REINSERT_GAP): string[] {
  const next = [...queue]
  const id = next[index]
  const at = Math.min(index + gap, next.length)
  next.splice(at, 0, id)
  return next
}
