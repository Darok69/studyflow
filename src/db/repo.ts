// Data-access layer: the only module that touches Dexie from the UI/session.
import { db, type Card, type RatingName, type Review, type Settings, type Subject } from './db'
import type { CardDraft, ParsedDeck } from '../import/parseDeck'
import { deckToJson } from '../import/exportDeck'
import { backupToJson, type Backup } from '../import/backup'
import { DEFAULT_RETENTION, newFsrsFields, rate, type FsrsFields } from '../scheduler/fsrs'
import { subjectColorIndex } from '../lib/theme'
import { BREAK_NUDGE_MINUTES, DEFAULT_DAILY_NEW_CAP } from '../lib/wellbeing'
import { dayKey } from '../lib/date'

const SETTINGS_ID = 'app'

function uuid(): string {
  return crypto.randomUUID()
}

/** Broadcast that persisted data changed — the sync layer listens for this. */
function notifyDataChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sf-data-changed'))
}

export async function getSubjects(): Promise<Subject[]> {
  return db.subjects.toArray()
}

export async function getCards(): Promise<Card[]> {
  return db.cards.toArray()
}

export async function getReviews(): Promise<Review[]> {
  return db.reviews.toArray()
}

export async function getCardsBySubject(subjectId: string): Promise<Card[]> {
  return db.cards.where('subjectId').equals(subjectId).toArray()
}

/** Persist a parsed deck as a new subject + its cards (one transaction). */
export async function importDeck(parsed: ParsedDeck): Promise<{ subjectId: string; cardCount: number }> {
  const now = new Date()
  const subjectId = uuid()

  const subject: Subject = {
    id: subjectId,
    name: parsed.subject.name || 'Bez názvu',
    examDate: parsed.subject.examDate,
    reminderTime: parsed.subject.reminderTime,
    createdAt: now.toISOString(),
    colorIndex: subjectColorIndex(subjectId),
  }

  const cards: Card[] = parsed.cards.map((d) => ({
    id: uuid(),
    subjectId,
    type: d.type,
    front: d.front,
    back: d.back,
    raw: d.raw,
    tags: d.tags,
    svg: d.svg,
    image: d.image,
    imageBack: d.imageBack,
    ...newFsrsFields(now),
  }))

  await db.transaction('rw', db.subjects, db.cards, async () => {
    await db.subjects.add(subject)
    if (cards.length) await db.cards.bulkAdd(cards)
  })

  notifyDataChanged()
  return { subjectId, cardCount: cards.length }
}

export interface RatingResult {
  updated: Card
  reviewId: string
  /** FSRS fields as they were BEFORE this rating — everything undo needs. */
  prev: FsrsFields
}

/**
 * Apply a rating: run FSRS (with the subject's deadline clamp), persist the
 * updated card and append a review log entry.
 */
export async function recordRating(
  card: Card,
  rating: RatingName,
  examDate: string | null,
  retention: number = DEFAULT_RETENTION,
): Promise<RatingResult> {
  const now = new Date()
  const updated: Card = { ...card, ...rate(card, rating, examDate, now, retention) }
  const review: Review = { id: uuid(), cardId: card.id, rating, ts: now.toISOString() }

  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(updated)
    await db.reviews.add(review)
  })
  notifyDataChanged()

  const prev: FsrsFields = {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.lastReview,
  }
  return { updated, reviewId: review.id, prev }
}

/**
 * Undo a rating: restore the card's FSRS fields (content edits made since are
 * kept) and drop the review log entry. Returns the restored card.
 */
export async function undoRating(
  cardId: string,
  reviewId: string,
  prev: FsrsFields,
): Promise<Card | null> {
  const restored = await db.transaction('rw', db.cards, db.reviews, async () => {
    const cur = await db.cards.get(cardId)
    if (!cur) return null
    const result: Card = { ...cur, ...prev }
    await db.cards.put(result)
    await db.reviews.delete(reviewId)
    return result
  })
  notifyDataChanged()
  return restored
}

// ---- Card CRUD (in-app authoring / browser) ----

export async function addCard(subjectId: string, draft: CardDraft): Promise<Card> {
  const card: Card = {
    id: uuid(),
    subjectId,
    type: draft.type,
    front: draft.front,
    back: draft.back,
    raw: draft.raw,
    tags: draft.tags,
    svg: draft.svg,
    image: draft.image,
    imageBack: draft.imageBack,
    ...newFsrsFields(new Date()),
  }
  await db.cards.add(card)
  notifyDataChanged()
  return card
}

/** Update card content/placement; FSRS state is intentionally untouched. */
export async function updateCard(
  id: string,
  patch: Partial<
    Pick<Card, 'front' | 'back' | 'raw' | 'tags' | 'svg' | 'image' | 'imageBack' | 'type' | 'subjectId'>
  >,
): Promise<Card | null> {
  const next = await db.transaction('rw', db.cards, async () => {
    const cur = await db.cards.get(id)
    if (!cur) return null
    const result: Card = { ...cur, ...patch }
    await db.cards.put(result)
    return result
  })
  notifyDataChanged()
  return next
}

