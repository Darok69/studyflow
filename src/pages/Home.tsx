import { useEffect, useState } from 'react'
import type { Card, Review, Settings, Subject } from '../db/db'
import { deleteSubject, getCards, getReviews, getSettings, getSubjects } from '../db/repo'
import { buildSession, type SchedCard, type SubjectPlan } from '../scheduler/scheduler'
import { assessLoad } from '../lib/wellbeing'
import { encouragement } from '../lib/encouragement'
import { currentStreak, reviewsToday } from '../stats/stats'
import { SubjectCard } from '../components/SubjectCard'

interface Props {
  onImport: () => void
  onStudy: () => void
  onStats: () => void
  onSettings: () => void
}

export function Home({ onImport, onStudy, onStats, onSettings }: Props) {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

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

  async function handleDelete(subject: Subject) {
    if (!window.confirm(`Smazat předmět „${subject.name}" a všechny jeho karty?`)) return
    await deleteSubject(subject.id)
    await load()
  }

  if (loading) {
    return <div className="page center muted">Načítám…</div>
  }

  const now = new Date()
  const schedCards: SchedCard[] = cards.map((c) => ({
    id: c.id,
    subjectId: c.subjectId,
    state: c.state,
    due: c.due,
  }))
  const session = buildSession(
    subjects.map((s) => ({ id: s.id, examDate: s.examDate })),
    schedCards,
    now,
    { newCardCap: settings?.dailyNewCapEnabled ? settings.dailyNewCap : null },
  )

  const load_ = assessLoad(session.total)
  const ts = reviews.map((r) => r.ts)
  const message = encouragement({
    totalReviews: reviews.length,
    remainingToday: session.total,
    studiedToday: reviewsToday(ts, now) > 0,
    streak: currentStreak(ts, now),
  })

  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const plans: { subject: Subject; plan: SubjectPlan }[] = session.perSubject
    .map((plan) => ({ subject: subjectById.get(plan.subjectId), plan }))
    .filter((x): x is { subject: Subject; plan: SubjectPlan } => x.subject !== undefined)

  return (
    <div className="page">
      {subjects.length > 0 && (
        <nav className="home-nav">
          <button className="btn btn-ghost btn-small" onClick={onStats}>
            Statistiky
          </button>
          <button className="btn btn-ghost btn-small" onClick={onSettings}>
            Nastavení
          </button>
        </nav>
      )}

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
          {plans.map(({ subject, plan }) => (
            <SubjectCard key={subject.id} subject={subject} plan={plan} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
