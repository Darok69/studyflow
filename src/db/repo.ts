// Data-access layer: the only module that touches Dexie from the UI/session.
import {
  db,
  type Card,
  type Confidence,
  type ErrorEntry,
  type RatingName,
  type Review,
  type Settings,
  type SourceMeta,
  type Subject,
  type SubjectKind,
} from './db'
import type { CardDraft, ParsedDeck } from '../import/parseDeck'
import { newCardsOnly } from '../import/mergeDeck'
import { deckToJson } from '../import/exportDeck'
import { backupToJson, type Backup } from '../import/backup'
import { DEFAULT_RETENTION, newFsrsFields, rate, type FsrsFields } from '../scheduler/fsrs'
import { subjectColorIndex } from '../lib/theme'
import { BREAK_NUDGE_MINUTES, DEFAULT_DAILY_MINUTES, DEFAULT_DAILY_NEW_CAP } from '../lib/wellbeing'
import { dayKey } from '../lib/date'

const SETTINGS_ID = 'app'

function uuid(): string {
  return crypto.randomUUID()
}

/** Broadcast that persisted data changed — the sync layer listens for this. */
function notifyDataChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sf-data-changed'))
}

/**
 * Draft → card, minus the FSRS state the caller adds. One place where a card is
 * born, whether it came from a JSON import, the in-app editor or the generator.
 */
