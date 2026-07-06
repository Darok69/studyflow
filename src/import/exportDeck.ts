// Deck export — the exact inverse of parseDeck, so an exported subject can be
// re-imported (here or on another device) without loss. Pure + testable.
import type { Card, Subject } from '../db/db'

type ExportCard = Record<string, unknown>

export function deckToJson(
  subject: Pick<Subject, 'name' | 'examDate' | 'reminderTime'>,
  cards: Card[],
): string {
  const out: ExportCard[] = cards.map((c) => {
    const base: ExportCard = { type: c.type }
    if (c.type === 'cloze') {
      // raw is the source of truth for cloze; front/back are derived from it.
      base.text = c.raw ?? c.front
    } else {
      base.front = c.front
      base.back = c.back
    }
    if (c.tags.length) base.tags = c.tags
    if (c.svg) base.svg = c.svg
    if (c.image) base.image = c.image
    if (c.imageBack) base.imageBack = c.imageBack
    return base
  })

  return JSON.stringify(
    {
      subject: subject.name,
      examDate: subject.examDate,
      reminderTime: subject.reminderTime,
      cards: out,
    },
    null,
    2,
  )
}
