import type { CSSProperties } from 'react'
import type { Card } from '../db/db'
import { SvgView } from './SvgView'

interface Props {
  card: Card
  revealed: boolean
  /** Card-text size multiplier (Settings → Vzhled). */
  fontScale?: number
  /** Sans-serif card face instead of the default serif. */
  sans?: boolean
}

export function CardFace({ card, revealed, fontScale = 1, sans = false }: Props) {
  const style = { '--card-scale': fontScale } as CSSProperties
  return (
    <div className={`paper${sans ? ' paper-sans' : ''}`} style={style}>
      {card.svg && <SvgView svg={card.svg} />}
      {card.image && <img className="card-image" src={card.image} alt="" loading="lazy" />}

      <div className="card-front">{card.front}</div>

      {revealed && (
        <>
          <hr className="card-divider" />
          {card.imageBack && (
            <img className="card-image" src={card.imageBack} alt="" loading="lazy" />
          )}
          <div className="card-back">{card.back}</div>
        </>
      )}
    </div>
  )
}
