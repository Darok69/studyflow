/**
 * Mock exam: multiple-choice questions scored the way a Moodle test scores them.
 *
 * Cards train recall; a written multiple-choice exam asks something else — to
 * judge four statements that all LOOK right. That skill only grows by doing it
 * under exam conditions, so the bank is a separate thing from the deck: it is
 * served next to the textbook (`mc-<id>.json`) and a run is a timed sitting,
 * not a review.
 *
 * Pure on purpose (no DOM, no Dexie) — the test screen and the tests share it.
 */

export interface McOption {
  t: string
  correct: boolean
}

export interface McQuestion {
  id: string
  /** single = exactly one right answer; multi = at least one, partial credit. */
  type: 'single' | 'multi'
  q: string
  options: McOption[]
  explain?: string
  /** Lecture title — the same string the deck uses as the card topic. */
  topic?: string
  /** CEFR level of a placement question (A1–C2). */
  level?: string
  lecture?: string
  slide?: number
  source?: string
}

export interface McBank {
  id: string
  subject: string
  examDate?: string | null
  /** What the real sitting looks like, as far as it is known. */
  format?: { minutes?: number; questions?: number; note?: string; timed?: boolean; placement?: boolean }
  questions: McQuestion[]
}

/** One answered question inside a run. `selected` are ORIGINAL option indices. */
export interface McAnswer {
  qid: string
  selected: number[]
  points: number
  max: number
}

export const POINTS = { single: 1, multi: 2 } as const

/**
 * Points for one question.
 *
 * single: all or nothing.
 * multi: Moodle-style partial credit — every right option ticked earns its
 * share of the points, every wrong one ticked costs its share, and the
 * question never goes below zero. Ticking everything therefore earns nothing,
 * which is exactly why it is not a strategy.
 */
export function scoreQuestion(q: McQuestion, selected: number[]): number {
  const max = POINTS[q.type]
  const picked = new Set(selected)
  if (q.type === 'single') {
    if (picked.size !== 1) return 0
    const [i] = [...picked]
    return q.options[i]?.correct ? max : 0
  }
  const right = q.options.filter((o) => o.correct).length
  const wrong = q.options.length - right
  let share = 0
  q.options.forEach((o, i) => {
    if (!picked.has(i)) return
    share += o.correct ? 1 / right : wrong > 0 ? -1 / wrong : 0
  })
  return Math.round(Math.max(0, share) * max * 100) / 100
}

export function isFullyRight(q: McQuestion, selected: number[]): boolean {
  return scoreQuestion(q, selected) === POINTS[q.type]
}

/** Small deterministic PRNG, so a run can be replayed and tests stay stable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface QuestionHistory {
  seen: number
  /** Result of the most recent attempt. */
  lastRight: boolean
}

/** Per-question history across every finished run. */
export function questionHistory(
  runs: { answers: McAnswer[] }[],
): Map<string, QuestionHistory> {
  const out = new Map<string, QuestionHistory>()
  // Runs come oldest first; a later attempt overwrites `lastRight`.
  for (const run of runs) {
    for (const a of run.answers) {
      const prev = out.get(a.qid)
      out.set(a.qid, { seen: (prev?.seen ?? 0) + 1, lastRight: a.points === a.max })
    }
  }
  return out
}

/**
 * Pick the questions for one sitting.
 *
 * Order of preference: questions last answered WRONG (that is where the points
 * are lost), then ones never seen, then the rest — least seen first. Inside a
 * group the order is random. The result is shuffled again so the wrong ones do
 * not all come first and give themselves away.
 */
export function pickQuestions(
  bank: McQuestion[],
  count: number,
  history: Map<string, QuestionHistory>,
  rnd: () => number,
  topics?: Set<string> | null,
): McQuestion[] {
  const pool = topics && topics.size > 0 ? bank.filter((q) => topics.has(q.topic ?? '')) : bank
  const wrong: McQuestion[] = []
  const fresh: McQuestion[] = []
  const rest: McQuestion[] = []
  for (const q of shuffle(pool, rnd)) {
    const h = history.get(q.id)
    if (!h) fresh.push(q)
    else if (!h.lastRight) wrong.push(q)
    else rest.push(q)
  }
  rest.sort((a, b) => (history.get(a.id)?.seen ?? 0) - (history.get(b.id)?.seen ?? 0))
  const chosen = [...wrong, ...fresh, ...rest].slice(0, Math.max(0, count))
  return shuffle(chosen, rnd)
}

