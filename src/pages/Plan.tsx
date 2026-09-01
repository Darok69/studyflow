import { useEffect, useState } from 'react'
import type { Card, Settings, Subject } from '../db/db'
import { getCards, getSettings, getSubjects, saveSettings, updateSubject } from '../db/repo'
import { capacityPlan, type CapacityPlan } from '../lib/plan'
import { countdownLabel, daysUntil } from '../lib/date'
import { subjectColor, subjectColorIndex } from '../lib/theme'
import { ProgressBar } from '../components/ProgressBar'
import { palette } from '../lib/theme'
import { t } from '../i18n'

/**
 * The week seen from the exam dates: how much time the plan really needs, how
 * much there is, and — when those two disagree — what to drop first.
 */
export function Plan({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [plan, setPlan] = useState<CapacityPlan | null>(null)

  async function load() {
    const [s, c, st] = await Promise.all([getSubjects(), getCards(), getSettings()])
    setSubjects(s)
    setCards(c)
    setSettings(st)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!settings) return
    const now = new Date()
    setPlan(
      capacityPlan(
        subjects.map((s) => ({ id: s.id, name: s.name, daysUntilExam: daysUntil(s.examDate, now) })),
        cards,
        settings.dailyMinutes,
      ),
    )
  }, [subjects, cards, settings])

  async function setMinutes(minutes: number) {
    const next = await saveSettings({ dailyMinutes: Math.min(240, Math.max(5, minutes)) })
    setSettings(next)
  }

  async function setIntention(subject: Subject, intention: string) {
    await updateSubject(subject.id, { intention: intention.trim() || undefined })
    setSubjects((list) => list.map((s) => (s.id === subject.id ? { ...s, intention } : s)))
  }

  if (loading || !settings || !plan) return <div className="page center muted">{t('loading')}</div>

  const overBy = Math.round((plan.neededMinutes - plan.availableMinutes) * 10) / 10

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
      </div>
      <h2 className="page-title">{t('planTitle')}</h2>

      {subjects.length === 0 ? (
        <p className="muted">{t('planEmpty')}</p>
      ) : (
        <>
          <section className="setting-row">
            <div className="setting-text">
              <div className="setting-name">{t('planAvailableName')}</div>
              <p className="muted setting-desc">{t('planAvailableDesc')}</p>
            </div>
            <input
              className="cap-input"
              type="number"
              min={5}
              max={240}
              step={5}
              value={settings.dailyMinutes}
              onChange={(e) => void setMinutes(Number(e.target.value) || 25)}
            />
          </section>

          <div className={`guardrail plan-verdict${plan.fits ? '' : ' plan-verdict-tight'}`} role="status">
            {plan.fits
              ? t('planFits', Math.round(plan.neededMinutes), plan.availableMinutes)
              : t('planTight', Math.round(plan.neededMinutes), plan.availableMinutes, Math.round(overBy))}
            {plan.cuts.length > 0 && (
              <>
                <span className="plan-cut">{t('planCutIntro')}</span>
                <ul className="plan-cuts">
                  {plan.cuts.map((cut) => (
                    <li key={cut.subjectId}>{t('planCut', cut.cards, cut.name)}</li>
                  ))}
                </ul>
              </>
            )}
            {plan.notEnough && <span className="plan-cut">{t('planNotEnough')}</span>}
          </div>

          <div className="plan-bar">
            <ProgressBar
              value={Math.min(plan.neededMinutes, plan.availableMinutes)}
              max={Math.max(plan.availableMinutes, plan.neededMinutes)}
              color={plan.fits ? palette.far : palette.mid}
            />
          </div>

          <ul className="card-list plan-list">
            {plan.perSubject.map((row) => {
              const subject = subjects.find((s) => s.id === row.subjectId)
              if (!subject) return null
              const identity = subjectColor(subject.colorIndex ?? subjectColorIndex(subject.id))
              return (
                <li key={row.subjectId} className="card-row plan-row">
                  <span className="subject-dot" style={{ background: identity }} aria-hidden="true" />
                  <div className="card-row-main">
                    <div className="card-row-front">{row.name}</div>
                    <div className="card-row-meta">
                      <span className="row-chip">{countdownLabel(row.daysUntilExam)}</span>
                      <span className="row-chip">{t('planPerDay', row.newPerDay, Math.round(row.minutesPerDay))}</span>
                      {row.cardsRemaining > 0 && (
                        <span className="row-chip">{t('planRemaining', row.cardsRemaining)}</span>
                      )}
                    </div>
                    <input
                      className="form-input plan-intention"
                      placeholder={t('planIntentionPlaceholder')}
                      defaultValue={subject.intention ?? ''}
                      onBlur={(e) => void setIntention(subject, e.target.value)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="muted plan-note">{t('planIntentionHint')}</p>
        </>
      )}
    </div>
  )
}
