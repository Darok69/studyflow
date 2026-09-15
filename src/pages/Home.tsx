import { useEffect, useRef, useState } from 'react'
import type { Card, Review, Settings, Subject } from '../db/db'
import { getCards, getReviews, getSettings, getSubjects, setSubjectOrder } from '../db/repo'
import { hasManualOrder, moveItem, orderedByHand } from '../lib/order'
import {
  buildSession,
  introducedTodayBySubject,
  type SchedCard,
  type SubjectPlan,
} from '../scheduler/scheduler'
import { assessLoad } from '../lib/wellbeing'
import { encouragement } from '../lib/encouragement'
import { subjectReadiness, type Readiness } from '../lib/readiness'
import { currentStreak, reviewsToday } from '../stats/stats'
import { updateAppBadge } from '../lib/badge'
import { SubjectCard } from '../components/SubjectCard'
import { SubjectEditor } from '../components/SubjectEditor'
import { NewDeckModal } from '../components/NewDeckModal'
import { SERVER_MODE } from '../lib/api'
import { clearDayNote, noteTone, readDayNote, type DayNote } from '../lib/dayNote'
import { freshStart, freshStartSeen, markFreshStartSeen, type FreshStart } from '../lib/freshStart'
import { dayKey } from '../lib/date'
import { t } from '../i18n'

interface Props {
  onImport: () => void
  onStudy: () => void
  /** Tap a deck → the subject screen: today's batch, its textbook, its topics. */
  onOpenSubject: (subjectId: string) => void
  onCram: (subjectId: string) => void
  onBrowser: () => void
  /** Source materials → outline → cards. Server mode only. */
  onSources: () => void
  /** The study materials read as a textbook. Shown only when the server has them. */
  /** Capacity plan up to the exam dates. */
  /** A hand-made deck was just created → jump straight to adding its cards. */
  onDeckCreated: (subjectId: string) => void
  onStats: () => void
  onSettings: () => void
}

