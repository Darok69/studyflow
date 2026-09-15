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

/**
 * A rule for filing cards that are ALREADY in the subject but carry no topic.
 * Decks made before topics existed still describe what they are about — in
 * their tags, and in the wording of the question. A deck can therefore bring
 * the knowledge of how its own older cards should be filed, instead of leaving
 * hundreds of them in one undifferentiated pile.
 *
 * Rules are tried in order and the first match wins, so put the specific ones
 * first. A rule never touches a card that already has a topic.
 */
export interface FilingRule {
  /** Matches when the card carries this tag (compared case-insensitively). */
  tag?: string
  /**
   * Matches when the card carries ALL of these tags. Needed where one tag is
   * not enough to tell topics apart — "sources" means one thing under the tag
   * PIL and another under EU.
   */
  tags?: string[]
  /** Matches when the question contains this text (case-insensitive). */
  match?: string
  topic: string
}

export interface FilingTarget {
  id: string
  topic?: string
  tags?: string[]
  front: string
}

/**
 * Which cards would get which topic. Returns only actual changes, so an import
 * that files nothing can say so instead of writing every card back unchanged.
 */
export function planFiling(cards: FilingTarget[], rules: FilingRule[]): Map<string, string> {
  const out = new Map<string, string>()
  if (rules.length === 0) return out
  for (const card of cards) {
    if (card.topic && card.topic.trim()) continue
    const tags = new Set((card.tags ?? []).map((t) => t.trim().toLowerCase()))
    const front = card.front.toLowerCase()
    for (const rule of rules) {
      const hit =
        (rule.tag !== undefined && tags.has(rule.tag.trim().toLowerCase())) ||
        (rule.tags !== undefined &&
          rule.tags.length > 0 &&
          rule.tags.every((t) => tags.has(t.trim().toLowerCase()))) ||
        (rule.match !== undefined && rule.match !== '' && front.includes(rule.match.toLowerCase()))
      if (hit && rule.topic.trim()) {
        out.set(card.id, rule.topic.trim())
        break
      }
    }
  }
  return out
}

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
