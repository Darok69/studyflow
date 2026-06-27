import type { Card } from '../db/db'
import { SvgView } from './SvgView'

interface Props {
  card: Card
  revealed: boolean
}

export function CardFace({ card, revealed }: Props) {
  return (
    <div className="paper">
      {card.svg && <SvgView svg={card.svg} />}
      {card.image && <img className="card-image" src={card.image} alt="" loading="lazy" />}

      <div className="card-front">{card.front}</div>

      {revealed && (
        <>
          <hr className="card-divider" />
          <div className="card-back">{card.back}</div>
        </>
      )}
    </div>
  )
}
