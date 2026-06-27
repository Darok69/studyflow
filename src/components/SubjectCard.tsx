import type { Subject } from '../db/db'
import type { SubjectStats } from '../scheduler/scheduler'
import { countdownLabel, formatExamDate, urgency } from '../lib/date'
import { urgencyColor } from '../lib/theme'
import { ProgressBar } from './ProgressBar'

interface Props {
  subject: Subject
  stats: SubjectStats
  onDelete: (subject: Subject) => void
}

export function SubjectCard({ subject, stats, onDelete }: Props) {
  const color = urgencyColor(urgency(stats.daysUntilExam))
  const todayCount = stats.dueToday + stats.newToday

  return (
    <article className="subject-card">
      <header className="subject-head">
        <h3 className="subject-name">{subject.name}</h3>
        <span className="countdown-chip" style={{ color, borderColor: color }} title={formatExamDate(subject.examDate)}>
          {countdownLabel(stats.daysUntilExam)}
        </span>
      </header>

      <ProgressBar value={stats.studied} max={stats.total} color={color} />
      <div className="subject-meta">
        <span>
          naučeno {stats.studied} / {stats.total}
        </span>
        <span className={todayCount > 0 ? 'today-due' : 'today-clear'}>
          {todayCount > 0
            ? `${stats.dueToday} k opakování · ${stats.newToday} nových`
            : 'pro dnešek hotovo'}
        </span>
      </div>

      <button className="subject-delete" onClick={() => onDelete(subject)} aria-label="Smazat předmět">
        Smazat
      </button>
    </article>
  )
}
