// Gentle progress signals derived purely from the `reviews` log (no schema
// change). Streak is SUPPORTIVE and RECOVERABLE — there is no "you lost it"
// state here, only counts the UI can frame kindly.
import { addDays, dayKey, startOfDay } from '../lib/date'
import { t } from '../i18n'

/** Missed days a month may absorb before a streak actually breaks (BRIEF §5.15). */
export const FREE_DAYS_PER_MONTH = 2

export interface Streak {
  days: number
  /** Free days already spent inside the running streak. */
  used: number
  /** Free days still available this month. */
  left: number
}

/**
 * Current streak = calendar days with ≥1 review, counting back from today —
 * with a BANK OF FREE DAYS. A single missed day does not wipe weeks of work:
 * two skips a month are absorbed silently, because a zeroed streak is what
 * drives people out of a study app for good. Only a third gap ends it.
 *
 * Grace as before: a day that has only just begun does not count as missed.
 */
export function streakWithBank(timestamps: string[], now: Date = new Date()): Streak {
  const days = new Set(timestamps.map((ts) => dayKey(new Date(ts))))
  if (days.size === 0) return { days: 0, used: 0, left: FREE_DAYS_PER_MONTH }

  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) cursor = startOfDay(addDays(now, -1))

  let streak = 0
  let used = 0
  // Walk backwards; a gap spends a free day as long as the bank holds and the
  // streak actually continues before it.
  for (;;) {
    if (days.has(dayKey(cursor))) {
      streak++
      cursor = startOfDay(addDays(cursor, -1))
      continue
    }
    if (used >= FREE_DAYS_PER_MONTH || streak === 0) break
    // Only spend a free day if the streak really goes on beyond the gap.
    const before = startOfDay(addDays(cursor, -1))
    if (!days.has(dayKey(before))) break
    used++
    cursor = before
  }

  return { days: streak, used, left: Math.max(0, FREE_DAYS_PER_MONTH - used) }
}

/** Streak length only — the shape the older callers expect. */
export function currentStreak(timestamps: string[], now: Date = new Date()): number {
  return streakWithBank(timestamps, now).days
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

// ---- Calibration + weak spots (BRIEF §5.6, §6.7) ----

export interface ConfidenceBucket {
  total: number
  correct: number
}

export interface Calibration {
  sure: ConfidenceBucket
  unsure: ConfidenceBucket
  no: ConfidenceBucket
  /** Reviews that carried a confidence answer at all. */
  samples: number
}

/** Below this hit rate on "I know it" the self-assessment is optimistic. */
export const OVERCONFIDENCE_THRESHOLD = 0.8
/** Fewer answers than this say nothing yet. */
export const CALIBRATION_MIN_SAMPLES = 20

/**
 * How well the pre-answer confidence matches the outcome. "Correct" means the
 * card was not rated Again — the same bar the scheduler uses.
 */
export function calibration(
  reviews: { rating: string; confidence?: 'know' | 'unsure' | 'no' }[],
): Calibration {
  const empty = (): ConfidenceBucket => ({ total: 0, correct: 0 })
  const out: Calibration = { sure: empty(), unsure: empty(), no: empty(), samples: 0 }
  for (const r of reviews) {
    if (!r.confidence) continue
    const bucket = r.confidence === 'know' ? out.sure : r.confidence === 'unsure' ? out.unsure : out.no
    bucket.total++
    if (r.rating !== 'again') bucket.correct++
    out.samples++
  }
  return out
}

export function accuracy(bucket: ConfidenceBucket): number | null {
  return bucket.total === 0 ? null : bucket.correct / bucket.total
}

export type CalibrationVerdict = 'unknown' | 'overconfident' | 'honest'

export function calibrationVerdict(c: Calibration): CalibrationVerdict {
  if (c.samples < CALIBRATION_MIN_SAMPLES || c.sure.total === 0) return 'unknown'
  return (accuracy(c.sure) ?? 1) < OVERCONFIDENCE_THRESHOLD ? 'overconfident' : 'honest'
}

export interface WeakTopic {
  topic: string | null
  count: number
  /** Of those, mistakes made while feeling sure. */
  hyper: number
}

/**
 * Topics that keep going wrong, worst first. Confident mistakes count double:
 * a wrong answer you trusted is worse than one you already doubted.
 */
export function weakTopics(
  errors: { topic?: string; kind: 'hypercorrection' | 'lapse' }[],
  limit = 5,
): WeakTopic[] {
  const byTopic = new Map<string, WeakTopic>()
  for (const e of errors) {
    const key = e.topic ?? ''
    const cur = byTopic.get(key) ?? { topic: e.topic ?? null, count: 0, hyper: 0 }
    cur.count++
    if (e.kind === 'hypercorrection') cur.hyper++
    byTopic.set(key, cur)
  }
  return [...byTopic.values()]
    .sort((a, b) => b.count + b.hyper - (a.count + a.hyper))
    .slice(0, limit)
}