export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.reviews.where('cardId').equals(id).delete()
    await db.cards.delete(id)
  })
  notifyDataChanged()
}

export async function setCardSuspended(id: string, suspended: boolean): Promise<void> {
  await db.cards.update(id, { suspended })
  notifyDataChanged()
}

/** Bury: hide the card for the rest of today; it re-enters the queue tomorrow. */
export async function buryCard(id: string, now: Date = new Date()): Promise<void> {
  await db.cards.update(id, { buriedUntil: dayKey(now) })
  notifyDataChanged()
}

/** Unbury: bring a buried card straight back into today's queue. */
export async function unburyCard(id: string): Promise<void> {
  await db.cards.update(id, { buriedUntil: null })
  notifyDataChanged()
}

// ---- Subject editing ----

/** Create an empty deck by hand (no import) — cards are added in the app. */
export async function createSubject(input: {
  name: string
  examDate?: string | null
  dailyNewLimit?: number | null
}): Promise<Subject> {
  const id = uuid()
  const subject: Subject = {
    id,
    name: input.name.trim() || 'Bez názvu',
    examDate: input.examDate ?? null,
    reminderTime: null,
    createdAt: new Date().toISOString(),
    colorIndex: subjectColorIndex(id),
    dailyNewLimit: input.dailyNewLimit ?? null,
  }
  await db.subjects.add(subject)
  notifyDataChanged()
  return subject
}

export async function updateSubject(
  id: string,
  patch: Partial<Pick<Subject, 'name' | 'examDate' | 'reminderTime' | 'colorIndex' | 'dailyNewLimit'>>,
): Promise<void> {
  await db.subjects.update(id, patch)
  notifyDataChanged()
}

// ---- Export / backup ----

/** Export one subject as import-format JSON (round-trips through parseDeck). */
export async function exportSubjectJson(subjectId: string): Promise<string | null> {
  const subject = await db.subjects.get(subjectId)
  if (!subject) return null
  const cards = await db.cards.where('subjectId').equals(subjectId).toArray()
  return deckToJson(subject, cards)
}

/** Export the whole app (all tables, FSRS state included) as one JSON file. */
export async function exportBackupJson(): Promise<string> {
  const [subjects, cards, reviews, settings] = await Promise.all([
    db.subjects.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.settings.get(SETTINGS_ID),
  ])
  return backupToJson({
    exportedAt: new Date().toISOString(),
    subjects,
    cards,
    reviews,
    settings: settings ?? null,
  })
}

/** Replace ALL local data with a parsed backup (one transaction). */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.subjects, db.cards, db.reviews, db.settings, async () => {
    await Promise.all([db.subjects.clear(), db.cards.clear(), db.reviews.clear(), db.settings.clear()])
    if (backup.subjects.length) await db.subjects.bulkAdd(backup.subjects)
    if (backup.cards.length) await db.cards.bulkAdd(backup.cards)
    if (backup.reviews.length) await db.reviews.bulkAdd(backup.reviews)
    if (backup.settings) await db.settings.put({ ...backup.settings, id: SETTINGS_ID })
  })
}

/** Delete a subject and all of its cards + reviews. */
export async function deleteSubject(subjectId: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.cards, db.reviews, async () => {
    const cardIds = await db.cards.where('subjectId').equals(subjectId).primaryKeys()
    await db.reviews.where('cardId').anyOf(cardIds as string[]).delete()
    await db.cards.where('subjectId').equals(subjectId).delete()
    await db.subjects.delete(subjectId)
  })
  notifyDataChanged()
}

/** Wipe everything (used by the reset action). */
export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.subjects, db.cards, db.reviews, db.settings, async () => {
    await Promise.all([
      db.subjects.clear(),
      db.cards.clear(),
      db.reviews.clear(),
      db.settings.clear(),
    ])
  })
  notifyDataChanged()
}

export const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  dailyNewCapEnabled: false,
  dailyNewCap: DEFAULT_DAILY_NEW_CAP,
  targetRetention: DEFAULT_RETENTION,
  showIntervalPreviews: true,
  typedAnswers: false,
  breakNudgeMinutes: BREAK_NUDGE_MINUTES,
  cardFontScale: 1,
  cardSans: false,
}

export async function getSettings(): Promise<Settings> {
  // Merge over defaults so rows saved by older versions pick up new fields.
  const stored = await db.settings.get(SETTINGS_ID)
  return { ...DEFAULT_SETTINGS, ...stored, id: SETTINGS_ID }
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next: Settings = { ...(await getSettings()), ...patch, id: SETTINGS_ID }
  await db.settings.put(next)
  notifyDataChanged()
  return next
}
