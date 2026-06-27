import Dexie, { type Table } from 'dexie'

export type CardType = 'basic' | 'cloze'
export type FsrsStateName = 'new' | 'learning' | 'review' | 'relearning'
export type RatingName = 'again' | 'hard' | 'good' | 'easy'

export interface Subject {
  id: string
  name: string
  examDate: string | null // YYYY-MM-DD
  reminderTime: string | null // HH:MM
  createdAt: string // ISO
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

// Typed Dexie instance. We avoid the `class extends Dexie` pattern because, with
// `useDefineForClassFields` on, declared table fields would clobber Dexie's own
// getters; the intersection-type cast keeps full typing without that footgun.
export const db = new Dexie('studyflow') as Dexie & {
  subjects: Table<Subject, string>
  cards: Table<Card, string>
  reviews: Table<Review, string>
}

db.version(1).stores({
  // Only indexed fields are listed; other properties are stored but not indexed.
  subjects: 'id, name, examDate, createdAt',
  cards: 'id, subjectId, state, due, [subjectId+state]',
  reviews: 'id, cardId, ts',
})
