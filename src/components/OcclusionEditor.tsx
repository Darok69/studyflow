import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { OcclusionMask } from '../db/db'
import { isTooSmall, maskAt, rectFromPoints, toRelative, type Point } from '../lib/occlusion'
import { t } from '../i18n'

interface Props {
  image: string
  masks: OcclusionMask[]
  onChange: (masks: OcclusionMask[]) => void
}

/**
 * Draw rectangles over a map with a finger or a mouse, name them, tap to
 * remove. Coordinates stay relative, so a mask drawn on a phone still sits on
 * the right place on a laptop.
 */
export function OcclusionEditor({ image, masks, onChange }: Props) {
  const surface = useRef<HTMLDivElement>(null)
  const [dragFrom, setDragFrom] = useState<Point | null>(null)
  const [dragTo, setDragTo] = useState<Point | null>(null)

  function pointFrom(e: ReactPointerEvent): Point | null {
    const box = surface.current?.getBoundingClientRect()
    if (!box) return null
    return toRelative({ x: e.clientX - box.left, y: e.clientY - box.top }, box)
  }

  function handleDown(e: ReactPointerEvent) {
    const point = pointFrom(e)
    if (!point) return
    // Tapping an existing mask selects it for renaming instead of drawing over.
    if (maskAt(masks, point)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragFrom(point)
    setDragTo(point)
  }

  function handleMove(e: ReactPointerEvent) {
    if (!dragFrom) return
    const point = pointFrom(e)
    if (point) setDragTo(point)
  }

  function handleUp() {
    if (dragFrom && dragTo) {
      const rect = rectFromPoints(dragFrom, dragTo)
      if (!isTooSmall(rect)) {
        onChange([
          ...masks,
          { id: crypto.randomUUID(), shape: 'rect', ...rect, label: '' },
        ])
      }
    }
    setDragFrom(null)
    setDragTo(null)
  }

  const preview = dragFrom && dragTo ? rectFromPoints(dragFrom, dragTo) : null

  return (
    <div className="occlusion-editor">
      <div
        ref={surface}
        className="occlusion occlusion-surface"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <img className="occlusion-image" src={image} alt="" />
        {masks.map((mask, i) => (
          <span
            key={mask.id}
            className="occlusion-mask occlusion-editable"
            style={{
              left: `${mask.x * 100}%`,
              top: `${mask.y * 100}%`,
              width: `${mask.w * 100}%`,
              height: `${mask.h * 100}%`,
            }}
          >
            {mask.label || i + 1}
          </span>
        ))}
        {preview && (
          <span
            className="occlusion-mask occlusion-preview"
            style={{
              left: `${preview.x * 100}%`,
              top: `${preview.y * 100}%`,
              width: `${preview.w * 100}%`,
              height: `${preview.h * 100}%`,
            }}
          />
        )}
      </div>

      <p className="muted occlusion-hint">{t('occlusionHint')}</p>

      <ul className="card-list occlusion-list">
        {masks.map((mask, i) => (
          <li key={mask.id} className="card-row occlusion-row">
            <span className="occlusion-index">{i + 1}</span>
            <input
              className="form-input"
              placeholder={t('occlusionLabelPlaceholder')}
              value={mask.label}
              onChange={(e) =>
                onChange(masks.map((m) => (m.id === mask.id ? { ...m, label: e.target.value } : m)))
              }
            />
            <button
              className="card-tool"
              onClick={() => onChange(masks.filter((m) => m.id !== mask.id))}
              title={t('delete')}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
