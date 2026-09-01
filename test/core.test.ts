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
import { blocksLength, isHeading, MAX_BLOCK_CHARS, segmentPages } from '../src/pipeline/segment'
import { dedupeCards, normalizeQuestion, similarity } from '../src/pipeline/dedupe'
import { checkCard, countSentences, markDrafts } from '../src/pipeline/qc'
import { fallbackCardsFromBlock, fallbackOutline, FALLBACK_TAG, significantTerm } from '../src/pipeline/fallback'
import { parseGeneratedCards, parseOutline } from '../src/pipeline/schema'
import { addSpend, costUsd, estimateCostUsd, monthKey, withinBudget } from '../src/pipeline/budget'
import { SYSTEM_PROMPT, cardsPrompt, disciplineOf, kindMenu } from '../src/pipeline/prompts'
import type { Block, GeneratedCard } from '../src/pipeline/types'

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

console.log('— card photos survive export/import —')
const photoDeck = parseDeck(
  JSON.stringify({
    subject: 'Foto',
    cards: [
      { front: 'q', back: 'a', image: 'data:image/jpeg;base64,AAAA', imageBack: 'data:image/jpeg;base64,BBBB' },
      { type: 'cloze', text: 'rok {{451}}', imageBack: 'data:image/jpeg;base64,CCCC' },
    ],
  }),
)
ok(photoDeck.cards[0].image === 'data:image/jpeg;base64,AAAA', 'parseDeck keeps the front photo')
ok(photoDeck.cards[0].imageBack === 'data:image/jpeg;base64,BBBB', 'parseDeck keeps the back photo')
ok(photoDeck.cards[1].imageBack === 'data:image/jpeg;base64,CCCC', 'cloze cards carry photos too')
const photoJson = deckToJson(
  { name: 'Foto', examDate: null, reminderTime: null },
  photoDeck.cards.map((d, i) => ({
    id: `p${i}`, subjectId: 's', type: d.type, front: d.front, back: d.back, raw: d.raw,
    tags: d.tags, svg: d.svg, image: d.image, imageBack: d.imageBack,
    due: '2026-06-27T09:00:00', stability: 0, difficulty: 0, reps: 0, lapses: 0,
    state: 'new' as const, lastReview: null,
  })),
)
const rePhoto = parseDeck(photoJson)
ok(
  rePhoto.cards[0].imageBack === 'data:image/jpeg;base64,BBBB' &&
    rePhoto.cards[1].imageBack === 'data:image/jpeg;base64,CCCC',
  'export → import round-trips both photo sides',
)

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


// ============================================================
// Pipeline — podklad → osnova → karty (BRIEF §4)
// ============================================================
console.log('— segmentation —')
{
  ok(isHeading('2.1 Besitz und Eigentum'), 'numbered line is a heading')
  ok(isHeading('§ 823 BGB'), 'paragraph sign is a heading')
  ok(isHeading('ŘÍMSKÉ PRÁVO'), 'all caps is a heading')
  ok(!isHeading('Besitz ist die tatsächliche Herrschaft über eine Sache.'), 'a sentence is not a heading')
  ok(!isHeading('12'), 'a bare page number is not a heading')

  const blocks = segmentPages([
    {
      page: 3,
      text: '2.1 Besitz\n\nBesitz ist die tatsächliche Herrschaft über eine Sache, unabhängig vom Recht daran.\n\nDominium: římské označení pro vlastnické právo k věci, které zahrnuje ius utendi et fruendi.',
    },
  ])
  ok(blocks.length === 2, `two paragraphs → two blocks (got ${blocks.length})`)
  ok(blocks.every((b) => b.heading === '2.1 Besitz'), 'heading carries onto the blocks below it')
  ok(blocks.every((b) => b.page === 3), 'blocks keep their page')
  ok(blocks[0].id === 'p3-b1' && blocks[1].id === 'p3-b2', 'block ids are stable within a page')
  ok(segmentPages(segmentPages([{ page: 3, text: 'x' }]).map((b) => ({ page: b.page, text: b.text })))[0]?.id === 'p3-b1', 'segmentation is deterministic')

  const long = 'Tato věta má rozumnou délku a opakuje se pořád dokola. '.repeat(80)
  const split = segmentPages([{ page: 1, text: long }])
  ok(split.length > 1, 'an oversized paragraph is split')
  ok(split.every((b) => b.text.length <= MAX_BLOCK_CHARS + 200), 'no block runs far past the cap')
  ok(split.every((b) => /[.!?]$/.test(b.text.trim())), 'splitting happens at sentence ends, never mid-sentence')
  ok(blocksLength(blocks) > 0, 'blocksLength counts characters')
  ok(segmentPages([]).length === 0, 'no pages → no blocks')
}

