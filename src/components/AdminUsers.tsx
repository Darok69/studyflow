import { useEffect, useState } from 'react'
import { addUser, ApiError, listUsers, removeUser, resetUserCode, type UserRow } from '../lib/api'
import { t } from '../i18n'

/** Admin-only: manage who can log in. Codes are shown exactly once. */
export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [email, setEmail] = useState('')
  const [issued, setIssued] = useState<{ email: string; code: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    setUsers(await listUsers())
  }

  useEffect(() => {
    void load().catch(() => setError(t('loadUsersFailed')))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const created = await addUser(email)
      setIssued({ email: created.email, code: created.code })
      setEmail('')
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.message === 'exists') setError(t('emailExists'))
      else if (err instanceof ApiError && err.message === 'invalid-email') setError(t('invalidEmail'))
      else setError(t('addFailed'))
    }
  }

  async function handleReset(user: UserRow) {
    if (!window.confirm(t('confirmNewCode', user.email))) return
    const { code } = await resetUserCode(user.id)
    setIssued({ email: user.email, code })
  }

  async function handleRemove(user: UserRow) {
    if (!window.confirm(t('confirmRemoveUser', user.email))) return
    await removeUser(user.id)
    await load()
  }

  function copyIssued() {
    if (!issued) return
    void navigator.clipboard
      ?.writeText(t('issuedMessage', issued.email, issued.code))
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
  }

  return (
    <section className="panel-section">
      <h3 className="section-title">{t('adminSection')}</h3>
      <p className="muted setting-desc">{t('adminDesc')}</p>

      <form className="answer-row" onSubmit={handleAdd}>
        <input
          className="form-input answer-input"
          type="email"
          placeholder={t('adminEmailPlaceholder')}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          {t('addBtn')}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {issued && (
        <div className="issued-code">
          <div>
            <strong>{issued.email}</strong>
            <div className="issued-code-value">{issued.code}</div>
            <p className="muted setting-desc">{t('codeShownOnce')}</p>
          </div>
          <div className="leech-actions">
            <button className="btn btn-ghost btn-small" onClick={copyIssued}>
              {copied ? t('copied') : t('copyMessage')}
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setIssued(null)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      <ul className="card-list">
        {users.map((u) => (
          <li key={u.id} className="card-row">
            <div className="card-row-main">
              <span className="card-row-front">
                {u.email}
                {u.isAdmin && ' 👑'}
              </span>
              <span className="card-row-meta">
                <span className="row-chip">
                  {u.lastLoginAt
                    ? t('lastLoginAt', new Date(u.lastLoginAt).toLocaleDateString(t('locale')))
                    : t('notLoggedInYet')}
                </span>
              </span>
            </div>
            <button className="card-tool" onClick={() => void handleReset(u)}>
              {t('newCodeBtn')}
            </button>
            {!u.isAdmin && (
              <button className="card-tool" onClick={() => void handleRemove(u)}>
                {t('removeBtn')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
