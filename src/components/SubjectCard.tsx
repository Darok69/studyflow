import type { Subject } from '../db/db'
import type { SubjectPlan } from '../scheduler/scheduler'
import { countdownLabel, formatExamDate, urgency } from '../lib/date'
import { readinessBand, type Readiness } from '../lib/readiness'
import { subjectColor, subjectColorIndex, urgencyColor, palette } from '../lib/theme'
import { ProgressBar } from './ProgressBar'
import { t } from '../i18n'

interface Props {
  subject: Subject
  plan: SubjectPlan
  /** Predicted recall at the exam moment (FSRS); null when subject is empty. */
  readiness: Readiness | null
  onEdit: (subject: Subject) => void
  /** Tap anywhere on the card → start studying this subject right away. */
  onOpen: (subject: Subject) => void
}

const BAND_COLOR: Record<ReturnType<typeof readinessBand>, string> = {
  solid: palette.far,
  building: palette.mid,
  fragile: palette.near,
}

export function SubjectCard({ subject, plan, readiness, onEdit, onOpen }: Props) {
  // Identity colour (left accent bar) is kept separate from the urgency colour
  // (countdown + progress) so the two signals never clash.
  const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))
  const urgent = urgencyColor(urgency(plan.daysUntilExam))
  const todayCount = plan.dueReviews + plan.newQuota
  const readyColor = readiness ? BAND_COLOR[readinessBand(readiness.percent)] : palette.muted

  return (
    <article
      className="subject-card subject-card-clickable"
      style={{ borderLeftColor: identity }}
      role="button"
      tabIndex={0}
      title={t('subjectOpenTitle')}
      onClick={() => onOpen(subject)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(subject)
        }
      }}
    >
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
        <span>{t('learnedRatio', plan.studied, plan.total)}</span>
        {readiness && (
          <span
            className="readiness-pill"
            style={{ color: readyColor }}
            title={t('readinessPillTitle')}
          >
            {t('readinessPercent', readiness.percent)}
          </span>
        )}
        <span className={todayCount > 0 ? 'today-due' : 'today-clear'}>
          {todayCount > 0
            ? t('subjectTodayCounts', plan.dueReviews, plan.newQuota)
            : t('doneForToday')}
        </span>
      </div>

      <div className="subject-actions">
        <button
          className="subject-action"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(subject)
          }}
        >
          {t('edit')}
        </button>
      </div>
    </article>
  )
}