console.log('— dedupe —')
{
  ok(normalizeQuestion('Co je  DOMINIUM?') === normalizeQuestion('co je dominium'), 'normalisation ignores case and punctuation')
  ok(normalizeQuestion('Co je vlastnické právo?') === normalizeQuestion('Co je vlastnicke pravo?'), 'diacritics do not make a new question')
  ok(similarity('Co je dominium?', 'Co je dominium') === 1, 'identical questions score 1')
  ok(similarity('Co je dominium?', 'Jaké byly fáze procesu?') < 0.4, 'different questions score low')

  const cards: GeneratedCard[] = [
    { type: 'basic', kind: 'definice', level: 1, front: 'Co je dominium?', back: 'Vlastnické právo.' },
    { type: 'basic', kind: 'definice', level: 1, front: 'Co je DOMINIUM?', back: 'Vlastnictví věci.' },
    { type: 'basic', kind: 'definice', level: 1, front: 'Co je possessio?', back: 'Držba.' },
  ]
  const { kept, dropped } = dedupeCards(cards)
  ok(kept.length === 2 && dropped.length === 1, `near-duplicate dropped (kept ${kept.length})`)
  ok(dedupeCards(cards, ['Co je possessio?']).kept.length === 1, 'questions already in the deck are dropped too')
  ok(dedupeCards([{ type: 'basic', kind: 'basic', level: 1, front: '  ', back: 'x' }]).kept.length === 0, 'an empty question is never kept')
}

console.log('— quality control —')
{
  ok(countSentences('Jedna věta.') === 1, 'one sentence')
  ok(countSentences('První. Druhá! Třetí?') === 3, 'three sentences')
  ok(countSentences('Podle § 823 BGB, tj. z. B. u věcných práv, platí odpovědnost.') === 1, 'abbreviations do not end a sentence')

  const short: GeneratedCard = { type: 'basic', kind: 'definice', level: 1, front: 'Co je dominium?', back: 'Vlastnické právo k věci.' }
  ok(checkCard(short).length === 0, 'a good card has no issues')

  const long: GeneratedCard = { ...short, back: 'První věta. Druhá věta. Třetí věta. Čtvrtá věta.' }
  ok(checkCard(long)[0] === 'answer-too-long', 'four sentences fail the chunking rule')

  const echo: GeneratedCard = { type: 'basic', kind: 'definice', level: 1, front: 'Vlastnické právo k věci je co?', back: 'Vlastnické právo k věci' }
  ok(checkCard(echo).includes('answer-in-question'), 'an answer standing in the question is caught')

  ok(checkCard({ type: 'cloze', kind: 'cloze', level: 1, text: 'Bez vynechání.' })[0] === 'cloze-no-blank', 'a cloze without a blank fails')
  ok(checkCard({ type: 'basic', kind: 'mapa', level: 1, front: 'Kde leží Dunaj?', back: 'Ve střední Evropě.' })[0] === 'needs-image', 'a map card without a picture fails')
  ok(checkCard({ type: 'basic', kind: 'basic', level: 1, front: '', back: '' })[0] === 'empty', 'an empty card fails first')

  const marked = markDrafts([short, long])
  ok(marked[0].draft === undefined, 'a passing card is left untouched')
  ok(marked[1].draft === true && marked[1].draftReason === 'answer-too-long', 'a failing card becomes a draft with the reason')
}

