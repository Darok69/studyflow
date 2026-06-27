// Pure-logic test suite (no DOM / no IndexedDB). Run with `npm test`, which
// bundles this with rolldown and executes it on Node. Covers the Sprint 1
// scheduler/FSRS/parsing core plus the Sprint 2 identity + wellbeing + stats.
import { parseDeck } from '../src/import/parseDeck'
import { buildSession, newCardQuota, subjectStats, reinsertAgain } from '../src/scheduler/scheduler'
import { rate, newFsrsFields } from '../src/scheduler/fsrs'
import { daysUntil, endOfDay } from '../src/lib/date'
import { subjectColor, subjectColorIndex, subjectPalette, SUBJECT_COLOR_COUNT } from '../src/lib/theme'
import { assessLoad, estimateMinutes } from '../src/lib/wellbeing'
import { currentStreak, reviewsInLastDays, reviewsLast7Days, reviewsToday } from '../src/stats/stats'
import { encouragement } from '../src/lib/encouragement'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) {
    pass++
    console.log('  ✓', msg)
  } else {
    fail++
    console.error('  ✗ FAIL:', msg)
  }
}

// helpers
const mk = (id: string, sub: string, state: string, due: string) => ({
  id,
  subjectId: sub,
  state: state as 'new' | 'learning' | 'review' | 'relearning',
  due,
})

// ============================================================
// Sprint 1 — parsing / scheduling / FSRS
// ============================================================
console.log('— parseDeck —')
const pd = parseDeck(
  JSON.stringify({
    subject: 'Test',
    examDate: '2026-07-15',
    cards: [
      { type: 'basic', front: 'Q?', back: 'A' },
      { type: 'cloze', text: 'The {{Twelve Tables}} were from {{451 BC}}.' },
    ],
  }),
)
ok(pd.errors.length === 0, 'valid deck has no errors')
ok(pd.cards.length === 2, 'parsed 2 cards')
const cloze = pd.cards[1]
ok(cloze.front.includes('［ ___ ］') && !cloze.front.includes('Twelve'), 'cloze front blanks the answers')
ok(cloze.back.includes('［ Twelve Tables ］') && cloze.back.includes('［ 451 BC ］'), 'cloze back fills both answers')
ok(cloze.raw === 'The {{Twelve Tables}} were from {{451 BC}}.', 'cloze keeps raw text')

const bad = parseDeck('{ not json')
ok(bad.errors.length > 0, 'invalid JSON yields an error')
const missing = parseDeck(JSON.stringify({ subject: '', cards: [{ type: 'basic', front: 'x' }] }))
ok(missing.errors.some((e) => e.includes('název')), 'missing subject name reported')
ok(missing.errors.some((e) => e.includes('#1')), 'basic card missing back reported')

console.log('— newCardQuota —')
ok(newCardQuota(10, 5) === 2, '10 new / 5 days = 2')
ok(newCardQuota(10, 0) === 10, 'exam today crams all 10')
ok(newCardQuota(10, -3) === 10, 'past exam crams all')
ok(newCardQuota(0, 5) === 0, 'no new cards = 0')
ok(newCardQuota(10, null) === 1, '10 new / 14-day horizon = 1')

console.log('— buildSession interleave + quota —')
const now = new Date('2026-06-27T09:00:00')
const subjects = [
  { id: 'far', examDate: '2026-08-30' },
  { id: 'near', examDate: '2026-06-30' },
]
const cards = [
  ...Array.from({ length: 6 }, (_, i) => mk(`n-new-${i}`, 'near', 'new', now.toISOString())),
  mk('n-due', 'near', 'review', '2026-06-26T09:00:00'),
  ...Array.from({ length: 14 }, (_, i) => mk(`f-new-${i}`, 'far', 'new', now.toISOString())),
]
const session = buildSession(subjects, cards, now)
ok(session.dueReviews === 1, `dueReviews = 1 (got ${session.dueReviews})`)
ok(session.newCards === 3, `newCards = 3 (got ${session.newCards})`)
ok(session.total === 4, `total = 4 (got ${session.total})`)
ok(session.order[0] === 'n-due', `first slot is nearest subject's due review (got ${session.order[0]})`)
ok(session.order[1].startsWith('f-'), `second slot interleaves the other subject (got ${session.order[1]})`)

console.log('— subjectStats —')
const st = subjectStats(subjects[1], cards, now)
ok(st.total === 7 && st.studied === 1, 'stats count total + studied')
ok(st.dueToday === 1 && st.newToday === 2, 'stats due/new today')

console.log('— reinsertAgain —')
const q = ['a', 'b', 'c', 'd', 'e']
ok(JSON.stringify(reinsertAgain(q, 0, 3)) === JSON.stringify(['a', 'b', 'c', 'a', 'd', 'e']), 'reinserts 3 positions later')

