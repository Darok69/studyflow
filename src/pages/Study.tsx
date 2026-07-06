import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, RatingName, Settings, Subject } from '../db/db'
import {
  buryCard,
  getCards,
  getReviews,
  getSettings,
  getSubjects,
  recordRating,
  setCardSuspended,
  undoRating,
} from '../db/repo'
import {
  buildSession,
  introducedTodayBySubject,
  reinsertAgain,
  type SchedCard,
} from '../scheduler/scheduler'
import { previewIntervals, retrievabilityAt, type FsrsFields } from '../scheduler/fsrs'
import { checkAnswer, typedAnswerTarget, type AnswerCheck } from '../lib/answer'
import { isLeech } from '../lib/wellbeing'
import { CardFace } from '../components/CardFace'
import { CardEditor } from '../components/CardEditor'
import { RatingButtons } from '../components/RatingButtons'
import { ProgressBar } from '../components/ProgressBar'
import { palette, subjectColor, subjectColorIndex } from '../lib/theme'
import { t } from '../i18n'

export type StudyMode =
  | { kind: 'today' }
  | { kind: 'subject'; subjectId: string } // today's plan, one subject only (real FSRS ratings)
  | { kind: 'cram'; subjectId: string }

interface UndoEntry {
  queue: string[]
  index: number
  finished: Set<string>
  reviewCount: number
  cardId: string
  // Persisted-rating info; null in cram mode (nothing was written).
  reviewId: string | null
  prev: FsrsFields | null
}

const UNDO_LIMIT = 50

