import type { Subject } from '../db/db'
import type { SubjectPlan } from '../scheduler/scheduler'
import { countdownLabel, formatExamDate, urgency } from '../lib/date'
import { subjectColor, subjectColorIndex, urgencyColor } from '../lib/theme'
import { ProgressBar } from './ProgressBar'

interface Props {
  subject: Subject
  plan: SubjectPlan
  onDelete: (subject: Subject) => void
}

export function SubjectCard({ subject, plan, onDelete }: Props) {
  // Identity colour (left accent bar) is kept separate from the urgency colour
  // (countdown + progress) so the two signals never clash.
  const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))
  const urgent = urgencyColor(urgency(plan.daysUntilExam))
  const todayCount = plan.dueReviews + plan.newQuota

  return (
    <article className="subject-card" style={{ borderLeftColor: identity }}>
      <header className="subject-head">
        <h3 className="subject-name">{subject.name}</h3>
        <span
          className="countdown-chip"
          style={{
            borderColor: urgent,
            background: `color-mix(in srgb, ${urgent} 16%, var(--panel))`,
          }}
          title={formatExamDate(subject.examDate)}
        >
          {countdownLabel(plan.daysUntilExam)}
        </span>
      </header>

      <ProgressBar value={plan.studied} max={plan.total} color={urgent} />
      <div className="subject-meta">
        <span>
          naučeno {plan.studied} / {plan.total}
        </span>
        <span className={todayCount > 0 ? 'today-due' : 'today-clear'}>
          {todayCount > 0
            ? `${plan.dueReviews} k opakování · ${plan.newQuota} nových`
            : 'pro dnešek hotovo'}
        </span>
      </div>

      <button className="subject-delete" onClick={() => onDelete(subject)} aria-label="Smazat předmět">
        Smazat
      </button>
    </article>
  )
}
