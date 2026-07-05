import type { HeatCell } from '../stats/stats'

const DAY_LABELS = ['po', '', 'st', '', 'pá', '', 'ne']

/** GitHub-style review-activity grid (columns = weeks, rows = Mon..Sun). */
export function Heatmap({ weeks }: { weeks: HeatCell[][] }) {
  return (
    <div className="heatmap" role="img" aria-label="Aktivita opakování v posledních týdnech">
      <div className="heatmap-days" aria-hidden="true">
        {DAY_LABELS.map((l, i) => (
          <span key={i} className="heatmap-day-label">
            {l}
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
