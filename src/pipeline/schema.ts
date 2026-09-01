// The shapes the model must return, and the validators that check what came
// back. `strict: true` on the SDK side guarantees the JSON parses; this module
// guarantees it makes SENSE (known kinds, levels in range, blocks that exist).
// Errors are short English codes — they go to the log, not to the user.
import { isCardKind, isCardLevel, type CardKind, type CardLevel } from '../db/cardKinds'
import type { GeneratedCard, Outline, OutlineTopic } from './types'

export const OUTLINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topics'],
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'blockIds', 'difficulty', 'estimatedMinutes', 'cardEstimate'],
        properties: {
          title: { type: 'string' },
          blockIds: { type: 'array', items: { type: 'string' } },
          difficulty: { type: 'integer', minimum: 1, maximum: 3 },
          estimatedMinutes: { type: 'integer', minimum: 1 },
          cardEstimate: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
} as const

export const CARDS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'kind', 'level'],
        properties: {
          type: { type: 'string', enum: ['basic', 'cloze'] },
          kind: { type: 'string' },
          level: { type: 'integer', minimum: 1, maximum: 3 },
          front: { type: 'string' },
          back: { type: 'string' },
          text: { type: 'string' },
          blockId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

export const VERDICTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ok'],
        properties: {
          ok: { type: 'boolean' },
          issue: { type: 'string' },
        },
      },
    },
  },
} as const

export interface Verdict {
  ok: boolean
  issue?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export interface ParseResult<T> {
  value: T
  errors: string[]
}

/** Validate an outline. Topics referencing unknown blocks are dropped, not fixed. */
export function parseOutline(data: unknown, knownBlockIds: string[]): ParseResult<Outline> {
  const errors: string[] = []
  const root = asRecord(data)
  const rawTopics = root && Array.isArray(root.topics) ? root.topics : null
  if (!rawTopics) return { value: { topics: [] }, errors: ['outline: missing topics array'] }

  const known = new Set(knownBlockIds)
  const topics: OutlineTopic[] = []

  rawTopics.forEach((entry, i) => {
    const t = asRecord(entry)
    const title = typeof t?.title === 'string' ? t.title.trim() : ''
    if (!title) {
      errors.push(`outline[${i}]: missing title`)
      return
    }
    const blockIds = Array.isArray(t?.blockIds)
      ? t.blockIds.map(String).filter((id) => known.has(id))
      : []
    if (blockIds.length === 0) {
      errors.push(`outline[${i}]: no known blocks`)
      return
    }
    const difficulty = t?.difficulty === 1 || t?.difficulty === 2 || t?.difficulty === 3 ? t.difficulty : 2
    topics.push({
      id: `t${topics.length + 1}`,
      title,
      blockIds,
      difficulty,
      estimatedMinutes: Math.max(1, Math.round(Number(t?.estimatedMinutes) || 10)),
      cardEstimate: Math.max(0, Math.round(Number(t?.cardEstimate) || blockIds.length * 2)),
    })
  })

  if (topics.length === 0) errors.push('outline: no usable topic')
  return { value: { topics }, errors }
}

export interface CardContext {
  topic: string
  /** Blocks the batch was generated from — maps blockId back to a page. */
  pages: Record<string, number>
  allowedKinds?: CardKind[]
}

/**
 * Validate generated cards. A card that cannot be repaired is dropped with a
 * logged reason; content problems (too long, echoing the question) are NOT
 * handled here — that is quality control's job.
 */
export function parseGeneratedCards(data: unknown, ctx: CardContext): ParseResult<GeneratedCard[]> {
  const errors: string[] = []
  const root = asRecord(data)
  const raw = root && Array.isArray(root.cards) ? root.cards : null
  if (!raw) return { value: [], errors: ['cards: missing cards array'] }

  const allowed = ctx.allowedKinds ? new Set<CardKind>(ctx.allowedKinds) : null
  const out: GeneratedCard[] = []

  raw.forEach((entry, i) => {
    const c = asRecord(entry)
    if (!c) {
      errors.push(`cards[${i}]: not an object`)
      return
    }
    const type = c.type === 'cloze' ? 'cloze' : 'basic'
    const kind: CardKind = isCardKind(c.kind) && (!allowed || allowed.has(c.kind)) ? c.kind : type
    const level: CardLevel = isCardLevel(c.level) ? c.level : 1

    const blockId = typeof c.blockId === 'string' ? c.blockId : undefined
    const page = blockId ? ctx.pages[blockId] : undefined
    const sourceRef = page != null ? { page, block: blockId } : undefined
    const tags = Array.isArray(c.tags) ? c.tags.map(String).filter(Boolean) : undefined

    if (type === 'cloze') {
      const text = typeof c.text === 'string' ? c.text.trim() : ''
      if (!text) {
        errors.push(`cards[${i}]: cloze without text`)
        return
      }
      out.push({ type, kind, level, topic: ctx.topic, text, tags, sourceRef })
      return
    }

    const front = typeof c.front === 'string' ? c.front.trim() : ''
    const back = typeof c.back === 'string' ? c.back.trim() : ''
    if (!front || !back) {
      errors.push(`cards[${i}]: missing front/back`)
      return
    }
    out.push({ type, kind, level, topic: ctx.topic, front, back, tags, sourceRef })
  })

  return { value: out, errors }
}

/**
 * Verdicts of the model's quality pass, aligned with the cards that were sent.
 * A missing or malformed verdict counts as "passed": quality control may
 * demote a card to draft, it must never silently delete work.
 */
export function parseVerdicts(data: unknown, expected: number): ParseResult<Verdict[]> {
  const errors: string[] = []
  const root = asRecord(data)
  const raw = root && Array.isArray(root.verdicts) ? root.verdicts : null
  if (!raw) return { value: Array.from({ length: expected }, () => ({ ok: true })), errors: ['qc: missing verdicts'] }
  if (raw.length !== expected) errors.push(`qc: ${raw.length} verdicts for ${expected} cards`)

  const value: Verdict[] = Array.from({ length: expected }, (_, i) => {
    const v = asRecord(raw[i])
    if (!v || typeof v.ok !== 'boolean') return { ok: true }
    return { ok: v.ok, issue: typeof v.issue === 'string' ? v.issue.slice(0, 200) : undefined }
  })
  return { value, errors }
}
