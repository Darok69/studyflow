// Data-access layer: the only module that touches Dexie from the UI/session.
import { db, type Card, type RatingName, type Review, type Settings, type Subject } from './db'
import type { ParsedDeck } from '../import/parseDeck'
import { newFsrsFields, rate } from '../scheduler/fsrs'
import { subjectColorIndex } from '../lib/theme'
import { DEFAULT_DAILY_NEW_CAP } from '../lib/wellbeing'

const SETTINGS_ID = 'app'

function uuid(): string {
  return crypto.randomUUID()
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
    ...newFsrsFields(now),
  }))

  await db.transaction('rw', db.subjects, db.cards, async () => {
    await db.subjects.add(subject)
    if (cards.length) await db.cards.bulkAdd(cards)
  })

  return { subjectId, cardCount: cards.length }
}

/**
 * Apply a rating: run FSRS (with the subject's deadline clamp), persist the
 * updated card and append a review log entry. Returns the updated card.
 */
export async function recordRating(
  card: Card,
  rating: RatingName,
  examDate: string | null,
): Promise<Card> {
  const now = new Date()
  const updated: Card = { ...card, ...rate(card, rating, examDate, now) }
  const review: Review = { id: uuid(), cardId: card.id, rating, ts: now.toISOString() }

  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(updated)
    await db.reviews.add(review)
  })

  return updated
}

/** Delete a subject and all of its cards + reviews. */
export async function deleteSubject(subjectId: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.cards, db.reviews, async () => {
    const cardIds = await db.cards.where('subjectId').equals(subjectId).primaryKeys()
    await db.reviews.where('cardId').anyOf(cardIds as string[]).delete()
    await db.cards.where('subjectId').equals(subjectId).delete()
    await db.subjects.delete(subjectId)
  })
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
}

const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  dailyNewCapEnabled: false,
  dailyNewCap: DEFAULT_DAILY_NEW_CAP,
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next: Settings = { ...(await getSettings()), ...patch, id: SETTINGS_ID }
  await db.settings.put(next)
  return next
}
