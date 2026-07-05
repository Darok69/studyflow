import { useEffect, useState } from 'react'
import type { Card, Review, Settings, Subject } from '../db/db'
import { getCards, getReviews, getSettings, getSubjects } from '../db/repo'
import { currentStreak, heatmapWeeks, reviewsInLastDays, reviewsLast7Days } from '../stats/stats'
import { readinessBand, subjectReadiness } from '../lib/readiness'
import { palette } from '../lib/theme'
import { Sparkline } from '../components/Sparkline'
import { Heatmap } from '../components/Heatmap'

const BAND_COLOR = { solid: palette.far, building: palette.mid, fragile: palette.near } as const

export function Stats({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void (async () => {
      const [r, c, s, st] = await Promise.all([getReviews(), getCards(), getSubjects(), getSettings()])
      setReviews(r)
      setCards(c)
      setSubjects(s)
      setSettings(st)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="page center muted">Načítám…</div>

  const now = new Date()
  const ts = reviews.map((r) => r.ts)
  const streak = currentStreak(ts, now)
  const last7 = reviewsLast7Days(ts, now)
  const week = reviewsInLastDays(ts, 7, now)
  const learned = cards.filter((c) => c.state !== 'new').length
  const heat = heatmapWeeks(ts, 12, now)

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
          ← Zpět
        </button>
      </div>
      <h2 className="page-title">Tvůj pokrok</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{streak}</div>
          <div className="stat-label">{streak === 1 ? 'den v řadě' : 'dní v řadě'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{week}</div>
          <div className="stat-label">opakování / 7 dní</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{learned}</div>
          <div className="stat-label">naučených karet</div>
        </div>
      </div>

      <section className="panel-section">
        <h3 className="section-title">Posledních 7 dní</h3>
        <Sparkline data={last7} />
      </section>

      <section className="panel-section">
        <h3 className="section-title">Posledních 12 týdnů</h3>
        <Heatmap weeks={heat} />
      </section>

      {readinessRows.length > 0 && (
        <section className="panel-section">
          <h3 className="section-title">Připravenost ke zkoušce</h3>
          <p className="muted readiness-note">
            Odhad z křivky zapomínání (FSRS): kolik si toho budeš pamatovat v den zkoušky, kdyby ses
            ode dneška už neučil. Roste s každým opakováním.
          </p>
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
        {streak > 0
          ? 'Konzistence je víc než výkon. Hezky pokračuj. 🌿'
          : 'Každý den je nový začátek — klidně se vrať dnes. 🌱'}
      </p>
    </div>
  )
}
