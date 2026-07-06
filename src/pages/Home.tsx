import { useEffect, useState } from 'react'
import type { Card, Review, Settings, Subject } from '../db/db'
import { getCards, getReviews, getSettings, getSubjects } from '../db/repo'
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
import { t } from '../i18n'

interface Props {
  onImport: () => void
  onStudy: () => void
  onStudySubject: (subjectId: string) => void
  onCram: (subjectId: string) => void
  onBrowser: () => void
  /** A hand-made deck was just created → jump straight to adding its cards. */
  onDeckCreated: (subjectId: string) => void
  onStats: () => void
  onSettings: () => void
}

export function Home({
  onImport,
  onStudy,
  onStudySubject,
  onCram,
  onBrowser,
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

  return (
    <div className="page">
      <nav className="home-nav">
        <button className="btn btn-ghost btn-small" onClick={onBrowser}>
          {t('navCards')}
        </button>
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
        <div className="subject-list">
          {plans.map(({ subject, plan, readiness }) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              plan={plan}
              readiness={readiness}
              onEdit={setEditing}
              onCram={(s) => onCram(s.id)}
              onOpen={(s) =>
                // Tap the deck → study it right away. Nothing due today →
                // fall back to a no-stakes practice run instead of a dead end.
                plan.dueReviews + plan.newQuota > 0 ? onStudySubject(s.id) : onCram(s.id)
              }
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
        />
      )}
    </div>
  )
}
