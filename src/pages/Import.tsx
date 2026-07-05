import { useState } from 'react'
import { parseDeck } from '../import/parseDeck'
import { importDeck } from '../db/repo'
import { aiPrompt, sampleDeckJson } from '../import/sampleDeck'
import { t } from '../i18n'

interface Props {
  onDone: () => void
  onCancel: () => void
  /** Pre-filled deck JSON (e.g. from a shared #deck= link). */
  initialText?: string
  /** True when the pre-fill came from a shared link — shows a friendly banner. */
  shared?: boolean
}

export function Import({ onDone, onCancel, initialText, shared = false }: Props) {
  const [text, setText] = useState(initialText ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleImport() {
    setBusy(true)
    setErrors([])
    const parsed = parseDeck(text)
    if (parsed.errors.length > 0) {
      setErrors(parsed.errors)
      setBusy(false)
      return
    }
    await importDeck(parsed)
    setBusy(false)
    onDone()
  }

  function copyPrompt() {
    void navigator.clipboard?.writeText(aiPrompt).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('importTitle')}</h2>
      {shared ? (
        <div className="guardrail" role="status">
          {t('sharedBanner')}
        </div>
      ) : (
        <p className="muted">{t('pasteHint')}</p>
      )}

      <textarea
        className="json-input"
        spellCheck={false}
        placeholder={t('jsonPlaceholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="button-row">
        <button className="btn btn-ghost" onClick={() => setText(sampleDeckJson)}>
          {t('loadSample')}
        </button>
        <button className="btn btn-primary" onClick={handleImport} disabled={busy || !text.trim()}>
          {busy ? t('importing') : t('importBtn')}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          {t('backPlain')}
        </button>
      </div>

      <section className="ai-prompt">
        <div className="ai-prompt-head">
          <h3>{t('aiHeading')}</h3>
          <button className="btn btn-ghost btn-small" onClick={copyPrompt}>
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
        <p className="muted">{t('aiHint')}</p>
        <pre className="prompt-box">{aiPrompt}</pre>
      </section>
    </div>
  )
}
