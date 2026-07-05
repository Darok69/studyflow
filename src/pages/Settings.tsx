import { useEffect, useRef, useState } from 'react'
import type { Settings as AppSettings } from '../db/db'
import { exportBackupJson, getSettings, resetAll, restoreBackup, saveSettings } from '../db/repo'
import { parseBackup } from '../import/backup'
import { getConfig, logout, SERVER_MODE, type Account } from '../lib/api'
import { pushSync, syncMeta } from '../lib/sync'
import { disableReminder, enableReminder, pushSupported, reminderPrefs } from '../lib/push'
import { AdminUsers } from '../components/AdminUsers'

const FONT_SCALES: { value: number; label: string }[] = [
  { value: 0.9, label: 'Menší' },
  { value: 1, label: 'Normální' },
  { value: 1.2, label: 'Větší' },
]

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface ToggleRowProps {
  name: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ name, desc, checked, onChange }: ToggleRowProps) {
  return (
    <section className="setting-row">
      <div className="setting-text">
        <div className="setting-name">{name}</div>
        <p className="muted setting-desc">{desc}</p>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch-slider" aria-hidden="true" />
      </label>
    </section>
  )
}

interface Props {
  onBack: () => void
  onReset: () => void
  account?: Account | null
  onLoggedOut?: () => void
}

