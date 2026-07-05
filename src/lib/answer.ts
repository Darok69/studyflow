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
