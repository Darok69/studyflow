import { useEffect, useState } from 'react'
import { getSettings, resetAll, saveSettings } from '../db/repo'
import { DEFAULT_DAILY_NEW_CAP } from '../lib/wellbeing'

export function Settings({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [cap, setCap] = useState(DEFAULT_DAILY_NEW_CAP)

  useEffect(() => {
    void (async () => {
      const s = await getSettings()
      setEnabled(s.dailyNewCapEnabled)
      setCap(s.dailyNewCap)
      setLoaded(true)
    })()
  }, [])

  async function update(next: { enabled?: boolean; cap?: number }) {
    const e = next.enabled ?? enabled
    const c = next.cap ?? cap
    setEnabled(e)
    setCap(c)
    await saveSettings({ dailyNewCapEnabled: e, dailyNewCap: c })
  }

  async function handleReset() {
    if (!window.confirm('Opravdu smazat všechna data (předměty, karty i historii)?')) return
    await resetAll()
    onReset()
  }

  if (!loaded) return <div className="page center muted">Načítám…</div>

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          ← Zpět
        </button>
      </div>
      <h2 className="page-title">Nastavení</h2>

      <section className="setting-row">
        <div className="setting-text">
          <div className="setting-name">Denní strop nových karet</div>
          <p className="muted setting-desc">
            Klidnější tempo před zkouškou — nové karty se rozloží do více dní místo jednoho velkého
            sezení. Opakování se nestropuje.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span className="switch-slider" aria-hidden="true" />
        </label>
      </section>

      {enabled && (
        <div className="cap-row">
          <span>Max. nových karet za den</span>
          <input
            className="cap-input"
            type="number"
            min={1}
            max={200}
            value={cap}
            onChange={(e) => update({ cap: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </div>
      )}

      <section className="panel-section">
        <h3 className="section-title">Data</h3>
        <p className="muted">Vše je uložené jen v tomto prohlížeči (offline). Nic se nikam neodesílá.</p>
        <button className="btn btn-ghost btn-danger" onClick={handleReset}>
          Smazat všechna data
        </button>
      </section>
    </div>
  )
}
