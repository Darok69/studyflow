import { useEffect, useMemo, useState } from 'react'
import type { Card, Subject } from '../db/db'
import { getCards, getSubjects, setCardSuspended } from '../db/repo'
import { countdownLabel, daysUntilDate } from '../lib/date'
import { isLeech } from '../lib/wellbeing'
import { subjectColor, subjectColorIndex } from '../lib/theme'
import { CardEditor } from '../components/CardEditor'

type StateFilter = 'all' | 'new' | 'learning' | 'suspended' | 'leech'

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'new', label: 'Nové' },
  { value: 'learning', label: 'V učení' },
  { value: 'suspended', label: 'Pozastavené' },
  { value: 'leech', label: 'Problémové' },
]

function czCards(n: number): string {
  if (n === 1) return 'karta'
  if (n >= 2 && n <= 4) return 'karty'
  return 'karet'
}

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

  if (loading) return <div className="page center muted">Načítám…</div>

  return (
    <div className="page">
      <div className="page-nav">
        <button className="btn btn-ghost btn-small" onClick={onBack}>
          ← Zpět
        </button>
        <span className="flex-spacer" />
        <button
          className="btn btn-primary btn-small"
          onClick={() => setEditing('new')}
          disabled={subjects.length === 0}
        >
          + Nová karta
        </button>
      </div>
      <h2 className="page-title">Kartičky</h2>

      <div className="browser-filters">
        <input
          className="form-input browser-search"
          placeholder="Hledat v otázkách, odpovědích a štítcích…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input browser-select"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">Všechny předměty</option>
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
            {f.label}
          </button>
        ))}
      </div>

      <p className="muted browser-count">
        {filtered.length} {czCards(filtered.length)}
      </p>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-emoji">🔍</p>
          <p className="muted">Žádná karta neodpovídá filtru.</p>
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
                <button className="card-row-main" onClick={() => setEditing(c)} title="Upravit kartu">
                  <span className="card-row-front">{c.front}</span>
                  <span className="card-row-meta">
                    {c.suspended ? (
                      <span className="row-chip row-chip-suspended">pozastavená</span>
                    ) : c.state === 'new' ? (
                      <span className="row-chip row-chip-new">nová</span>
                    ) : (
                      <span className="row-chip">{countdownLabel(dueDays)}</span>
                    )}
                    {isLeech(c) && <span className="row-chip row-chip-leech">problémová</span>}
                    {c.tags.map((t) => (
                      <span key={t} className="row-chip row-chip-tag">
                        {t}
                      </span>
                    ))}
                  </span>
                </button>
                <button
                  className="card-tool"
                  onClick={() => void toggleSuspend(c)}
                  title={c.suspended ? 'Vrátit do opakování' : 'Vyřadit z opakování'}
                >
                  {c.suspended ? 'Obnovit' : 'Pozastavit'}
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
