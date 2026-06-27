interface Props {
  value: number
  max: number
  color?: string
}

export function ProgressBar({ value, max, color }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
