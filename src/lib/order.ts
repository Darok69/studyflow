/**
 * The order the decks sit in on the home screen.
 *
 * By default they follow the nearest exam, which is the right answer for the
 * queue but not always for the eye: which deck you want first is a personal
 * thing — the one you are in the middle of, the one you keep forgetting. So
 * the position is the user's to set, and it is stored on the subject rather
 * than on the device, because it travels with the data to every phone.
 *
 * Pure, no DOM: the drag gesture calls `moveItem` and the repository writes
 * the result, and both are testable on their own.
 */

export interface Orderable {
  id: string
  /** Manual position. Missing on subjects made before ordering existed. */
  order?: number | null
  /** ISO — the fallback order, so the list is stable before anything is moved. */
  createdAt?: string
}

/** Move one item to another index, leaving the rest in their relative order. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list
  if (from < 0 || from >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  // Clamp rather than refuse: a drag that ends past the last card means "last".
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}

/**
 * The display order: whatever the user set, then everything they have not
 * touched yet, oldest first. A subject with no position goes AFTER the placed
 * ones — a new deck appears at the end instead of jumping into the middle.
 */
export function orderedByHand<T extends Orderable>(subjects: T[]): T[] {
  const placed = subjects.filter((s) => typeof s.order === 'number')
  const rest = subjects.filter((s) => typeof s.order !== 'number')
  placed.sort((a, b) => (a.order as number) - (b.order as number))
  rest.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  return [...placed, ...rest]
}

/** Has anyone arranged these yet? If not, the caller keeps its own order. */
export function hasManualOrder(subjects: Orderable[]): boolean {
  return subjects.some((s) => typeof s.order === 'number')
}

/**
 * Positions to persist after a drag. Every subject gets one, including the
 * untouched ones — otherwise the first drag would leave the rest floating
 * behind the placed cards in an order nobody chose.
 */
export function positionsFor(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, i]))
}

/**
 * Topics in the order a deck lists them — first appearance of each. Cards are
 * stored under random ids, so this is the only place the author's order of
 * topics survives, and it is kept on the subject.
 */
export function deckTopicOrder(cards: { topic?: string }[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of cards) {
    const topic = c.topic?.trim()
    if (!topic || seen.has(topic)) continue
    seen.add(topic)
    out.push(topic)
  }
  return out
}

/**
 * A re-import brings the deck's order; topics the deck no longer lists (cards
 * written by hand, an older batch) keep their place after it.
 */
export function mergeTopicOrder(prev: string[] | undefined, deck: string[]): string[] {
  const inDeck = new Set(deck)
  return [...deck, ...(prev ?? []).filter((t) => !inDeck.has(t))]
}

/**
 * Topics by the date of their class, then in the deck's order. Topics with no
 * class come after the dated ones; anything the order does not know keeps the
 * position it came in, so a subject without classes looks as it always did.
 */
export function sortTopicsByClass<T extends { topic: string; readyBy?: string }>(
  plans: T[],
  topicOrder: string[] | undefined,
): T[] {
  const rank = new Map((topicOrder ?? []).map((t, i) => [t, i]))
  return plans
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        (a.p.readyBy ?? '9999').localeCompare(b.p.readyBy ?? '9999') ||
        (rank.get(a.p.topic) ?? Infinity) - (rank.get(b.p.topic) ?? Infinity) ||
        a.i - b.i,
    )
    .map((x) => x.p)
}
