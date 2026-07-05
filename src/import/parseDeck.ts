import type { CardType } from '../db/db'

// A card ready to import — id and subjectId are assigned by the repository.
export interface CardDraft {
  type: CardType
  front: string
  back: string
  raw?: string
  tags: string[]
  svg?: string
  image?: string
}

export interface ParsedDeck {
  subject: {
    name: string
    examDate: string | null
    reminderTime: string | null
  }
  cards: CardDraft[]
  errors: string[]
}

const CLOZE_RE = /\{\{([\s\S]+?)\}\}/g
const HAS_CLOZE = /\{\{[\s\S]+?\}\}/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

const BLANK = '［ ___ ］'

function isValidDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime())
}

function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && TIME_RE.test(v)
}

/** True when a text contains at least one {{cloze}} blank (editor validation). */
export function hasCloze(text: string): boolean {
  return HAS_CLOZE.test(text)
}

/** A cloze "The {{Twelve Tables}} were ..." → blanked front + filled back. */
export function makeCloze(text: string): { front: string; back: string; raw: string } {
  const front = text.replace(CLOZE_RE, BLANK)
  const back = text.replace(CLOZE_RE, (_m, answer) => `［ ${String(answer).trim()} ］`)
  return { front, back, raw: text }
}

function emptySubject(): ParsedDeck['subject'] {
  return { name: '', examDate: null, reminderTime: null }
}

/** Parse a JSON deck string into a ParsedDeck. Never throws; errors are collected. */
export function parseDeck(raw: string): ParsedDeck {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    return { subject: emptySubject(), cards: [], errors: [`Neplatný JSON: ${(e as Error).message}`] }
  }

  if (!data || typeof data !== 'object') {
    return { subject: emptySubject(), cards: [], errors: ['Kořenový prvek musí být objekt balíčku.'] }
  }

  const obj = data as Record<string, unknown>
  const errors: string[] = []

  const name = typeof obj.subject === 'string' ? obj.subject.trim() : ''
  if (!name) errors.push('Chybí název předmětu ("subject").')

  if (obj.examDate != null && !isValidDate(obj.examDate)) {
    errors.push('Pole "examDate" musí být ve formátu YYYY-MM-DD.')
  }
  const examDate = isValidDate(obj.examDate) ? obj.examDate : null
  const reminderTime = isValidTime(obj.reminderTime) ? obj.reminderTime : null

  const cards: CardDraft[] = []
  const rawCards = Array.isArray(obj.cards) ? obj.cards : []
  if (!Array.isArray(obj.cards)) errors.push('Pole "cards" musí být pole karet.')

  rawCards.forEach((entry, i) => {
    const c = (entry ?? {}) as Record<string, unknown>
    const n = i + 1
    const tags = Array.isArray(c.tags) ? c.tags.map((t) => String(t)) : []
    const svg = typeof c.svg === 'string' && c.svg.trim() ? c.svg : undefined
    const image = typeof c.image === 'string' && c.image.trim() ? c.image : undefined
    const type: CardType = c.type === 'cloze' ? 'cloze' : 'basic'

    if (type === 'cloze') {
      const text = typeof c.text === 'string' ? c.text : typeof c.front === 'string' ? c.front : ''
      if (!text || !HAS_CLOZE.test(text)) {
        errors.push(`Karta #${n}: cloze musí obsahovat alespoň jedno {{vynechané slovo}}.`)
        return
      }
      const { front, back, raw } = makeCloze(text)
      cards.push({ type, front, back, raw, tags, svg, image })
    } else {
      const front = typeof c.front === 'string' ? c.front.trim() : ''
      const back = typeof c.back === 'string' ? c.back.trim() : ''
      if (!front || !back) {
        errors.push(`Karta #${n}: základní karta musí mít "front" i "back".`)
        return
      }
      cards.push({ type, front, back, tags, svg, image })
    }
  })

  if (cards.length === 0 && errors.length === 0) {
    errors.push('Balíček neobsahuje žádné použitelné karty.')
  }

  return { subject: { name, examDate, reminderTime }, cards, errors }
}
