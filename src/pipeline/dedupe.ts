// Deduplication. Two cards asking the same thing in different words are worse
// than one: the second one is answered from memory of the first, not from
// knowledge. Character trigrams over a diacritics-free, punctuation-free form —
// no embeddings, no dependency, works offline.
import { normalizeAnswer } from '../lib/answer'
import type { GeneratedCard } from './types'

/** Near-duplicate threshold (Dice coefficient over trigrams). */
export const DUPLICATE_THRESHOLD = 0.85

/**
 * Lowercase, diacritics- and punctuation-free form. Reuses the typed-answer
 * normaliser (src/lib/answer.ts) so "same text" means the same thing whether we
 * are grading an answer or hunting duplicates; cloze braces drop out first.
 */
export function normalizeQuestion(text: string): string {
  return normalizeAnswer(text.replace(/\{\{|\}\}/g, ' '))
}

function trigrams(text: string): Set<string> {
  const s = ` ${text} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3))
  return out
}

/** Dice coefficient of character trigrams: 1 = identical, 0 = nothing shared. */
export function similarity(a: string, b: string): number {
  const na = normalizeQuestion(a)
  const nb = normalizeQuestion(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = trigrams(na)
  const tb = trigrams(nb)
  let shared = 0
  for (const g of ta) if (tb.has(g)) shared++
  return (2 * shared) / (ta.size + tb.size)
}

/** The text a card is identified by — the question side. */
export function cardQuestion(card: GeneratedCard): string {
  return card.front ?? card.text ?? ''
}

export interface DedupeResult {
  kept: GeneratedCard[]
  dropped: GeneratedCard[]
}

/**
 * Drop cards that repeat an earlier one, or anything in `existing` (questions
 * already in the deck), so a second run over the same source adds nothing twice.
 */
export function dedupeCards(
  cards: GeneratedCard[],
  existing: string[] = [],
  threshold: number = DUPLICATE_THRESHOLD,
): DedupeResult {
  const seen: string[] = existing.map(normalizeQuestion).filter(Boolean)
  const kept: GeneratedCard[] = []
  const dropped: GeneratedCard[] = []

  for (const card of cards) {
    const q = cardQuestion(card)
    if (!q.trim()) {
      dropped.push(card)
      continue
    }
    const isDupe = seen.some((prev) => similarity(prev, q) >= threshold)
    if (isDupe) dropped.push(card)
    else {
      kept.push(card)
      seen.push(normalizeQuestion(q))
    }
  }

  return { kept, dropped }
}
