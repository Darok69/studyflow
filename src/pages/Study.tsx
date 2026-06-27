import { useCallback, useEffect, useState } from 'react'
import type { Card, RatingName, Subject } from '../db/db'
import { getCards, getSubjects, recordRating } from '../db/repo'
import { buildSession, reinsertAgain, type SchedCard } from '../scheduler/scheduler'
import { CardFace } from '../components/CardFace'
import { RatingButtons } from '../components/RatingButtons'
import { ProgressBar } from '../components/ProgressBar'
import { palette } from '../lib/theme'

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

  useEffect(() => {
    void (async () => {
      const [subjects, cards] = await Promise.all([getSubjects(), getCards()])
      const schedCards: SchedCard[] = cards.map((c) => ({
        id: c.id,
        subjectId: c.subjectId,
        state: c.state,
        due: c.due,
      }))
      const session = buildSession(
        subjects.map((s) => ({ id: s.id, examDate: s.examDate })),
        schedCards,
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

  if (loading) {
    return <div className="page center muted">Načítám…</div>
  }

  if (total === 0) {
    return (
      <div className="page center done-screen">
        <p className="done-emoji">☕</p>
        <h2>Na dnešek nemáš žádné karty</h2>
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
          Zopakoval jsi {reviewCount} {reviewCount === 1 ? 'kartu' : reviewCount < 5 ? 'karty' : 'karet'}.
        </p>
        <button className="btn btn-primary" onClick={onDone}>
          Zpět na přehled
        </button>
      </div>
    )
  }

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
        <span className="subject-tag">{subject.name}</span>
        <span className={`type-tag ${card.state === 'new' ? 'type-new' : 'type-review'}`}>
          {card.state === 'new' ? 'nová' : 'opakování'}
        </span>
      </div>

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
