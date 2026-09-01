import type { CSSProperties } from 'react'
import type { Card } from '../db/db'
import { SvgView } from './SvgView'
import { OcclusionView } from './OcclusionView'

interface Props {
  card: Card
  revealed: boolean
  /** Card-text size multiplier (Settings → Vzhled). */
  fontScale?: number
  /** Sans-serif card face instead of the default serif. */
  sans?: boolean
  /**
   * Steps of a worked example, and how many of them are already handed over.
   * Given only for stepped cards (case, scheme, process) — everything else
   * renders the answer in one piece as before.
   */
  steps?: string[]
  shownSteps?: number
}

export function CardFace({
  card,
  revealed,
  fontScale = 1,
  sans = false,
  steps,
  shownSteps = 0,
}: Props) {
  const style = { '--card-scale': fontScale } as CSSProperties
  return (
    <div className={`paper${sans ? ' paper-sans' : ''}`} style={style}>
      {card.svg && <SvgView svg={card.svg} />}
      {card.occlusion && card.image ? (
        <OcclusionView
          image={card.image}
          occlusion={card.occlusion}
          revealed={revealed}
          alt={card.images?.[0]?.alt ?? card.front}
        />
      ) : (
        card.image && <img className="card-image" src={card.image} alt="" loading="lazy" />
      )}

      <div className="card-front">{card.front}</div>

      {revealed && (
        <>
          <hr className="card-divider" />
          {card.imageBack && (
            <img className="card-image" src={card.imageBack} alt="" loading="lazy" />
          )}
          {steps && steps.length > 1 ? (
            <ol className="card-steps">
              {steps.slice(0, shownSteps).map((step, i) => (
                <li key={i} className="card-step">
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <div className="card-back">{card.back}</div>
          )}
        </>
      )}
    </div>
  )
}
