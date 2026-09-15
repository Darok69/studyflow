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