export function Settings({ onBack, onReset, account, onLoggedOut }: Props) {
  const [s, setS] = useState<AppSettings | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Server-mode extras: sync status, push reminder prefs.
  const [syncState, setSyncState] = useState(() => syncMeta())
  const [syncBusy, setSyncBusy] = useState(false)
  const [pushAvailable, setPushAvailable] = useState(false)
  const [reminder, setReminder] = useState(() => reminderPrefs())
  const [reminderError, setReminderError] = useState<string | null>(null)

  useEffect(() => {
    void getSettings().then(setS)
    if (SERVER_MODE && pushSupported()) {
      void getConfig()
        .then((c) => setPushAvailable(c.pushEnabled))
        .catch(() => setPushAvailable(false))
    }
  }, [])

  async function handleSyncNow() {
    setSyncBusy(true)
    try {
      await pushSync()
      setSyncState(syncMeta())
    } catch {
      setRestoreError('Synchronizace se nepovedla — zkus to znovu.')
    } finally {
      setSyncBusy(false)
    }
  }

  async function handleLogout() {
    await logout().catch(() => {})
    onLoggedOut?.()
  }

  async function toggleReminder(enabled: boolean) {
    setReminderError(null)
    try {
      if (enabled) {
        await enableReminder(reminder.time, 'cs')
        setReminder({ enabled: true, time: reminder.time })
      } else {
        await disableReminder()
        setReminder({ ...reminder, enabled: false })
      }
    } catch (err) {
      setReminderError(
        (err as Error).message === 'permission-denied'
          ? 'Prohlížeč notifikace zablokoval — povol je v nastavení stránky.'
          : 'Nepodařilo se zapnout připomínky — zkus to znovu.',
      )
    }
  }

  async function changeReminderTime(time: string) {
    setReminder((r) => ({ ...r, time }))
    if (reminder.enabled && /^\d{2}:\d{2}$/.test(time)) {
      await enableReminder(time, 'cs').catch(() => {})
    }
  }

  async function update(patch: Partial<Omit<AppSettings, 'id'>>) {
    if (!s) return
    const next = { ...s, ...patch }
    setS(next)
    await saveSettings(patch)
  }

  async function handleReset() {
    if (!window.confirm('Opravdu smazat všechna data (předměty, karty i historii)?')) return
    await resetAll()
    onReset()
  }

  async function handleExport() {
    download(`studyflow-zaloha-${new Date().toISOString().slice(0, 10)}.json`, await exportBackupJson())
  }

  async function handleRestoreFile(file: File) {
    setRestoreError(null)
    const { backup, error } = parseBackup(await file.text())
    if (!backup) {
      setRestoreError(error)
      return
    }
    const what = `${backup.subjects.length} předmětů, ${backup.cards.length} karet`
    if (!window.confirm(`Nahradit všechna současná data zálohou (${what})?`)) return
    await restoreBackup(backup)
    if (SERVER_MODE) await pushSync().catch(() => {})
    onReset()
  }

  if (!s) return <div className="page center muted">Načítám…</div>

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          ← Zpět
        </button>
      </div>
      <h2 className="page-title">Nastavení</h2>

      {SERVER_MODE && account && (
        <>
          <h3 className="section-title">Účet a synchronizace</h3>
          <section className="setting-row">
            <div className="setting-text">
              <div className="setting-name">{account.email}</div>
              <p className="muted setting-desc">
                {syncState.lastSyncAt
                  ? `Poslední synchronizace: ${new Date(syncState.lastSyncAt).toLocaleString('cs-CZ')}`
                  : 'Zatím nesynchronizováno.'}
                {' '}Data se zálohují na server automaticky — na dalším zařízení se stačí přihlásit.
              </p>
              <div className="button-row" style={{ marginTop: 10 }}>
                <button className="btn btn-ghost btn-small" onClick={() => void handleSyncNow()} disabled={syncBusy}>
                  {syncBusy ? 'Synchronizuji…' : 'Synchronizovat teď'}
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => void handleLogout()}>
                  Odhlásit se
                </button>
              </div>
            </div>
          </section>

          {pushAvailable && (
            <>
              <ToggleRow
                name="Denní připomínka"
                desc="Push notifikace s počtem kartiček, které na tebe ten den čekají. Funguje i při zavřené aplikaci (nainstaluj si ji na plochu)."
                checked={reminder.enabled}
                onChange={(v) => void toggleReminder(v)}
              />
              {reminder.enabled && (
                <div className="cap-row">
                  <span>Čas připomínky</span>
                  <input
                    className="cap-input"
                    type="time"
                    value={reminder.time}
                    onChange={(e) => void changeReminderTime(e.target.value)}
                  />
                </div>
              )}
              {reminderError && <p className="form-error">{reminderError}</p>}
            </>
          )}

          {account.isAdmin && <AdminUsers />}
        </>
      )}

      <h3 className="section-title">Učení</h3>

      <section className="setting-row">
        <div className="setting-text">
          <div className="setting-name">Cílová zapamatovanost</div>
          <p className="muted setting-desc">
            Kolik procent karet chceš mít v hlavě, když přijdou na řadu. Vyšší hodnota = častější
            opakování; 90 % je rozumný standard.
          </p>
          <div className="slider-row">
            <input
              type="range"
              min={80}
              max={95}
              step={1}
              value={Math.round(s.targetRetention * 100)}
              onChange={(e) => update({ targetRetention: Number(e.target.value) / 100 })}
            />
            <span className="slider-value">{Math.round(s.targetRetention * 100)} %</span>
          </div>
        </div>
      </section>

      <ToggleRow
        name="Náhledy intervalů"
        desc="Na tlačítkách hodnocení uvidíš, za jak dlouho se karta vrátí (jako v Anki)."
        checked={s.showIntervalPreviews}
        onChange={(v) => update({ showIntervalPreviews: v })}
      />

      <ToggleRow
        name="Psané odpovědi"
        desc="U krátkých odpovědí nejdřív napíšeš, co si myslíš — aktivní vybavování je nejsilnější forma učení. Překlepy a diakritika se odpouští."
        checked={s.typedAnswers}
        onChange={(v) => update({ typedAnswers: v })}
      />

      <h3 className="section-title">Tempo a pohoda</h3>

      <ToggleRow
        name="Denní strop nových karet"
        desc="Klidnější tempo před zkouškou — nové karty se rozloží do více dní místo jednoho velkého sezení. Opakování se nestropuje."
        checked={s.dailyNewCapEnabled}
        onChange={(v) => update({ dailyNewCapEnabled: v })}
      />

      {s.dailyNewCapEnabled && (
        <div className="cap-row">
          <span>Max. nových karet za den</span>
          <input
            className="cap-input"
            type="number"
            min={1}
            max={200}
            value={s.dailyNewCap}
            onChange={(e) =>
              update({ dailyNewCap: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
        </div>
      )}

      <div className="cap-row">
        <span>Připomenout pauzu po (min)</span>
        <input
          className="cap-input"
          type="number"
          min={10}
          max={90}
          value={s.breakNudgeMinutes}
          onChange={(e) =>
            update({ breakNudgeMinutes: Math.min(90, Math.max(10, Number(e.target.value) || 22)) })
          }
        />
      </div>

      <h3 className="section-title">Vzhled karet</h3>

      <section className="setting-row">
        <div className="setting-text">
          <div className="setting-name">Velikost písma</div>
          <div className="segmented setting-segmented">
            {FONT_SCALES.map((f) => (
              <button
                key={f.value}
                className={`segment${s.cardFontScale === f.value ? ' segment-active' : ''}`}
                onClick={() => update({ cardFontScale: f.value })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ToggleRow
        name="Bezpatkové písmo"
        desc="Karty se standardně zobrazují patkovým (knižním) písmem. Pokud ti sedí víc bezpatkové, přepni."
        checked={s.cardSans}
        onChange={(v) => update({ cardSans: v })}
      />

      <h3 className="section-title">Data</h3>

      <section className="panel-section">
        <p className="muted">
          Vše je uložené jen v tomto prohlížeči (offline). Záloha přenese předměty, karty i celou
          historii učení na jiné zařízení.
        </p>
        {restoreError && <p className="form-error">{restoreError}</p>}
        <div className="button-row">
          <button className="btn btn-ghost" onClick={() => void handleExport()}>
            Stáhnout zálohu
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Obnovit ze zálohy
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleRestoreFile(f)
              e.target.value = ''
            }}
          />
        </div>
        <button className="btn btn-ghost btn-danger" onClick={handleReset}>
          Smazat všechna data
        </button>
      </section>
    </div>
  )
}
