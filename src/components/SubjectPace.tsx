import { useState } from 'react'
import type { Settings, Subject } from '../db/db'
import { saveSettings, updateSubject } from '../db/repo'
import { t } from '../i18n'

/**
 * Tempo předmětu přímo na jeho stránce: kdy je zkouška a kolik nových karet
 * denně. Ne v dialogu — tohle jsou věci, které se během semestru mění pořád,
 * a schovat je za tlačítko „Upravit“ znamená, že je nikdo nezmění.
 *
 * Nabídnutá čísla nejsou strop, jen zkratka. Kdo chce sto nových denně, napíše
 * si sto: appka má radit, ne zakazovat. Jediné, co tu uživatel může přehlédnout,
 * je SPOLEČNÝ denní strop napříč předměty — ten se proto sám ohlásí, právě když
 * je to on, kdo dávku ořezal.
 */
interface Props {
  subject: Subject
  settings: Settings | null
  /** Kolik nových karet dnes tomuhle předmětu vychází. */
  newToday: number
  /** Co dnes vychází na opakování — jen pro přehled, opakování se nestropuje. */
  dueToday: number
  onChanged: () => void
}

const PRESETS = [10, 20, 40]

export function SubjectPace({
  subject,
  settings,
  newToday,
  dueToday,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(
    subject.dailyNewLimit != null && !PRESETS.includes(subject.dailyNewLimit)
      ? String(subject.dailyNewLimit)
      : '',
  )

  const limit = subject.dailyNewLimit ?? null

  async function setExamDate(value: string) {
    await updateSubject(subject.id, { examDate: value || null })
    onChanged()
  }

  async function setLimit(value: number | null) {
    await updateSubject(subject.id, { dailyNewLimit: value })
    onChanged()
  }

  async function applyCustom() {
    const n = Number(custom.trim())
    if (!Number.isFinite(n) || n < 0) return
    await setLimit(Math.floor(n))
  }

  // Společný strop napříč předměty je jediné, co uživateli může dávku uříznout
  // odjinud, než kde ji nastavuje. Netvrdíme, že uřízl zrovna dnes — na to by
  // tahle stránka musela počítat plán celého dne. Jen se o něm ví.
  const capOn = !!settings?.dailyNewCapEnabled

  async function liftCap() {
    await saveSettings({ dailyNewCapEnabled: false })
    onChanged()
  }

  return (
    <section className="pace-box">
      <button className="pace-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="pace-title">{t('paceTitle')}</span>
        <span className="muted pace-summary">
          {limit == null ? t('paceAuto') : t('paceManual', limit)} ·{' '}
          {t('paceTodayIs', newToday, dueToday)}
        </span>
        <span className="pace-chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="pace-body">
          <label className="form-field">
            <span className="form-label">{t('examDateLabel')}</span>
            <input
              className="form-input"
              type="date"
              value={subject.examDate ?? ''}
              onChange={(e) => void setExamDate(e.target.value)}
            />
          </label>

          <div className="form-field">
            <span className="form-label">{t('paceNewPerDay')}</span>
            <div className="pace-choices">
              <button
                className={`chip${limit == null ? ' chip-on' : ''}`}
                onClick={() => void setLimit(null)}
              >
                {t('paceAutoBtn')}
              </button>
              {PRESETS.map((n) => (
                <button
                  key={n}
                  className={`chip${limit === n ? ' chip-on' : ''}`}
                  onClick={() => void setLimit(n)}
                >
                  {n}
                </button>
              ))}
              <input
                className="form-input pace-custom"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder={t('paceCustom')}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onBlur={() => void applyCustom()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void applyCustom()
                }}
              />
            </div>
            <p className="muted setting-desc">
              {limit == null ? t('paceAutoDesc') : t('paceManualDesc')}
            </p>
          </div>

          {capOn && (
            <p className="pace-note">
              {t('paceCapNote', settings?.dailyNewCap ?? 0)}{' '}
              <button className="link-btn" onClick={() => void liftCap()}>
                {t('paceCapLift')}
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
