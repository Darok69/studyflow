/**
 * Importing a deck that is still growing.
 *
 * Study material arrives topic by topic, so the same deck gets imported again
 * later with more cards in it. A plain import would make a SECOND subject with
 * the old cards duplicated inside it — and the originals, with all their FSRS
 * history, would sit in the first one, unused. So an import into an existing
 * subject adds only the cards that are not there yet.
 *
 * Identity is the QUESTION. Two cards asking the same thing are the same card,
 * whatever else changed about them — and keying on the answer too would mean
 * that correcting a typo in an answer silently added a duplicate question.
 * Pure, no DB: the repository supplies the fronts it already has.
 */
import type { CardDraft } from './parseDeck'

/** Same question apart from case, spacing and surrounding whitespace. */
export function questionKey(front: string): string {
  return front.replace(/\s+/g, ' ').trim().toLowerCase()
}

export interface MergePlan {
  fresh: CardDraft[]
  /** Cards already in the subject, or repeated inside the imported file. */
  duplicates: number
}

export function newCardsOnly(existingFronts: Iterable<string>, drafts: CardDraft[]): MergePlan {
  const seen = new Set<string>()
  for (const front of existingFronts) seen.add(questionKey(front))

  const fresh: CardDraft[] = []
  let duplicates = 0
  for (const draft of drafts) {
    const key = questionKey(draft.front)
    // An empty question cannot be matched on; let it through rather than
    // silently collapsing every such card into one.
    if (key && seen.has(key)) {
      duplicates++
      continue
    }
    if (key) seen.add(key)
    fresh.push(draft)
  }
  return { fresh, duplicates }
}
