// Typed-answer checking (active recall). Deliberately forgiving: study is
// self-graded, so the verdict is a hint for the student, never a gatekeeper.
// Pure + testable; no DB, no React.

export type AnswerVerdict = 'correct' | 'close' | 'wrong'

export interface AnswerCheck {
  verdict: AnswerVerdict
  similarity: number // 0..1 on normalized strings
}

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein distance (iterative two-row). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Similarity of two answers after normalization, 0..1. */
export function answerSimilarity(a: string, b: string): number {
  const na = normalizeAnswer(a)
  const nb = normalizeAnswer(b)
  if (na === nb) return 1
  const max = Math.max(na.length, nb.length)
  if (max === 0) return 1
  return 1 - levenshtein(na, nb) / max
}

const CORRECT_THRESHOLD = 0.92
const CLOSE_THRESHOLD = 0.7

export function checkAnswer(input: string, expected: string): AnswerCheck {
  const similarity = answerSimilarity(input, expected)
  const verdict: AnswerVerdict =
    similarity >= CORRECT_THRESHOLD ? 'correct' : similarity >= CLOSE_THRESHOLD ? 'close' : 'wrong'
  return { verdict, similarity }
}

// ---- Quantities (geography `cisla` cards) ----
// The point of those cards is the ORDER OF MAGNITUDE, not the digits: someone
// who says Austria is roughly 84 000 km² knows it. Demanding "83 879" would
// teach trivia and punish knowledge (BRIEF §4, kind `cisla`).

/** Numbers in a text, tolerant of Czech/German formatting: "83 879", "1,5 mil.". */
export function parseQuantities(text: string): number[] {
  const cleaned = text
    .replace(/(\d)[\s\u00a0](?=\d{3}\b)/g, '$1') // thousands separated by a space
    .replace(/(\d),(\d)/g, '$1.$2') // decimal comma
  const out: number[] = []
  for (const m of cleaned.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const value = Number(m[0])
    if (Number.isFinite(value)) out.push(value)
  }
  return out
}

/** Within this factor of the expected value the estimate counts as right. */
export const QUANTITY_TOLERANCE = 0.25

/**
 * Compare a numeric estimate. Two numbers in the expected answer are read as a
 * RANGE and anything inside it is correct; a single number is correct within
 * ±25 % and close within ±50 %. Without a number on either side this falls back
 * to the ordinary text comparison.
 */
export function checkQuantityAnswer(input: string, expected: string): AnswerCheck {
  const got = parseQuantities(input)
  const want = parseQuantities(expected)
  if (got.length === 0 || want.length === 0) return checkAnswer(input, expected)

  const value = got[0]
  if (want.length >= 2) {
    const low = Math.min(want[0], want[1])
    const high = Math.max(want[0], want[1])
    if (value >= low && value <= high) return { verdict: 'correct', similarity: 1 }
    const span = high - low || Math.abs(high) || 1
    const off = value < low ? low - value : value - high
    return { verdict: off <= span ? 'close' : 'wrong', similarity: off <= span ? 0.7 : 0 }
  }

  const target = want[0]
  if (target === 0) return { verdict: value === 0 ? 'correct' : 'wrong', similarity: value === 0 ? 1 : 0 }
  const ratio = Math.abs(value - target) / Math.abs(target)
  if (ratio <= QUANTITY_TOLERANCE) return { verdict: 'correct', similarity: 1 - ratio }
  if (ratio <= QUANTITY_TOLERANCE * 2) return { verdict: 'close', similarity: 0.6 }
  return { verdict: 'wrong', similarity: 0 }
}

const MAX_TYPED_LENGTH = 80

/**
 * What the student should type for a card — or null when typing makes no sense
 * (long / multi-line backs stay reveal-only). Cloze cards expect the blanked
 * answers; basic cards expect the back.
 */
export function typedAnswerTarget(card: {
  type: 'basic' | 'cloze'
  back: string
  raw?: string
}): string | null {
  if (card.type === 'cloze') {
    const answers = [...(card.raw ?? '').matchAll(/\{\{([\s\S]+?)\}\}/g)].map((m) => m[1].trim())
    if (answers.length === 0) return null
    const joined = answers.join(', ')
    return joined.length <= MAX_TYPED_LENGTH ? joined : null
  }
  const back = card.back.trim()
  if (!back || back.includes('\n') || back.length > MAX_TYPED_LENGTH) return null
  return back
}
