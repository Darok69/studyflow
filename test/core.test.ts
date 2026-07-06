// Pure-logic test suite (no DOM / no IndexedDB). Run with `npm test`, which
// bundles this with rolldown and executes it on Node. Covers the Sprint 1
// scheduler/FSRS/parsing core, the Sprint 2 identity + wellbeing + stats, and
// the Sprint 3 Anki-parity / customisation / learning extras.
import { parseDeck, makeCloze, hasCloze } from '../src/import/parseDeck'
import { deckToJson } from '../src/import/exportDeck'
import { backupToJson, parseBackup } from '../src/import/backup'
import {
  buildSession,
  introducedTodayBySubject,
  isSchedulable,
  newCardQuota,
  subjectStats,
  reinsertAgain,
} from '../src/scheduler/scheduler'
import { rate, newFsrsFields, previewIntervals, retrievabilityAt } from '../src/scheduler/fsrs'
import { daysUntil, daysUntilDate, endOfDay } from '../src/lib/date'
import { subjectColor, subjectColorIndex, subjectPalette, SUBJECT_COLOR_COUNT } from '../src/lib/theme'
import { assessLoad, estimateMinutes, isLeech, LEECH_LAPSES } from '../src/lib/wellbeing'
import {
  currentStreak,
  heatmapWeeks,
  reviewForecast,
  reviewsInLastDays,
  reviewsLast7Days,
  reviewsToday,
} from '../src/stats/stats'
import { decodeDeckPayload, encodeDeckPayload, payloadFromHash } from '../src/lib/sharelink'
import { encouragement } from '../src/lib/encouragement'
import { answerSimilarity, checkAnswer, normalizeAnswer, typedAnswerTarget } from '../src/lib/answer'
import { readinessBand, subjectReadiness } from '../src/lib/readiness'

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

console.log('— manual daily new limit + introduced-today —')
const limSubjects = [
  { id: 'near', examDate: '2026-06-30', dailyNewLimit: 5 },
  { id: 'far', examDate: '2026-08-30' },
]
const lim = buildSession(limSubjects, cards, now)
ok(
  lim.perSubject.find((p) => p.subjectId === 'near')!.newQuota === 5,
  `manual limit 5 overrides auto pace (got ${lim.perSubject.find((p) => p.subjectId === 'near')!.newQuota})`,
)
ok(
  buildSession([{ id: 'near', examDate: '2026-06-30', dailyNewLimit: 0 }], cards, now).newCards === 0,
  'manual limit 0 = no new cards',
)
const introSession = buildSession(limSubjects, cards, now, {
  introducedToday: new Map([['near', 3]]),
})
ok(
  introSession.perSubject.find((p) => p.subjectId === 'near')!.newQuota === 2,
  'cards already introduced today reduce the manual quota (5 - 3 = 2)',
)
const introCapped = buildSession(subjects, cards, now, {
  newCardCap: 4,
  introducedToday: new Map([['near', 3]]),
})
ok(introCapped.newCards === 1, `introduced-today also spends the global cap (got ${introCapped.newCards})`)
const introAuto = buildSession([{ id: 'near', examDate: '2026-06-30' }], cards, now, {
  introducedToday: new Map([['near', 2]]),
})
ok(
  introAuto.newCards === 1,
  `auto pace counts today's already-introduced cards (pool 8 / 3 days = 3, minus 2 done → 1; got ${introAuto.newCards})`,
)

const introMap = introducedTodayBySubject(
  [
    { cardId: 'n-new-0', ts: now.toISOString() }, // first review today → counts
    { cardId: 'n-new-0', ts: '2026-06-27T10:00:00' }, // same card again → still 1
    { cardId: 'n-due', ts: '2026-06-20T09:00:00' }, // introduced in the past
    { cardId: 'n-due', ts: now.toISOString() }, // today's review of an old card → no count
  ],
  cards,
  now,
)
ok((introMap.get('near') ?? 0) === 1, 'introducedTodayBySubject counts only first-ever reviews today')
const subjStatsIntro = subjectStats({ id: 'near', examDate: '2026-06-30', dailyNewLimit: 4 }, cards, now, 4)
ok(subjStatsIntro.newToday === 0, 'subjectStats: manual limit fully used up today → 0 more')

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

