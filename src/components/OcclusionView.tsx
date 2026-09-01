import type { Occlusion } from '../db/db'
import { maskRoles } from '../lib/occlusion'

interface Props {
  image: string
  occlusion: Occlusion
  revealed: boolean
  /** Alt text — an occlusion card is useless to a screen reader without it. */
  alt: string
}

/**
 * A map with its masks. Before the reveal the asked place is covered with a
 * question mark; after it, the label appears in its place — so the answer is
 * literally where the question was.
 */
export function OcclusionView({ image, occlusion, revealed, alt }: Props) {
  const target = occlusion.masks[0]
  const roles = maskRoles(occlusion, target?.id ?? '')

  return (
    <div className="occlusion" role="img" aria-label={revealed ? `${alt}: ${target?.label ?? ''}` : alt}>
      <img className="occlusion-image" src={image} alt="" loading="lazy" />
      {occlusion.masks.map((mask) => {
        const role = roles.get(mask.id)
        if (role === 'context') return null
        const isTarget = role === 'target'
        const style = {
          left: `${mask.x * 100}%`,
          top: `${mask.y * 100}%`,
          width: `${mask.w * 100}%`,
          height: `${mask.h * 100}%`,
        }
        return (
          <span
            key={mask.id}
            className={`occlusion-mask${isTarget ? ' occlusion-target' : ''}${
              isTarget && revealed ? ' occlusion-revealed' : ''
            }`}
            style={style}
          >
            {isTarget ? (revealed ? mask.label : '?') : ''}
          </span>
        )
      })}
    </div>
  )
}