console.log('— rule-based fallback (no model) —')
{
  const block: Block = {
    id: 'p1-b1',
    heading: 'Vlastnictví',
    page: 1,
    text: 'Besitz ist die tatsächliche Herrschaft über eine Sache, unabhängig vom Recht daran. Das Eigentum wurde im Jahr 1811 im ABGB geregelt. Rakousko má rozlohu 83 879 km² a hraničí s osmi státy.',
  }
  const cards = fallbackCardsFromBlock(block)
  ok(cards.length >= 3, `fallback made cards without a model (got ${cards.length})`)
  ok(cards.every((c) => c.tags?.includes(FALLBACK_TAG)), 'every fallback card is tagged koncept')
  ok(cards.every((c) => c.sourceRef?.page === 1 && c.sourceRef?.block === 'p1-b1'), 'fallback cards point back at the source')
  ok(cards.every((c) => c.topic === 'Vlastnictví'), 'fallback cards inherit the heading as topic')

  const def = cards.find((c) => c.kind === 'definice')
  ok(def?.front === 'Was ist Besitz?', `German definition keeps its language (got ${def?.front})`)
  ok(!def?.back?.includes('Besitz ist'), 'the definition answer is the definiens only')

  const year = cards.find((c) => c.text?.includes('{{1811}}'))
  ok(!!year && year.type === 'cloze', 'a year becomes a cloze')
  const figure = cards.find((c) => c.text?.includes('{{83 879 km²}}'))
  ok(!!figure, 'a figure becomes a cloze')

  const czech = fallbackCardsFromBlock({ id: 'p2-b1', heading: '', page: 2, text: 'Dominium je vlastnické právo k věci, které zahrnuje užívání, požívání i zcizení věci.' })
  ok(czech[0]?.front === 'Co je Dominium?', `Czech definition uses the Czech stem (got ${czech[0]?.front})`)

  const plain = fallbackCardsFromBlock({ id: 'p3-b1', heading: '', page: 3, text: 'Zkoumání této problematiky vyžaduje trpělivost a soustředění během celého semestru.' })
  ok(plain.length === 1 && plain[0].text?.includes('{{'), 'a plain paragraph still yields one cloze')
  ok(fallbackCardsFromBlock({ id: 'p4-b1', heading: '', page: 4, text: '' }).length === 0, 'an empty block yields nothing')
  ok(significantTerm('Krátká věta o věcech') !== null, 'significantTerm finds a term')

  const outline = fallbackOutline([block, { ...block, id: 'p1-b2' }, { id: 'p2-b1', heading: 'Držba', page: 2, text: 'Text.' }])
  ok(outline.topics.length === 2, 'fallback outline groups blocks by heading')
  ok(outline.topics[0].blockIds.length === 2, 'a topic collects all its blocks')
  ok(outline.topics.every((t) => t.estimatedMinutes >= 5), 'every topic carries a time estimate')
}

console.log('— model output validation —')
{
  const known = ['p1-b1', 'p1-b2']
  const good = parseOutline({ topics: [{ title: 'Vlastnictví', blockIds: ['p1-b1'], difficulty: 3, estimatedMinutes: 20, cardEstimate: 12 }] }, known)
  ok(good.errors.length === 0 && good.value.topics.length === 1, 'a well-formed outline passes')
  ok(good.value.topics[0].id === 't1', 'topics get their own ids')

  const bogus = parseOutline({ topics: [{ title: 'X', blockIds: ['nope'], difficulty: 9, estimatedMinutes: 0, cardEstimate: 0 }] }, known)
  ok(bogus.value.topics.length === 0 && bogus.errors.length > 0, 'a topic referencing unknown blocks is dropped')
  ok(parseOutline('not json at all', known).errors.length > 0, 'a foreign shape never throws')
  ok(parseOutline({ topics: [] }, known).errors.length > 0, 'an empty outline is an error')

  const ctx = { topic: 'Vlastnictví', pages: { 'p1-b1': 7 } }
  const parsed = parseGeneratedCards(
    {
      cards: [
        { type: 'basic', kind: 'definice', level: 2, front: 'Co je dominium?', back: 'Vlastnické právo.', blockId: 'p1-b1' },
        { type: 'cloze', kind: 'cloze', level: 1, text: 'Vzniklo roku {{1811}}.', blockId: 'p1-b1' },
        { type: 'basic', kind: 'vymyslene', level: 7, front: 'Q?', back: 'A', blockId: 'p1-b1' },
        { type: 'basic', kind: 'definice', level: 1, front: '', back: '', blockId: 'p1-b1' },
      ],
    },
    ctx,
  )
  ok(parsed.value.length === 3, `unusable cards are dropped, the rest kept (got ${parsed.value.length})`)
  ok(parsed.value[0].sourceRef?.page === 7, 'blockId is resolved to a page')
  ok(parsed.value[0].topic === 'Vlastnictví', 'cards inherit the approved topic')
  ok(parsed.value[2].kind === 'basic' && parsed.value[2].level === 1, 'an unknown kind/level falls back instead of failing')
  ok(parseGeneratedCards({}, ctx).errors.length > 0, 'a missing cards array is an error')
  ok(parseGeneratedCards({ cards: [{ type: 'basic', kind: 'definice', level: 1, front: 'Q?', back: 'A', blockId: 'p1-b1' }] }, { ...ctx, allowedKinds: ['proces'] }).value[0].kind === 'basic', 'a kind outside the discipline is not accepted')
}