function cardFromDraft(draft: CardDraft, subjectId: string): Omit<Card, keyof FsrsFields> {
  return {
    id: uuid(),
    subjectId,
    type: draft.type,
    // A deck written by hand carries no didactic kind: what it renders as is
    // what it teaches, at recall level.
    kind: draft.kind ?? draft.type,
    level: draft.level ?? 1,
    topic: draft.topic,
    front: draft.front,
    back: draft.back,
    raw: draft.raw,
    tags: draft.tags,
    svg: draft.svg,
    image: draft.image,
    imageBack: draft.imageBack,
    images: draft.images,
    occlusion: draft.occlusion,
    sourceId: draft.sourceId,
    sourceRef: draft.sourceRef,
    draft: draft.draft,
    draftReason: draft.draftReason,
  }
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

/**
 * Subjects whose name matches, ignoring case and surrounding spaces.
 * Used by the import screen to offer adding to a deck that already exists
 * instead of making a second one beside it.
 */
export async function findSubjectsByName(name: string): Promise<Subject[]> {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return []
  const all = await db.subjects.toArray()
  return all.filter((s) => s.name.trim().toLowerCase() === wanted)
}

/**
 * Add a re-imported deck's NEW cards to a subject that already exists.
 * Cards already there keep their FSRS history untouched — that is the whole
 * point, since material arrives topic by topic and gets imported again.
 */
export async function addNewCardsToSubject(
  subjectId: string,
  parsed: ParsedDeck,
): Promise<{ subjectId: string; cardCount: number; duplicates: number }> {
  const existing = await db.cards.where('subjectId').equals(subjectId).toArray()
  const { fresh, duplicates } = newCardsOnly(
    existing.map((c) => c.front),
    parsed.cards,
  )
  const added = await addCards(subjectId, fresh)
  // An exam date that moved is worth taking over; the rest of the subject
  // (colour, limits, intention) belongs to the user, not to the file.
  if (parsed.subject.examDate) {
    const subject = await db.subjects.get(subjectId)
    if (subject && subject.examDate !== parsed.subject.examDate) {
      await db.subjects.update(subjectId, { examDate: parsed.subject.examDate })
    }
  }
  notifyDataChanged()
  return { subjectId, cardCount: added, duplicates }
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
    ...cardFromDraft(d, subjectId),
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
  /** Set when the mistake went into the error log, so undo can take it back. */
  errorId: string | null
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
  meta: { confidence?: Confidence; elapsedMs?: number } = {},
): Promise<RatingResult> {
  const now = new Date()
  const updated: Card = { ...card, ...rate(card, rating, examDate, now, retention) }
  const review: Review = {
    id: uuid(),
    cardId: card.id,
    rating,
    ts: now.toISOString(),
    confidence: meta.confidence,
    elapsedMs: meta.elapsedMs,
  }

  // Being SURE and wrong is the most valuable mistake there is — it corrects
  // best and it is exactly what the exam punishes, so it goes on the record.
  const sureAndWrong = meta.confidence === 'know' && rating === 'again'
  const lapsed = rating === 'again' && card.state === 'review'
  const error: ErrorEntry | null =
    sureAndWrong || lapsed
      ? {
          id: uuid(),
          cardId: card.id,
          subjectId: card.subjectId,
          topic: card.topic,
          ts: now.toISOString(),
          kind: sureAndWrong ? 'hypercorrection' : 'lapse',
        }
      : null

  await db.transaction('rw', db.cards, db.reviews, db.errorLog, async () => {
    await db.cards.put(updated)
    await db.reviews.add(review)
    if (error) await db.errorLog.add(error)
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
  return { updated, reviewId: review.id, prev, errorId: error?.id ?? null }
}

/**
 * Undo a rating: restore the card's FSRS fields (content edits made since are
 * kept) and drop the review log entry. Returns the restored card.
 */
export async function undoRating(
  cardId: string,
  reviewId: string,
  prev: FsrsFields,
  errorId: string | null = null,
): Promise<Card | null> {
  const restored = await db.transaction('rw', db.cards, db.reviews, db.errorLog, async () => {
    const cur = await db.cards.get(cardId)
    if (!cur) return null
    const result: Card = { ...cur, ...prev }
    await db.cards.put(result)
    await db.reviews.delete(reviewId)
    if (errorId) await db.errorLog.delete(errorId)
    return result
  })
  notifyDataChanged()
  return restored
}

// ---- Card CRUD (in-app authoring / browser) ----

export async function addCard(subjectId: string, draft: CardDraft): Promise<Card> {
  const card: Card = {
    ...cardFromDraft(draft, subjectId),
    ...newFsrsFields(new Date()),
  }
  await db.cards.add(card)
  notifyDataChanged()
  return card
}

/**
 * Add a whole batch of cards to an EXISTING subject — how a generated deck
 * lands in the app (importDeck always creates a new subject instead).
 */
export async function addCards(subjectId: string, drafts: CardDraft[]): Promise<number> {
  if (drafts.length === 0) return 0
  const now = new Date()
  const cards: Card[] = drafts.map((d) => ({ ...cardFromDraft(d, subjectId), ...newFsrsFields(now) }))
  await db.cards.bulkAdd(cards)
  notifyDataChanged()
  return cards.length
}

/** Update card content/placement; FSRS state is intentionally untouched. */
export async function updateCard(
  id: string,
  patch: Partial<
    Pick<
      Card,
      | 'front'
      | 'back'
      | 'raw'
      | 'tags'
      | 'svg'
      | 'image'
      | 'imageBack'
      | 'images'
      | 'occlusion'
      | 'type'
      | 'kind'
      | 'level'
      | 'topic'
      | 'subjectId'
      | 'draft'
      | 'draftReason'
    >
  >,
): Promise<Card | null> {
  const next = await db.transaction('rw', db.cards, async () => {
    const cur = await db.cards.get(id)
    if (!cur) return null
    // A hand-edited card carries a visible mark: own material is learned more
    // willingly than material somebody else wrote (BRIEF §5.18).
    const result: Card = { ...cur, ...patch, userEdited: true }
    await db.cards.put(result)
    return result
  })
  notifyDataChanged()
  return next
}

/**
 * Accept a card that failed quality control as it stands. Nothing else changes —
 * the reason is dropped and the card joins the queue tomorrow like any other.
 */
export async function approveDraft(id: string): Promise<void> {
  await db.cards.update(id, { draft: false, draftReason: undefined })
  notifyDataChanged()
}

export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', db.cards, db.reviews, db.errorLog, async () => {
    await db.reviews.where('cardId').equals(id).delete()
    await db.errorLog.where('cardId').equals(id).delete()
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
  kind?: SubjectKind
  ects?: number | null
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
    kind: input.kind ?? 'other',
    ects: input.ects ?? null,
  }
  await db.subjects.add(subject)
  notifyDataChanged()
  return subject
}

export async function updateSubject(
  id: string,
  patch: Partial<
    Pick<
      Subject,
      | 'name'
      | 'examDate'
      | 'reminderTime'
      | 'colorIndex'
      | 'dailyNewLimit'
      | 'kind'
      | 'ects'
      | 'intention'
    >
  >,
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
  const [subjects, cards, reviews, errors, settings] = await Promise.all([
    db.subjects.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.errorLog.toArray(),
    db.settings.get(SETTINGS_ID),
  ])
  return backupToJson({
    exportedAt: new Date().toISOString(),
    subjects,
    cards,
    reviews,
    errorLog: errors,
    settings: settings ?? null,
  })
}

/** Replace ALL local data with a parsed backup (one transaction). */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.subjects, db.cards, db.reviews, db.settings, db.errorLog, async () => {
    await Promise.all([
      db.subjects.clear(),
      db.cards.clear(),
      db.reviews.clear(),
      db.settings.clear(),
      db.errorLog.clear(),
    ])
    if (backup.subjects.length) await db.subjects.bulkAdd(backup.subjects)
    if (backup.cards.length) await db.cards.bulkAdd(backup.cards)
    if (backup.reviews.length) await db.reviews.bulkAdd(backup.reviews)
    // Backups written before the error log existed simply have none.
    if (backup.errorLog?.length) await db.errorLog.bulkAdd(backup.errorLog)
    if (backup.settings) await db.settings.put({ ...backup.settings, id: SETTINGS_ID })
  })
}