// ============================================================
// Sprint 3 — suspend / bury scheduling
// ============================================================
console.log('— suspend + bury filtering —')
const today = new Date('2026-07-05T09:00:00')
ok(isSchedulable(mk('a', 's', 'new', today.toISOString()), today), 'plain card is schedulable')
ok(
  !isSchedulable({ ...mk('a', 's', 'new', today.toISOString()), suspended: true }, today),
  'suspended card is not schedulable',
)
ok(
  !isSchedulable({ ...mk('a', 's', 'new', today.toISOString()), buriedUntil: '2026-07-05' }, today),
  'card buried through today is not schedulable',
)
ok(
  isSchedulable({ ...mk('a', 's', 'new', today.toISOString()), buriedUntil: '2026-07-04' }, today),
  'card buried through yesterday is schedulable again',
)

const mixSubjects = [{ id: 's1', examDate: '2026-07-10' }]
const mixCards = [
  mk('due-ok', 's1', 'review', '2026-07-04T09:00:00'),
  { ...mk('due-susp', 's1', 'review', '2026-07-04T09:00:00'), suspended: true },
  { ...mk('due-buried', 's1', 'review', '2026-07-04T09:00:00'), buriedUntil: '2026-07-05' },
  mk('new-ok', 's1', 'new', today.toISOString()),
]
const mixSession = buildSession(mixSubjects, mixCards, today)
ok(mixSession.dueReviews === 1, `suspended+buried excluded from due (got ${mixSession.dueReviews})`)
ok(!mixSession.order.includes('due-susp') && !mixSession.order.includes('due-buried'), 'queue omits them')
const mixPlan = mixSession.perSubject[0]
ok(mixPlan.total === 3, `suspended card leaves totals; buried stays (total ${mixPlan.total})`)
const mixStats = subjectStats(mixSubjects[0], mixCards, today)
ok(mixStats.dueToday === 1 && mixStats.total === 3, 'subjectStats applies the same filtering')

console.log('— interval previews + retention —')
const previewCard = {
  id: 'p', subjectId: 's1', type: 'basic' as const, front: 'q', back: 'a', tags: [],
  due: today.toISOString(), stability: 10, difficulty: 5, reps: 4, lapses: 0,
  state: 'review' as const, lastReview: '2026-06-30T09:00:00',
}
const prev = previewIntervals(previewCard, null, today)
ok(prev.again <= prev.hard && prev.hard <= prev.good && prev.good <= prev.easy, 'intervals are monotone in rating')
ok(prev.good >= 1, 'good schedules at least a day ahead')
const prevClamped = previewIntervals(previewCard, '2026-07-08', today)
ok(prevClamped.easy <= 3, `deadline clamp caps preview at exam (easy ${prevClamped.easy})`)
const lowRet = rate(previewCard, 'good', null, today, 0.8)
const highRet = rate(previewCard, 'good', null, today, 0.95)
ok(
  new Date(lowRet.due).getTime() > new Date(highRet.due).getTime(),
  'lower target retention spaces reviews further apart',
)

console.log('— retrievability + readiness —')
const newCard = {
  id: 'n', subjectId: 's1', type: 'basic' as const, front: 'q', back: 'a', tags: [],
  ...newFsrsFields(today),
}
ok(retrievabilityAt(newCard, today) === 0, 'never-studied card has 0 retrievability')
const strongCard = { ...previewCard, stability: 200 }
const rNow = retrievabilityAt(strongCard, today)
ok(rNow > 0.9, `stable card recently reviewed ≈ high recall (got ${rNow.toFixed(3)})`)
const rLater = retrievabilityAt(strongCard, new Date('2027-07-05T09:00:00'))
ok(rLater < rNow, 'recall decays with time')

