import type { DayBucket } from '../stats/stats'
import { palette } from '../lib/theme'

interface Props {
  data: DayBucket[]
  label?: string
}

export function Sparkline({ data, label = 'Opakování za posledních 7 dní' }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="sparkline" role="img" aria-label={label}>
      {data.map((d) => (
        <div key={d.key} className="spark-col">
          <div className="spark-track">
            <div
              className="spark-bar"
              style={{
                height: `${d.count === 0 ? 0 : Math.max(8, Math.round((d.count / max) * 100))}%`,
                background: d.isToday ? palette.accent : 'var(--line)',
              }}
              title={`${d.label}: ${d.count}`}
            />
          </div>
          <span className={`spark-label${d.isToday ? ' spark-label-today' : ''}`}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}
