// Import without a model: your own notes, a spreadsheet column, a markdown
// table. Anything that puts a question and an answer on one line becomes a
// deck — no API, no key, no waiting.
import type { CardDraft } from './parseDeck'
import { hasCloze, makeCloze } from './parseDeck'

/** Separators people actually use, most explicit first. */
const SEPARATORS = ['\t', ' — ', ' – ', ' | ', ' -- ', ' - ', ';', ':'] as const

export interface PlainDeck {
  /** First line, when it reads like a title rather than a card. */
  subject: string | null
  cards: CardDraft[]
}

function draftFrom(front: string, back: string): CardDraft | null {
  const q = front.trim()
  const a = back.trim()
  if (!q || !a) return null
  return { type: 'basic', kind: 'basic', level: 1, front: q, back: a, tags: [] }
}

function clozeDraft(text: string): CardDraft {
  const { front, back, raw } = makeCloze(text.trim())
  return { type: 'cloze', kind: 'cloze', level: 1, front, back, raw, tags: [] }
}

/** Strip the pipes and padding of a markdown table row. */
function unpipe(line: string): string {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').trim()
}

function isTableRule(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]+$/.test(line.trim())
}

/**
 * Which separator holds this text together? The one that splits the most lines
 * into exactly two non-empty halves — guessing per line would turn a colon in
 * an answer into a card boundary.
 */
export function detectSeparator(lines: string[]): string | null {
  let best: { sep: string; hits: number } | null = null
  for (const sep of SEPARATORS) {
    let hits = 0
    for (const line of lines) {
      const at = line.indexOf(sep)
      if (at > 0 && line.slice(at + sep.length).trim()) hits++
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { sep, hits }
  }
  // Fewer than half the lines means it is probably punctuation, not structure.
  return best && best.hits >= Math.ceil(lines.length / 2) ? best.sep : null
}

/**
 * Parse pasted text into cards. Recognises, in order: markdown tables, a
 * shared separator ("Pojem — význam"), `{{cloze}}` lines, and finally
 * question/answer pairs on consecutive lines.
 */
export function parsePlainDeck(raw: string): PlainDeck {
  const allLines = raw
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !isTableRule(l))
  if (allLines.length === 0) return { subject: null, cards: [] }

  // A markdown table is just a pipe-separated file once the rules are gone.
  const piped = allLines.every((l) => l.includes('|'))
  const lines = piped ? allLines.map(unpipe) : allLines

  const cards: CardDraft[] = []
  let subject: string | null = null

  const separator = detectSeparator(piped ? lines.map((l) => l.replace(/\s*\|\s*/g, ' | ')) : lines)
  if (separator) {
    for (const [i, line] of lines.entries()) {
      const source = piped ? line.replace(/\s*\|\s*/g, ' | ') : line
      const at = source.indexOf(separator)
      if (at <= 0) {
        // A line without the separator at the very top is the deck's name.
        if (i === 0 && !subject) subject = line.trim()
        continue
      }
      const card = draftFrom(source.slice(0, at), source.slice(at + separator.length))
      if (card) cards.push(card)
    }
    // A header row ("Pojem | Význam") is not a card.
    if (piped && cards.length > 1 && /^(pojem|term|frage|otázka|question)/i.test(cards[0].front)) {
      cards.shift()
    }
    return { subject, cards }
  }

  // No separator: cloze lines, or question/answer on consecutive lines.
  const clozeLines = lines.filter((l) => hasCloze(l))
  if (clozeLines.length > 0) {
    return { subject: null, cards: clozeLines.map(clozeDraft) }
  }

  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length >= 2)
  for (const block of blocks) {
    const card = draftFrom(block[0], block.slice(1).join('\n'))
    if (card) cards.push(card)
  }

  return { subject: null, cards }
}
