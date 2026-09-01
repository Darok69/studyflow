import { useState } from 'react'
import type { OcclusionMask, Subject } from '../db/db'
import { addCards } from '../db/repo'
import { fileToCardPhoto } from '../lib/image'
import { occlusionCards } from '../lib/occlusion'
import { OcclusionEditor } from './OcclusionEditor'
import { Modal } from './Modal'
import { t } from '../i18n'

interface Props {
  subjects: Subject[]
  defaultSubjectId?: string
  onCreated: (subjectId: string, count: number) => void
  onClose: () => void
}

/** The card's own picture — masks are stored against this sentinel key. */
const IMAGE_KEY = 'card.image'

/**
 * A map in, a deck out: pick the picture, cover the places, name them. One card
 * per name, all sharing the same map. No model involved at any point.
 */
export function NewMapModal({ subjects, defaultSubjectId, onCreated, onClose }: Props) {
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? '')
  const [image, setImage] = useState<string | null>(null)
  const [masks, setMasks] = useState<OcclusionMask[]>([])
  const [alt, setAlt] = useState('')
  const [mode, setMode] = useState<'hide-one-guess-one' | 'hide-all-guess-one'>('hide-one-guess-one')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePick(file: File) {
    setError(null)
    try {
      setImage(await fileToCardPhoto(file))
    } catch (e) {
      setError((e as Error).message === 'too-big' ? t('photoTooBig') : t('photoUnreadable'))
    }
  }

  const labelled = masks.filter((m) => m.label.trim()).length

  async function handleSave() {
    if (!image || labelled === 0) {
      setError(t('occlusionNeedLabels'))
      return
    }
    setBusy(true)
    const drafts = occlusionCards({ masks, mode, imageKey: IMAGE_KEY, alt }).map((card) => ({
      ...card,
      image,
    }))
    const count = await addCards(subjectId, drafts)
    setBusy(false)
    onCreated(subjectId, count)
  }

  return (
    <Modal title={t('occlusionTitle')} onClose={onClose}>
      {subjects.length > 1 && (
        <label className="form-label">
          <span>{t('sourcesDeckLabel')}</span>
          <select
            className="form-input"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!image ? (
        <label className="btn btn-primary">
          {t('occlusionPick')}
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handlePick(file)
            }}
          />
        </label>
      ) : (
        <>
          <label className="form-label">
            <span>{t('occlusionAltLabel')}</span>
            <input
              className="form-input"
              placeholder={t('occlusionAltPlaceholder')}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
          </label>

          <OcclusionEditor image={image} masks={masks} onChange={setMasks} />

          <div className="setting-text">
            <div className="setting-name">{t('occlusionModeLabel')}</div>
            <div className="segmented setting-segmented">
              <button
                className={`segment${mode === 'hide-one-guess-one' ? ' segment-active' : ''}`}
                onClick={() => setMode('hide-one-guess-one')}
              >
                {t('occlusionModeOne')}
              </button>
              <button
                className={`segment${mode === 'hide-all-guess-one' ? ' segment-active' : ''}`}
                onClick={() => setMode('hide-all-guess-one')}
              >
                {t('occlusionModeAll')}
              </button>
            </div>
            <p className="muted setting-desc">
              {mode === 'hide-one-guess-one' ? t('occlusionModeOneDesc') : t('occlusionModeAllDesc')}
            </p>
          </div>
        </>
      )}

      {error && (
        <ul className="error-list">
          <li>{error}</li>
        </ul>
      )}

      <div className="button-row">
        <button
          className="btn btn-primary"
          disabled={busy || !image || labelled === 0}
          onClick={() => void handleSave()}
        >
          {t('occlusionSave', labelled)}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
    </Modal>
  )
}
