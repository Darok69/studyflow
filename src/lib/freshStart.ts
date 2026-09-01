// Fresh start effect (BRIEF §5.14): people commit to a plan far more readily on
// a day that feels like a beginning. Monday, the first of the month and the day
// after an exam are exactly those days — so the app offers the new stage there
// instead of nagging on a random Wednesday.
import { dayKey, daysUntil } from './date'

export type FreshStart = 'after-exam' | 'month' | 'monday' | null

/**
 * Which kind of beginning today is, most meaningful first. An exam that has
 * just been written outranks the calendar: that is when the plan really changes.
 */
export function freshStart(now: Date, examDates: (string | null)[]): FreshStart {
  const justWritten = examDates.some((date) => {
    const days = daysUntil(date, now)
    return days !== null && days <= 0 && days >= -2
  })
  if (justWritten) return 'after-exam'
  if (now.getDate() === 1) return 'month'
  if (now.getDay() === 1) return 'monday'
  return null
}

/** One fresh-start offer per day, at most — it is an invitation, not a nag. */
const KEY = 'studyflow-fresh-start-seen'

export function freshStartSeen(now: Date): boolean {
  try {
    return localStorage.getItem(KEY) === dayKey(now)
  } catch {
    return true
  }
}

export function markFreshStartSeen(now: Date): void {
  try {
    localStorage.setItem(KEY, dayKey(now))
  } catch {
    /* nothing to do */
  }
}
