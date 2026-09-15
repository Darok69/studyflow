import type { CardImage, CardType, Occlusion, SourceRef } from '../db/db'
import type { FilingRule } from './mergeDeck'
import { type CardKind, type CardLevel, isCardKind, isCardLevel } from '../db/cardKinds'
import { t } from '../i18n'

// A card ready to import — id and subjectId are assigned by the repository.
// The generation pipeline produces the very same shape, so a generated deck and
// a hand-written JSON deck travel through one code path.
export interface CardDraft {
  type: CardType // how it renders
  kind?: CardKind // what it teaches (definice, proces, případ…)
  level?: CardLevel // 1 recall, 2 understanding, 3 application
  topic?: string // heading from the approved outline
  front: string
  back: string
  raw?: string
  tags: string[]
  svg?: string
  image?: string
  imageBack?: string
  images?: CardImage[]
  occlusion?: Occlusion | null
  sourceId?: string
  sourceRef?: SourceRef
  draft?: boolean // failed quality control
  draftReason?: string
}

export interface ParsedDeck {
  subject: {
    name: string
    examDate: string | null
    reminderTime: string | null
  }
  cards: CardDraft[]
  /** Rules for filing cards the subject ALREADY has (see mergeDeck.ts). */
  filing: FilingRule[]
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

/**
 * `filing` is optional and hand-written, so anything malformed is dropped
 * silently rather than failing an import that is otherwise fine.
 */
function parseFiling(value: unknown): FilingRule[] {
  if (!Array.isArray(value)) return []
  const out: FilingRule[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const topic = typeof r.topic === 'string' ? r.topic.trim() : ''
    const tag = typeof r.tag === 'string' ? r.tag.trim() : undefined
    const match = typeof r.match === 'string' ? r.match.trim() : undefined
    const tags = Array.isArray(r.tags)
      ? r.tags.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
      : undefined
    if (!topic || (!tag && !match && !(tags && tags.length))) continue
    out.push({
      topic,
      ...(tag ? { tag } : {}),
      ...(tags && tags.length ? { tags } : {}),
      ...(match ? { match } : {}),
    })
  }
  return out
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
    return { subject: emptySubject(), cards: [], filing: [], errors: [t('errInvalidJson', (e as Error).message)] }
  }

  if (!data || typeof data !== 'object') {
    return { subject: emptySubject(), cards: [], filing: [], errors: [t('errRootObject')] }
  }

  const obj = data as Record<string, unknown>
  const errors: string[] = []

  const name = typeof obj.subject === 'string' ? obj.subject.trim() : ''
  if (!name) errors.push(t('errMissingSubject'))

  if (obj.examDate != null && !isValidDate(obj.examDate)) {
    errors.push(t('errExamDateFormat'))
  }
  const examDate = isValidDate(obj.examDate) ? obj.examDate : null
  const reminderTime = isValidTime(obj.reminderTime) ? obj.reminderTime : null

  const cards: CardDraft[] = []
  const rawCards = Array.isArray(obj.cards) ? obj.cards : []
  if (!Array.isArray(obj.cards)) errors.push(t('errCardsArray'))

  rawCards.forEach((entry, i) => {
    const c = (entry ?? {}) as Record<string, unknown>
    const n = i + 1
    const tags = Array.isArray(c.tags) ? c.tags.map((t) => String(t)) : []
    const svg = typeof c.svg === 'string' && c.svg.trim() ? c.svg : undefined
    const image = typeof c.image === 'string' && c.image.trim() ? c.image : undefined
    const imageBack =
      typeof c.imageBack === 'string' && c.imageBack.trim() ? c.imageBack : undefined
    const type: CardType = c.type === 'cloze' ? 'cloze' : 'basic'
    // Didactic fields are optional in the import format: a hand-written deck
    // without them still imports, it just teaches at recall level.
    const kind: CardKind = isCardKind(c.kind) ? c.kind : type
    const level: CardLevel = isCardLevel(c.level) ? c.level : 1
    const topic = typeof c.topic === 'string' && c.topic.trim() ? c.topic.trim() : undefined
    // Generated cards carry where they came from and whether they passed the
    // quality check; hand-written decks simply have none of this.
    const ref = c.sourceRef as { page?: unknown; block?: unknown } | undefined
    const sourceRef: SourceRef | undefined =
      ref && typeof ref.page === 'number'
        ? { page: ref.page, block: typeof ref.block === 'string' ? ref.block : undefined }
        : undefined
    const sourceId = typeof c.sourceId === 'string' ? c.sourceId : undefined
    const draft = c.draft === true ? true : undefined
    const draftReason = draft && typeof c.draftReason === 'string' ? c.draftReason : undefined

    if (type === 'cloze') {
      const text = typeof c.text === 'string' ? c.text : typeof c.front === 'string' ? c.front : ''
      if (!text || !HAS_CLOZE.test(text)) {
        errors.push(t('errClozeCardNeedsBlank', n))
        return
      }
      const { front, back, raw } = makeCloze(text)
      cards.push({ type, kind, level, topic, front, back, raw, tags, svg, image, imageBack, sourceId, sourceRef, draft, draftReason })
    } else {
      const front = typeof c.front === 'string' ? c.front.trim() : ''
      const back = typeof c.back === 'string' ? c.back.trim() : ''
      if (!front || !back) {
        errors.push(t('errBasicCardNeedsBoth', n))
        return
      }
      cards.push({ type, kind, level, topic, front, back, tags, svg, image, imageBack, sourceId, sourceRef, draft, draftReason })
    }
  })

  if (cards.length === 0 && errors.length === 0) {
    errors.push(t('errNoUsableCards'))
  }

  return { subject: { name, examDate, reminderTime }, cards, filing: parseFiling(obj.filing), errors }
}
