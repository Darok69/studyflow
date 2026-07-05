import { useState } from 'react'
import type { Card, CardType, Subject } from '../db/db'
import { addCard, deleteCard, updateCard } from '../db/repo'
import { hasCloze, makeCloze } from '../import/parseDeck'
import { Modal } from './Modal'

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

export function CardEditor({ subjects, card, defaultSubjectId, onSaved, onDeleted, onClose }: Props) {
  const [type, setType] = useState<CardType>(card?.type ?? 'basic')
  const [subjectId, setSubjectId] = useState(card?.subjectId ?? defaultSubjectId ?? subjects[0]?.id ?? '')
  const [front, setFront] = useState(card?.type === 'basic' ? card.front : '')
  const [back, setBack] = useState(card?.type === 'basic' ? card.back : '')
  const [clozeText, setClozeText] = useState(card?.type === 'cloze' ? (card.raw ?? '') : '')
  const [tags, setTags] = useState(card?.tags.join(', ') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    setError(null)

    if (!subjectId) {
      setError('Vyber předmět.')
      return
    }

    let content: Pick<Card, 'type' | 'front' | 'back' | 'raw'>
    if (type === 'cloze') {
      if (!hasCloze(clozeText)) {
        setError('Doplňovačka musí obsahovat alespoň jedno {{vynechané slovo}}.')
        return
      }
      content = { type, ...makeCloze(clozeText) }
    } else {
      if (!front.trim() || !back.trim()) {
        setError('Základní karta musí mít otázku i odpověď.')
        return
      }
      content = { type, front: front.trim(), back: back.trim(), raw: undefined }
    }

    setBusy(true)
    const patch = { ...content, tags: parseTags(tags), subjectId }
    if (card) {
      const updated = await updateCard(card.id, patch)
      if (updated) onSaved(updated)
    } else {
      const created = await addCard(subjectId, { ...content, tags: parseTags(tags) })
      onSaved(created)
    }
    setBusy(false)
    onClose()
  }

  async function handleDelete() {
    if (!card) return
    if (!window.confirm('Smazat tuhle kartu i s její historií?')) return
    await deleteCard(card.id)
    onDeleted?.(card.id)
    onClose()
  }

  return (
    <Modal title={card ? 'Upravit kartu' : 'Nová karta'} onClose={onClose}>
      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">Předmět</span>
          <select className="form-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-field">
          <span className="form-label">Typ karty</span>
          <div className="segmented">
            <button
              className={`segment${type === 'basic' ? ' segment-active' : ''}`}
              onClick={() => setType('basic')}
            >
              Základní
            </button>
            <button
              className={`segment${type === 'cloze' ? ' segment-active' : ''}`}
              onClick={() => setType('cloze')}
            >
              Doplňovačka
            </button>
          </div>
        </div>

        {type === 'basic' ? (
          <>
            <label className="form-field">
              <span className="form-label">Přední strana (otázka)</span>
              <textarea
                className="form-input form-textarea"
                value={front}
                onChange={(e) => setFront(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Zadní strana (odpověď)</span>
              <textarea
                className="form-input form-textarea"
                value={back}
                onChange={(e) => setBack(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label className="form-field">
            <span className="form-label">
              Text s {'{{vynechanými}}'} slovy — každé {'{{...}}'} se stane doplňovačkou
            </span>
            <textarea
              className="form-input form-textarea"
              placeholder="Dvanáct desek pochází z roku {{451 př. n. l.}}."
              value={clozeText}
              onChange={(e) => setClozeText(e.target.value)}
            />
          </label>
        )}

        <label className="form-field">
          <span className="form-label">Štítky (oddělené čárkou)</span>
          <input className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="button-row modal-actions">
          {card && (
            <button className="btn btn-ghost btn-danger" onClick={handleDelete}>
              Smazat
            </button>
          )}
          <span className="flex-spacer" />
          <button className="btn btn-ghost" onClick={onClose}>
            Zrušit
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