console.log('— FSRS rating + deadline clamp —')
const fresh = newFsrsFields(now)
ok(fresh.state === 'new' && fresh.reps === 0, 'new card starts in new state, 0 reps')
const reviewCard = {
  id: 'x', subjectId: 'near', type: 'basic' as const, front: 'q', back: 'a', tags: [],
  due: now.toISOString(), stability: 100, difficulty: 5, reps: 8, lapses: 0,
  state: 'review' as const, lastReview: '2026-05-01T09:00:00',
}
const noClamp = rate(reviewCard, 'good', null, now)
ok(new Date(noClamp.due).getTime() > now.getTime(), 'good rating pushes due into the future')
const clamped = rate(reviewCard, 'good', '2026-06-30', now)
const cap = endOfDay(new Date('2026-06-30T00:00:00')).getTime()
ok(new Date(clamped.due).getTime() <= cap, 'due clamped to exam day')
ok(new Date(clamped.due).getTime() < new Date(noClamp.due).getTime(), 'clamped due is earlier than unclamped')
const again = rate(reviewCard, 'again', null, now)
ok(again.lapses === 1, 'again increments lapses')
ok(daysUntil('2026-06-30', now) === 3, 'daysUntil computes 3')

// ============================================================
// Sprint 2 — colour identity
// ============================================================
console.log('— subject colour identity —')
ok(SUBJECT_COLOR_COUNT === 8 && subjectPalette.length === 8, 'palette has 8 hues')
ok(subjectColorIndex('abc-123') === subjectColorIndex('abc-123'), 'colour index is deterministic')
const idx = subjectColorIndex('some-subject-id')
ok(idx >= 0 && idx < 8 && Number.isInteger(idx), 'colour index in 0..7')
ok(subjectColor(idx) === subjectPalette[idx], 'subjectColor resolves to the palette hue')
ok(subjectColor(-1) === subjectPalette[7] && subjectColor(8) === subjectPalette[0], 'subjectColor wraps out-of-range safely')
const spread = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(subjectColorIndex))
ok(spread.size >= 4, `hash spreads ids across hues (got ${spread.size} distinct)`)

// ============================================================
// Sprint 2 — wellbeing guardrails
// ============================================================
console.log('— wellbeing estimate + heavy load —')
ok(estimateMinutes(0) === 0, '0 cards = 0 min')
ok(estimateMinutes(1) === 1, '1 card rounds up to 1 min')
ok(estimateMinutes(60) === 8, '60 cards ≈ 8 min')
ok(assessLoad(40).heavy === false, '40 cards is not heavy')
ok(assessLoad(70).heavy === true, '70 cards (> 60) is heavy')
ok(assessLoad(70).minutes === estimateMinutes(70), 'assessLoad reports the estimate')

console.log('— daily new-card cap —')
const capped1 = buildSession(subjects, cards, now, { newCardCap: 1 })
ok(capped1.newCards === 1, `cap 1 limits new cards to 1 (got ${capped1.newCards})`)
ok(capped1.dueReviews === 1, 'cap does not affect due reviews')
const capped2 = buildSession(subjects, cards, now, { newCardCap: 2 })
const nearPlan = capped2.perSubject.find((p) => p.subjectId === 'near')!
const farPlan = capped2.perSubject.find((p) => p.subjectId === 'far')!
ok(nearPlan.newQuota === 2 && farPlan.newQuota === 0, 'cap is spent nearest-deadline first')
ok(buildSession(subjects, cards, now, { newCardCap: null }).newCards === 3, 'null cap = uncapped')

// ============================================================
// Sprint 2 — stats (streak / sparkline)
// ============================================================
console.log('— stats: streak + last 7 days —')
const T = (day: string, h = 10) => `2026-06-${day}T${String(h).padStart(2, '0')}:00:00`
ok(currentStreak([T('27'), T('26'), T('25')], now) === 3, 'three consecutive days = streak 3')
ok(currentStreak([T('27'), T('25')], now) === 1, 'gap yesterday breaks streak back to today only')
ok(currentStreak([T('26'), T('25')], now) === 2, 'grace: no review today yet still counts from yesterday')
ok(currentStreak([T('24'), T('23')], now) === 0, 'no review today or yesterday = streak 0')
ok(currentStreak([], now) === 0, 'no reviews = streak 0')

const last7 = reviewsLast7Days([T('27'), T('27'), T('26')], now)
ok(last7.length === 7, 'sparkline has 7 buckets')
ok(last7[6].isToday && last7[6].count === 2, 'last bucket is today with 2 reviews')
ok(last7[5].count === 1, 'yesterday bucket has 1 review')
ok(reviewsToday([T('27'), T('27'), T('26')], now) === 2, 'reviewsToday counts only today')
ok(reviewsInLastDays([T('27'), T('20'), T('19')], 7, now) === 1, 'reviewsInLastDays(7) windows correctly')

// ============================================================
// Sprint 2 — supportive copy (never punitive)
// ============================================================
console.log('— encouragement copy —')
ok(encouragement({ totalReviews: 0, remainingToday: 5, studiedToday: false, streak: 0 }).includes('🌱'), 'new user gets a gentle seed message')
ok(encouragement({ totalReviews: 10, remainingToday: 0, studiedToday: true, streak: 2 }).includes('hotový'), 'finished-today gets calm praise')
const missed = encouragement({ totalReviews: 10, remainingToday: 5, studiedToday: false, streak: 0 })
ok(missed.includes('nevadí') && !/zmeškal|selhal|ztratil/i.test(missed), 'missed day is kind, never punitive')
ok(encouragement({ totalReviews: 10, remainingToday: 5, studiedToday: true, streak: 3 }).includes('sérii 3'), 'active streak is framed positively')

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
