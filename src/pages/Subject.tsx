import { useEffect, useState } from 'react'
import type { Card, Review, Settings, Subject as SubjectRow } from '../db/db'
import { getCards, getReviews, getSettings, getSubjects } from '../db/repo'
import {
  introducedTodayBySubject,
  subjectStats,
  topicPlans,
  type SchedCard,
  type TopicPlan,
} from '../scheduler/scheduler'
import { subjectReadiness } from '../lib/readiness'
import { countdownLabel, formatExamDate, urgency } from '../lib/date'
import { readinessBand } from '../lib/readiness'
import { palette, subjectColor, subjectColorIndex, urgencyColor } from '../lib/theme'
import { ProgressBar } from '../components/ProgressBar'
import { SubjectEditor } from '../components/SubjectEditor'
import { SubjectPace } from '../components/SubjectPace'
import { getMaterialIndex, SERVER_MODE, type MaterialIndex } from '../lib/api'
import { lectureForTopic, matchCourses, orderByCourse, type CourseRef } from '../lib/materials'
import { t } from '../i18n'

/**
 * One subject, everything about it in one place: today's batch, the textbook it
 * was made from, and the topics underneath — each with its own counts and its
 * own way in.
 *
 * The point of the screen is that a topic is studiable on its own. A semester
 * is learned lecture by lecture, and a queue that mixes every lecture of the
 * course together is unusable while the material is still being met for the
 * first time. Interleaving still happens INSIDE a topic and inside the whole
 * day's batch — it just stops being the only option.
 */

interface Props {
  subjectId: string
  hasMaterials: boolean
  onBack: () => void
  onStudy: () => void
  onCram: () => void
  onStudyTopic: (topic: string) => void
  onCramTopic: (topic: string) => void
  /** Open the textbook — at one lecture, or at the course's list when null. */
  onRead: (lectureId: string | null, courseCode: string | null) => void
  onBrowse: (topic: string | null) => void
}

const BAND_COLOR: Record<ReturnType<typeof readinessBand>, string> = {
  solid: palette.far,
  building: palette.mid,
  fragile: palette.near,
}

