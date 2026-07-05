import { useEffect, useState } from 'react'
import { addUser, ApiError, listUsers, removeUser, resetUserCode, type UserRow } from '../lib/api'

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
    void load().catch(() => setError('Nepodařilo se načíst uživatele.'))
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
      if (err instanceof ApiError && err.message === 'exists') setError('Tenhle e-mail už přístup má.')
      else if (err instanceof ApiError && err.message === 'invalid-email') setError('To nevypadá jako e-mail.')
      else setError('Přidání se nepovedlo — zkus to znovu.')
    }
  }

  async function handleReset(user: UserRow) {
    if (!window.confirm(`Vygenerovat nový kód pro ${user.email}? Starý přestane platit a odhlásí se.`)) return
    const { code } = await resetUserCode(user.id)
    setIssued({ email: user.email, code })
  }

  async function handleRemove(user: UserRow) {
    if (!window.confirm(`Odebrat přístup pro ${user.email}? Smaže se i jeho záloha na serveru.`)) return
    await removeUser(user.id)
    await load()
  }

  function copyIssued() {
    if (!issued) return
    void navigator.clipboard
      ?.writeText(`StudyFlow → https://study.dmarka.eu\nE-mail: ${issued.email}\nPřístupový kód: ${issued.code}`)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
  }

  return (
    <section className="panel-section">
      <h3 className="section-title">Přístupy (admin)</h3>
      <p className="muted setting-desc">
        Kdo tu je, může se přihlásit. Nový uživatel dostane přístupový kód — zobrazí se jen jednou,
        pošli mu ho třeba WhatsAppem.
      </p>

      <form className="answer-row" onSubmit={handleAdd}>
        <input
          className="form-input answer-input"
          type="email"
          placeholder="kamarad@email.cz"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Přidat
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {issued && (
        <div className="issued-code">
          <div>
            <strong>{issued.email}</strong>
            <div className="issued-code-value">{issued.code}</div>
            <p className="muted setting-desc">Kód se už znovu nezobrazí — teď ho zkopíruj a pošli.</p>
          </div>
          <div className="leech-actions">
            <button className="btn btn-ghost btn-small" onClick={copyIssued}>
              {copied ? 'Zkopírováno ✓' : 'Zkopírovat zprávu'}
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setIssued(null)}>
              Zavřít
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
                    ? `naposledy ${new Date(u.lastLoginAt).toLocaleDateString('cs-CZ')}`
                    : 'zatím nepřihlášen'}
                </span>
              </span>
            </div>
            <button className="card-tool" onClick={() => void handleReset(u)}>
              Nový kód
            </button>
            {!u.isAdmin && (
              <button className="card-tool" onClick={() => void handleRemove(u)}>
                Odebrat
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
