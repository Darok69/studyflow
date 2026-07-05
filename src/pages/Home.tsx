import { useEffect, useState } from 'react'
import type { Card, Review, Settings, Subject } from '../db/db'
import { getCards, getReviews, getSettings, getSubjects } from '../db/repo'
import { buildSession, type SchedCard, type SubjectPlan } from '../scheduler/scheduler'
import { assessLoad } from '../lib/wellbeing'
import { encouragement } from '../lib/encouragement'
import { subjectReadiness, type Readiness } from '../lib/readiness'
import { currentStreak, reviewsToday } from '../stats/stats'
import { updateAppBadge } from '../lib/badge'
import { SubjectCard } from '../components/SubjectCard'
import { SubjectEditor } from '../components/SubjectEditor'

interface Props {
  onImport: () => void
  onStudy: () => void
  onCram: (subjectId: string) => void
  onBrowser: () => void
  onStats: () => void
  onSettings: () => void
}

export function Home({ onImport, onStudy, onCram, onBrowser, onStats, onSettings }: Props) {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editing, setEditing] = useState<Subject | null>(null)

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
    return <div className="page center muted">Načítám…</div>
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
    subjects.map((s) => ({ id: s.id, examDate: s.examDate })),
    schedCards,
    now,
    { newCardCap: settings?.dailyNewCapEnabled ? settings.dailyNewCap : null },
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
          Kartičky
        </button>
        <button className="btn btn-ghost btn-small" onClick={onStats}>
          Statistiky
        </button>
        <button className="btn btn-ghost btn-small" onClick={onSettings}>
          Nastavení
        </button>
      </nav>

      <section className="today-banner">
        <div>
          <div className="today-title">Dnešní plán</div>
          <div className="today-counts">
            {session.total > 0 ? (
              <>
                <strong>{session.dueReviews}</strong> k opakování ·{' '}
                <strong>{session.newCards}</strong> nových ·{' '}
                <span className="today-est">~{load_.minutes} min</span>
              </>
            ) : (
              'Na dnešek nic nečeká 🌿'
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onStudy} disabled={session.total === 0}>
          Studovat vše
        </button>
      </section>

      <p className="encouragement">{message}</p>

      {load_.heavy && (
        <div className="guardrail" role="status">
          Dnes je toho víc ({load_.cards} karet, ~{load_.minutes} min). Klidně to rozlož během dne —
          nemusíš všechno najednou. 🌱
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji">🌱</p>
          <p>Zatím tu nic není — a to je úplně v pořádku.</p>
          <p className="muted">Naimportuj si první balíček a můžeme začít v klidu.</p>
          <button className="btn btn-primary" onClick={onImport}>
            Importovat balíček
          </button>
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
            />
          ))}
        </div>
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