ok(subjectReadiness([], null, today) === null, 'empty subject has no readiness')
const readyAllNew = subjectReadiness([newCard], '2026-07-10', today)!
ok(readyAllNew.percent === 0 && readyAllNew.learned === 0, 'all-new subject reads 0 %')
const readyMixed = subjectReadiness([newCard, strongCard], '2026-07-06', today)!
ok(readyMixed.percent > 0 && readyMixed.percent < 100, 'mixed subject lands between 0 and 100')
ok(readyMixed.learned === 1 && readyMixed.total === 2, 'readiness counts learned/total')
const readySuspended = subjectReadiness([newCard, { ...strongCard, suspended: true }], '2026-07-06', today)!
ok(readySuspended.percent === 0, 'suspended cards do not count toward readiness')
ok(readinessBand(90) === 'solid' && readinessBand(60) === 'building' && readinessBand(20) === 'fragile', 'readiness bands')

console.log('— typed answers —')
ok(normalizeAnswer('  Řím,  hlavní!  ') === 'rim hlavni', 'normalize strips diacritics + punctuation')
ok(answerSimilarity('Praha', 'praha') === 1, 'case-insensitive match')
ok(checkAnswer('Ceska republika', 'Česká republika').verdict === 'correct', 'diacritics-free answer is correct')
ok(checkAnswer('Cesk republika', 'Česká republika').verdict === 'correct', 'one typo in a long answer still correct')
ok(checkAnswer('Ceska repulika ano', 'Česká republika').verdict !== 'wrong', 'near-miss is at least close')
ok(checkAnswer('Brno', 'Česká republika').verdict === 'wrong', 'different answer is wrong')
ok(typedAnswerTarget({ type: 'basic', back: 'Praha' }) === 'Praha', 'short basic back is typeable')
ok(typedAnswerTarget({ type: 'basic', back: 'a\nb' }) === null, 'multi-line back is not typeable')
ok(typedAnswerTarget({ type: 'basic', back: 'x'.repeat(100) }) === null, 'long back is not typeable')
ok(
  typedAnswerTarget({ type: 'cloze', back: '', raw: 'A {{b}} c {{d}}.' }) === 'b, d',
  'cloze target joins the blanked answers',
)

console.log('— leech detection —')
ok(!isLeech({ lapses: LEECH_LAPSES - 1, state: 'review' }), 'below threshold is not a leech')
ok(isLeech({ lapses: LEECH_LAPSES, state: 'review' }), 'at threshold is a leech')
ok(!isLeech({ lapses: LEECH_LAPSES, state: 'new' }), 'new card is never a leech')

console.log('— cloze helpers —')
ok(hasCloze('a {{b}} c') && !hasCloze('a b c'), 'hasCloze detects blanks')
const mc = makeCloze('a {{b}} c')
ok(mc.front.includes('___') && mc.back.includes('b') && mc.raw === 'a {{b}} c', 'makeCloze round trip')

console.log('— deck export round trip —')
const exported = deckToJson(
  { name: 'Právo', examDate: '2026-07-15', reminderTime: '18:30' },
  [
    { ...newCard, front: 'Q?', back: 'A', tags: ['ius'] },
    { ...newCard, id: 'n2', type: 'cloze', ...makeCloze('The {{Twelve Tables}}.'), tags: [] },
  ],
)
const reparsed = parseDeck(exported)
ok(reparsed.errors.length === 0, 'exported deck re-imports without errors')
ok(reparsed.subject.name === 'Právo' && reparsed.subject.examDate === '2026-07-15', 'subject fields survive')
ok(reparsed.cards.length === 2, 'both cards survive')
ok(reparsed.cards[1].raw === 'The {{Twelve Tables}}.', 'cloze raw text survives the round trip')
ok(reparsed.cards[0].tags.join() === 'ius', 'tags survive')

