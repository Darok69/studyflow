import { useState } from 'react'
import { ApiError, login, type Account } from '../lib/api'
import { t } from '../i18n'

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
        setError(t('errTooManyAttempts'))
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t('errBadCredentials'))
      } else {
        setError(t('errServer'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page center login-page">
      <div className="login-card">
        <span className="brand-mark login-mark" aria-hidden="true" />
        <h2>{t('welcome')}</h2>
        <p className="login-tagline">{t('introTagline')}</p>
        <ul className="login-intro">
          <li>
            <span className="login-intro-icon" aria-hidden="true">🧠</span>
            {t('introPoint1')}
          </li>
          <li>
            <span className="login-intro-icon" aria-hidden="true">🎯</span>
            {t('introPoint2')}
          </li>
          <li>
            <span className="login-intro-icon" aria-hidden="true">📱</span>
            {t('introPoint3')}
          </li>
        </ul>
        <p className="muted">{t('inviteOnly')}</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-label">{t('emailLabel')}</span>
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
            <span className="form-label">{t('accessCodeLabel')}</span>
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
            {busy ? t('loggingIn') : t('loginBtn')}
          </button>
        </form>
      </div>
    </div>
  )
}