export function Study({ onDone, mode = { kind: 'today' } }: { onDone: () => void; mode?: StudyMode }) {
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [cardMap, setCardMap] = useState<Map<string, Card>>(new Map())
  const [subjectMap, setSubjectMap] = useState<Map<string, Subject>>(new Map())
  const [finished, setFinished] = useState<Set<string>>(new Set())
  const [total, setTotal] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)

  // Typed-answer (active recall) state, reset per card.
  const [answerText, setAnswerText] = useState('')
  const [answerCheck, setAnswerCheck] = useState<AnswerCheck | null>(null)
  const answerRef = useRef<HTMLInputElement>(null)

  // Undo stack + leech nudge + inline editor.
  const undoStack = useRef<UndoEntry[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [leechCard, setLeechCard] = useState<Card | null>(null)
  const [editing, setEditing] = useState<Card | null>(null)

  const cram = mode.kind === 'cram'

  // Break nudge: re-armable baseline so it stays a suggestion, never a block.
  const [nudgeBaseAt, setNudgeBaseAt] = useState<number>(() => Date.now())
  const [showNudge, setShowNudge] = useState(false)

  useEffect(() => {
    void (async () => {
      const [subjects, cards, reviews, loadedSettings] = await Promise.all([
        getSubjects(),
        getCards(),
        getReviews(),
        getSettings(),
      ])

      let order: string[]
      if (mode.kind === 'cram') {
        // Practice run: every card of the subject, weakest recall first.
        // Ratings here never touch the FSRS plan.
        const now = new Date()
        order = cards
          .filter((c) => c.subjectId === mode.subjectId && !c.suspended)
          .map((c) => ({ id: c.id, r: retrievabilityAt(c, now, loadedSettings.targetRetention) }))
          .sort((a, b) => a.r - b.r)
          .map((x) => x.id)
      } else {
        // 'subject' narrows the queue to one subject; the introduced-today map
        // stays global so the daily new-card cap holds across subjects.
        const target = mode.kind === 'subject' ? mode.subjectId : null
        const schedCards: SchedCard[] = cards
          .filter((c) => !target || c.subjectId === target)
          .map((c) => ({
            id: c.id,
            subjectId: c.subjectId,
            state: c.state,
            due: c.due,
            suspended: c.suspended,
            buriedUntil: c.buriedUntil,
          }))
        const session = buildSession(
          subjects
            .filter((s) => !target || s.id === target)
            .map((s) => ({ id: s.id, examDate: s.examDate, dailyNewLimit: s.dailyNewLimit })),
          schedCards,
          new Date(),
          {
            newCardCap: loadedSettings.dailyNewCapEnabled ? loadedSettings.dailyNewCap : null,
            introducedToday: introducedTodayBySubject(reviews, cards, new Date()),
          },
        )
        order = session.order
      }

      setCardMap(new Map(cards.map((c) => [c.id, c])))
      setSubjectMap(new Map(subjects.map((s) => [s.id, s])))
      setSettings(loadedSettings)
      setQueue(order)
      setTotal(order.length)
      setLoading(false)
    })()
    // mode is stable for the lifetime of this page instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentId = queue[index]
  const card = currentId ? cardMap.get(currentId) : undefined
  const subject = card ? subjectMap.get(card.subjectId) : undefined
  const done = !loading && index >= queue.length

  const typedTarget =
    settings?.typedAnswers && card && !cram ? typedAnswerTarget(card) : null

  const previews = useMemo(() => {
    if (!card || !subject || !settings || cram || !settings.showIntervalPreviews || !revealed) {
      return null
    }
    return previewIntervals(card, subject.examDate, new Date(), settings.targetRetention)
  }, [card, subject, settings, cram, revealed])

  function resetCardState() {
    setRevealed(false)
    setAnswerText('')
    setAnswerCheck(null)
  }

  const handleRate = useCallback(
    async (rating: RatingName) => {
      if (!card || !subject || !settings || busy) return
      setBusy(true)

      const entry: UndoEntry = {
        queue,
        index,
        finished,
        reviewCount,
        cardId: card.id,
        reviewId: null,
        prev: null,
      }

      if (!cram) {
        const result = await recordRating(card, rating, subject.examDate, settings.targetRetention)
        entry.reviewId = result.reviewId
        entry.prev = result.prev
        setCardMap((m) => new Map(m).set(result.updated.id, result.updated))

        // A card that keeps lapsing is a formulation problem — offer a rewrite.
        if (rating === 'again' && isLeech({ lapses: card.lapses + 1, state: card.state })) {
          setLeechCard(card)
        }
      }

      undoStack.current.push(entry)
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift()
      setCanUndo(true)

      if (rating === 'again') {
        setQueue((q) => reinsertAgain(q, index))
      } else {
        setFinished((f) => new Set(f).add(card.id))
      }
      setReviewCount((n) => n + 1)
      resetCardState()
      setIndex((i) => i + 1)
      setBusy(false)
    },
    [card, subject, settings, index, queue, finished, reviewCount, cram, busy],
  )

  const handleUndo = useCallback(async () => {
    if (busy) return
    const entry = undoStack.current.pop()
    if (!entry) {
      setCanUndo(false)
      return
    }
    setBusy(true)

    if (entry.reviewId && entry.prev) {
      const restored = await undoRating(entry.cardId, entry.reviewId, entry.prev)
      if (restored) setCardMap((m) => new Map(m).set(restored.id, restored))
    }

    setQueue(entry.queue)
    setIndex(entry.index)
    setFinished(entry.finished)
    setReviewCount(entry.reviewCount)
    resetCardState()
    setCanUndo(undoStack.current.length > 0)
    setBusy(false)
  }, [busy])

  /** Remove the current card (and its re-inserted copies) from this session. */
  function dropCurrentFromQueue() {
    if (!currentId) return
    const kept = [...queue.slice(0, index), ...queue.slice(index).filter((id) => id !== currentId)]
    setTotal((t) => t - (queue.length - kept.length))
    setQueue(kept)
    // Session shape changed under the stack — keep undo honest by clearing it.
    undoStack.current = []
    setCanUndo(false)
    resetCardState()
  }

  async function handleBury() {
    if (!card) return
    await buryCard(card.id)
    dropCurrentFromQueue()
  }

  async function handleSuspend() {
    if (!card) return
    await setCardSuspended(card.id, true)
    dropCurrentFromQueue()
  }

  function handleCheckAnswer() {
    if (!typedTarget) return
    setAnswerCheck(checkAnswer(answerText, typedTarget))
    setRevealed(true)
  }

  // Keyboard shortcuts: space/enter reveals, 1–4 rate once revealed, Z undoes.
  useEffect(() => {
    if (loading || done) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (editing) return

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        void handleUndo()
        return
      }
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
        return
      }
      if (revealed) {
        const map: Record<string, RatingName> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }
        const r = map[e.key]
        if (r) {
          e.preventDefault()
          void handleRate(r)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, loading, done, handleRate, handleUndo, editing])

  // Soft "time for a break?" suggestion (interval is user-tunable in Settings).
  const nudgeMinutes = settings?.breakNudgeMinutes ?? 22
  useEffect(() => {
    if (loading || done) return
    const id = window.setInterval(() => {
      if (Date.now() - nudgeBaseAt >= nudgeMinutes * 60_000) setShowNudge(true)
    }, 20_000)
    return () => window.clearInterval(id)
  }, [loading, done, nudgeBaseAt, nudgeMinutes])

  function dismissNudge() {
    setShowNudge(false)
    setNudgeBaseAt(Date.now()) // re-arm for another interval
  }

  if (loading || !settings) {
    return <div className="page center muted">{t('loading')}</div>
  }

  if (total === 0) {
    return (
      <div className="page center done-screen">
        <p className="done-emoji">🌿</p>
        <h2>{cram ? t('nothingToCram') : t('nothingTodayPlain')}</h2>
        <p className="muted">{t('enjoyBreak')}</p>
        <button className="btn btn-primary" onClick={onDone}>
          {t('backToOverview')}
        </button>
      </div>
    )
  }

  if (done || !card || !subject) {
    return (
      <div className="page center done-screen">
        <p className="done-emoji">🎉</p>
        <h2>{t('doneHeading')}</h2>
        <p className="muted">{cram ? t('doneCram', reviewCount) : t('doneStudy', reviewCount)}</p>
        <button className="btn btn-primary" onClick={onDone}>
          {t('backToOverview')}
        </button>
        {canUndo && (
          <button className="btn btn-ghost btn-small" onClick={() => void handleUndo()} disabled={busy}>
            {t('undoLast')}
          </button>
        )}
      </div>
    )
  }

  const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))

  const verdictView =
    answerCheck &&
    {
      correct: { className: 'verdict verdict-correct', text: t('verdictCorrect') },
      close: { className: 'verdict verdict-close', text: t('verdictClose') },
      wrong: { className: 'verdict verdict-wrong', text: t('verdictWrong') },
    }[answerCheck.verdict]

  return (
    <div className="page study">
      <div className="study-top">
        <button className="btn btn-ghost btn-small" onClick={onDone}>
          {t('endSession')}
        </button>
        <div className="study-progress">
          <ProgressBar value={finished.size} max={total} color={palette.accent} />
        </div>
        <span className="study-count">
          {Math.min(finished.size + 1, total)} / {total}
        </span>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => void handleUndo()}
          disabled={!canUndo || busy}
          title={t('undoTitle')}
        >
          {t('undoShort')}
        </button>
      </div>

      <div className="study-subject">
        <span className="subject-dot" style={{ background: identity }} aria-hidden="true" />
        <span className="subject-tag">{subject.name}</span>
        {cram ? (
          <span className="type-tag type-cram">{t('typeCram')}</span>
        ) : (
          <span className={`type-tag ${card.state === 'new' ? 'type-new' : 'type-review'}`}>
            {card.state === 'new' ? t('typeNew') : t('typeReview')}
          </span>
        )}
        {!cram && (
          <span className="card-tools">
            <button className="card-tool" onClick={() => void handleBury()} title={t('buryTitle')}>
              {t('buryBtn')}
            </button>
            <button className="card-tool" onClick={() => void handleSuspend()} title={t('suspendTitle')}>
              {t('suspendBtn')}
            </button>
          </span>
        )}
      </div>

      {cram && (
        <div className="cram-note" role="status">
          {t('cramNote')}
        </div>
      )}

      {showNudge && (
        <div className="break-nudge" role="status">
          <span>{t('breakNudge', nudgeMinutes)}</span>
          <button className="nudge-dismiss" onClick={dismissNudge}>
            {t('keepGoing')}
          </button>
        </div>
      )}

      {leechCard && (
        <div className="leech-hint" role="status">
          <span>{t('leechHint')}</span>
          <span className="leech-actions">
            <button className="nudge-dismiss" onClick={() => setEditing(leechCard)}>
              {t('edit')}
            </button>
            <button className="nudge-dismiss" onClick={() => setLeechCard(null)}>
              {t('keepCard')}
            </button>
          </span>
        </div>
      )}

      <CardFace
        card={card}
        revealed={revealed}
        fontScale={settings.cardFontScale}
        sans={settings.cardSans}
      />

      {revealed && verdictView && (
        <div className={verdictView.className} role="status">
          {verdictView.text}
          {answerCheck && answerCheck.verdict !== 'correct' && answerText.trim() && (
            <span className="verdict-answer">{t('yourAnswer', answerText.trim())}</span>
          )}
        </div>
      )}

      <div className="study-actions">
        {revealed ? (
          <RatingButtons onRate={(r) => void handleRate(r)} previews={previews} />
        ) : typedTarget ? (
          <div className="answer-row">
            <input
              ref={answerRef}
              className="form-input answer-input"
              placeholder={t('answerPlaceholder')}
              value={answerText}
              autoFocus
              onChange={(e) => setAnswerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCheckAnswer()
                }
              }}
            />
            <button className="btn btn-primary" onClick={handleCheckAnswer}>
              {t('checkAnswer')}
            </button>
            <button className="btn btn-ghost" onClick={() => setRevealed(true)} title={t('skipTypingTitle')}>
              {t('justShow')}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-reveal" onClick={() => setRevealed(true)}>
            {t('showAnswer')}
          </button>
        )}
      </div>

      {editing && (
        <CardEditor
          subjects={[...subjectMap.values()]}
          card={editing}
          onSaved={(saved) => {
            setCardMap((m) => new Map(m).set(saved.id, saved))
            setLeechCard(null)
          }}
          onDeleted={(id) => {
            setLeechCard(null)
            const kept = queue.filter((x, i) => i < index || x !== id)
            setTotal((t) => t - (queue.length - kept.length))
            setQueue(kept)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
