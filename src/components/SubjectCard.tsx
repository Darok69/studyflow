import type { Subject } from '../db/db'
import type { SubjectPlan } from '../scheduler/scheduler'
import { countdownLabel, formatExamDate, urgency } from '../lib/date'
import { readinessBand, type Readiness } from '../lib/readiness'
import { subjectColor, subjectColorIndex, urgencyColor, palette } from '../lib/theme'
import { ProgressBar } from './ProgressBar'

interface Props {
  subject: Subject
  plan: SubjectPlan
  /** Predicted recall at the exam moment (FSRS); null when subject is empty. */
  readiness: Readiness | null
  onEdit: (subject: Subject) => void
  onCram: (subject: Subject) => void
}

const BAND_COLOR: Record<ReturnType<typeof readinessBand>, string> = {
  solid: palette.far,
  building: palette.mid,
  fragile: palette.near,
}

export function SubjectCard({ subject, plan, readiness, onEdit, onCram }: Props) {
  // Identity colour (left accent bar) is kept separate from the urgency colour
  // (countdown + progress) so the two signals never clash.
  const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))
  const urgent = urgencyColor(urgency(plan.daysUntilExam))
  const todayCount = plan.dueReviews + plan.newQuota
  const readyColor = readiness ? BAND_COLOR[readinessBand(readiness.percent)] : palette.muted

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
        {readiness && (
          <span
            className="readiness-pill"
            style={{ color: readyColor }}
            title="Odhad, kolik si toho budeš pamatovat v den zkoušky (FSRS křivka zapomínání)"
          >
            připravenost {readiness.percent} %
          </span>
        )}
        <span className={todayCount > 0 ? 'today-due' : 'today-clear'}>
          {todayCount > 0
            ? `${plan.dueReviews} k opakování · ${plan.newQuota} nových`
            : 'pro dnešek hotovo'}
        </span>
      </div>

      <div className="subject-actions">
        <button className="subject-action" onClick={() => onCram(subject)}>
          Procvičit
        </button>
        <button className="subject-action" onClick={() => onEdit(subject)}>
          Upravit
        </button>
      </div>
    </article>
  )
}
