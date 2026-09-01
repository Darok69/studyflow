// Shared pipeline vocabulary. These modules are pure TypeScript with no DOM, no
// i18n and no Dexie: the very same code runs in the browser (offline fallback)
// and on the server (bundled into server/gen/pipeline.mjs).
//
// Anything the user should read comes out as a STABLE CODE, never as a Czech
// sentence — the UI translates it, so the pipeline stays i18n-free.
import type { CardKind, CardLevel } from '../db/cardKinds'

/** One page of extracted text, as produced by the PDF/vision extractor. */
export interface SourcePage {
  page: number
  text: string
}

/** A semantic block of the material — the unit the generator works on. */
export interface Block {
  /** Stable within a source (`p3-b2`) — doubles as the idempotence key. */
  id: string
  heading: string
  text: string
  page: number
}

/** One topic of the outline the user approves BEFORE any card is generated. */
export interface OutlineTopic {
  id: string
  title: string
  blockIds: string[]
  /** 1 easy … 3 hard — the model's estimate, the user may overwrite it. */
  difficulty: 1 | 2 | 3
  estimatedMinutes: number
  cardEstimate: number
}

export interface Outline {
  topics: OutlineTopic[]
}

/**
 * A card as the pipeline emits it — deliberately the app's own import format,
 * so generated decks travel through the same validated path as hand-written
 * JSON (`parseDeck`).
 */
export interface GeneratedCard {
  type: 'basic' | 'cloze'
  kind: CardKind
  level: CardLevel
  topic?: string
  front?: string
  back?: string
  /** Cloze source text with `{{blanks}}` (used instead of front/back). */
  text?: string
  tags?: string[]
  /** Blob key of the picture this card asks about (map, chart, scheme). */
  imageKey?: string
  sourceRef?: { page: number; block?: string }
  draft?: boolean
  draftReason?: QcIssue
}

export interface GeneratedDeck {
  subject: string
  examDate: string | null
  reminderTime: string | null
  cards: GeneratedCard[]
}

/** Why a card did not pass quality control. Translated in the UI. */
export type QcIssue =
  | 'empty'
  | 'answer-too-long'
  | 'answer-in-question'
  | 'cloze-no-blank'
  | 'needs-image'
  | 'duplicate'

/** How a batch of cards was produced — the UI must say when it was the fallback. */
export type PipelineMode = 'model' | 'fallback'

export type FallbackReason = 'no-key' | 'budget' | 'offline' | 'api-error'

export interface GenerationResult {
  mode: PipelineMode
  /** Set whenever mode is 'fallback' — the honest reason it happened. */
  reason?: FallbackReason
  cards: GeneratedCard[]
}