console.log('— backup parse —')
const backupJson = backupToJson({
  exportedAt: today.toISOString(),
  subjects: [{ id: 's1', name: 'X', examDate: null, reminderTime: null, createdAt: today.toISOString(), colorIndex: 0 }],
  cards: [newCard],
  reviews: [],
  settings: null,
})
const parsedBackup = parseBackup(backupJson)
ok(parsedBackup.error === null && parsedBackup.backup !== null, 'valid backup parses')
ok(parsedBackup.backup!.subjects.length === 1 && parsedBackup.backup!.cards.length === 1, 'backup keeps data')
ok(parseBackup('{ nope').backup === null, 'invalid JSON rejected')
ok(parseBackup('{"kind":"x"}').backup === null, 'foreign JSON rejected')
ok(parseBackup(JSON.stringify({ kind: 'studyflow-backup', version: 99, subjects: [], cards: [], reviews: [] })).backup === null, 'newer version rejected')

console.log('— heatmap —')
const heat = heatmapWeeks([T('27'), T('27'), T('26')], 12, now)
ok(heat.length === 12 && heat.every((w) => w.length === 7), '12 weeks × 7 days')
const flat = heat.flat()
const todayCell = flat.find((c) => c.key === '2026-06-27')!
ok(todayCell.count === 2 && todayCell.level === 4, 'busiest day gets the top level')
ok(flat.find((c) => c.key === '2026-06-26')!.level >= 1, 'lighter day gets a lighter level')
ok(flat.find((c) => c.key === '2026-06-28')!.future === true, 'days after today are marked future')
ok(flat.filter((c) => !c.future).every((c) => c.level >= 0), 'no negative levels')
ok(daysUntilDate(new Date('2026-06-30T01:00:00'), now) === 3, 'daysUntilDate counts local days')

console.log('— review forecast —')
{
  const fNow = new Date('2026-07-05T09:00:00')
  const fc = reviewForecast(
    [
      { state: 'review', due: '2026-07-01T10:00:00' }, // overdue → today
      { state: 'review', due: '2026-07-05T10:00:00' }, // today
      { state: 'review', due: '2026-07-07T10:00:00' }, // +2 days
      { state: 'review', due: '2026-07-05T10:00:00', buriedUntil: '2026-07-05' }, // buried → tomorrow
      { state: 'review', due: '2026-07-06T10:00:00', suspended: true }, // excluded
      { state: 'new', due: fNow.toISOString() }, // excluded
      { state: 'review', due: '2026-08-30T10:00:00' }, // beyond horizon
    ],
    14,
    fNow,
  )
  ok(fc.length === 14, 'forecast has 14 buckets')
  ok(fc[0].count === 2 && fc[0].isToday && fc[0].label === 'dnes', `today = overdue + due today (got ${fc[0].count})`)
  ok(fc[1].count === 1, 'buried card lands on tomorrow')
  ok(fc[2].count === 1, 'future due lands on its day')
  ok(fc.reduce((n, d) => n + d.count, 0) === 4, 'suspended/new/beyond-horizon excluded')
}

console.log('— deck share link —')
{
  const json = JSON.stringify({ subject: 'Řím — právo', cards: [{ type: 'basic', front: 'Q?', back: 'Á' }] })
  const payload = await encodeDeckPayload(json)
  ok(/^[01]\.[A-Za-z0-9_-]+$/.test(payload), `payload is URL-safe (got ${payload.slice(0, 12)}…)`)
  ok((await decodeDeckPayload(payload)) === json, 'encode → decode round-trips UTF-8 exactly')
  const big = JSON.stringify({ subject: 'X', cards: Array.from({ length: 60 }, (_, i) => ({ type: 'basic', front: `Otázka číslo ${i} s delším textem?`, back: `Odpověď číslo ${i} s ještě delším textem.` })) })
  const bigPayload = await encodeDeckPayload(big)
  ok(bigPayload.length < big.length, `compression shrinks a real deck (${big.length} → ${bigPayload.length})`)
  ok((await decodeDeckPayload(bigPayload)) === big, 'big deck round-trips')
  ok((await decodeDeckPayload('1.@@@nonsense')) === null, 'malformed payload returns null, never throws')
  ok((await decodeDeckPayload('9.abc')) === null, 'unknown version returns null')
  ok(payloadFromHash('#deck=1.abc') === '1.abc', 'payloadFromHash extracts the payload')
  ok(payloadFromHash('#other') === null, 'foreign hash is ignored')
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