/** Option order for display; values are ORIGINAL indices. */
export function optionOrder(q: McQuestion, rnd: () => number): number[] {
  return shuffle(
    q.options.map((_, i) => i),
    rnd,
  )
}

export interface RunSummary {
  points: number
  max: number
  percent: number
  right: number
  partial: number
  wrong: number
}

export function summarize(answers: McAnswer[]): RunSummary {
  const points = Math.round(answers.reduce((s, a) => s + a.points, 0) * 100) / 100
  const max = answers.reduce((s, a) => s + a.max, 0)
  return {
    points,
    max,
    percent: max > 0 ? Math.round((points / max) * 100) : 0,
    right: answers.filter((a) => a.points === a.max).length,
    partial: answers.filter((a) => a.points > 0 && a.points < a.max).length,
    wrong: answers.filter((a) => a.points === 0).length,
  }
}

/** Topics where the most points were lost, worst first (only topics with ≥ 2 answers). */
export function weakTopicsInRuns(
  runs: { answers: McAnswer[] }[],
  topicOf: Map<string, string>,
): { topic: string; percent: number; answered: number }[] {
  const acc = new Map<string, { p: number; m: number; n: number }>()
  for (const run of runs) {
    for (const a of run.answers) {
      const topic = topicOf.get(a.qid)
      if (!topic) continue
      const row = acc.get(topic) ?? { p: 0, m: 0, n: 0 }
      row.p += a.points
      row.m += a.max
      row.n += 1
      acc.set(topic, row)
    }
  }
  return [...acc.entries()]
    .filter(([, r]) => r.n >= 2 && r.m > 0)
    .map(([topic, r]) => ({ topic, percent: Math.round((r.p / r.m) * 100), answered: r.n }))
    .sort((a, b) => a.percent - b.percent)
}

/** Sanity check of a bank coming from the server; drops what cannot be scored. */
export function cleanBank(raw: unknown): McBank | null {
  const b = raw as Partial<McBank> | null
  if (!b || typeof b !== 'object' || typeof b.subject !== 'string' || !Array.isArray(b.questions)) {
    return null
  }
  const questions = b.questions.filter((q): q is McQuestion => {
    if (!q || typeof q.id !== 'string' || typeof q.q !== 'string') return false
    if (q.type !== 'single' && q.type !== 'multi') return false
    if (!Array.isArray(q.options) || q.options.length < 2) return false
    const right = q.options.filter((o) => o && o.correct === true).length
    return q.type === 'single' ? right === 1 : right >= 1
  })
  return { id: String(b.id ?? ''), subject: b.subject, examDate: b.examDate ?? null, format: b.format, questions }
}

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

/** Share of points per CEFR level in one sitting, lowest level first. */
export function levelBreakdown(
  questions: McQuestion[],
  answers: McAnswer[],
): { level: string; percent: number; answered: number }[] {
  const acc = new Map<string, { p: number; m: number; n: number }>()
  questions.forEach((q, i) => {
    const a = answers[i]
    if (!q.level || !a) return
    const row = acc.get(q.level) ?? { p: 0, m: 0, n: 0 }
    row.p += a.points
    row.m += a.max
    row.n += 1
    acc.set(q.level, row)
  })
  return CEFR.filter((l) => acc.has(l)).map((level) => {
    const r = acc.get(level)!
    return { level, percent: r.m > 0 ? Math.round((r.p / r.m) * 100) : 0, answered: r.n }
  })
}

/**
 * Estimated level: the highest level reached WITHOUT a gap — every level up to
 * it scored at least `pass` %. A strong C1 score over a failed B2 does not count:
 * that is guessing, or ear-learnt phrases, not command of the grammar. Returns
 * null when not even the lowest tested level is reached.
 */
export function estimateLevel(rows: { level: string; percent: number }[], pass = 70): string | null {
  let reached: string | null = null
  for (const r of rows) {
    if (r.percent < pass) break
    reached = r.level
  }
  return reached
}

/** Points lost per topic in ONE sitting, worst first. */
export function topicsInSitting(
  questions: McQuestion[],
  answers: McAnswer[],
): { topic: string; percent: number; answered: number }[] {
  return weakTopicsInRuns(
    [{ answers }],
    new Map(questions.map((q) => [q.id, q.topic ?? ''])),
  ).filter((t) => t.topic)
}
