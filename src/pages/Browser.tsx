import { useEffect, useMemo, useState } from 'react'
import type { Card, Subject } from '../db/db'
import { getCards, getSubjects, setCardSuspended, unburyCard } from '../db/repo'
import { countdownLabel, dayKey, daysUntilDate } from '../lib/date'
import { isLeech } from '../lib/wellbeing'
import { subjectColor, subjectColorIndex } from '../lib/theme'
import { CardEditor } from '../components/CardEditor'
import { t, type MsgKey } from '../i18n'

type StateFilter = 'all' | 'new' | 'learning' | 'suspended' | 'leech'

const STATE_FILTERS: { value: StateFilter; labelKey: MsgKey }[] = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'new', labelKey: 'filterNew' },
  { value: 'learning', labelKey: 'filterLearning' },
  { value: 'suspended', labelKey: 'filterSuspended' },
  { value: 'leech', labelKey: 'filterLeech' },
]

export function Browser({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [editing, setEditing] = useState<Card | 'new' | null>(null)

  async function load() {
    const [s, c] = await Promise.all([getSubjects(), getCards()])
    setSubjects(s)
    setCards(c)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter((c) => {
      if (subjectFilter !== 'all' && c.subjectId !== subjectFilter) return false
      switch (stateFilter) {
        case 'new':
          if (c.state !== 'new' || c.suspended) return false
          break
        case 'learning':
          if (c.state === 'new' || c.suspended) return false
          break
        case 'suspended':
          if (!c.suspended) return false
          break
        case 'leech':
          if (!isLeech(c)) return false
          break
      }
      if (!q) return true
      const hay = `${c.front}\n${c.back}\n${c.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [cards, search, subjectFilter, stateFilter])

  async function toggleSuspend(card: Card) {
    await setCardSuspended(card.id, !card.suspended)
    await load()
  }

  async function handleUnbury(card: Card) {
    await unburyCard(card.id)
    await load()
  }

  const todayKey = dayKey(new Date())
  const isBuried = (c: Card) => !!c.buriedUntil && c.buriedUntil >= todayKey

  if (loading) return <div className="page center muted">{t('loading')}</div>

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          {t('back')}
        </button>
        <span className="flex-spacer" />
        <button
          className="btn btn-primary btn-small"
          onClick={() => setEditing('new')}
          disabled={subjects.length === 0}
        >
          {t('newCardBtn')}
        </button>
      </div>
      <h2 className="page-title">{t('navCards')}</h2>

      <div className="browser-filters">
        <input
          className="form-input browser-search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input browser-select"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">{t('allSubjects')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="segmented browser-states">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`segment${stateFilter === f.value ? ' segment-active' : ''}`}
            onClick={() => setStateFilter(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <p className="muted browser-count">{t('cardsCount', filtered.length)}</p>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji">🔍</p>
          <p className="muted">{t('noCardMatches')}</p>
        </div>
      ) : (
        <ul className="card-list">
          {filtered.map((c) => {
            const subj = subjectById.get(c.subjectId)
            const identity = subj
              ? subjectColor(subj.colorIndex ?? subjectColorIndex(subj.id))
              : 'var(--line)'
            const dueDays = c.state === 'new' ? null : daysUntilDate(new Date(c.due))
            return (
              <li key={c.id} className="card-row">
                <span className="subject-dot" style={{ background: identity }} aria-hidden="true" />
                <button className="card-row-main" onClick={() => setEditing(c)} title={t('editCardTitle')}>
                  <span className="card-row-front">{c.front}</span>
                  <span className="card-row-meta">
                    {c.suspended ? (
                      <span className="row-chip row-chip-suspended">{t('chipSuspended')}</span>
                    ) : c.state === 'new' ? (
                      <span className="row-chip row-chip-new">{t('typeNew')}</span>
                    ) : (
                      <span className="row-chip">{countdownLabel(dueDays)}</span>
                    )}
                    {isBuried(c) && !c.suspended && (
                      <span className="row-chip row-chip-suspended">{t('chipBuried')}</span>
                    )}
                    {isLeech(c) && <span className="row-chip row-chip-leech">{t('chipLeech')}</span>}
                    {c.tags.map((t) => (
                      <span key={t} className="row-chip row-chip-tag">
                        {t}
                      </span>
                    ))}
                  </span>
                </button>
                {isBuried(c) && !c.suspended && (
                  <button
                    className="card-tool"
                    onClick={() => void handleUnbury(c)}
                    title={t('unburyTitle')}
                  >
                    {t('unburyBtn')}
                  </button>
                )}
                <button
                  className="card-tool"
                  onClick={() => void toggleSuspend(c)}
                  title={c.suspended ? t('resumeTitle') : t('suspendTitleShort')}
                >
                  {c.suspended ? t('resumeBtn') : t('suspendBtn')}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <CardEditor
          subjects={subjects}
          card={editing === 'new' ? null : editing}
          defaultSubjectId={subjectFilter !== 'all' ? subjectFilter : undefined}
          onSaved={() => void load()}
          onDeleted={() => void load()}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
