import { useEffect, useRef, useState } from 'react'
import type { Settings as AppSettings } from '../db/db'
import { exportBackupJson, getSettings, resetAll, restoreBackup, saveSettings } from '../db/repo'
import { parseBackup } from '../import/backup'
import { getConfig, logout, sendTestPush, SERVER_MODE, type Account } from '../lib/api'
import { pushSync, syncMeta } from '../lib/sync'
import { disableReminder, enableReminder, pushSupported, reminderPrefs } from '../lib/push'
import { AdminUsers } from '../components/AdminUsers'
import { currentLang, setLang, t, type Lang, type MsgKey } from '../i18n'

const FONT_SCALES: { value: number; labelKey: MsgKey }[] = [
  { value: 0.9, labelKey: 'fontSmaller' },
  { value: 1, labelKey: 'fontNormal' },
  { value: 1.2, labelKey: 'fontLarger' },
]

// Language names stay in their own language on purpose.
const LANGS: { value: Lang; label: string }[] = [
  { value: 'cs', label: 'Čeština' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
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
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

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
      setRestoreError(t('syncFailed'))
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
        await enableReminder(reminder.time, currentLang())
        setReminder({ enabled: true, time: reminder.time })
      } else {
        await disableReminder()
        setReminder({ ...reminder, enabled: false })
      }
    } catch (err) {
      setReminderError(
        (err as Error).message === 'permission-denied' ? t('reminderBlocked') : t('reminderFailed'),
      )
    }
  }

  async function handleTestPush() {
    setTestState('sending')
    try {
      await sendTestPush()
      setTestState('sent')
    } catch {
      setTestState('failed')
    }
    window.setTimeout(() => setTestState('idle'), 6000)
  }

  async function changeReminderTime(time: string) {
    setReminder((r) => ({ ...r, time }))
    if (reminder.enabled && /^\d{2}:\d{2}$/.test(time)) {
      await enableReminder(time, currentLang()).catch(() => {})
    }
  }

  async function update(patch: Partial<Omit<AppSettings, 'id'>>) {
    if (!s) return
    const next = { ...s, ...patch }
    setS(next)
    await saveSettings(patch)
  }

  async function handleReset() {
    if (!window.confirm(t('confirmDeleteAll'))) return
    await resetAll()
    onReset()
  }

  async function handleExport() {
    download(t('backupFileName', new Date().toISOString().slice(0, 10)), await exportBackupJson())
  }

  async function handleRestoreFile(file: File) {
    setRestoreError(null)
    const { backup, error } = parseBackup(await file.text())
    if (!backup) {
      setRestoreError(error)
      return
    }
    if (!window.confirm(t('confirmRestore', backup.subjects.length, backup.cards.length))) return
    await restoreBackup(backup)
    if (SERVER_MODE) await pushSync().catch(() => {})
    onReset()
  }

  if (!s) return <div className="page center muted">{t('loading')}</div>

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
      </div>
      <h2 className="page-title">{t('navSettings')}</h2>

      {SERVER_MODE && account && (
        <>
          <h3 className="section-title">{t('sectionAccount')}</h3>
          <section className="setting-row">
            <div className="setting-text">
              <div className="setting-name">{account.email}</div>
              <p className="muted setting-desc">
                {syncState.lastSyncAt
                  ? t('lastSyncAt', new Date(syncState.lastSyncAt).toLocaleString(t('locale')))
                  : t('notSyncedYet')}
                {' '}{t('syncAutoNote')}
              </p>
              <div className="button-row" style={{ marginTop: 10 }}>
                <button className="btn btn-ghost btn-small" onClick={() => void handleSyncNow()} disabled={syncBusy}>
                  {syncBusy ? t('syncing') : t('syncNow')}
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => void handleLogout()}>
                  {t('logout')}
                </button>
              </div>
            </div>
          </section>

          {pushAvailable && (
            <>
              <ToggleRow
                name={t('reminderName')}
                desc={`${t('reminderDesc')} ${t('reminderConfirmNote')}`}
                checked={reminder.enabled}
                onChange={(v) => void toggleReminder(v)}
              />
              {reminder.enabled && (
                <>
                  <div className="cap-row">
                    <span>{t('reminderTimeLabel')}</span>
                    <input
                      className="cap-input"
                      type="time"
                      value={reminder.time}
                      onChange={(e) => void changeReminderTime(e.target.value)}
                    />
                  </div>
                  <div className="cap-row">
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => void handleTestPush()}
                      disabled={testState === 'sending'}
                    >
                      {testState === 'sending' ? t('pushTestSending') : t('pushTestBtn')}
                    </button>
                    {testState === 'sent' && <span className="muted">{t('pushTestSent')}</span>}
                  </div>
                  {testState === 'failed' && <p className="form-error">{t('pushTestFailed')}</p>}
                </>
              )}
              {reminderError && <p className="form-error">{reminderError}</p>}
            </>
          )}

          {!pushSupported() && (
            <section className="setting-row">
              <div className="setting-text">
                <div className="setting-name">{t('reminderName')}</div>
                <p className="muted setting-desc">{t('pushInstallHint')}</p>
              </div>
            </section>
          )}

          {account.isAdmin && <AdminUsers />}
        </>
      )}

      <h3 className="section-title">{t('sectionLearning')}</h3>

      <section className="setting-row">
        <div className="setting-text">
          <div className="setting-name">{t('retentionName')}</div>
          <p className="muted setting-desc">{t('retentionDesc')}</p>
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
        name={t('previewsName')}
        desc={t('previewsDesc')}
        checked={s.showIntervalPreviews}
        onChange={(v) => update({ showIntervalPreviews: v })}
      />

      <ToggleRow
        name={t('typedName')}
        desc={t('typedDesc')}
        checked={s.typedAnswers}
        onChange={(v) => update({ typedAnswers: v })}
      />

      <h3 className="section-title">{t('sectionPace')}</h3>

      <ToggleRow
        name={t('capName')}
        desc={t('capDesc')}
        checked={s.dailyNewCapEnabled}
        onChange={(v) => update({ dailyNewCapEnabled: v })}
      />

      {s.dailyNewCapEnabled && (
        <div className="cap-row">
          <span>{t('capMaxLabel')}</span>
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
        <span>{t('breakAfterLabel')}</span>
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

      <h3 className="section-title">{t('sectionAppearance')}</h3>

      <section className="setting-row">
        <div className="setting-text">
          <div className="setting-name">{t('fontSizeName')}</div>
          <div className="segmented setting-segmented">
            {FONT_SCALES.map((f) => (
              <button
                key={f.value}
                className={`segment${s.cardFontScale === f.value ? ' segment-active' : ''}`}
                onClick={() => update({ cardFontScale: f.value })}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ToggleRow
        name={t('sansName')}
        desc={t('sansDesc')}
        checked={s.cardSans}
        onChange={(v) => update({ cardSans: v })}
      />

      <h3 className="section-title">{t('sectionLanguage')}</h3>

      <section className="setting-row">
        <div className="setting-text">
          <div className="segmented setting-segmented">
            {LANGS.map((l) => (
              <button
                key={l.value}
                className={`segment${currentLang() === l.value ? ' segment-active' : ''}`}
                onClick={() => setLang(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <h3 className="section-title">{t('sectionData')}</h3>

      <section className="panel-section">
        <p className="muted">{t('dataDesc')}</p>
        {restoreError && <p className="form-error">{restoreError}</p>}
        <div className="button-row">
          <button className="btn btn-ghost" onClick={() => void handleExport()}>
            {t('downloadBackup')}
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            {t('restoreFromBackup')}
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
          {t('deleteAllData')}
        </button>
      </section>
    </div>
  )
}
