import Dexie, { type Table } from 'dexie'
import { subjectColorIndex } from '../lib/theme'
import { type CardKind, type CardLevel, isCardKind } from './cardKinds'

export type CardType = 'basic' | 'cloze'
export type FsrsStateName = 'new' | 'learning' | 'review' | 'relearning'
export type RatingName = 'again' | 'hard' | 'good' | 'easy'

/** Which field a subject belongs to — drives colour and the generator prompt. */
export type SubjectKind = 'law' | 'geography' | 'other'

export interface Subject {
  id: string
  name: string
  examDate: string | null // YYYY-MM-DD
  reminderTime: string | null // HH:MM
  createdAt: string // ISO
  colorIndex: number // stable identity hue (0..7), assigned once and never changed
  dailyNewLimit?: number | null // manual new-cards-per-day; null/undefined = auto pace
  kind?: SubjectKind // 'other' for subjects created before the field existed
  ects?: number | null // credits this course is worth (progress tracking)
  /**
   * Implementation intention (BRIEF §5.11): "V úterý v 19:00 u kuchyňského
   * stolu 25 minut práva." A concrete when/where/what beats good will, and it
   * is what the reminder says instead of a generic "time to study".
   */
  intention?: string
}

/**
 * A picture attached to a card. `key` points at the server blob store
 * (`/api/sources/...`); older in-app photos keep living in Card.image as data
 * URLs. `focus` is a relative point + zoom so a detail can be framed without
 * cropping the original.
 */
export interface CardImage {
  key: string
  role: 'prompt' | 'answer' | 'context'
  alt: string // required — screen readers and the occlusion text variant
  focus?: { x: number; y: number; zoom: number }
}

/** Occlusion mask. ALL coordinates are relative (0–1) so they survive any resolution. */
export interface OcclusionMask {
  id: string
  shape: 'rect' | 'poly'
  x: number
  y: number
  w: number
  h: number
  points?: { x: number; y: number }[] // polygon vertices, relative as well
  label: string
}

export interface Occlusion {
  imageKey: string
  masks: OcclusionMask[]
  mode: 'hide-one-guess-one' | 'hide-all-guess-one'
}

/** Where in the source material a card came from — lets the UI jump back. */
export interface SourceRef {
  page: number
  block?: string
}

export interface Card {
  id: string
  subjectId: string
  type: CardType // how the card is RENDERED (plain vs cloze)
  kind?: CardKind // what the card TEACHES (definice, proces, případ…)
  level?: CardLevel // 1 recall, 2 understanding, 3 application
  topic?: string // heading from the approved outline — interleaving + filters
  front: string
  back: string
  raw?: string // original cloze source text
  tags: string[]
  svg?: string // inline SVG markup (sanitized at render time)
  image?: string // question photo — data URL (in-app upload) or plain URL (import)
  imageBack?: string // answer photo, revealed together with the back side
  images?: CardImage[] // pictures held in the server blob store
  occlusion?: Occlusion | null // masks for image-occlusion cards
  sourceId?: string // source material this card was generated from
  sourceRef?: SourceRef
  draft?: boolean // failed quality control — waits for a human before scheduling
  draftReason?: string // why it failed, shown in the browser
  userEdited?: boolean // hand-edited by the user (ownership effect)
  suspended?: boolean // excluded from scheduling until re-enabled
  buriedUntil?: string | null // YYYY-MM-DD — hidden from the queue through this day

  // ---- FSRS scheduling state ----
  due: string // ISO
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: FsrsStateName
  lastReview: string | null // ISO
}

/**
 * How sure the user was BEFORE the answer was revealed. Comparing this with the
 * rating is the calibration signal: overconfidence is the main reason people
 * walk into an exam thinking they know the material (BRIEF §5.6).
 */
export type Confidence = 'know' | 'unsure' | 'no'

export interface Review {
  id: string
  cardId: string
  rating: RatingName
  ts: string // ISO — used for stats / streaks
  confidence?: Confidence // absent on reviews made before calibration existed
  /** Milliseconds from showing the question to the rating — thinking time. */
  elapsedMs?: number
}

