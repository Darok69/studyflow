import { useState } from 'react'
import { ApiError, login, type Account } from '../lib/api'

export function Login({ onLoggedIn }: { onLoggedIn: (account: Account) => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      onLoggedIn(await login(email, code))
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Příliš mnoho pokusů — zkus to za chvíli znovu.')
      } else if (err instanceof ApiError && err.status === 401) {
        setError('E-mail nebo přístupový kód nesedí.')
      } else {
        setError('Nepodařilo se spojit se serverem — zkus to znovu.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page center login-page">
      <div className="login-card">
        <span className="brand-mark login-mark" aria-hidden="true" />
        <h2>Vítej ve StudyFlow</h2>
        <p className="muted">
          Aplikace je jen pro zvané. Přihlas se e-mailem a přístupovým kódem, který jsi dostal.
        </p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-label">E-mail</span>
            <input
              className="form-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-label">Přístupový kód</span>
            <input
              className="form-input login-code"
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-reveal" type="submit" disabled={busy}>
            {busy ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>
      </div>
    </div>
  )
}
