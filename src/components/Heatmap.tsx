import type { HeatCell } from '../stats/stats'
import { t } from '../i18n'

// Row labels (Mon..Sun, every other one) as Date.getDay() indices; null = blank.
const DAY_ROWS: (number | null)[] = [1, null, 3, null, 5, null, 0]

/** GitHub-style review-activity grid (columns = weeks, rows = Mon..Sun). */
export function Heatmap({ weeks }: { weeks: HeatCell[][] }) {
  return (
    <div className="heatmap" role="img" aria-label={t('heatmapLabel')}>
      <div className="heatmap-days" aria-hidden="true">
        {DAY_ROWS.map((d, i) => (
          <span key={i} className="heatmap-day-label">
            {d === null ? '' : t('weekdayShort', d)}
          </span>
        ))}
      </div>
      <div className="heatmap-grid">
        {weeks.map((col, w) => (
          <div key={w} className="heatmap-col">
            {col.map((cell) => (
              <span
                key={cell.key}
                className={`heat-cell${cell.future ? ' heat-future' : ` heat-${cell.level}`}`}
                title={cell.future ? undefined : `${cell.key}: ${cell.count}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
