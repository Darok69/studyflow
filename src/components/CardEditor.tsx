import { useRef, useState } from 'react'
import type { Card, CardType, Subject } from '../db/db'
import { addCard, deleteCard, updateCard } from '../db/repo'
import { hasCloze, makeCloze } from '../import/parseDeck'
import { fileToCardPhoto } from '../lib/image'
import { Modal } from './Modal'
import { t } from '../i18n'

interface Props {
  subjects: Subject[]
  /** Existing card to edit, or null to create a new one. */
  card: Card | null
  /** Preselected subject for new cards. */
  defaultSubjectId?: string
  onSaved: (card: Card) => void
  onDeleted?: (id: string) => void
  onClose: () => void
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Photo attach/preview/remove for one card side (camera or gallery). */
function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (v?: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File) {
    setError(null)
    setBusy(true)
    try {
      onChange(await fileToCardPhoto(file))
    } catch (err) {
      setError((err as Error).message === 'too-big' ? t('photoTooBig') : t('photoUnreadable'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form-field">
      <span className="form-label">{label}</span>
      {value ? (
        <div className="photo-row">
          <img className="photo-thumb" src={value} alt="" />
          <button className="btn btn-ghost btn-small" onClick={() => onChange(undefined)}>
            {t('removePhoto')}
          </button>
        </div>
      ) : (
        <div>
          <button
            className="btn btn-ghost btn-small"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? t('loading') : t('addPhoto')}
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void pick(f)
          e.target.value = ''
        }}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

export function CardEditor({ subjects, card, defaultSubjectId, onSaved, onDeleted, onClose }: Props) {
  const [type, setType] = useState<CardType>(card?.type ?? 'basic')
  const [subjectId, setSubjectId] = useState(card?.subjectId ?? defaultSubjectId ?? subjects[0]?.id ?? '')
  const [front, setFront] = useState(card?.type === 'basic' ? card.front : '')
  const [back, setBack] = useState(card?.type === 'basic' ? card.back : '')
  const [clozeText, setClozeText] = useState(card?.type === 'cloze' ? (card.raw ?? '') : '')
  const [tags, setTags] = useState(card?.tags.join(', ') ?? '')
  const [image, setImage] = useState<string | undefined>(card?.image)
  const [imageBack, setImageBack] = useState<string | undefined>(card?.imageBack)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    setError(null)

    if (!subjectId) {
      setError(t('errSelectSubject'))
      return
    }

    let content: Pick<Card, 'type' | 'front' | 'back' | 'raw'>
    if (type === 'cloze') {
      if (!hasCloze(clozeText)) {
        setError(t('errClozeNeedsBlank'))
        return
      }
      content = { type, ...makeCloze(clozeText) }
    } else {
      if (!front.trim() || !back.trim()) {
        setError(t('errBasicNeedsBoth'))
        return
      }
      content = { type, front: front.trim(), back: back.trim(), raw: undefined }
    }

    setBusy(true)
    const patch = { ...content, tags: parseTags(tags), subjectId, image, imageBack }
    if (card) {
      const updated = await updateCard(card.id, patch)
      if (updated) onSaved(updated)
    } else {
      const created = await addCard(subjectId, {
        ...content,
        tags: parseTags(tags),
        image,
        imageBack,
      })
      onSaved(created)
    }
    setBusy(false)
    onClose()
  }

  async function handleDelete() {
    if (!card) return
    if (!window.confirm(t('confirmDeleteCard'))) return
    await deleteCard(card.id)
    onDeleted?.(card.id)
    onClose()
  }

  return (
    <Modal title={card ? t('editCardTitle') : t('newCardTitle')} onClose={onClose}>
      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">{t('subjectLabel')}</span>
          <select className="form-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-field">
          <span className="form-label">{t('cardTypeLabel')}</span>
          <div className="segmented">
            <button
              className={`segment${type === 'basic' ? ' segment-active' : ''}`}
              onClick={() => setType('basic')}
            >
              {t('typeBasic')}
            </button>
            <button
              className={`segment${type === 'cloze' ? ' segment-active' : ''}`}
              onClick={() => setType('cloze')}
            >
              {t('typeCloze')}
            </button>
          </div>
        </div>

        {type === 'basic' ? (
          <>
            <label className="form-field">
              <span className="form-label">{t('frontLabel')}</span>
              <textarea
                className="form-input form-textarea"
                value={front}
                onChange={(e) => setFront(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="form-label">{t('backLabel')}</span>
              <textarea
                className="form-input form-textarea"
                value={back}
                onChange={(e) => setBack(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label className="form-field">
            <span className="form-label">{t('clozeFieldLabel')}</span>
            <textarea
              className="form-input form-textarea"
              placeholder={t('clozePlaceholder')}
              value={clozeText}
              onChange={(e) => setClozeText(e.target.value)}
            />
          </label>
        )}

        <div className="form-row">
          <PhotoField label={t('photoFrontLabel')} value={image} onChange={setImage} />
          <PhotoField label={t('photoBackLabel')} value={imageBack} onChange={setImageBack} />
        </div>

        <label className="form-field">
          <span className="form-label">{t('tagsLabel')}</span>
          <input className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="button-row modal-actions">
          {card && (
            <button className="btn btn-ghost btn-danger" onClick={handleDelete}>
              {t('delete')}
            </button>
          )}
          <span className="flex-spacer" />
          <button className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
