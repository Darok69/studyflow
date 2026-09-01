// Rule-based quality control — the half that needs no model and therefore runs
// always, including offline. A card that fails is not thrown away: it is kept
// as a draft with the reason, so the user can fix it instead of losing it.
import { cardKindSpec } from '../db/cardKinds'
import { normalizeQuestion } from './dedupe'
import type { GeneratedCard, QcIssue } from './types'

/** BRIEF §5.10: one card, one idea. Longer answers get split. */
export const MAX_ANSWER_SENTENCES = 3
/** Below this length an "answer contained in the question" is a coincidence. */
const MIN_ECHO_CHARS = 12

/** Sentence count that survives "§ 823", "451 př. n. l." and "z. B.". */
export function countSentences(text: string): number {
  // Word boundaries are matched explicitly: JavaScript's \b is ASCII-only, so
  // "První." would break apart at the accented letter and lose its full stop.
  const cleaned = text
    .replace(/(^|\s)\p{Lu}\p{L}?\./gu, '$1 ') // initials and short abbreviations: "B.", "Nr."
    .replace(/(^|\s)\p{Ll}\./gu, '$1 ') // single lowercase letter: the "z." of "z. B."
    .replace(/(^|\s)(č|čl|odst|písm|např|tj|tzv|resp|př|bzw|ggf|vgl)\.\s*/giu, '$1 ')
    .trim()
  if (!cleaned) return 0
  const parts = cleaned.split(/[.!?]+(?:\s|$)/u).filter((s) => s.trim().length > 0)
  return Math.max(1, parts.length)
}

/** Shorter quotes than this prove nothing either way. */
const MIN_EVIDENCE_CHARS = 15

/**
 * Does the card's quoted evidence really stand in the source? The model is
 * asked to return the fragment it built the answer on; if that fragment cannot
 * be found in the block, the card was invented. This is the grounding check
 * from BRIEF §4.7 done by a rule — no second model pass, no extra cost.
 *
 * A card with no quote is NOT punished here: rule-based cards never carry one.
 */
export function checkEvidence(card: GeneratedCard, sourceText: string): boolean {
  const quote = card.evidence?.trim()
  if (!quote || quote.length < MIN_EVIDENCE_CHARS) return true
  return normalizeQuestion(sourceText).includes(normalizeQuestion(quote))
}

/** Answer side of a card as plain text (cloze answers live inside the text). */
function answerText(card: GeneratedCard): string {
  return card.back ?? card.text ?? ''
}

/**
 * Check one card. Returns the issues found, most serious first; an empty array
 * means the card is ready to be scheduled.
 */
export function checkCard(card: GeneratedCard): QcIssue[] {
  const issues: QcIssue[] = []
  const question = (card.front ?? card.text ?? '').trim()
  const answer = answerText(card).trim()

  if (!question || (card.type === 'basic' && !answer)) {
    issues.push('empty')
    return issues
  }

  if (card.type === 'cloze' && !/\{\{[\s\S]+?\}\}/.test(card.text ?? '')) {
    issues.push('cloze-no-blank')
  }

  if (card.type === 'basic' && countSentences(answer) > MAX_ANSWER_SENTENCES) {
    issues.push('answer-too-long')
  }

  // The answer already standing in the question means nothing is retrieved.
  if (card.type === 'basic' && answer.length >= MIN_ECHO_CHARS) {
    const nq = normalizeQuestion(question)
    const na = normalizeQuestion(answer)
    if (na && nq.includes(na)) issues.push('answer-in-question')
  }

  // A map or chart card without a picture asks about something invisible.
  if (cardKindSpec(card.kind).needsImage && !card.imageKey) {
    issues.push('needs-image')
  }

  return issues
}

/**
 * Run the checks over a batch: passing cards come back untouched, failing ones
 * as drafts carrying the reason. Pass the block text the batch came from and
 * every card is grounding-checked against it as well.
 */
export function markDrafts(cards: GeneratedCard[], sourceText?: string): GeneratedCard[] {
  return cards.map((card) => {
    const issues = checkCard(card)
    if (issues.length === 0 && sourceText && !checkEvidence(card, sourceText)) {
      issues.push('not-in-source')
    }
    if (issues.length === 0) return card
    return { ...card, draft: true, draftReason: issues[0] }
  })
}
