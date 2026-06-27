// Gentle progress signals derived purely from the `reviews` log (no schema
// change). Streak is SUPPORTIVE and RECOVERABLE — there is no "you lost it"
// state here, only counts the UI can frame kindly.
import { addDays, dayKey, startOfDay } from '../lib/date'

// Czech short weekday names, indexed by Date.getDay() (0 = Sunday).
const WEEKDAY_CS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']

/**
 * Current streak = consecutive calendar days with ≥1 review, counting back from
 * today. Grace: if today has no reviews yet, counting starts at yesterday, so
 * the streak never reads 0 just because the day has only begun. A genuine gap
 * (no reviews today or yesterday) quietly resets it to 0.
 */
export function currentStreak(timestamps: string[], now: Date = new Date()): number {
  const days = new Set(timestamps.map((ts) => dayKey(new Date(ts))))
  if (days.size === 0) return 0

  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) {
    cursor = startOfDay(addDays(now, -1))
    if (!days.has(dayKey(cursor))) return 0
  }

  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor = startOfDay(addDays(cursor, -1))
  }
  return streak
}

export interface DayBucket {
  key: string
  label: string
  count: number
  isToday: boolean
}

/** Review counts for the last 7 calendar days (oldest → today), for a sparkline. */
export function reviewsLast7Days(timestamps: string[], now: Date = new Date()): DayBucket[] {
  const counts = new Map<string, number>()
  for (const ts of timestamps) {
    const k = dayKey(new Date(ts))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  const todayK = dayKey(now)
  const buckets: DayBucket[] = []
  for (let i = 6; i >= 0; i--) {
    const d = startOfDay(addDays(now, -i))
    const k = dayKey(d)
    buckets.push({
      key: k,
      label: WEEKDAY_CS[d.getDay()],
      count: counts.get(k) ?? 0,
      isToday: k === todayK,
    })
  }
  return buckets
}

export function reviewsToday(timestamps: string[], now: Date = new Date()): number {
  const k = dayKey(now)
  return timestamps.reduce((n, ts) => (dayKey(new Date(ts)) === k ? n + 1 : n), 0)
}

/** Total reviews within the last `days` calendar days (inclusive of today). */
export function reviewsInLastDays(timestamps: string[], days: number, now: Date = new Date()): number {
  const cutoff = startOfDay(addDays(now, -(days - 1))).getTime()
  return timestamps.reduce((n, ts) => (new Date(ts).getTime() >= cutoff ? n + 1 : n), 0)
}
