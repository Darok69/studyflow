import type { Urgency } from './theme'
import { t } from '../i18n'

const DAY_MS = 86_400_000

export function startOfDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

export function endOfDay(d: Date): Date {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e
}

/** Local calendar-day key, 'YYYY-MM-DD' (used for streaks / day bucketing). */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Parse a 'YYYY-MM-DD' string as a local Date (midnight). */
export function parseExamDate(examDate: string): Date {
  return new Date(`${examDate}T00:00:00`)
}

/** Whole days from today (local midnight) to the exam date. Null when no exam. */
export function daysUntil(examDate: string | null, now: Date = new Date()): number | null {
  if (!examDate) return null
  const exam = startOfDay(parseExamDate(examDate)).getTime()
  const today = startOfDay(now).getTime()
  return Math.round((exam - today) / DAY_MS)
}

/** Whole local calendar days from today to a Date (negative = in the past). */
export function daysUntilDate(d: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS)
}

export function urgency(days: number | null): Urgency {
  if (days === null) return 'none'
  if (days <= 3) return 'near'
  if (days <= 7) return 'mid'
  return 'far'
}

/** Human-friendly countdown label for the home screen (localised). */
export function countdownLabel(days: number | null): string {
  if (days === null) return t('countdownNone')
  if (days < 0) return t('countdownOverdue', Math.abs(days))
  if (days === 0) return t('countdownToday')
  if (days === 1) return t('countdownTomorrow')
  return t('countdownIn', days)
}

export function formatExamDate(examDate: string | null): string {
  if (!examDate) return ''
  return parseExamDate(examDate).toLocaleDateString(t('locale'), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
