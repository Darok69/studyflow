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
  /** Exam topics this belongs to; how a reading finds its lecture. */
  topics?: string[]
}

export interface CourseRef {
  code: string
  title: string
  /** Deck this course was made for. Set by the pipeline from courses.json. */
  subject?: string | null
  lectures: LectureRef[]
}

/**
 * Every course belonging to this subject.
 *
 * A subject can be taught from more than one course — a lecture and its
 * practical exercise cover the same exam, and both belong in the same
 * textbook. The pipeline therefore stamps each course with the deck it was
 * made for, and that is the primary link.
 *
 * The fallback is the older one: a course whose LECTURE TITLES appear among
 * the deck's card topics. It keeps working for material uploaded before the
 * subject was stamped, and for hand-made decks.
 */
export function matchCourses<T extends CourseRef>(
  courses: T[],
  subjectName: string,
  topics: string[],
): T[] {
  const name = subjectName.trim().toLowerCase()
  const named = courses.filter((c) => (c.subject ?? '').trim().toLowerCase() === name && name !== '')
  if (named.length > 0) return withSameTopics(courses, named)

  const wanted = new Set(topics.filter(Boolean))
  if (wanted.size === 0) return []
  const scored = courses
    .map((course) => ({ course, hits: course.lectures.filter((l) => wanted.has(l.title)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  return scored.length > 0 ? withSameTopics(courses, [scored[0].course]) : []
}

/**
 * Přibalí kurzy, které učí TÁŽ TÉMATA jako ty nalezené.
 *
 * Kartu nese přednáška, a tak se podle názvů najde právě přednáškový kurz.
 * Jenže povinná četba se jmenuje po článku („Kreß, Mezinárodní trestní
 * právo") a cvičení po hodině („Cvičení 3") — podle názvu by je nenašel nikdo
 * a v učebnici by chyběly, přestože patří k témuž tématu téže zkoušky.
 *
 * U zkoušky se téma dostane celé, ne po kurzech. Proto se k nalezeným kurzům
 * přidá každý další, který sdílí aspoň jedno téma.
 */
function withSameTopics<T extends CourseRef>(courses: T[], seed: T[]): T[] {
  const keys = new Set(seed.flatMap((c) => c.lectures.flatMap((l) => l.topics ?? [])))
  if (keys.size === 0) return seed
  const has = new Set(seed.map((c) => c.code))
  const out = [...seed]
  for (const course of courses) {
    if (has.has(course.code)) continue
    if (course.lectures.some((l) => (l.topics ?? []).some((k) => keys.has(k)))) out.push(course)
  }
  return out
}

/**
 * Lecture that carries a topic's cards, matched by title.
 * Lets a topic row open the textbook exactly where the topic is explained.
 */
export function lectureForTopic(courses: CourseRef[], topic: string): LectureRef | null {
  if (!topic) return null
  for (const course of courses) {
    const hit = course.lectures.find((l) => l.title === topic)
    if (hit) return hit
  }
  return null
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
  courses: CourseRef[],
): T[] {
  const rank = new Map<string, number>()
  let i = 0
  for (const course of courses) {
    for (const l of course.lectures) {
      // A title used by two lectures keeps the first one's place.
      if (!rank.has(l.title)) rank.set(l.title, i)
      i++
    }
  }
  return [...plans].sort((a, b) => {
    const ra = rank.get(a.topic)
    const rb = rank.get(b.topic)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return 0 // both unknown: leave them as they came
  })
}