export function Subject({
  subjectId,
  hasMaterials,
  onBack,
  onStudy,
  onCram,
  onStudyTopic,
  onCramTopic,
  onRead,
  onBrowse,
}: Props) {
  const [subject, setSubject] = useState<SubjectRow | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [index, setIndex] = useState<MaterialIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  async function load() {
    const [subjects, c, r, st] = await Promise.all([
      getSubjects(),
      getCards(),
      getReviews(),
      getSettings(),
    ])
    setSubject(subjects.find((s) => s.id === subjectId) ?? null)
    setCards(c)
    setReviews(r)
    setSettings(st)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // subjectId is fixed for the lifetime of this page instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The textbook index is small (titles and counts); the lectures themselves
  // are fetched only when one is opened.
  useEffect(() => {
    if (!SERVER_MODE || !hasMaterials) return
    let alive = true
    getMaterialIndex()
      .then((data) => {
        if (alive) setIndex(data)
      })
      .catch(() => {
        /* no textbook is a normal state — the topics below still work */
      })
    return () => {
      alive = false
    }
  }, [hasMaterials])

  if (loading) return <div className="page center muted">{t('loading')}</div>
  if (!subject) return <div className="page center muted">{t('subjectGone')}</div>

  const now = new Date()
  const schedCards: SchedCard[] = cards.map((c) => ({
    id: c.id,
    subjectId: c.subjectId,
    topic: c.topic,
    state: c.state,
    due: c.due,
    suspended: c.suspended,
    draft: c.draft,
    buriedUntil: c.buriedUntil,
  }))
  const introduced = introducedTodayBySubject(reviews, cards, now)
  const stats = subjectStats(
    { id: subject.id, examDate: subject.examDate, dailyNewLimit: subject.dailyNewLimit },
    schedCards,
    now,
    introduced.get(subject.id) ?? 0,
  )
  const own = cards.filter((c) => c.subjectId === subject.id)
  const readiness = subjectReadiness(own, subject.examDate, now, settings?.targetRetention)

  // A subject can be taught from several courses — a lecture and its practical
  // exercise cover the same exam, so both belong in the same textbook.
  const courses: CourseRef[] = matchCourses(
    index?.courses ?? [],
    subject.name,
    own.map((c) => c.topic ?? ''),
  )
  const plans: TopicPlan[] = orderByCourse(topicPlans(subject.id, schedCards, now), courses)

  const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))
  const urgent = urgencyColor(urgency(stats.daysUntilExam))
  const todayCount = stats.dueToday + stats.newToday
  const lectures = courses.reduce((n, c) => n + c.lectures.length, 0)
  const slides = courses.reduce((n, c) => n + c.lectures.reduce((m, l) => m + l.slides, 0), 0)

  return (
    <div className="page subject-page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
      </div>

      <header className="subject-hero" style={{ borderLeftColor: identity }}>
        <div className="subject-hero-head">
          <h2 className="page-title">{subject.name}</h2>
          <span
            className="countdown-chip"
            style={{
              borderColor: urgent,
              background: `color-mix(in srgb, ${urgent} 16%, var(--panel))`,
            }}
            title={formatExamDate(subject.examDate)}
          >
            {countdownLabel(stats.daysUntilExam)}
          </span>
        </div>
        <ProgressBar value={stats.studied} max={stats.total} color={urgent} />
        <div className="subject-meta">
          <span>{t('learnedRatio', stats.studied, stats.total)}</span>
          {readiness && (
            <span
              className="readiness-pill"
              style={{ color: BAND_COLOR[readinessBand(readiness.percent)] }}
              title={t('readinessPillTitle')}
            >
              {t('readinessPercent', readiness.percent)}
            </span>
          )}
        </div>
        <div className="button-row subject-hero-actions">
          <button className="btn btn-primary" onClick={onStudy} disabled={todayCount === 0}>
            {todayCount > 0 ? t('studyTodayCount', todayCount) : t('doneForToday')}
          </button>
          <button className="btn btn-ghost" onClick={onCram}>
            {t('practice')}
          </button>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            {t('edit')}
          </button>
        </div>
      </header>

      <SubjectPace
        subject={subject}
        settings={settings}
        newToday={stats.newToday}
        dueToday={stats.dueToday}
        onChanged={() => void load()}
      />

      {courses.length > 0 && (
        <button className="textbook-row" onClick={() => onRead(null, courses.map((c) => c.code).join(','))}>
          <span className="textbook-icon" aria-hidden="true">
            📖
          </span>
          <span className="textbook-main">
            <span className="textbook-title">{t('textbookTitle')}</span>
            <span className="muted">
              {t('readerLectures', lectures)} · {t('readerSlideCount', slides)}
            </span>
          </span>
        </button>
      )}

      <section className="topic-section">
        <h3 className="section-title">
          {t('topicsTitle', plans.length)}
          <button className="btn btn-ghost btn-small" onClick={() => onBrowse(null)}>
            {t('navCards')}
          </button>
        </h3>
        {plans.length === 0 && <p className="muted">{t('topicsEmpty')}</p>}
        <div className="topic-list">
          {plans.map((plan) => {
            const lecture = lectureForTopic(courses, plan.topic)
            const today = plan.dueReviews + Math.min(plan.newRemaining, stats.newToday)
            const label = plan.topic || t('topicNone')
            return (
              <article key={plan.topic || '—'} className="topic-row">
                <button
                  className="topic-main"
                  onClick={() => (today > 0 ? onStudyTopic(plan.topic) : onCramTopic(plan.topic))}
                  title={today > 0 ? t('topicStudyTitle') : t('topicPracticeTitle')}
                >
                  {lecture && <span className="topic-unit">{lecture.unit}</span>}
                  <span className="topic-name">{label}</span>
                  <span className="topic-counts muted">
                    {t('topicLearned', plan.studied, plan.total)}
                    {plan.dueReviews > 0 ? ` · ${t('topicDue', plan.dueReviews)}` : ''}
                  </span>
                  <ProgressBar value={plan.studied} max={plan.total} color={identity} />
                </button>
                <div className="topic-actions">
                  {lecture && (
                    <button
                      className="topic-action"
                      onClick={() => onRead(lecture.id, courses.map((c) => c.code).join(','))}
                      title={t('topicReadTitle')}
                    >
                      {t('topicRead')}
                    </button>
                  )}
                  <button
                    className="topic-action"
                    onClick={() => onBrowse(plan.topic)}
                    title={t('topicCardsTitle')}
                  >
                    {t('topicCards')}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {editing && (
        <SubjectEditor
          subject={subject}
          onSaved={() => void load()}
          onDeleted={onBack}
          onClose={() => setEditing(false)}
          onCram={() => onCram()}
        />
      )}
    </div>
  )
}
