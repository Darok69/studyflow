import { useEffect, useState } from 'react'
import {
  createPubToken,
  deletePubPack,
  getPubState,
  revokePubToken,
  type PubPack,
  type PubToken,
} from '../lib/api'
import { t } from '../i18n'

/**
 * Propojení s vlastním Claudem: token + příkaz, kterým si ho uživatel připojí.
 *
 * Token se ukazuje jen jednou, hned po vytvoření — server si nechává jen jeho
 * otisk. Proto je tu příkaz k zkopírování rovnou i s tokenem uvnitř: kdo ho
 * nezkopíruje teď, udělá si prostě další.
 */
export function ClaudeLink() {
  const [tokens, setTokens] = useState<PubToken[]>([])
  const [packs, setPacks] = useState<PubPack[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState<'cmd' | 'ask' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPubState()
      .then((s) => {
        setTokens(s.tokens)
        setPacks(s.packs)
      })
      .catch(() => setError(t('claudeLoadFailed')))
  }, [])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const command = fresh
    ? `claude mcp add --transport http studyflow ${origin}/mcp --header "Authorization: Bearer ${fresh}"`
    : ''

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      const res = await createPubToken(new Date().toISOString().slice(0, 10))
      setFresh(res.token)
      setTokens(res.tokens)
    } catch {
      setError(t('claudeTokenFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(t('claudeConfirmRevoke'))) return
    const res = await revokePubToken(id)
    setTokens(res.tokens)
    setFresh(null)
  }

  async function handleDeletePack(pack: PubPack) {
    if (!window.confirm(t('claudeConfirmDeletePack', pack.subject))) return
    const res = await deletePubPack(pack.slug)
    setPacks(res.packs)
  }

  function copy(text: string, which: 'cmd' | 'ask') {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(which)
      window.setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <section className="panel-section">
      <h3 className="section-title">{t('claudeSection')}</h3>
      <p className="muted setting-desc">{t('claudeDesc')}</p>

      {error && <p className="form-error">{error}</p>}

      {fresh ? (
        <div className="issued-code">
          <div>
            <div className="setting-name">{t('claudeStep1')}</div>
            <code className="claude-cmd">{command}</code>
            <p className="muted setting-desc">{t('claudeShownOnce')}</p>
          </div>
          <div className="leech-actions">
            <button className="btn btn-primary btn-small" onClick={() => copy(command, 'cmd')}>
              {copied === 'cmd' ? t('copied') : t('claudeCopyCommand')}
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setFresh(null)}>
              {t('close')}
            </button>
          </div>
        </div>
      ) : (
        <div className="cap-row">
          <button className="btn btn-primary" onClick={() => void handleCreate()} disabled={busy}>
            {t('claudeNewToken')}
          </button>
        </div>
      )}

      <div className="setting-text">
        <div className="setting-name">{t('claudeStep2')}</div>
        <p className="muted setting-desc">{t('claudeAsk')}</p>
        <button className="btn btn-ghost btn-small" onClick={() => copy(t('claudeAsk'), 'ask')}>
          {copied === 'ask' ? t('copied') : t('claudeCopyAsk')}
        </button>
      </div>

      {tokens.length > 0 && (
        <ul className="card-list">
          {tokens.map((tok) => (
            <li key={tok.id} className="card-row">
              <div className="card-row-main">
                <span className="card-row-front">{t('claudeTokenName', tok.label || tok.id)}</span>
                <span className="card-row-meta">
                  <span className="row-chip">
                    {tok.lastUsedAt
                      ? t('claudeTokenUsed', new Date(tok.lastUsedAt).toLocaleDateString(t('locale')))
                      : t('claudeTokenUnused')}
                  </span>
                </span>
              </div>
              <span className="card-tools">
                <button className="card-tool" onClick={() => void handleRevoke(tok.id)}>
                  {t('claudeRevoke')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {packs.length > 0 && (
        <>
          <div className="setting-name">{t('claudeMyPacks')}</div>
          <ul className="card-list">
            {packs.map((pack) => (
              <li key={pack.slug} className="card-row">
                <div className="card-row-main">
                  <span className="card-row-front">{pack.subject}</span>
                  <span className="card-row-meta">
                    <span className="row-chip">{t('claudePackCounts', pack.lectures, pack.cards)}</span>
                  </span>
                </div>
                <span className="card-tools">
                  <button className="card-tool" onClick={() => void handleDeletePack(pack)}>
                    {t('delete')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
