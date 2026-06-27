import type { Urgency } from './theme'

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

export function urgency(days: number | null): Urgency {
  if (days === null) return 'none'
  if (days <= 3) return 'near'
  if (days <= 7) return 'mid'
  return 'far'
}

/** Czech, human-friendly countdown label for the home screen. */
export function countdownLabel(days: number | null): string {
  if (days === null) return 'bez termínu'
  if (days < 0) {
    const n = Math.abs(days)
    return `${n} ${czDays(n)} po termínu`
  }
  if (days === 0) return 'dnes'
  if (days === 1) return 'zítra'
  return `za ${days} ${czDays(days)}`
}

function czDays(n: number): string {
  if (n === 1) return 'den'
  if (n >= 2 && n <= 4) return 'dny'
  return 'dní'
}

export function formatExamDate(examDate: string | null): string {
  if (!examDate) return ''
  return parseExamDate(examDate).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
