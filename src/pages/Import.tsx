import { useState } from 'react'
import { parseDeck } from '../import/parseDeck'
import { importDeck } from '../db/repo'
import { aiPrompt, sampleDeckJson } from '../import/sampleDeck'

interface Props {
  onDone: () => void
  onCancel: () => void
}

export function Import({ onDone, onCancel }: Props) {
  const [text, setText] = useState('')
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
      <h2 className="page-title">Import balíčku</h2>
      <p className="muted">Vlož JSON s kartami, nebo si načti ukázkový balíček.</p>

      <textarea
        className="json-input"
        spellCheck={false}
        placeholder='{ "subject": "...", "examDate": "RRRR-MM-DD", "cards": [ ... ] }'
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
          Načíst ukázkový balíček
        </button>
        <button className="btn btn-primary" onClick={handleImport} disabled={busy || !text.trim()}>
          {busy ? 'Importuji…' : 'Importovat'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Zpět
        </button>
      </div>

      <section className="ai-prompt">
        <div className="ai-prompt-head">
          <h3>Vygeneruj balíček pomocí AI</h3>
          <button className="btn btn-ghost btn-small" onClick={copyPrompt}>
            {copied ? 'Zkopírováno ✓' : 'Zkopírovat'}
          </button>
        </div>
        <p className="muted">
          Zkopíruj prompt do svého oblíbeného AI nástroje, doplň téma a výsledný JSON vlož výše.
        </p>
        <pre className="prompt-box">{aiPrompt}</pre>
      </section>
    </div>
  )
}
