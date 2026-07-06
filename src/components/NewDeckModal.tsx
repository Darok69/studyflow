import { useState } from 'react'
import { createSubject } from '../db/repo'
import { Modal } from './Modal'
import { t } from '../i18n'

interface Props {
  /** Called with the fresh deck id — the caller takes the user to add cards. */
  onCreated: (subjectId: string) => void
  onClose: () => void
}

export function NewDeckModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      setError(t('errSubjectNeedsName'))
      return
    }
    setBusy(true)
    const subject = await createSubject({ name, examDate: examDate || null })
    setBusy(false)
    onCreated(subject.id)
  }

  return (
    <Modal title={t('newDeckTitle')} onClose={onClose}>
      <div className="form-grid">
        <p className="muted">{t('newDeckHint')}</p>

        <label className="form-field">
          <span className="form-label">{t('nameLabel')}</span>
          <input
            className="form-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
        </label>

        <label className="form-field">
          <span className="form-label">{t('examDateLabel')}</span>
          <input
            className="form-input"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="button-row modal-actions">
          <span className="flex-spacer" />
          <button className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => void handleCreate()} disabled={busy}>
            {busy ? t('saving') : t('createDeckBtn')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