console.log('— budget —')
{
  ok(Math.abs(costUsd('claude-sonnet-5', { input: 1_000_000, output: 0 }) - 2) < 1e-9, 'sonnet input is $2 per 1M tokens')
  ok(Math.abs(costUsd('claude-opus-5', { output: 1_000_000 }) - 25) < 1e-9, 'opus output is $25 per 1M tokens')
  ok(costUsd('claude-sonnet-5', { input: 1_000_000 }, true) === 1, 'batch halves the price')
  ok(costUsd('claude-sonnet-5', { input: 1_000_000, cacheRead: 1_000_000 }) > 2, 'cached reads still cost something')

  const big = estimateCostUsd({ chars: 300 * 1800, cardEstimate: 800 })
  ok(big > 0.5 && big < 20, `a 300-page script estimates in single dollars (got ${big})`)
  ok(estimateCostUsd({ chars: 300 * 1800, cardEstimate: 800, batch: true }) < big, 'the batch estimate is lower')

  const jan = new Date('2026-01-15T12:00:00')
  const feb = new Date('2026-02-01T12:00:00')
  ok(monthKey(jan) === '2026-01', 'month key is local YYYY-MM')
  const ledger = addSpend(addSpend(null, 3, jan), 4, jan)
  ok(ledger.spentUsd === 7, 'spend accumulates within a month')
  ok(withinBudget(ledger, 15, 5, jan), 'a run that fits under the ceiling is allowed')
  ok(!withinBudget(ledger, 15, 9, jan), 'a run that would cross the ceiling is refused')
  ok(withinBudget(ledger, 15, 9, feb), 'a new month starts from zero')
  ok(addSpend(ledger, 1, feb).spentUsd === 1, 'the ledger resets with the month')
  ok(!withinBudget(ledger, 0, 0.01, jan), 'a zero budget refuses everything')
}

console.log('— prompts —')
{
  ok(SYSTEM_PROMPT === SYSTEM_PROMPT.trim(), 'the cached prefix has no stray whitespace')
  ok(!/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/.test(SYSTEM_PROMPT), 'no timestamp in the cached prefix (it would kill the cache)')
  ok(SYSTEM_PROMPT.includes('NIKDY nepřekládej'), 'the prompt forbids translating terms')
  ok(disciplineOf('law') === 'law' && disciplineOf(undefined) === 'general', 'discipline falls back to general')
  ok(kindMenu('law').includes('pripad') && !kindMenu('law').includes('klimadiagram'), 'the law menu offers law kinds only')
  ok(kindMenu('geography').includes('proces'), 'the geography menu offers processes')
  ok(kindMenu('law').includes('cloze'), 'shared kinds are offered in every discipline')

  const block: Block = { id: 'p1-b1', heading: 'Vlastnictví', page: 1, text: 'Dominium je vlastnické právo.' }
  const prompt = cardsPrompt({
    subjectName: 'Římské právo',
    discipline: 'law',
    topic: { id: 't1', title: 'Vlastnictví', blockIds: ['p1-b1'], difficulty: 2, estimatedMinutes: 10, cardEstimate: 6 },
    blocks: [block],
  })
  ok(prompt.includes('[p1-b1]') && prompt.includes('strana 1'), 'the prompt carries block ids and pages')
  ok(prompt.includes('Dominium je vlastnické právo.'), 'the prompt carries the material itself')
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
