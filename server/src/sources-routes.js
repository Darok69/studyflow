// The pipeline as HTTP: upload → extract → outline → (user approves) → generate
// → quality control → deck. Every step is its own request so the UI can show a
// process instead of one spinner, and so a failure costs one step, not the run.
//
// Two promises are kept here: the app never stops working without a model (each
// generating step falls back to the rule-based generator and SAYS so), and no
// topic is ever paid for twice (results are stored per topic).
import {
  createSource,
  deleteSource,
  getLedger,
  getSourceMeta,
  listSources,
  patchSource,
  readArtefact,
  readOriginal,
  readTopicCards,
  saveLedger,
  saveOriginal,
  writeArtefact,
  writeTopicCards,
} from './blobs.js'
import { extractPdfPages, extractTextPages, sniffKind, IMAGE_MEDIA_TYPES } from './extract.js'
import { AiError, aiEnabled, generateCards, generateOutline, reviewCards, transcribeImage } from './ai.js'
import {
  addSpend,
  blocksLength,
  currentLedger,
  dedupeCards,
  estimateCostUsd,
  fallbackCards,
  fallbackOutline,
  markDrafts,
  segmentPages,
} from '../gen/pipeline.mjs'

const DEFAULT_BUDGET_USD = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 15)

const BINARY_TYPES = [
  'application/pdf',
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
]

function ledgerOf(userId) {
  const stored = getLedger(userId)
  const current = currentLedger(stored)
  return { ...current, budgetUsd: stored?.budgetUsd ?? DEFAULT_BUDGET_USD }
}

function spend(userId, usd) {
  const ledger = ledgerOf(userId)
  return saveLedger(userId, { ...addSpend(ledger, usd), budgetUsd: ledger.budgetUsd })
}

/** The model is opt-in per request: `?model=1`. Anything else stays free. */
function wantsModel(req) {
  return req.query?.model === '1' || req.query?.model === 'true'
}

/**
 * May this step call the model? Not asking for it is the DEFAULT and not a
 * failure; a missing key, an exhausted budget and an API outage end the same
 * way as asking without being able to — rules take over and the answer says so.
 */
function modelAllowed(userId, plannedUsd, req) {
  if (req && !wantsModel(req)) return { mode: 'fallback', reason: 'by-choice' }
  if (!aiEnabled()) return { mode: 'fallback', reason: 'no-key' }
  const ledger = ledgerOf(userId)
  if (ledger.spentUsd + plannedUsd > ledger.budgetUsd) return { mode: 'fallback', reason: 'budget' }
  return { mode: 'model' }
}

function blocksOf(userId, sourceId) {
  return readArtefact(userId, sourceId, 'blocks') ?? []
}

function subjectDiscipline(query) {
  const kind = String(query?.discipline ?? '')
  return kind === 'law' || kind === 'geography' ? kind : 'general'
}

