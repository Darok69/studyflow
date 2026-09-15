import { useEffect, useState } from 'react'
import { parseDeck } from '../import/parseDeck'
import { parsePlainDeck } from '../import/parsePlainText'
import { addNewCardsToSubject, findSubjectsByName, importDeck } from '../db/repo'
import type { ParsedDeck } from '../import/parseDeck'
import type { Subject } from '../db/db'
import { aiPrompt, sampleDeckJson } from '../import/sampleDeck'
import { getServerDeck, getServerDecks, SERVER_MODE, type ServerDeck } from '../lib/api'
import { t } from '../i18n'

interface Props {
  onDone: () => void
  onCancel: () => void
  /** Pre-filled deck JSON (e.g. from a shared #deck= link). */
  initialText?: string
  /** True when the pre-fill came from a shared link — shows a friendly banner. */
  shared?: boolean
}

export function Import({ onDone, onCancel, initialText, shared = false }: Props) {
  const [text, setText] = useState(initialText ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  /**
   * A deck whose name matches one already here. Study material arrives topic by
   * topic, so the same deck comes back bigger — and importing it again as a new
   * subject would duplicate the old cards and strand their FSRS history in the
   * first copy. Rather than guess, ask.
   */
  const [existing, setExisting] = useState<{ subject: Subject; parsed: ParsedDeck } | null>(null)
  const [merged, setMerged] = useState<{ added: number; duplicates: number; filed: number } | null>(null)
  /**
   * Decks the server already holds. Material arrives topic by topic, and
   * hunting down a JSON file on disk to paste into a box is not a thing anyone
   * should have to do on a phone — so the app fetches them itself.
   */
  const [serverDecks, setServerDecks] = useState<ServerDeck[]>([])
  const [loadingDeck, setLoadingDeck] = useState<string | null>(null)

  useEffect(() => {
    if (!SERVER_MODE) return
    let alive = true
    getServerDecks()
      .then((r) => {
        if (alive) setServerDecks(r.decks)
      })
      .catch(() => {
        /* no decks on the server is a normal state — pasting still works */
      })
    return () => {
      alive = false
    }
  }, [])

  /**
   * Load a deck straight from the server. A deck named like a subject that is
   * already here is MERGED into it — that is what the name means, and material
   * that grows gets loaded again and again. Nothing is ever overwritten.
   */
  async function loadServerDeck(deck: ServerDeck) {
    setErrors([])
    setMerged(null)
    setLoadingDeck(deck.id)
    try {
      const raw = await getServerDeck(deck.id)
      const parsed = parseDeck(JSON.stringify(raw))
      if (parsed.errors.length > 0) {
        setErrors(parsed.errors)
        return
      }
      const same = await findSubjectsByName(parsed.subject.name)
      if (same.length > 0) {
        const r = await addNewCardsToSubject(same[0].id, parsed)
        setMerged({ added: r.cardCount, duplicates: r.duplicates, filed: r.filed })
        return
      }
      await importDeck(parsed)
      onDone()
    } catch {
      setErrors([t('serverDeckError')])
    } finally {
      setLoadingDeck(null)
    }
  }

  /**
   * JSON when the text is JSON, your own notes otherwise. Guessing beats making
   * the student pick a format: a pasted table, "Pojem — význam" lines or
   * question/answer pairs all end up as cards without a model.
   */
  async function handleImport() {
    setBusy(true)
    setErrors([])

    const looksLikeJson = text.trim().startsWith('{')
    if (looksLikeJson) {
      const parsed = parseDeck(text)
      if (parsed.errors.length > 0) {
        setErrors(parsed.errors)
        setBusy(false)
        return
      }
      const same = await findSubjectsByName(parsed.subject.name)
      if (same.length > 0) {
        setExisting({ subject: same[0], parsed })
        setBusy(false)
        return
      }
      await importDeck(parsed)
      setBusy(false)
      onDone()
      return
    }

    const plain = parsePlainDeck(text)
    if (plain.cards.length === 0) {
      setErrors([t('errPlainNoCards')])
      setBusy(false)
      return
    }
    await importDeck({
      subject: { name: plain.subject ?? t('plainDeckName'), examDate: null, reminderTime: null },
      cards: plain.cards,
      filing: [],
      errors: [],
    })
    setBusy(false)
    onDone()
  }

  async function addToExisting() {
    if (!existing) return
    setBusy(true)
    const result = await addNewCardsToSubject(existing.subject.id, existing.parsed)
    setBusy(false)
    setExisting(null)
    setMerged({ added: result.cardCount, duplicates: result.duplicates, filed: result.filed })
  }

  async function importAsNew() {
    if (!existing) return
    setBusy(true)
    await importDeck(existing.parsed)
    setBusy(false)
    setExisting(null)
    onDone()
  }

  function copyPrompt() {
    void navigator.clipboard?.writeText(aiPrompt).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('importTitle')}</h2>
      {shared ? (
        <div className="guardrail" role="status">
          {t('sharedBanner')}
        </div>
      ) : (
        <>
          <p className="muted">{t('pasteHint')}</p>
          <p className="muted plain-hint">{t('plainHint')}</p>
        </>
      )}

      {serverDecks.length > 0 && (
        <section className="server-decks">
          <h3>{t('serverDecksTitle')}</h3>
          <p className="muted">{t('serverDecksHint')}</p>
          <div className="server-deck-list">
            {serverDecks.map((deck) => (
              <button
                key={deck.id}
                className="server-deck"
                onClick={() => void loadServerDeck(deck)}
                disabled={loadingDeck !== null}
              >
                <span className="server-deck-main">
                  <span className="server-deck-name">{deck.subject}</span>
                  <span className="muted">
                    {deck.cards > 0 ? t('cardsCount', deck.cards) : t('serverDeckFilingOnly')}
                    {deck.filing > 0 && deck.cards > 0 ? ` · ${t('serverDeckFiles')}` : ''}
                  </span>
                </span>
                <span className="server-deck-go">
                  {loadingDeck === deck.id ? t('importing') : t('serverDeckLoad')}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <textarea
        className="json-input"
        spellCheck={false}
        placeholder={t('jsonPlaceholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {existing && (
        <div className="guardrail import-choice" role="status">
          <p>{t('importExistsQ', existing.subject.name, existing.parsed.cards.length)}</p>
          <div className="button-row">
            <button className="btn btn-primary" onClick={() => void addToExisting()} disabled={busy}>
              {t('importMergeBtn')}
            </button>
            <button className="btn btn-ghost" onClick={() => void importAsNew()} disabled={busy}>
              {t('importNewBtn')}
            </button>
            <button className="btn btn-ghost" onClick={() => setExisting(null)} disabled={busy}>
              {t('cancel')}
            </button>
          </div>
          <p className="muted">{t('importMergeHint')}</p>
        </div>
      )}

      {merged && (
        <div className="guardrail" role="status">
          <p>{t('importMerged', merged.added, merged.duplicates)}</p>
          {merged.filed > 0 && <p>{t('importFiled', merged.filed)}</p>}
          <div className="button-row">
            <button className="btn btn-primary" onClick={onDone}>
              {t('backPlain')}
            </button>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="button-row">
        <button className="btn btn-ghost" onClick={() => setText(sampleDeckJson)}>
          {t('loadSample')}
        </button>
        <button className="btn btn-primary" onClick={handleImport} disabled={busy || !text.trim()}>
          {busy ? t('importing') : t('importBtn')}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          {t('backPlain')}
        </button>
      </div>

      <section className="ai-prompt">
        <div className="ai-prompt-head">
          <h3>{t('aiHeading')}</h3>
          <button className="btn btn-ghost btn-small" onClick={copyPrompt}>
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
        <p className="muted">{t('aiHint')}</p>
        <pre className="prompt-box">{aiPrompt}</pre>
      </section>
    </div>
  )
}