export function Home({
  onImport,
  onStudy,
  onOpenSubject,
  onCram,
  onBrowser,
  onSources,
  onDeckCreated,
  onStats,
  onSettings,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [creating, setCreating] = useState(false)
  // Zeigarnik: the thread left hanging when a session was cut short.
  const [note, setNote] = useState<DayNote | null>(null)
  const [fresh, setFresh] = useState<FreshStart>(null)
  /**
   * The order while a card is being dragged. Held apart from the stored order
   * so the list can follow the finger before anything is written down.
   */
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOrderRef = useRef<string[] | null>(null)

  async function load() {
    const [s, c, r, st] = await Promise.all([getSubjects(), getCards(), getReviews(), getSettings()])
    setSubjects(s)
    setCards(c)
    setReviews(r)
    setSettings(st)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setNote(readDayNote())
  }, [])

  useEffect(() => {
    if (loading) return
    const today = new Date()
    if (freshStartSeen(today)) return
    setFresh(freshStart(today, subjects.map((s) => s.examDate)))
  }, [loading, subjects])

  if (loading) {
    return <div className="page center muted">{t('loading')}</div>
  }

  const now = new Date()
  const schedCards: SchedCard[] = cards.map((c) => ({
    id: c.id,
    subjectId: c.subjectId,
    state: c.state,
    due: c.due,
    suspended: c.suspended,
    draft: c.draft,
    buriedUntil: c.buriedUntil,
  }))
  const session = buildSession(
    subjects.map((s) => ({ id: s.id, examDate: s.examDate, dailyNewLimit: s.dailyNewLimit })),
    schedCards,
    now,
    {
      newCardCap: settings?.dailyNewCapEnabled ? settings.dailyNewCap : null,
      introducedToday: introducedTodayBySubject(reviews, cards, now),
    },
  )

  // "Widget": the installed-app icon shows how many cards wait today.
  updateAppBadge(session.total)

  const load_ = assessLoad(session.total)
  const ts = reviews.map((r) => r.ts)
  const message = encouragement({
    totalReviews: reviews.length,
    remainingToday: session.total,
    studiedToday: reviewsToday(ts, now) > 0,
    streak: currentStreak(ts, now),
  })

  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const retention = settings?.targetRetention
  const plans: { subject: Subject; plan: SubjectPlan; readiness: Readiness | null }[] =
    session.perSubject
      .map((plan) => {
        const subject = subjectById.get(plan.subjectId)
        if (!subject) return null
        const own = cards.filter((c) => c.subjectId === subject.id)
        return { subject, plan, readiness: subjectReadiness(own, subject.examDate, now, retention) }
      })
      .filter((x): x is { subject: Subject; plan: SubjectPlan; readiness: Readiness | null } => x !== null)

  // Deadline order is what the queue needs; the shelf is the user's to arrange.
  // Until someone drags a card, nothing changes and the nearest exam stays first.
  const arranged = hasManualOrder(subjects)
    ? orderedByHand(subjects)
        .map((s) => plans.find((p) => p.subject.id === s.id))
        .filter((p): p is (typeof plans)[number] => p !== undefined)
    : plans
  const shown = dragOrder
    ? dragOrder
        .map((id) => arranged.find((p) => p.subject.id === id))
        .filter((p): p is (typeof plans)[number] => p !== undefined)
    : arranged

  function startDrag(e: React.PointerEvent<HTMLElement>, subject: Subject) {
    // The handle keeps the pointer for the whole gesture, so leaving the button
    // mid-drag does not silently drop it.
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Some browsers refuse capture for a pointer they do not consider down.
      // The drag still works through the list's own move handler.
    }
    const ids = shown.map((p) => p.subject.id)
    dragOrderRef.current = ids
    setDragOrder(ids)
    setDraggingId(subject.id)
  }

  function onDragMove(e: React.PointerEvent<HTMLElement>) {
    const ids = dragOrderRef.current
    if (!draggingId || !ids) return
    // Hit-test rather than measure: the cards are a wrapping grid, so "which
    // card am I over" is the only question with a stable answer.
    const under = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-subject-id]')
    const overId = under?.dataset.subjectId
    if (!overId || overId === draggingId) return
    const from = ids.indexOf(draggingId)
    const to = ids.indexOf(overId)
    if (from < 0 || to < 0) return
    const next = moveItem(ids, from, to)
    dragOrderRef.current = next
    setDragOrder(next)
  }

  async function endDrag() {
    const ids = dragOrderRef.current
    setDraggingId(null)
    if (ids) await setSubjectOrder(ids)
    dragOrderRef.current = null
    await load()
    setDragOrder(null)
  }

  /** Same move from the keyboard — one step left or right. */
  async function nudge(subject: Subject, delta: number) {
    const ids = shown.map((p) => p.subject.id)
    const from = ids.indexOf(subject.id)
    if (from < 0) return
    const to = Math.max(0, Math.min(ids.length - 1, from + delta))
    if (to === from) return
    await setSubjectOrder(moveItem(ids, from, to))
    await load()
  }

  return (
    <div className="page home-page">
      <nav className="home-nav">
        <button className="btn btn-ghost btn-small" onClick={onBrowser}>
          {t('navCards')}
        </button>
        {SERVER_MODE && (
          <button className="btn btn-ghost btn-small" onClick={onSources}>
            {t('navSources')}
          </button>
        )}
        <button className="btn btn-ghost btn-small" onClick={onStats}>
          {t('navStats')}
        </button>
        <button className="btn btn-ghost btn-small" onClick={onSettings}>
          {t('navSettings')}
        </button>
      </nav>

      <section className="today-banner">
        <div>
          <div className="today-title">{t('todayPlan')}</div>
          <div className="today-counts">
            {session.total > 0 ? (
              <>
                <strong>{session.dueReviews}</strong> {t('toReview')} ·{' '}
                <strong>{session.newCards}</strong> {t('newCount')} ·{' '}
                <span className="today-est">{t('estMinutes', load_.minutes)}</span>
              </>
            ) : (
              t('nothingTodayLeaf')
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onStudy} disabled={session.total === 0}>
          {t('studyAll')}
        </button>
      </section>

      <p className="encouragement">{message}</p>

      {(() => {
        const tone = noteTone(note, dayKey(now))
        if (!tone || !note) return null
        const text = note.topic
          ? tone === 'today'
            ? t('noteToday', note.topic)
            : t('noteLater', note.topic)
          : t('noteNoTopic')
        return (
          <div className="guardrail day-note" role="status">
            <span>{text}</span>
            <button
              className="nudge-dismiss"
              onClick={() => {
                clearDayNote()
                setNote(null)
              }}
            >
              {t('close')}
            </button>
          </div>
        )
      })()}

      {fresh && (
        <div className="guardrail fresh-start" role="status">
          <span>
            {fresh === 'after-exam'
              ? t('freshAfterExam')
              : fresh === 'month'
                ? t('freshMonth')
                : t('freshMonday')}
          </span>
          <button
            className="nudge-dismiss"
            onClick={() => {
              markFreshStartSeen(new Date())
              setFresh(null)
            }}
          >
            {t('freshDismiss')}
          </button>
        </div>
      )}

      {load_.heavy && (
        <div className="guardrail" role="status">
          {t('heavyLoad', load_.cards, load_.minutes)}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji">🌱</p>
          <p>{t('emptyNothingYet')}</p>
          <p className="muted">{t('emptyImportHint')}</p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              {t('newDeckBtn')}
            </button>
            <button className="btn btn-ghost" onClick={onImport}>
              {t('importDeckBtn')}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`subject-list${draggingId ? ' subject-list-dragging' : ''}`}
          onPointerMove={onDragMove}
          onPointerUp={() => void endDrag()}
          onPointerCancel={() => void endDrag()}
        >
          {shown.map(({ subject, plan, readiness }) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              plan={plan}
              readiness={readiness}
              onEdit={setEditing}
              onDragStart={shown.length > 1 ? startDrag : undefined}
              onNudge={(s, d) => void nudge(s, d)}
              dragging={draggingId === subject.id}
              // Tap the deck → the subject: today's batch, the textbook it was
              // made from, and the topics underneath. A semester is learned
              // lecture by lecture, so the way in has to show the lectures.
              onOpen={(s) => onOpenSubject(s.id)}
            />
          ))}
          <button className="btn btn-ghost new-deck-btn" onClick={() => setCreating(true)}>
            {t('newDeckBtn')}
          </button>
        </div>
      )}

      {creating && (
        <NewDeckModal
          onCreated={(subjectId) => {
            setCreating(false)
            onDeckCreated(subjectId)
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <SubjectEditor
          subject={editing}
          onSaved={() => void load()}
          onDeleted={() => void load()}
          onClose={() => setEditing(null)}
          onCram={(s) => onCram(s.id)}
        />
      )}
    </div>
  )
}
