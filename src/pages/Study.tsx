import { useCallback, useEffect, useState } from 'react'
import type { Card, RatingName, Subject } from '../db/db'
import { getCards, getSettings, getSubjects, recordRating } from '../db/repo'
import { buildSession, reinsertAgain, type SchedCard } from '../scheduler/scheduler'
import { CardFace } from '../components/CardFace'
import { RatingButtons } from '../components/RatingButtons'
import { ProgressBar } from '../components/ProgressBar'
import { palette, subjectColor, subjectColorIndex } from '../lib/theme'
import { BREAK_NUDGE_MINUTES } from '../lib/wellbeing'

function czCards(n: number): string {
  if (n === 1) return 'kartu'
  if (n >= 2 && n <= 4) return 'karty'
  return 'karet'
}

export function Study({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [cardMap, setCardMap] = useState<Map<string, Card>>(new Map())
  const [subjectMap, setSubjectMap] = useState<Map<string, Subject>>(new Map())
  const [finished, setFinished] = useState<Set<string>>(new Set())
  const [total, setTotal] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)

  // Break nudge: re-armable baseline so it stays a suggestion, never a block.
  const [nudgeBaseAt, setNudgeBaseAt] = useState<number>(() => Date.now())
  const [showNudge, setShowNudge] = useState(false)

  useEffect(() => {
    void (async () => {
      const [subjects, cards, settings] = await Promise.all([
        getSubjects(),
        getCards(),
        getSettings(),
      ])
      const schedCards: SchedCard[] = cards.map((c) => ({
        id: c.id,
        subjectId: c.subjectId,
        state: c.state,
        due: c.due,
      }))
      const session = buildSession(
        subjects.map((s) => ({ id: s.id, examDate: s.examDate })),
        schedCards,
        new Date(),
        { newCardCap: settings.dailyNewCapEnabled ? settings.dailyNewCap : null },
      )
      setCardMap(new Map(cards.map((c) => [c.id, c])))
      setSubjectMap(new Map(subjects.map((s) => [s.id, s])))
      setQueue(session.order)
      setTotal(session.order.length)
      setLoading(false)
    })()
  }, [])

  const currentId = queue[index]
  const card = currentId ? cardMap.get(currentId) : undefined
  const subject = card ? subjectMap.get(card.subjectId) : undefined
  const done = !loading && index >= queue.length

  const handleRate = useCallback(
    (rating: RatingName) => {
      if (!card || !subject) return

      void recordRating(card, rating, subject.examDate).then((updated) => {
        setCardMap((m) => new Map(m).set(updated.id, updated))
      })

      if (rating === 'again') {
        setQueue((q) => reinsertAgain(q, index))
      } else {
        setFinished((f) => new Set(f).add(card.id))
      }
      setReviewCount((n) => n + 1)
      setRevealed(false)
      setIndex((i) => i + 1)
    },
    [card, subject, index],
  )

  // Keyboard shortcuts: space/enter reveals, 1–4 rate once revealed.
  useEffect(() => {
    if (loading || done) return
    function onKey(e: KeyboardEvent) {
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
          handleRate(r)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, loading, done, handleRate])

  // Soft "time for a break?" suggestion after ~22 min of continuous studying.
  useEffect(() => {
    if (loading || done) return
    const id = window.setInterval(() => {
      if (Date.now() - nudgeBaseAt >= BREAK_NUDGE_MINUTES * 60_000) setShowNudge(true)
    }, 20_000)
    return () => window.clearInterval(id)
  }, [loading, done, nudgeBaseAt])

  function dismissNudge() {
    setShowNudge(false)
    setNudgeBaseAt(Date.now()) // re-arm for another interval
  }

  if (loading) {
    return <div className="page center muted">Načítám…</div>
  }

  if (total === 0) {
    return (
      <div className="page center done-screen">
        <p className="done-emoji">🌿</p>
        <h2>Na dnešek nic nečeká</h2>
        <p className="muted">Užij si pauzu — uvidíme se zase, až budeš chtít.</p>
        <button className="btn btn-primary" onClick={onDone}>
          Zpět na přehled
        </button>
      </div>
    )
  }

  if (done || !card || !subject) {
    return (
      <div className="page center done-screen">
        <p className="done-emoji">🎉</p>
        <h2>Hotovo!</h2>
        <p className="muted">
          Dal sis na tom záležet — prošel jsi {reviewCount} {czCards(reviewCount)}. Pěkná práce. 🌿
        </p>
        <button className="btn btn-primary" onClick={onDone}>
          Zpět na přehled
        </button>
      </div>
    )
  }

  const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))

  return (
    <div className="page study">
      <div className="study-top">
        <button className="btn btn-ghost btn-small" onClick={onDone}>
          Konec
        </button>
        <div className="study-progress">
          <ProgressBar value={finished.size} max={total} color={palette.accent} />
        </div>
        <span className="study-count">
          {Math.min(finished.size + 1, total)} / {total}
        </span>
      </div>

      <div className="study-subject">
        <span className="subject-dot" style={{ background: identity }} aria-hidden="true" />
        <span className="subject-tag">{subject.name}</span>
        <span className={`type-tag ${card.state === 'new' ? 'type-new' : 'type-review'}`}>
          {card.state === 'new' ? 'nová' : 'opakování'}
        </span>
      </div>

      {showNudge && (
        <div className="break-nudge" role="status">
          <span>Studuješ přes 20 minut — dáš si pauzu? 🙂</span>
          <button className="nudge-dismiss" onClick={dismissNudge}>
            Pokračovat
          </button>
        </div>
      )}

      <CardFace card={card} revealed={revealed} />

      <div className="study-actions">
        {revealed ? (
          <RatingButtons onRate={handleRate} />
        ) : (
          <button className="btn btn-primary btn-reveal" onClick={() => setRevealed(true)}>
            Zobrazit odpověď
          </button>
        )}
      </div>
    </div>
  )
}