// ---- Error log (weak spots) ----

export async function getErrors(): Promise<ErrorEntry[]> {
  return db.errorLog.toArray()
}

/** The user's own explanation of a mistake — elaboration beats re-reading. */
export async function setErrorNote(id: string, note: string): Promise<void> {
  await db.errorLog.update(id, { note: note.trim() || undefined })
  notifyDataChanged()
}

// ---- Source materials (local mirror of the server's blob store) ----
// Sources deliberately do NOT call notifyDataChanged: they are not part of the
// backup snapshot, so a source change must not mark the whole app dirty.

export async function getSources(): Promise<SourceMeta[]> {
  return db.sources.toArray()
}

export async function getSourcesBySubject(subjectId: string): Promise<SourceMeta[]> {
  return db.sources.where('subjectId').equals(subjectId).toArray()
}

export async function getSource(id: string): Promise<SourceMeta | undefined> {
  return db.sources.get(id)
}

/** Upsert one source's metadata as reported by the server. */
export async function putSource(meta: SourceMeta): Promise<void> {
  await db.sources.put(meta)
}

/** Replace the whole local mirror with the server's list (authoritative). */
export async function replaceSources(list: SourceMeta[]): Promise<void> {
  await db.transaction('rw', db.sources, async () => {
    await db.sources.clear()
    if (list.length) await db.sources.bulkAdd(list)
  })
}

export async function deleteSourceMeta(id: string): Promise<void> {
  await db.sources.delete(id)
}

/** Delete a subject and all of its cards + reviews. */
export async function deleteSubject(subjectId: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.cards, db.reviews, db.sources, db.errorLog, async () => {
    const cardIds = await db.cards.where('subjectId').equals(subjectId).primaryKeys()
    await db.errorLog.where('subjectId').equals(subjectId).delete()
    await db.reviews.where('cardId').anyOf(cardIds as string[]).delete()
    await db.cards.where('subjectId').equals(subjectId).delete()
    await db.sources.where('subjectId').equals(subjectId).delete()
    await db.subjects.delete(subjectId)
  })
  notifyDataChanged()
}

/** Wipe everything (used by the reset action). */
export async function resetAll(): Promise<void> {
  // Six tables: Dexie's positional overload stops at five, so pass an array.
  await db.transaction('rw', [db.subjects, db.cards, db.reviews, db.settings, db.sources, db.errorLog], async () => {
    await Promise.all([
      db.subjects.clear(),
      db.cards.clear(),
      db.reviews.clear(),
      db.settings.clear(),
      db.sources.clear(),
      db.errorLog.clear(),
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
  askConfidence: true,
  dailyMinutes: DEFAULT_DAILY_MINUTES,
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
