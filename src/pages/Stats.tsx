import { useEffect, useState } from 'react'
import type { Card, Review, Settings, Subject } from '../db/db'
import type { ErrorEntry } from '../db/db'
import { getCards, getErrors, getReviews, getSettings, getSubjects } from '../db/repo'
import {
  accuracy,
  calibration,
  calibrationVerdict,
  currentStreak,
  heatmapWeeks,
  reviewForecast,
  reviewsInLastDays,
  reviewsLast7Days,
  weakTopics,
} from '../stats/stats'
import { readinessBand, subjectReadiness } from '../lib/readiness'
import { palette } from '../lib/theme'
import { Sparkline } from '../components/Sparkline'
import { Heatmap } from '../components/Heatmap'
import { t } from '../i18n'

const BAND_COLOR = { solid: palette.far, building: palette.mid, fragile: palette.near } as const

export function Stats({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [errors, setErrors] = useState<ErrorEntry[]>([])

  useEffect(() => {
    void (async () => {
      const [r, c, s, st, e] = await Promise.all([
        getReviews(),
        getCards(),
        getSubjects(),
        getSettings(),
        getErrors(),
      ])
      setReviews(r)
      setCards(c)
      setSubjects(s)
      setSettings(st)
      setErrors(e)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="page center muted">{t('loading')}</div>

  const now = new Date()
  const ts = reviews.map((r) => r.ts)
  const streak = currentStreak(ts, now)
  const last7 = reviewsLast7Days(ts, now)
  const week = reviewsInLastDays(ts, 7, now)
  const learned = cards.filter((c) => c.state !== 'new').length
  const heat = heatmapWeeks(ts, 12, now)
  const forecast = reviewForecast(cards, 14, now)

  const calib = calibration(reviews)
  const verdict = calibrationVerdict(calib)
  const sureAccuracy = accuracy(calib.sure)
  const unsureAccuracy = accuracy(calib.unsure)
  const weak = weakTopics(errors)

  const readinessRows = subjects
    .map((s) => ({
      subject: s,
      readiness: subjectReadiness(
        cards.filter((c) => c.subjectId === s.id),
        s.examDate,
        now,
        settings?.targetRetention,
      ),
    }))
    .filter((r) => r.readiness !== null)

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
      </div>
      <h2 className="page-title">{t('statsTitle')}</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{streak}</div>
          <div className="stat-label">{t('daysInRow', streak)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{week}</div>
          <div className="stat-label">{t('reviewsPer7')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{learned}</div>
          <div className="stat-label">{t('learnedCardsLabel')}</div>
        </div>
      </div>

      <section className="panel-section">
        <h3 className="section-title">{t('last7Days')}</h3>
        <Sparkline data={last7} />
      </section>

      <section className="panel-section">
        <h3 className="section-title">{t('upcoming14')}</h3>
        <p className="muted readiness-note">{t('forecastNote')}</p>
        <Sparkline data={forecast} label={t('forecastSparkLabel')} />
      </section>

      <section className="panel-section">
        <h3 className="section-title">{t('weakTitle')}</h3>
        {weak.length === 0 ? (
          <p className="muted">{t('weakEmpty')}</p>
        ) : (
          <ul className="card-list weak-list">
            {weak.map((w) => (
              <li key={w.topic ?? 'none'} className="card-row weak-row">
                <span className="card-row-front">{t('weakTopic', w.topic ?? t('weakNoTopic'), w.count)}</span>
                {w.hyper > 0 && <span className="row-chip row-chip-draft">{t('confKnow')} ✕ {w.hyper}</span>}
              </li>
            ))}
          </ul>
        )}

        <h3 className="section-title">{t('calibTitle')}</h3>
        {verdict === 'unknown' ? (
          <p className="muted">{t('calibEmpty')}</p>
        ) : (
          <div className="calib-box">
            {sureAccuracy !== null && <p>{t('calibSure', Math.round(sureAccuracy * 100))}</p>}
            {unsureAccuracy !== null && (
              <p className="muted">{t('calibUnsure', Math.round(unsureAccuracy * 100))}</p>
            )}
            <p className={verdict === 'overconfident' ? 'calib-warn' : 'muted'}>
              {verdict === 'overconfident' ? t('calibOverconfident') : t('calibHonest')}
            </p>
          </div>
        )}

        <h3 className="section-title">{t('last12Weeks')}</h3>
        <Heatmap weeks={heat} />
      </section>

      {readinessRows.length > 0 && (
        <section className="panel-section">
          <h3 className="section-title">{t('readinessSection')}</h3>
          <p className="muted readiness-note">{t('readinessNote')}</p>
          <ul className="readiness-list">
            {readinessRows.map(({ subject, readiness }) => {
              const r = readiness!
              return (
                <li key={subject.id} className="readiness-row">
                  <span className="readiness-name">{subject.name}</span>
                  <span className="readiness-bar">
                    <span
                      className="readiness-fill"
                      style={{
                        width: `${r.percent}%`,
                        background: BAND_COLOR[readinessBand(r.percent)],
                      }}
                    />
                  </span>
                  <span
                    className="readiness-value"
                    style={{ color: BAND_COLOR[readinessBand(r.percent)] }}
                  >
                    {r.percent} %
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="muted gentle-note">
        {streak > 0 ? t('statsKeepGoing') : t('statsFreshStart')}
      </p>
    </div>
  )
}
