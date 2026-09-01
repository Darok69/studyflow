// What a run costs and whether it may happen at all. Pure arithmetic so the
// same numbers back the estimate shown BEFORE a run (BRIEF §8) and the ledger
// the server keeps afterwards.
//
// Prices are USD per 1M tokens, Anthropic first-party rates.

export type PipelineModel = 'claude-opus-5' | 'claude-sonnet-5'

export interface Pricing {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export const PRICING: Record<PipelineModel, Pricing> = {
  // Outline and quality control: both decide about hundreds of cards at once.
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  // Per-block generation and vision transcription — the bulk of the traffic.
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
}

/** Batch API runs asynchronously for half the price (BRIEF §8). */
export const BATCH_DISCOUNT = 0.5

/** Czech and German text runs around 3.5 characters per token. */
export const CHARS_PER_TOKEN = 3.5

export interface Usage {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
}

export function costUsd(model: PipelineModel, usage: Usage, batch = false): number {
  const p = PRICING[model]
  const usd =
    ((usage.input ?? 0) * p.input +
      (usage.output ?? 0) * p.output +
      (usage.cacheRead ?? 0) * p.cacheRead +
      (usage.cacheWrite ?? 0) * p.cacheWrite) /
    1_000_000
  return batch ? usd * BATCH_DISCOUNT : usd
}

export function tokensForChars(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN)
}

export interface EstimateInput {
  /** Total characters of the material that will be sent. */
  chars: number
  /** How many cards the outline expects. */
  cardEstimate: number
  /** Generation goes through the Batch API. */
  batch?: boolean
}

/**
 * Rough pre-run estimate: outline reads the whole material once (Opus),
 * generation reads each block once and writes the cards (Sonnet), quality
 * control re-reads the cards (Opus). Shown as an order of magnitude — the
 * ledger afterwards uses the real usage numbers.
 */
export function estimateCostUsd({ chars, cardEstimate, batch = false }: EstimateInput): number {
  const materialTokens = tokensForChars(chars)
  const cardTokens = cardEstimate * 140 // question + answer + metadata

  const outline = costUsd('claude-opus-5', { input: materialTokens, output: 1200 })
  const generate = costUsd('claude-sonnet-5', { input: materialTokens, output: cardTokens }, batch)
  const qc = costUsd('claude-opus-5', { input: cardTokens + materialTokens / 4, output: cardTokens / 4 })

  return Math.round((outline + generate + qc) * 100) / 100
}

export interface BudgetLedger {
  month: string // YYYY-MM, local time
  spentUsd: number
}

/**
 * Local month key. Deliberately not reusing lib/date.ts — that module pulls in
 * i18n, which has no business inside the server bundle.
 */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function emptyLedger(date: Date = new Date()): BudgetLedger {
  return { month: monthKey(date), spentUsd: 0 }
}

/** The ledger for the current month — a new month starts from zero. */
export function currentLedger(ledger: BudgetLedger | null, date: Date = new Date()): BudgetLedger {
  const month = monthKey(date)
  if (!ledger || ledger.month !== month) return { month, spentUsd: 0 }
  return ledger
}

/** True when the planned run still fits under the monthly ceiling. */
export function withinBudget(
  ledger: BudgetLedger | null,
  budgetUsd: number,
  plannedUsd: number,
  date: Date = new Date(),
): boolean {
  if (budgetUsd <= 0) return false
  return currentLedger(ledger, date).spentUsd + plannedUsd <= budgetUsd
}

export function addSpend(
  ledger: BudgetLedger | null,
  usd: number,
  date: Date = new Date(),
): BudgetLedger {
  const cur = currentLedger(ledger, date)
  return { month: cur.month, spentUsd: Math.round((cur.spentUsd + usd) * 10_000) / 10_000 }
}
