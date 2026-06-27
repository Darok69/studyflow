import { useMemo } from 'react'
import { sanitizeSvg } from '../import/sanitizeSvg'

export function SvgView({ svg }: { svg: string }) {
  const safe = useMemo(() => sanitizeSvg(svg), [svg])
  if (!safe) return null
  return <div className="card-svg" dangerouslySetInnerHTML={{ __html: safe }} />
}
