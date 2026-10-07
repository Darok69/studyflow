import type { CardImage, CardType, Occlusion, SourceRef } from '../db/db'
import type { CardUpdate, FilingRule, RemoveRule } from './mergeDeck'
import { type CardKind, type CardLevel, isCardKind, isCardLevel } from '../db/cardKinds'
import { t } from '../i18n'

// A card ready to import — id and subjectId are assigned by the repository.
// The generation pipeline produces the very same shape, so a generated deck and
// a hand-written JSON deck travel through one code path.
export interface CardDraft {
  type: CardType // how it renders
  kind?: CardKind // what it teaches (definice, proces, případ…)
  level?: CardLevel // 1 recall, 2 understanding, 3 application
  priority?: 1 | 2 | 3 // 1 must know 100 %, 2 important, 3 the rest
  readyBy?: string // YYYY-MM-DD — the class this card prepares for
  learnOrder?: number // learning order inside one class (concepts before cases)
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
  /** Corrections to cards the subject already has, found by old question. */
  updates?: CardUpdate[]
  /** Cards the deck takes back out of the subject. */
  remove?: RemoveRule[]
  /** The deck is the whole subject: cards it no longer asks are removed. */
  prune?: boolean
  /**
   * Names the subject went by before (e.g. before a translation). A deck whose
   * name matches no subject merges into one with a former name and renames it —
   * otherwise a renamed deck would arrive as a second subject without history.
   */
  formerNames?: string[]
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

/** A calendar day as written in a deck: YYYY-MM-DD. */
function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** `updates`: [{match, front?, back?, topic?}] — malformed entries are dropped. */
function parseUpdates(value: unknown): CardUpdate[] {
  if (!Array.isArray(value)) return []
  const out: CardUpdate[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const match = typeof r.match === 'string' ? r.match : ''
    const front = typeof r.front === 'string' && r.front.trim() ? r.front : undefined
    const back = typeof r.back === 'string' && r.back.trim() ? r.back : undefined
    const topic = typeof r.topic === 'string' && r.topic.trim() ? r.topic.trim() : undefined
    const priority = r.priority === 1 || r.priority === 2 || r.priority === 3 ? r.priority : undefined
    const readyBy = isDayKey(r.readyBy) ? r.readyBy : undefined
    const learnOrder = isOrder(r.learnOrder) ? r.learnOrder : undefined
    if (
      !match.trim() ||
      (front === undefined &&
        back === undefined &&
        topic === undefined &&
        priority === undefined &&
        readyBy === undefined &&
        learnOrder === undefined)
    )
      continue
    out.push({
      match,
      ...(learnOrder !== undefined ? { learnOrder } : {}),
      ...(readyBy !== undefined ? { readyBy } : {}),
      ...(front !== undefined ? { front } : {}),
      ...(back !== undefined ? { back } : {}),
      ...(topic !== undefined ? { topic } : {}),
      ...(priority !== undefined ? { priority } : {}),
    })
  }
  return out
}

/** `remove`: [{tag}] — only tag rules exist, anything else is ignored. */
function parseRemove(value: unknown): RemoveRule[] {
  if (!Array.isArray(value)) return []
  const out: RemoveRule[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const tag = (raw as Record<string, unknown>).tag
    if (typeof tag === 'string' && tag.trim()) out.push({ tag: tag.trim() })
  }
  return out
}

function emptySubject(): ParsedDeck['subject'] {
  return { name: '', examDate: null, reminderTime: null }
}

/** Pořadí učení: konečné nezáporné číslo. */
function isOrder(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

/**
 * Image occlusion carried in a deck file. Coordinates are relative (0–1); a
 * mask that does not fit the picture or has no usable size is dropped, and an
 * occlusion without the asked mask (the first one) is no occlusion at all.
 */
export function parseOcclusion(raw: unknown): Occlusion | undefined {
  const o = raw as Partial<Occlusion> | null | undefined
  if (!o || typeof o !== 'object' || !Array.isArray(o.masks)) return undefined
  const in01 = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  const masks = o.masks
    .filter(
      (m) =>
        m &&
        typeof m.id === 'string' &&
        in01(m.x) &&
        in01(m.y) &&
        in01(m.w) &&
        in01(m.h) &&
        m.w > 0 &&
        m.h > 0 &&
        m.x + m.w <= 1.0001 &&
        m.y + m.h <= 1.0001,
    )
    .map((m) => ({
      id: m.id,
      shape: 'rect' as const,
      x: m.x,
      y: m.y,
      w: m.w,
      h: m.h,
      label: typeof m.label === 'string' ? m.label : '',
    }))
  if (masks.length === 0 || masks[0].id !== o.masks[0]?.id || !masks[0].label.trim()) return undefined
  const mode = o.mode === 'hide-all-guess-one' ? 'hide-all-guess-one' : 'hide-one-guess-one'
  return { imageKey: 'card.image', mode, masks }
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
    const priority = c.priority === 1 || c.priority === 2 || c.priority === 3 ? c.priority : undefined
    const readyBy = isDayKey(c.readyBy) ? c.readyBy : undefined
    const learnOrder = isOrder(c.learnOrder) ? c.learnOrder : undefined
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
    // A blind diagram only makes sense with its picture.
    const occlusion = image ? parseOcclusion(c.occlusion) : undefined

    if (type === 'cloze') {
      const text = typeof c.text === 'string' ? c.text : typeof c.front === 'string' ? c.front : ''
      if (!text || !HAS_CLOZE.test(text)) {
        errors.push(t('errClozeCardNeedsBlank', n))
        return
      }
      const { front, back, raw } = makeCloze(text)
      cards.push({ type, kind, level, ...(priority ? { priority } : {}), ...(readyBy ? { readyBy } : {}), ...(learnOrder !== undefined ? { learnOrder } : {}), topic, front, back, raw, tags, svg, image, imageBack, sourceId, sourceRef, draft, draftReason })
    } else {
      const front = typeof c.front === 'string' ? c.front.trim() : ''
      const back = typeof c.back === 'string' ? c.back.trim() : ''
      if (!front || !back) {
        errors.push(t('errBasicCardNeedsBoth', n))
        return
      }
      cards.push({ type, kind, level, ...(priority ? { priority } : {}), ...(readyBy ? { readyBy } : {}), ...(learnOrder !== undefined ? { learnOrder } : {}), ...(occlusion ? { occlusion } : {}), topic, front, back, tags, svg, image, imageBack, sourceId, sourceRef, draft, draftReason })
    }
  })

  if (cards.length === 0 && errors.length === 0) {
    errors.push(t('errNoUsableCards'))
  }

  return {
    subject: { name, examDate, reminderTime },
    cards,
    filing: parseFiling(obj.filing),
    updates: parseUpdates(obj.updates),
    remove: parseRemove(obj.remove),
    prune: obj.prune === true,
    formerNames: parseFormerNames(obj.formerNames),
    errors,
  }
}

/** `formerNames`: non-empty strings only, anything else is dropped. */
function parseFormerNames(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const names = raw.filter((n): n is string => typeof n === 'string' && n.trim() !== '').map((n) => n.trim())
  return names.length > 0 ? names : undefined
}
