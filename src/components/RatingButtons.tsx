import type { RatingName } from '../db/db'

const RATINGS: { rating: RatingName; label: string; key: string; className: string }[] = [
  { rating: 'again', label: 'Znovu', key: '1', className: 'rate-again' },
  { rating: 'hard', label: 'Těžké', key: '2', className: 'rate-hard' },
  { rating: 'good', label: 'Dobré', key: '3', className: 'rate-good' },
  { rating: 'easy', label: 'Snadné', key: '4', className: 'rate-easy' },
]

export function RatingButtons({ onRate }: { onRate: (r: RatingName) => void }) {
  return (
    <div className="rating-row">
      {RATINGS.map((r) => (
        <button key={r.rating} className={`rate-btn ${r.className}`} onClick={() => onRate(r.rating)}>
          <span className="rate-label">{r.label}</span>
          <span className="rate-key">{r.key}</span>
        </button>
      ))}
    </div>
  )
}
