import { useEffect, type ReactNode } from 'react'
import { t } from '../i18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Minimal in-app modal: dark overlay + panel; Esc or overlay click closes. */
export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="btn btn-ghost btn-small" onClick={onClose} aria-label={t('close')}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
