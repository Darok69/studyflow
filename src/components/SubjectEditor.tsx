import { useState } from 'react'
import type { Subject } from '../db/db'
import { deleteSubject, exportSubjectJson, updateSubject } from '../db/repo'
import { DECK_HASH_PREFIX, encodeDeckPayload, MAX_LINK_LENGTH } from '../lib/sharelink'
import { subjectPalette } from '../lib/theme'
import { Modal } from './Modal'
import { t } from '../i18n'

interface Props {
  subject: Subject
  onSaved: () => void
  onDeleted: () => void
  onClose: () => void
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Filesystem-safe slug for export filenames. */
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'predmet'
  )
}

export function SubjectEditor({ subject, onSaved, onDeleted, onClose }: Props) {
  const [name, setName] = useState(subject.name)
  const [examDate, setExamDate] = useState(subject.examDate ?? '')
  const [reminderTime, setReminderTime] = useState(subject.reminderTime ?? '')
  const [colorIndex, setColorIndex] = useState(subject.colorIndex)
  const [error, setError] = useState<string | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'too-big'>('idle')

  async function handleSave() {
    if (!name.trim()) {
      setError(t('errSubjectNeedsName'))
      return
    }
    await updateSubject(subject.id, {
      name: name.trim(),
      examDate: examDate || null,
      reminderTime: reminderTime || null,
      colorIndex,
    })
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm(t('confirmDeleteSubject', subject.name))) return
    await deleteSubject(subject.id)
    onDeleted()
    onClose()
  }

  async function handleExport() {
    const json = await exportSubjectJson(subject.id)
    if (json) download(`studyflow-${slug(subject.name)}.json`, json)
  }

  /** Copy a #deck= link so a friend can import this subject with one click. */
  async function handleShare() {
    const json = await exportSubjectJson(subject.id)
    if (!json) return
    const link = `${window.location.origin}${window.location.pathname}${DECK_HASH_PREFIX}${await encodeDeckPayload(json)}`
    if (link.length > MAX_LINK_LENGTH) {
      setShareState('too-big')
      return
    }
    await navigator.clipboard?.writeText(link)
    setShareState('copied')
    window.setTimeout(() => setShareState('idle'), 2500)
  }

  return (
    <Modal title={t('editSubjectTitle')} onClose={onClose}>
      <div className="form-grid">
        <label className="form-field">
          <span className="form-label">{t('nameLabel')}</span>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="form-row">
          <label className="form-field">
            <span className="form-label">{t('examDateLabel')}</span>
            <input
              className="form-input"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-label">{t('reminderLabel')}</span>
            <input
              className="form-input"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </label>
        </div>

        <div className="form-field">
          <span className="form-label">{t('subjectColorLabel')}</span>
          <div className="swatch-row" role="radiogroup" aria-label={t('subjectColorLabel')}>
            {subjectPalette.map((hex, i) => (
              <button
                key={hex}
                role="radio"
                aria-checked={i === colorIndex}
                className={`swatch${i === colorIndex ? ' swatch-active' : ''}`}
                style={{ background: hex }}
                onClick={() => setColorIndex(i)}
                aria-label={t('colorN', i + 1)}
              />
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {shareState === 'too-big' && (
          <p className="form-error">{t('shareTooBig')}</p>
        )}

        <div className="button-row modal-actions">
          <button className="btn btn-ghost btn-danger" onClick={handleDelete}>
            {t('delete')}
          </button>
          <button className="btn btn-ghost" onClick={handleExport}>
            {t('exportBtn')}
          </button>
          <button className="btn btn-ghost" onClick={() => void handleShare()}>
            {shareState === 'copied' ? t('linkCopied') : t('shareLink')}
          </button>
          <span className="flex-spacer" />
          <button className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
