/**
 * Tying a subject to its textbook.
 *
 * A card's `topic` is the title of the lecture it came from, so the link
 * between a deck and a course in the textbook can be read straight out of the
 * data — no extra field on the subject, and nothing to re-import. That matters:
 * re-importing a deck would mean new card ids and a lost FSRS history.
 *
 * Pure on purpose (no fetch, no DOM) — the reader screen and the tests use the
 * same functions.
 */

export interface LectureRef {
  id: string
  unit: string
  title: string
  slides: number
  cards: number
}

export interface CourseRef {
  code: string
  title: string
  lectures: LectureRef[]
}

/**
 * The course whose lecture titles best match this subject's topics.
 * Returns null when nothing overlaps — a hand-made deck has no textbook.
 */
export function matchCourse<T extends CourseRef>(courses: T[], topics: string[]): T | null {
  const wanted = new Set(topics.filter(Boolean))
  if (wanted.size === 0) return null
  let best: T | null = null
  let bestHits = 0
  for (const course of courses) {
    const hits = course.lectures.filter((l) => wanted.has(l.title)).length
    if (hits > bestHits) {
      best = course
      bestHits = hits
    }
  }
  return bestHits > 0 ? best : null
}

/**
 * Lecture that carries a topic's cards, matched by title.
 * Lets a topic row open the textbook exactly where the topic is explained.
 */
export function lectureForTopic(course: CourseRef | null, topic: string): LectureRef | null {
  if (!course || !topic) return null
  return course.lectures.find((l) => l.title === topic) ?? null
}

/**
 * Sort topics into the order the course teaches them.
 *
 * Card ids are random, so the order topics come out of the database in means
 * nothing; the textbook's lecture order is the one the material was written in
 * and the one a semester follows. Topics the textbook does not know keep their
 * relative order and go last — they are usually hand-made additions.
 */
export function orderByCourse<T extends { topic: string }>(
  plans: T[],
  course: CourseRef | null,
): T[] {
  const rank = new Map<string, number>()
  course?.lectures.forEach((l, i) => {
    // A title used by two lectures keeps the first one's place.
    if (!rank.has(l.title)) rank.set(l.title, i)
  })
  return [...plans].sort((a, b) => {
    const ra = rank.get(a.topic)
    const rb = rank.get(b.topic)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return 0 // both unknown: leave them as they came
  })
}
