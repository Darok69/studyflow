import type { RatingName } from '../db/db'
import { t, type MsgKey } from '../i18n'

const RATINGS: { rating: RatingName; labelKey: MsgKey; key: string; className: string }[] = [
  { rating: 'again', labelKey: 'rateAgain', key: '1', className: 'rate-again' },
  { rating: 'hard', labelKey: 'rateHard', key: '2', className: 'rate-hard' },
  { rating: 'good', labelKey: 'rateGood', key: '3', className: 'rate-good' },
  { rating: 'easy', labelKey: 'rateEasy', key: '4', className: 'rate-easy' },
]

interface Props {
  onRate: (r: RatingName) => void
  /** Anki-style interval hints (calendar days each rating would schedule). */
  previews?: Record<RatingName, number> | null
}

export function RatingButtons({ onRate, previews }: Props) {
  return (
    <div className="rating-row">
      {RATINGS.map((r) => (
        <button key={r.rating} className={`rate-btn ${r.className}`} onClick={() => onRate(r.rating)}>
          <span className="rate-label">{t(r.labelKey)}</span>
          {previews ? (
            <span className="rate-interval">{t('intervalShort', previews[r.rating])}</span>
          ) : (
            <span className="rate-key">{r.key}</span>
          )}
        </button>
      ))}
    </div>
  )
}
