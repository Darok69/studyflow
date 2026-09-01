import { useEffect, useRef, useState } from 'react'
import type { Subject } from '../db/db'
import { addCards, getSubjects, replaceSources } from '../db/repo'
import { parseDeck } from '../import/parseDeck'
import {
  aiStatus,
  deleteSource,
  estimateSource,
  extractSource,
  generateTopic,
  listSources,
  markSourceImported,
  proposeOutline,
  reviewTopic,
  saveOutline,
  sourceDeck,
  uploadSource,
  type AiStatus,
  type FallbackReason,
  type OutlineTopicDto,
  type ServerSource,
  type SourceEstimate,
} from '../lib/api'
import { ProgressBar } from '../components/ProgressBar'
import { t } from '../i18n'

interface Props {
  onBack: () => void
}

const ACCEPT = '.pdf,.txt,.md,image/*'

function money(usd: number): string {
  return `$${usd.toFixed(2)}`
}

function reasonLabel(reason: FallbackReason | undefined): string {
  if (reason === 'budget') return t('sourceReasonBudget')
  if (reason === 'api-error') return t('sourceReasonApiError')
  if (reason === 'offline') return t('sourceReasonOffline')
  return t('sourceReasonNoKey')
}

function statusLabel(source: ServerSource): string {
  switch (source.status) {
    case 'extracting':
      return t('sourceStatusExtracting')
    case 'extracted':
      return t('sourceStatusExtracted', source.pages, source.blocks ?? 0)
    case 'outlined':
      return t('sourceStatusOutlined')
    case 'generating':
      return t('sourceStatusGenerating')
    case 'generated':
      return t('sourceStatusGenerated')
    case 'done':
      return t('sourceStatusDone')
    case 'error':
      return t('sourceStatusError')
    default:
      return t('sourceStatusUploaded')
  }
}

/** A subject's field decides which card kinds the generator may use. */
function disciplineOf(subject: Subject | undefined): string {
  return subject?.kind === 'law' || subject?.kind === 'geography' ? subject.kind : 'general'
}

interface OutlineState {
  sourceId: string
  topics: OutlineTopicDto[]
  selected: Set<string>
}

