import { useEffect, useMemo, useRef, useState } from 'react'
import type { TestRun } from '../db/db'
import { getTestRuns, saveTestRun } from '../db/repo'
import { getServerTest } from '../lib/api'
import {
  cleanBank,
  estimateLevel,
  levelBreakdown,
  topicsInSitting,
  isFullyRight,
  mulberry32,
  optionOrder,
  pickQuestions,
  POINTS,
  questionHistory,
  scoreQuestion,
  summarize,
  weakTopicsInRuns,
  type McAnswer,
  type McBank,
  type McQuestion,
} from '../lib/mcTest'
import { t } from '../i18n'

/**
 * Mock exam for one subject.
 *
 * Three phases on one screen: set the sitting up, sit it, read it back. While
 * sitting there is no feedback at all — exactly like the real thing; what was
 * right comes only after handing in, with the reason next to every option.
 */

interface Props {
  subjectId: string
  subjectName: string
  bankId: string
  onBack: () => void
}

type Phase = 'setup' | 'running' | 'done'

interface Sitting {
  questions: McQuestion[]
  orders: number[][]
  startedAt: number
  /** ms; null = untimed */
  limitMs: number | null
}

const COUNTS = [10, 20, 30] as const

/** Body s desetinnou čárkou podle jazyka (1,33 — ne 1.33). */
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function Test({ subjectId, subjectName, bankId, onBack }: Props) {
  const [bank, setBank] = useState<McBank | null>(null)
  const [error, setError] = useState(false)
  const [runs, setRuns] = useState<TestRun[]>([])
  const [phase, setPhase] = useState<Phase>('setup')

  const [count, setCount] = useState<number>(20)
  const [timed, setTimed] = useState(true)
  const [topics, setTopics] = useState<Set<string>>(new Set())

  const [sitting, setSitting] = useState<Sitting | null>(null)
  const [at, setAt] = useState(0)
  const [selected, setSelected] = useState<number[][]>([])
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<McAnswer[] | null>(null)
  const [onlyMistakes, setOnlyMistakes] = useState(false)
  const submitted = useRef(false)

  useEffect(() => {
    let alive = true
    Promise.all([getServerTest(bankId), getTestRuns(subjectId)])
      .then(([raw, r]) => {
        if (!alive) return
        const clean = cleanBank(raw)
        if (!clean) setError(true)
        setBank(clean)
        // Rozřazovací test: všechny otázky a bez stopek — měří se úroveň, ne rychlost.
        if (clean?.format?.timed === false) setTimed(false)
        if (clean?.format?.placement) setCount(9999)
        setRuns(r)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [bankId, subjectId])

  const allTopics = useMemo(() => {
    const seen: string[] = []
    for (const q of bank?.questions ?? []) {
      if (q.topic && !seen.includes(q.topic)) seen.push(q.topic)
    }
    return seen
  }, [bank])

  const topicOf = useMemo(
    () => new Map((bank?.questions ?? []).map((q) => [q.id, q.topic ?? ''])),
    [bank],
  )

  // Clock: only while sitting a timed test.
  useEffect(() => {
    if (phase !== 'running' || !sitting?.limitMs) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [phase, sitting])

  const remaining = sitting?.limitMs ? sitting.startedAt + sitting.limitMs - now : null

  useEffect(() => {
    if (phase === 'running' && remaining !== null && remaining <= 0) void handIn()
    // handIn reads the latest state through closures set up on this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase])

  if (error) {
    return (
      <div className="page">
        <div className="page-nav">
          <button className="btn btn-ghost btn-small" onClick={onBack}>
            {t('back')}
          </button>
        </div>
        <p className="muted">{t('mcLoadError')}</p>
      </div>
    )
  }
  if (!bank) return <div className="page center muted">{t('loading')}</div>

  const pool = topics.size > 0 ? bank.questions.filter((q) => topics.has(q.topic ?? '')) : bank.questions
  const realCount = Math.min(count, pool.length)

  function start() {
    if (!bank) return
    const rnd = mulberry32(Date.now() & 0xffffffff)
    const history = questionHistory(runs)
    const questions = pickQuestions(bank.questions, realCount, history, rnd, topics)
    const points = questions.reduce((s, q) => s + POINTS[q.type], 0)
    // Real sitting: ~90 min for the paper. Without a known format, give
    // 1.5 min per point — enough to read four statements carefully.
    const minutes =
      bank.format?.minutes && bank.format?.questions
        ? (bank.format.minutes / bank.format.questions) * questions.length
        : points * 1.5
    submitted.current = false
    setSitting({
      questions,
      orders: questions.map((q) => optionOrder(q, rnd)),
      startedAt: Date.now(),
      limitMs: timed ? Math.round(minutes * 60_000) : null,
    })
    setSelected(questions.map(() => []))
    setAt(0)
    setNow(Date.now())
    setResult(null)
    setOnlyMistakes(false)
    setPhase('running')
    window.scrollTo(0, 0)
  }

  function toggle(qi: number, option: number) {
    if (!sitting) return
    const q = sitting.questions[qi]
    setSelected((prev) => {
      const next = [...prev]
      const cur = next[qi] ?? []
      if (q.type === 'single') next[qi] = cur.includes(option) ? [] : [option]
      else next[qi] = cur.includes(option) ? cur.filter((i) => i !== option) : [...cur, option]
      return next
    })
  }

  async function handIn() {
    if (!sitting || submitted.current) return
    submitted.current = true
    const answers: McAnswer[] = sitting.questions.map((q, i) => ({
      qid: q.id,
      selected: [...(selected[i] ?? [])].sort((a, b) => a - b),
      points: scoreQuestion(q, selected[i] ?? []),
      max: POINTS[q.type],
    }))
    await saveTestRun({
      subjectId,
      bankId,
      ts: new Date().toISOString(),
      durationMs: Date.now() - sitting.startedAt,
      answers,
    })
    setRuns(await getTestRuns(subjectId))
    setResult(answers)
    setPhase('done')
    window.scrollTo(0, 0)
  }

  function confirmHandIn() {
    const open = selected.filter((s) => s.length === 0).length
    if (open > 0 && !window.confirm(t('mcConfirmOpen', open))) return
    void handIn()
  }

  // ---------- setup ----------
  if (phase === 'setup') {
    const recent = [...runs].reverse().slice(0, 5)
    const weak = weakTopicsInRuns(runs, topicOf).slice(0, 4)
    return (
      <div className="page mc-page">
        <div className="page-nav">
          <button className="btn btn-ghost btn-small" onClick={onBack}>
            {t('back')}
          </button>
        </div>
        <h2 className="page-title">{bank.format?.placement ? t('mcPlacementTitle') : t('mcTitle')}</h2>
        <p className="muted">
          {subjectName} · {t('mcBankSize', bank.questions.length)}
        </p>
        {bank.format?.note && <p className="muted mc-note">{bank.format.note}</p>}

        <section className="panel-section">
          <span className="mc-label">{t('mcCount')}</span>
          <div className="chip-row">
            {COUNTS.map((n) => (
              <button
                key={n}
                className={`chip${count === n ? ' chip-on' : ''}`}
                onClick={() => setCount(n)}
                disabled={pool.length === 0}
              >
                {n}
              </button>
            ))}
            <button
              className={`chip${count >= 9999 ? ' chip-on' : ''}`}
              onClick={() => setCount(9999)}
            >
              {t('mcAll', pool.length)}
            </button>
          </div>

          <label className="mc-toggle">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
            <span>{t('mcTimed')}</span>
          </label>

          {allTopics.length > 1 && (
            <>
              <span className="mc-label">{t('mcTopics')}</span>
              <div className="chip-row">
                <button
                  className={`chip${topics.size === 0 ? ' chip-on' : ''}`}
                  onClick={() => setTopics(new Set())}
                >
                  {t('mcTopicsAll')}
                </button>
                {allTopics.map((topic) => (
                  <button
                    key={topic}
                    className={`chip${topics.has(topic) ? ' chip-on' : ''}`}
                    onClick={() =>
                      setTopics((prev) => {
                        const next = new Set(prev)
                        if (next.has(topic)) next.delete(topic)
                        else next.add(topic)
                        return next
                      })
                    }
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={start} disabled={realCount === 0}>
            {t('mcStart', realCount)}
          </button>
          <p className="muted mc-hint">{t('mcScoringHint')}</p>
        </section>

        {recent.length > 0 && (
          <section className="mc-history">
            <h3 className="section-title">{t('mcHistory')}</h3>
            <ul className="mc-history-list">
              {recent.map((run) => {
                const s = summarize(run.answers)
                return (
                  <li key={run.id}>
                    <span>{new Date(run.ts).toLocaleDateString()}</span>
                    <span className="muted">{t('mcQuestionsN', run.answers.length)}</span>
                    <strong className={s.percent >= 50 ? 'mc-pass' : 'mc-fail'}>{s.percent} %</strong>
                  </li>
                )
              })}
            </ul>
            {weak.length > 0 && (
              <>
                <h3 className="section-title">{t('mcWeak')}</h3>
                <ul className="mc-history-list">
                  {weak.map((w) => (
                    <li key={w.topic}>
                      <span>{w.topic}</span>
                      <strong className={w.percent >= 50 ? 'mc-pass' : 'mc-fail'}>{w.percent} %</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    )
  }

  if (!sitting) return null

  // ---------- running ----------
  if (phase === 'running') {
    const q = sitting.questions[at]
    const order = sitting.orders[at]
    const mine = selected[at] ?? []
    const answered = selected.filter((s) => s.length > 0).length
    return (
      <div className="page mc-page">
        <div className="mc-bar">
          <span>{t('mcProgress', at + 1, sitting.questions.length)}</span>
          {remaining !== null && (
            <span className={`mc-clock${remaining < 120_000 ? ' mc-clock-low' : ''}`}>
              ⏱ {formatClock(remaining)}
            </span>
          )}
          <button className="btn btn-ghost btn-small" onClick={confirmHandIn}>
            {t('mcHandIn')}
          </button>
        </div>

        <article className="mc-question">
          <span className="mc-kind">
            {q.type === 'multi' ? t('mcMulti') : t('mcSingle')} · {t('mcPoints', POINTS[q.type])}
          </span>
          <h3 className="mc-q">{q.q}</h3>
          <div className="mc-options" role={q.type === 'single' ? 'radiogroup' : 'group'}>
            {order.map((oi, pos) => {
              const on = mine.includes(oi)
              return (
                <button
                  key={oi}
                  className={`mc-option${on ? ' mc-option-on' : ''}`}
                  role={q.type === 'single' ? 'radio' : 'checkbox'}
                  aria-checked={on}
                  onClick={() => toggle(at, oi)}
                >
                  <span className="mc-mark" aria-hidden="true">
                    {q.type === 'single' ? (on ? '●' : '○') : on ? '☑' : '☐'}
                  </span>
                  <span className="mc-letter">{String.fromCharCode(97 + pos)})</span>
                  <span>{q.options[oi].t}</span>
                </button>
              )
            })}
          </div>
        </article>

        <div className="button-row mc-nav">
          <button className="btn btn-ghost" onClick={() => setAt(at - 1)} disabled={at === 0}>
            ←
          </button>
          {at < sitting.questions.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setAt(at + 1)}>
              {t('mcNext')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={confirmHandIn}>
              {t('mcHandIn')}
            </button>
          )}
        </div>

        <nav className="mc-map" aria-label={t('mcMap')}>
          {sitting.questions.map((_, i) => (
            <button
              key={i}
              className={`mc-dot${i === at ? ' mc-dot-at' : ''}${(selected[i] ?? []).length > 0 ? ' mc-dot-done' : ''}`}
              onClick={() => setAt(i)}
              aria-label={t('mcProgress', i + 1, sitting.questions.length)}
            >
              {i + 1}
            </button>
          ))}
        </nav>
        <p className="muted mc-hint">{t('mcAnswered', answered, sitting.questions.length)}</p>
      </div>
    )
  }

  // ---------- done ----------
  const answers = result ?? []
  const s = summarize(answers)
  const levels = levelBreakdown(sitting.questions, answers)
  const estimate = levels.length > 0 ? estimateLevel(levels) : null
  const areas = topicsInSitting(sitting.questions, answers)
  const rows = sitting.questions
    .map((q, i) => ({ q, i, a: answers[i] }))
    .filter((r) => !onlyMistakes || (r.a && !isFullyRight(r.q, r.a.selected)))
  return (
    <div className="page mc-page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
      </div>
      <section className="panel-section mc-score">
        <span className={`mc-percent ${s.percent >= 50 ? 'mc-pass' : 'mc-fail'}`}>{s.percent} %</span>
        <span>{t('mcScore', fmt(s.points), fmt(s.max))}</span>
        <span className="muted">{t('mcBreakdown', s.right, s.partial, s.wrong)}</span>
        <div className="button-row">
          <button className="btn btn-primary" onClick={() => setPhase('setup')}>
            {t('mcAgain')}
          </button>
          <button className="btn btn-ghost" onClick={() => setOnlyMistakes((v) => !v)}>
            {onlyMistakes ? t('mcShowAll') : t('mcOnlyMistakes')}
          </button>
        </div>
      </section>

      {levels.length > 0 && (
        <section className="panel-section mc-levels">
          <h3 className="section-title">{t('mcLevelTitle')}</h3>
          <p className="mc-level-est">{estimate ? t('mcLevelEst', estimate) : t('mcLevelBelow', levels[0].level)}</p>
          <ul className="mc-history-list">
            {levels.map((l) => (
              <li key={l.level}>
                <span>{l.level}</span>
                <span className="muted">{t('mcQuestionsN', l.answered)}</span>
                <strong className={l.percent >= 70 ? 'mc-pass' : 'mc-fail'}>{l.percent} %</strong>
              </li>
            ))}
          </ul>
          <p className="muted mc-hint">{t('mcLevelHint')}</p>
        </section>
      )}

      {areas.length > 0 && (
        <section className="panel-section mc-levels">
          <h3 className="section-title">{t('mcAreasTitle')}</h3>
          <ul className="mc-history-list">
            {areas.map((a) => (
              <li key={a.topic}>
                <span>{a.topic}</span>
                <strong className={a.percent >= 70 ? 'mc-pass' : 'mc-fail'}>{a.percent} %</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.map(({ q, i, a }) => {
        const mine = new Set(a?.selected ?? [])
        const full = a ? a.points === a.max : false
        return (
          <article key={q.id} className={`mc-question mc-review ${full ? 'mc-review-ok' : 'mc-review-bad'}`}>
            <span className="mc-kind">
              {i + 1}. · {q.type === 'multi' ? t('mcMulti') : t('mcSingle')} ·{' '}
              {t('mcGot', fmt(a?.points ?? 0), fmt(POINTS[q.type]))}
              {q.topic ? ` · ${q.topic}` : ''}
            </span>
            <h3 className="mc-q">{q.q}</h3>
            <ul className="mc-options mc-options-review">
              {sitting.orders[i].map((oi) => {
                const o = q.options[oi]
                const picked = mine.has(oi)
                const cls = o.correct ? (picked ? 'mc-r-hit' : 'mc-r-missed') : picked ? 'mc-r-wrong' : ''
                return (
                  <li key={oi} className={`mc-option ${cls}`}>
                    <span className="mc-mark" aria-hidden="true">
                      {o.correct ? '✓' : picked ? '✗' : '·'}
                    </span>
                    <span>{o.t}</span>
                    {picked && <span className="mc-you">{t('mcYou')}</span>}
                  </li>
                )
              })}
            </ul>
            {q.explain && <p className="mc-explain">{q.explain}</p>}
          </article>
        )
      })}
    </div>
  )
}