export function registerSourceRoutes(app, { requireUser }) {
  app.addContentTypeParser(BINARY_TYPES, { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  // ---- inventory ----

  app.get('/api/sources', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    return listSources(user.id)
  })

  app.get('/api/ai/status', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const ledger = ledgerOf(user.id)
    return { enabled: aiEnabled(), ...ledger }
  })

  app.put('/api/ai/budget', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const budgetUsd = Number(req.body?.budgetUsd)
    if (!Number.isFinite(budgetUsd) || budgetUsd < 0 || budgetUsd > 1000) {
      return reply.code(400).send({ error: 'bad-budget' })
    }
    const ledger = ledgerOf(user.id)
    return saveLedger(user.id, { ...ledger, budgetUsd })
  })

  // ---- upload ----

  app.post('/api/sources', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const body = req.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: 'empty-body' })
    }
    const { subjectId, name } = req.query ?? {}
    if (!subjectId) return reply.code(400).send({ error: 'missing-subject' })

    const { kind, ext } = sniffKind(req.headers['content-type'], name ?? '')
    const meta = createSource(user.id, { subjectId, kind, name: name || `Podklad.${ext}`, ext })
    saveOriginal(user.id, meta.id, body)
    return patchSource(user.id, meta.id, { bytes: body.length })
  })

  app.delete('/api/sources/:id', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    deleteSource(user.id, req.params.id)
    return { ok: true }
  })

  // ---- extraction ----

  app.post('/api/sources/:id/extract', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const meta = getSourceMeta(user.id, req.params.id)
    if (!meta) return reply.code(404).send({ error: 'not-found' })

    const buffer = readOriginal(user.id, meta.id)
    if (!buffer) return reply.code(404).send({ error: 'no-file' })

    patchSource(user.id, meta.id, { status: 'extracting', error: null })
    let pages = []
    let mode = 'model'

    try {
      if (meta.kind === 'pdf') {
        pages = await extractPdfPages(buffer)
        mode = 'local' // reading a PDF needs no model — that is not a fallback
      } else if (meta.kind === 'image') {
        const mediaType = `image/${meta.ext === 'jpg' ? 'jpeg' : meta.ext}`
        if (!IMAGE_MEDIA_TYPES.has(mediaType)) {
          throw new AiError('bad-output', 'unsupported image type')
        }
        const gate = modelAllowed(user.id, 0.05, req)
        if (gate.mode === 'fallback') {
          // A picture without a model cannot be read. Say it plainly instead of
          // pretending the source is empty.
          patchSource(user.id, meta.id, { status: 'error', error: gate.reason })
          return reply.code(503).send({ error: 'needs-model', reason: gate.reason })
        }
        const { text, costUsd } = await transcribeImage({ buffer, mediaType })
        spend(user.id, costUsd)
        pages = extractTextPages(text)
      } else {
        pages = extractTextPages(buffer.toString('utf8'))
        mode = 'local'
      }
    } catch (error) {
      const code = error instanceof AiError ? error.code : 'extract-failed'
      patchSource(user.id, meta.id, { status: 'error', error: code })
      return reply.code(502).send({ error: code })
    }

    const blocks = segmentPages(pages)
    writeArtefact(user.id, meta.id, 'pages', pages)
    writeArtefact(user.id, meta.id, 'blocks', blocks)
    const updated = patchSource(user.id, meta.id, {
      status: 'extracted',
      pages: pages.length,
      blocks: blocks.length,
      chars: blocksLength(blocks),
    })
    return { source: updated, pages: pages.length, blocks: blocks.length, mode }
  })

  /** Source preview: the text of one page, so a card can show where it came from. */
  app.get('/api/sources/:id/pages/:page', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const pages = readArtefact(user.id, req.params.id, 'pages')
    if (!pages) return reply.code(404).send({ error: 'not-extracted' })
    const wanted = Number(req.params.page)
    const found = pages.find((p) => p.page === wanted)
    if (!found) return reply.code(404).send({ error: 'no-such-page' })
    return found
  })

  // ---- estimate (shown BEFORE anything is spent) ----

  app.get('/api/sources/:id/estimate', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const blocks = blocksOf(user.id, req.params.id)
    if (blocks.length === 0) return reply.code(404).send({ error: 'not-extracted' })
    const outline = readArtefact(user.id, req.params.id, 'outline')
    const cardEstimate = outline
      ? outline.topics.reduce((n, t) => n + t.cardEstimate, 0)
      : blocks.length * 2
    const estimateUsd = estimateCostUsd({ chars: blocksLength(blocks), cardEstimate })
    const ledger = ledgerOf(user.id)
    return {
      estimateUsd,
      cardEstimate,
      blocks: blocks.length,
      ...ledger,
      // What it would cost if the model were asked for — the estimate exists
      // precisely so that choice can be made with a number in front of you.
      ...modelAllowed(user.id, estimateUsd),
    }
  })

  // ---- outline: proposed, then approved by the user ----

  app.post('/api/sources/:id/outline', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const meta = getSourceMeta(user.id, req.params.id)
    if (!meta) return reply.code(404).send({ error: 'not-found' })
    const blocks = blocksOf(user.id, meta.id)
    if (blocks.length === 0) return reply.code(409).send({ error: 'not-extracted' })

    const planned = estimateCostUsd({ chars: blocksLength(blocks), cardEstimate: 0 })
    let gate = modelAllowed(user.id, planned, req)
    let outline

    if (gate.mode === 'model') {
      try {
        const result = await generateOutline({
          blocks,
          subjectName: meta.name,
          discipline: subjectDiscipline(req.query),
        })
        spend(user.id, result.costUsd)
        outline = result.outline
      } catch (error) {
        req.log.warn({ err: error?.message }, 'outline failed, falling back to rules')
        gate = { mode: 'fallback', reason: error instanceof AiError ? error.code : 'api-error' }
      }
    }
    // The rule-based outline counts the cards the rules would really make, so
    // the approval screen shows a real number, not a guess.
    if (!outline) outline = fallbackOutline(blocks, { discipline: subjectDiscipline(req.query) })

    writeArtefact(user.id, meta.id, 'outline', outline)
    patchSource(user.id, meta.id, { status: 'outlined' })
    return { outline, ...gate }
  })

  /** The outline as it stands — proposed or approved. */
  app.get('/api/sources/:id/outline', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const outline = readArtefact(user.id, req.params.id, 'outline')
    if (!outline) return reply.code(404).send({ error: 'no-outline' })
    return outline
  })

  /** The user's approved (and possibly rewritten) outline — nothing generates before this. */
  app.put('/api/sources/:id/outline', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const blocks = blocksOf(user.id, req.params.id)
    const known = new Set(blocks.map((b) => b.id))
    const topics = Array.isArray(req.body?.topics) ? req.body.topics : null
    if (!topics) return reply.code(400).send({ error: 'bad-outline' })

    const clean = topics
      .map((t, i) => ({
        id: typeof t.id === 'string' && t.id ? t.id : `t${i + 1}`,
        title: String(t.title ?? '').slice(0, 200),
        blockIds: (Array.isArray(t.blockIds) ? t.blockIds : []).filter((id) => known.has(id)),
        difficulty: [1, 2, 3].includes(t.difficulty) ? t.difficulty : 2,
        estimatedMinutes: Math.max(1, Math.round(Number(t.estimatedMinutes) || 10)),
        cardEstimate: Math.max(0, Math.round(Number(t.cardEstimate) || 0)),
      }))
      .filter((t) => t.title && t.blockIds.length > 0)

    if (clean.length === 0) return reply.code(400).send({ error: 'empty-outline' })
    return writeArtefact(user.id, req.params.id, 'outline', { topics: clean })
  })

  // ---- generation, one topic per call ----

  app.post('/api/sources/:id/generate', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const meta = getSourceMeta(user.id, req.params.id)
    if (!meta) return reply.code(404).send({ error: 'not-found' })
    const outline = readArtefact(user.id, meta.id, 'outline')
    const topic = outline?.topics.find((t) => t.id === req.body?.topicId)
    if (!topic) return reply.code(404).send({ error: 'no-such-topic' })

    // Already generated — never pay for the same topic twice.
    const done = readTopicCards(user.id, meta.id, topic.id)
    if (done && !req.body?.force) {
      return { topicId: topic.id, cards: done.cards.length, mode: done.mode, reason: done.reason, cached: true }
    }

    const blocks = blocksOf(user.id, meta.id).filter((b) => topic.blockIds.includes(b.id))
    if (blocks.length === 0) return reply.code(409).send({ error: 'no-blocks' })

    const planned = estimateCostUsd({ chars: blocksLength(blocks), cardEstimate: topic.cardEstimate })
    let gate = modelAllowed(user.id, planned, req)
    let cards = null

    patchSource(user.id, meta.id, { status: 'generating' })

    if (gate.mode === 'model') {
      try {
        const result = await generateCards({
          topic,
          blocks,
          subjectName: meta.name,
          discipline: subjectDiscipline(req.query),
        })
        spend(user.id, result.costUsd)
        cards = result.cards
      } catch (error) {
        req.log.warn({ err: error?.message }, 'generation failed, falling back to rules')
        gate = { mode: 'fallback', reason: error instanceof AiError ? error.code : 'api-error' }
      }
    }
    if (!cards) cards = fallbackCards(blocks, { discipline: subjectDiscipline(req.query) })

    // Deduplicate against everything already generated for this source.
    const existing = []
    for (const other of outline.topics) {
      if (other.id === topic.id) continue
      const stored = readTopicCards(user.id, meta.id, other.id)
      for (const c of stored?.cards ?? []) existing.push(c.front ?? c.text ?? '')
    }
    const { kept, dropped } = dedupeCards(cards, existing)
    // Rules + the evidence quote each card had to bring: a card whose quote is
    // not in the block was invented and becomes a draft. No second call needed.
    const checked = markDrafts(kept, blocks.map((b) => b.text).join('\n\n'))

    writeTopicCards(user.id, meta.id, topic.id, {
      topicId: topic.id,
      mode: gate.mode,
      reason: gate.reason,
      cards: checked,
      generatedAt: new Date().toISOString(),
    })

    // Keep the running total on the metadata so the list can offer "add N cards"
    // without fetching the whole deck first.
    let total = 0
    for (const other of outline.topics) {
      total += (readTopicCards(user.id, meta.id, other.id)?.cards ?? []).length
    }
    patchSource(user.id, meta.id, { cards: total, status: 'generated' })

    return {
      topicId: topic.id,
      cards: checked.length,
      duplicates: dropped.length,
      drafts: checked.filter((c) => c.draft).length,
      ...gate,
    }
  })

  // ---- quality control, the half only a model can do ----

  app.post('/api/sources/:id/qc', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const meta = getSourceMeta(user.id, req.params.id)
    if (!meta) return reply.code(404).send({ error: 'not-found' })
    const outline = readArtefact(user.id, meta.id, 'outline')
    const topic = outline?.topics.find((t) => t.id === req.body?.topicId)
    const stored = topic ? readTopicCards(user.id, meta.id, topic.id) : null
    if (!topic || !stored) return reply.code(404).send({ error: 'no-such-topic' })

    const blocks = blocksOf(user.id, meta.id).filter((b) => topic.blockIds.includes(b.id))
    const sourceText = blocks.map((b) => b.text).join('\n\n')
    const gate = modelAllowed(user.id, estimateCostUsd({ chars: sourceText.length, cardEstimate: 0 }))
    if (gate.mode === 'fallback') {
      // The rule-based half already ran at generation time; say the second pass
      // did not happen rather than pretending the cards were reviewed.
      return { topicId: topic.id, reviewed: 0, ...gate }
    }

    let verdicts
    try {
      const result = await reviewCards({ cards: stored.cards, sourceText })
      spend(user.id, result.costUsd)
      verdicts = result.verdicts
    } catch (error) {
      req.log.warn({ err: error?.message }, 'quality control failed')
      return { topicId: topic.id, reviewed: 0, mode: 'fallback', reason: error instanceof AiError ? error.code : 'api-error' }
    }

    const cards = stored.cards.map((card, i) =>
      verdicts[i]?.ok === false
        ? { ...card, draft: true, draftReason: card.draftReason ?? 'not-in-source' }
        : card,
    )
    writeTopicCards(user.id, meta.id, topic.id, { ...stored, cards, reviewedAt: new Date().toISOString() })
    return { topicId: topic.id, reviewed: cards.length, drafts: cards.filter((c) => c.draft).length, mode: 'model' }
  })

  /** The client confirms the deck landed in a subject — stops a double import. */
  app.post('/api/sources/:id/imported', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const updated = patchSource(user.id, req.params.id, {
      importedAt: new Date().toISOString(),
      status: 'done',
    })
    if (!updated) return reply.code(404).send({ error: 'not-found' })
    return updated
  })

  // ---- the finished deck, in the app's own import format ----

  app.get('/api/sources/:id/deck', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const meta = getSourceMeta(user.id, req.params.id)
    if (!meta) return reply.code(404).send({ error: 'not-found' })
    const outline = readArtefact(user.id, meta.id, 'outline')
    if (!outline) return reply.code(409).send({ error: 'no-outline' })

    const cards = []
    let mode = 'model'
    for (const topic of outline.topics) {
      const stored = readTopicCards(user.id, meta.id, topic.id)
      if (!stored) continue
      if (stored.mode === 'fallback') mode = 'fallback'
      cards.push(...stored.cards)
    }
    if (cards.length === 0) return reply.code(409).send({ error: 'nothing-generated' })

    patchSource(user.id, meta.id, { status: 'done' })
    return {
      subject: meta.name,
      examDate: null,
      reminderTime: null,
      sourceId: meta.id,
      mode,
      cards,
    }
  })
}
