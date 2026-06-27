import { useEffect, useState } from 'react'
import type { Card, Review } from '../db/db'
import { getCards, getReviews } from '../db/repo'
import { currentStreak, reviewsInLastDays, reviewsLast7Days } from '../stats/stats'
import { Sparkline } from '../components/Sparkline'

export function Stats({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [cards, setCards] = useState<Card[]>([])

  useEffect(() => {
    void (async () => {
      const [r, c] = await Promise.all([getReviews(), getCards()])
      setReviews(r)
      setCards(c)
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

      <p className="muted gentle-note">
        {streak > 0
          ? 'Konzistence je víc než výkon. Hezky pokračuj. 🌿'
          : 'Každý den je nový začátek — klidně se vrať dnes. 🌱'}
      </p>
    </div>
  )
}
