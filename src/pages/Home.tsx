import { useEffect, useState } from 'react'
import type { Card, Subject } from '../db/db'
import { deleteSubject, getCards, getSubjects } from '../db/repo'
import { buildSession, subjectStats, type SchedCard } from '../scheduler/scheduler'
import { SubjectCard } from '../components/SubjectCard'

interface Props {
  onImport: () => void
  onStudy: () => void
}

export function Home({ onImport, onStudy }: Props) {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<Card[]>([])

  async function load() {
    const [s, c] = await Promise.all([getSubjects(), getCards()])
    setSubjects(s)
    setCards(c)
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
  )

  if (loading) {
    return <div className="page center muted">Načítám…</div>
  }

  return (
    <div className="page">
      <section className="today-banner">
        <div>
          <div className="today-title">Dnešní plán</div>
          <div className="today-counts">
            {session.total > 0 ? (
              <>
                <strong>{session.dueReviews}</strong> k opakování ·{' '}
                <strong>{session.newCards}</strong> nových
              </>
            ) : (
              'Žádné karty na dnešek 🎉'
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onStudy} disabled={session.total === 0}>
          Studovat vše
        </button>
      </section>

      {subjects.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji">📚</p>
          <p>Zatím nemáš žádné předměty.</p>
          <button className="btn btn-primary" onClick={onImport}>
            Importovat balíček
          </button>
        </div>
      ) : (
        <div className="subject-list">
          {subjects.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              stats={subjectStats({ id: s.id, examDate: s.examDate }, schedCards, now)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
