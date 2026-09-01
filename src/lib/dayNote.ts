// Zeigarnik: a day that ends in the middle of a topic leaves a thread to pick
// up (BRIEF §5.13). Unfinished work stays in mind — and starting tomorrow is
// far easier when there is a named place to start from than a blank plan.
//
// Pure logic + a thin localStorage wrapper; the decision of what to show is
// testable on its own.

const KEY = 'studyflow-day-note'

export interface DayNote {
  subjectId: string
  subjectName: string
  topic: string | null
  /** Day the session was cut short (YYYY-MM-DD). */
  savedOn: string
  /** Cards still waiting in that session. */
  remaining: number
}

export type NoteTone = 'today' | 'later'

/**
 * Should the note be offered, and in which words? The same day it reads as
 * "you stopped here", from the next day on as "start here".
 */
export function noteTone(note: DayNote | null, today: string): NoteTone | null {
  if (!note || note.remaining <= 0) return null
  return note.savedOn === today ? 'today' : 'later'
}

export function readDayNote(): DayNote | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const note = JSON.parse(raw) as Partial<DayNote>
    if (!note || typeof note.subjectId !== 'string' || typeof note.savedOn !== 'string') return null
    return {
      subjectId: note.subjectId,
      subjectName: typeof note.subjectName === 'string' ? note.subjectName : '',
      topic: typeof note.topic === 'string' ? note.topic : null,
      savedOn: note.savedOn,
      remaining: typeof note.remaining === 'number' ? note.remaining : 0,
    }
  } catch {
    return null
  }
}

export function writeDayNote(note: DayNote): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(note))
  } catch {
    /* private mode: the note is a nicety, never a requirement */
  }
}

export function clearDayNote(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* see above */
  }
}