/**
 * A mistake worth learning from. Written when the user was SURE and still got
 * it wrong (hypercorrection: confident errors are the ones that correct best)
 * and when a learned card lapses.
 */
export interface ErrorEntry {
  id: string
  cardId: string
  subjectId: string
  topic?: string
  ts: string // ISO
  kind: 'hypercorrection' | 'lapse'
  note?: string // the user's own "why did I get this wrong?"
}

export type SourceKind = 'pdf' | 'image' | 'text' | 'audio' | 'url'

export type SourceStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'outlined'
  | 'generating'
  | 'generated'
  | 'done'
  | 'error'

/**
 * Local mirror of a source material's metadata. The heavy parts — the original
 * file, page renders and the extracted text — live on the server blob store and
 * are fetched on demand; they never enter the sync snapshot.
 */
export interface SourceMeta {
  id: string
  subjectId: string
  kind: SourceKind
  name: string
  pages: number
  status: SourceStatus
  createdAt: string // ISO
  error?: string | null
}

// Singleton app settings (one row, id = 'app').
// New optional-behaviour fields get defaults in repo.getSettings, so older
// stored rows upgrade transparently without a schema migration.
export interface Settings {
  id: string
  dailyNewCapEnabled: boolean
  dailyNewCap: number
  targetRetention: number // FSRS request_retention (0.80–0.95)
  showIntervalPreviews: boolean // interval hint on the rating buttons
  typedAnswers: boolean // active-recall typing before reveal
  breakNudgeMinutes: number // soft break suggestion interval
  cardFontScale: number // card text size multiplier (0.9 / 1 / 1.2)
  cardSans: boolean // sans-serif card face instead of serif
  askConfidence: boolean // the "vím / tuším / nevím" step before the reveal
  dailyMinutes: number // time that genuinely exists for studying on a normal day
}

// Typed Dexie instance. We avoid the `class extends Dexie` pattern because, with
// `useDefineForClassFields` on, declared table fields would clobber Dexie's own
// getters; the intersection-type cast keeps full typing without that footgun.
export const db = new Dexie('studyflow') as Dexie & {
  subjects: Table<Subject, string>
  cards: Table<Card, string>
  reviews: Table<Review, string>
  settings: Table<Settings, string>
  sources: Table<SourceMeta, string>
  errorLog: Table<ErrorEntry, string>
}

db.version(1).stores({
  // Only indexed fields are listed; other properties are stored but not indexed.
  subjects: 'id, name, examDate, createdAt',
  cards: 'id, subjectId, state, due, [subjectId+state]',
  reviews: 'id, cardId, ts',
})

// v2: add the settings store and backfill a stable colour for existing subjects.
// (colorIndex is not indexed, so subjects' store string is unchanged.)
db.version(2)
  .stores({ settings: 'id' })
  .upgrade(async (tx) => {
    await tx
      .table('subjects')
      .toCollection()
      .modify((s: Subject) => {
        if (typeof s.colorIndex !== 'number') s.colorIndex = subjectColorIndex(s.id)
      })
  })

// v3: source materials + the didactic fields the generation pipeline fills in.
// `draft` stays unindexed on purpose — IndexedDB cannot index booleans.
db.version(3)
  .stores({
    cards: 'id, subjectId, state, due, [subjectId+state], topic, sourceId',
    sources: 'id, subjectId, status, createdAt',
  })
  .upgrade(async (tx) => {
    await tx
      .table('subjects')
      .toCollection()
      .modify((s: Subject) => {
        if (!s.kind) s.kind = 'other'
      })
    await tx
      .table('cards')
      .toCollection()
      .modify((c: Card) => {
        // Hand-made and imported cards keep teaching what they always taught:
        // the render type doubles as the didactic kind, at recall level.
        if (!isCardKind(c.kind)) c.kind = c.type
        if (!c.level) c.level = 1
      })
  })

// v4: calibration (confidence on a review) + the error log behind weak spots.
// Reviews gain optional fields only, so no backfill is needed.
db.version(4).stores({
  errorLog: 'id, cardId, subjectId, ts, kind',
})
