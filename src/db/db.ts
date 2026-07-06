import Dexie, { type Table } from 'dexie'
import { subjectColorIndex } from '../lib/theme'

export type CardType = 'basic' | 'cloze'
export type FsrsStateName = 'new' | 'learning' | 'review' | 'relearning'
export type RatingName = 'again' | 'hard' | 'good' | 'easy'

export interface Subject {
  id: string
  name: string
  examDate: string | null // YYYY-MM-DD
  reminderTime: string | null // HH:MM
  createdAt: string // ISO
  colorIndex: number // stable identity hue (0..7), assigned once and never changed
  dailyNewLimit?: number | null // manual new-cards-per-day; null/undefined = auto pace
}

export interface Card {
  id: string
  subjectId: string
  type: CardType
  front: string
  back: string
  raw?: string // original cloze source text
  tags: string[]
  svg?: string // inline SVG markup (sanitized at render time)
  image?: string // image URL (rendered as-is; for later)
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

export interface Review {
  id: string
  cardId: string
  rating: RatingName
  ts: string // ISO — used for stats / streaks
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
}

// Typed Dexie instance. We avoid the `class extends Dexie` pattern because, with
// `useDefineForClassFields` on, declared table fields would clobber Dexie's own
// getters; the intersection-type cast keeps full typing without that footgun.
export const db = new Dexie('studyflow') as Dexie & {
  subjects: Table<Subject, string>
  cards: Table<Card, string>
  reviews: Table<Review, string>
  settings: Table<Settings, string>
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
