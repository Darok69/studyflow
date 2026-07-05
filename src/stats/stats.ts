// Gentle progress signals derived purely from the `reviews` log (no schema
// change). Streak is SUPPORTIVE and RECOVERABLE — there is no "you lost it"
// state here, only counts the UI can frame kindly.
import { addDays, dayKey, startOfDay } from '../lib/date'
import { t } from '../i18n'

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
      label: t('weekdayShort', d.getDay()),
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

export interface ForecastCard {
  state: string
  due: string // ISO
  suspended?: boolean
  buriedUntil?: string | null // YYYY-MM-DD
}

/**
 * Review forecast: how many scheduled reviews land on each of the next `days`
 * days. Overdue cards pile onto today; a buried card counts from the day it
 * comes back. New cards are excluded — this is the committed review load.
 * Output shape matches DayBucket so the sparkline can render it directly.
 */
export function reviewForecast(
  cards: ForecastCard[],
  days: number = 14,
  now: Date = new Date(),
): DayBucket[] {
  const todayStart = startOfDay(now).getTime()
  const DAY_MS = 86_400_000

  const counts = new Array<number>(days).fill(0)
  for (const c of cards) {
    if (c.state === 'new' || c.suspended) continue
    let idx = Math.max(0, Math.floor((startOfDay(new Date(c.due)).getTime() - todayStart) / DAY_MS))
    if (c.buriedUntil) {
      const back = Math.floor(
        (startOfDay(addDays(new Date(`${c.buriedUntil}T00:00:00`), 1)).getTime() - todayStart) / DAY_MS,
      )
      idx = Math.max(idx, back)
    }
    if (idx < days) counts[idx]++
  }

  const todayK = dayKey(now)
  return counts.map((count, i) => {
    const d = startOfDay(addDays(now, i))
    const k = dayKey(d)
    return {
      key: k,
      label: i === 0 ? t('countdownToday') : t('weekdayShort', d.getDay()),
      count,
      isToday: k === todayK,
    }
  })
}

export interface HeatCell {
  key: string // YYYY-MM-DD
  count: number
  level: 0 | 1 | 2 | 3 | 4 // 0 = none; 1–4 scale relative to the busiest day
  future: boolean // after today (rendered blank)
}

/**
 * GitHub-style activity heatmap: `weeks` columns of Monday-first weeks ending
 * with the current week. Levels are relative to the busiest day in range so
 * light and heavy studiers both get a readable gradient.
 */
export function heatmapWeeks(
  timestamps: string[],
  weeks: number = 12,
  now: Date = new Date(),
): HeatCell[][] {
  const counts = new Map<string, number>()
  for (const ts of timestamps) {
    const k = dayKey(new Date(ts))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  const today = startOfDay(now)
  // Monday of the current week (getDay(): 0 = Sunday → back 6 days).
  const mondayShift = (today.getDay() + 6) % 7
  const firstMonday = addDays(today, -mondayShift - (weeks - 1) * 7)

  let max = 0
  for (const [, n] of counts) max = Math.max(max, n)

  const level = (n: number): HeatCell['level'] => {
    if (n <= 0 || max === 0) return 0
    const r = n / max
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  }

  const grid: HeatCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const day = addDays(firstMonday, w * 7 + d)
      const k = dayKey(day)
      const n = counts.get(k) ?? 0
      col.push({ key: k, count: n, level: level(n), future: day.getTime() > today.getTime() })
    }
    grid.push(col)
  }
  return grid
}