export function Sources({ onBack }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [sources, setSources] = useState<ServerSource[]>([])
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [estimates, setEstimates] = useState<Record<string, SourceEstimate>>({})
  const [outline, setOutline] = useState<OutlineState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const fileInput = useRef<HTMLInputElement>(null)

  async function reload() {
    const [list, ai] = await Promise.all([listSources(), aiStatus()])
    setSources(list)
    setStatus(ai)
    // Mirror the metadata locally so the list is readable offline as well.
    await replaceSources(
      list.map((s) => ({
        id: s.id,
        subjectId: s.subjectId,
        kind: s.kind,
        name: s.name,
        pages: s.pages,
        status: s.status,
        createdAt: s.createdAt,
        error: s.error ?? null,
      })),
    )
  }

  useEffect(() => {
    void getSubjects().then((list) => {
      setSubjects(list)
      setSubjectId((cur) => cur || list[0]?.id || '')
    })
    void reload().catch(() => setError(t('errSourceFailed')))

    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  const subject = subjects.find((s) => s.id === subjectId)
  const mine = sources.filter((s) => s.subjectId === subjectId)

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key)
    setError(null)
    try {
      return await fn()
    } catch {
      setError(t('errSourceFailed'))
      return null
    } finally {
      setBusy(null)
    }
  }

  async function handleFile(file: File) {
    setBusy('upload')
    setError(null)
    setNote(null)
    try {
      // The File object goes straight into the request body. The input is only
      // cleared afterwards — clearing it first invalidates the file in Safari.
      await uploadSource({
        subjectId,
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        body: file,
      })
      await reload()
    } catch {
      setError(t('errUploadFailed'))
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handlePaste() {
    if (!pasted.trim()) return
    await run('upload', async () => {
      await uploadSource({
        subjectId,
        name: `${pasted.trim().slice(0, 40)}…`,
        contentType: 'text/plain',
        body: pasted,
      })
      setPasted('')
      setPasting(false)
      await reload()
    })
  }

  async function handleExtract(source: ServerSource) {
    const result = await run(source.id, async () => {
      const res = await extractSource(source.id)
      await reload()
      const est = await estimateSource(source.id).catch(() => null)
      if (est) setEstimates((prev) => ({ ...prev, [source.id]: est }))
      return res
    })
    if (result) setNote(t('sourceStatusExtracted', result.pages, result.blocks))
  }

  async function handleOutline(source: ServerSource) {
    const res = await run(source.id, async () => {
      const out = await proposeOutline(source.id, disciplineOf(subject))
      await reload()
      return out
    })
    if (!res) return
    setOutline({
      sourceId: source.id,
      topics: res.outline.topics,
      selected: new Set(res.outline.topics.map((topic) => topic.id)),
    })
    if (res.mode === 'fallback') setNote(`${t('sourceModelOff')} (${reasonLabel(res.reason)})`)
  }

  /**
   * The user approved the outline — only now do cards get generated, one topic
   * per request, so a failure costs one topic and the progress is honest.
   */
  async function handleApprove() {
    if (!outline) return
    const chosen = outline.topics.filter((topic) => outline.selected.has(topic.id))
    if (chosen.length === 0) {
      setError(t('outlineNoneSelected'))
      return
    }
    setBusy(outline.sourceId)
    setError(null)
    setProgress({ done: 0, total: chosen.length })
    try {
      await saveOutline(outline.sourceId, chosen)
      let fellBack: FallbackReason | undefined
      let usedFallback = false
      for (const [i, topic] of chosen.entries()) {
        const res = await generateTopic(outline.sourceId, topic.id, disciplineOf(subject))
        if (res.mode === 'fallback') {
          usedFallback = true
          fellBack = res.reason
        } else {
          // The second pass only runs where a model actually generated.
          await reviewTopic(outline.sourceId, topic.id).catch(() => null)
        }
        setProgress({ done: i + 1, total: chosen.length })
      }
      setOutline(null)
      await reload()
      setNote(usedFallback ? `${t('sourceModelOff')} (${reasonLabel(fellBack)})` : null)
    } catch {
      setError(t('errSourceFailed'))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  /** Generated deck → the app's own import path → cards in the chosen deck. */
  async function handleImport(source: ServerSource) {
    const added = await run(source.id, async () => {
      const deck = await sourceDeck(source.id)
      const parsed = parseDeck(JSON.stringify(deck))
      if (parsed.cards.length === 0) throw new Error('empty')
      const count = await addCards(
        subjectId,
        parsed.cards.map((card) => ({ ...card, sourceId: source.id })),
      )
      await markSourceImported(source.id)
      return count
    })
    if (added != null) {
      setNote(t('sourceImported', added))
      await reload()
    }
  }

  async function handleDelete(source: ServerSource) {
    if (!window.confirm(t('sourceDeleteConfirm'))) return
    await run(source.id, async () => {
      await deleteSource(source.id)
      await reload()
    })
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('sourcesTitle')}</h2>
      <p className="muted">{t('sourcesIntro')}</p>

      {!online && (
        <div className="guardrail" role="status">
          {t('sourcesOffline')}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="guardrail" role="status">
          {t('sourcesNeedDeck')}
        </div>
      ) : (
        <>
          <label className="setting-row">
            <span>{t('sourcesDeckLabel')}</span>
            <select
              className="browser-select"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {status && (
            <p className="muted">
              {t('sourceSpent', money(status.spentUsd), money(status.budgetUsd))}
              {!status.enabled && ` · ${t('sourceModelUnavailable')}`}
            </p>
          )}

          {note && (
            <div className="guardrail" role="status">
              {note}
            </div>
          )}
          {error && (
            <ul className="error-list">
              <li>{error}</li>
            </ul>
          )}

          <ul className="card-list">
            {mine.length === 0 && <li className="muted">{t('sourcesEmpty')}</li>}
            {mine.map((source) => {
              const estimate = estimates[source.id]
              const working = busy === source.id
              return (
                <li key={source.id} className="card-row source-row">
                  <div className="card-row-main">
                    <div className="card-row-front">{source.name}</div>
                    <div className="card-row-meta">
                      <span className="row-chip">{statusLabel(source)}</span>
                      {source.status === 'error' && source.error === 'no-key' && (
                        <span className="row-chip">{t('sourceNeedsModel')}</span>
                      )}
                      {estimate && source.status !== 'done' && (
                        <span className="row-chip">{t('sourceEstimate', money(estimate.estimateUsd))}</span>
                      )}
                    </div>
                  </div>
                  <div className="button-row source-actions">
                    {source.status === 'uploaded' && (
                      <button
                        className="btn btn-primary btn-small"
                        disabled={working || !online}
                        onClick={() => void handleExtract(source)}
                      >
                        {t('sourceExtract')}
                      </button>
                    )}
                    {(source.status === 'extracted' || source.status === 'outlined') && (
                      <button
                        className="btn btn-primary btn-small"
                        disabled={working || !online}
                        onClick={() => void handleOutline(source)}
                      >
                        {working ? t('sourceOutlineWorking') : t('sourceOutlineBtn')}
                      </button>
                    )}
                    {(source.cards ?? 0) > 0 && !source.importedAt && (
                      <button
                        className="btn btn-primary btn-small"
                        disabled={working || !online}
                        onClick={() => void handleImport(source)}
                      >
                        {t('sourceImportBtn', source.cards ?? 0)}
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={working}
                      onClick={() => void handleDelete(source)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {progress && (
            <div className="panel-section">
              <span>{t('sourceGenerating', progress.done, progress.total)}</span>
              <ProgressBar value={progress.done} max={progress.total} />
            </div>
          )}

          {outline && (
            <section className="panel-section outline-panel">
              <h3>{t('outlineTitle')}</h3>
              <p className="muted">{t('outlineHint')}</p>
              <ul className="card-list">
                {outline.topics.map((topic) => (
                  <li key={topic.id} className="card-row outline-topic">
                    <input
                      type="checkbox"
                      checked={outline.selected.has(topic.id)}
                      aria-label={topic.title}
                      onChange={(e) => {
                        const selected = new Set(outline.selected)
                        if (e.target.checked) selected.add(topic.id)
                        else selected.delete(topic.id)
                        setOutline({ ...outline, selected })
                      }}
                    />
                    <div className="card-row-main">
                      <input
                        className="browser-search"
                        value={topic.title}
                        onChange={(e) =>
                          setOutline({
                            ...outline,
                            topics: outline.topics.map((x) =>
                              x.id === topic.id ? { ...x, title: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <div className="card-row-meta">
                        <span className="row-chip">
                          {t('outlineTopicMeta', topic.cardEstimate, topic.estimatedMinutes)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <button
                  className="btn btn-primary"
                  disabled={busy !== null || !online}
                  onClick={() => void handleApprove()}
                >
                  {t('sourceApprove')}
                </button>
                <button className="btn btn-ghost" onClick={() => setOutline(null)}>
                  {t('cancel')}
                </button>
              </div>
            </section>
          )}

          <section className="panel-section">
            <label className={`btn btn-primary${busy || !online ? ' btn-disabled' : ''}`}>
              {busy === 'upload' ? t('sourcesUploading') : t('sourcesUpload')}
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept={ACCEPT}
                disabled={busy !== null || !online}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
            </label>
            <p className="muted">{t('sourcesUploadHint')}</p>
            {pasting ? (
              <>
                <textarea
                  className="json-input"
                  placeholder={t('sourcesPasteHint')}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
                <div className="button-row">
                  <button
                    className="btn btn-primary"
                    disabled={busy !== null || !pasted.trim() || !online}
                    onClick={() => void handlePaste()}
                  >
                    {busy === 'upload' ? t('sourcesUploading') : t('sourcesPaste')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setPasting(false)}>
                    {t('cancel')}
                  </button>
                </div>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setPasting(true)} disabled={!online}>
                {t('sourcesPaste')}
              </button>
            )}
          </section>
        </>
      )}

      <div className="button-row">
        <button className="btn btn-ghost" onClick={onBack}>
          {t('backPlain')}
        </button>
      </div>
    </div>
  )
}
