// Nahrávání vlastních učebnic: HTTP vrstva nad pub.js.
//
// Dvě části. Uvnitř appky (session cookie) se tokeny vytvářejí a ruší a
// vypisují se vlastní balíčky. Zvenčí (hlavička `Authorization: Bearer sf_…`)
// se balíčky nahrávají — tudy chodí cizí Claude, který cookie nemá a mít nemá.
import { normalizePack, packSlug, SLUG_RE } from '../gen/pipeline.mjs'
import {
  createPubToken,
  deletePack,
  getUserPacks,
  listPubTokens,
  MAX_PACKS_PER_USER,
  prefixFor,
  readPackSource,
  revokePubToken,
  userIdFromPubToken,
  writePack,
  writePackSource,
} from './pub.js'

/** Účet za tokenem v hlavičce, nebo 401. */
export function pubUserId(req, reply) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const userId = userIdFromPubToken(token)
  if (!userId) {
    reply.code(401).send({ error: 'unauthorized' })
    return null
  }
  return userId
}

/** Popis balíčků pro výpis — bez `lectureIds`, ty do odpovědi nepatří. */
export function packSummary(userId) {
  return Object.entries(getUserPacks(userId))
    .map(([slug, p]) => ({
      slug,
      subject: p.subject,
      examDate: p.examDate ?? null,
      lectures: p.lectures ?? 0,
      cards: p.cards ?? 0,
      updatedAt: p.updatedAt ?? null,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

/** Jméno balíčku: buď už je to slug, nebo se z něj slug udělá. */
export function normalizeSlug(rawSlug) {
  const given = String(rawSlug ?? '')
  return SLUG_RE.test(given) ? given : packSlug(given)
}

/**
 * Uloží balíček pro uživatele. Sdílí ji HTTP i MCP, aby obě cesty kontrolovaly
 * úplně stejně — jinak by se jedna z nich dřív nebo později rozešla.
 */
export function savePackFor(userId, rawSlug, body) {
  const slug = normalizeSlug(rawSlug)
  if (!slug) return { error: 'bad-slug' }
  const existing = getUserPacks(userId)
  if (!existing[slug] && Object.keys(existing).length >= MAX_PACKS_PER_USER) {
    return { error: 'too-many-packs' }
  }
  const prefix = prefixFor(userId, slug)
  if (!prefix) return { error: 'no-prefix' }
  const result = normalizePack(body ?? {}, { slug, prefix })
  if ('error' in result) return { error: result.error }
  const entry = writePack(userId, result.pack, prefix)
  // Zdroj se drží vedle výsledku: bez něj by šlo balíček jen přepsat celý.
  writePackSource(userId, slug, body ?? {})
  return {
    slug,
    subject: entry.subject,
    lectures: entry.lectures,
    cards: entry.cards,
    warnings: result.pack.warnings,
  }
}

/**
 * Přidá (nebo nahradí) jednu přednášku v už existujícím balíčku.
 *
 * Tohle je cesta, kterou chodí Claude po přednáškách: celou učebnici by musel
 * posílat znovu a znovu, a u dvaceti přednášek by to byly megabajty na každý
 * krok. Server si proto vezme uložený zdroj, vymění v něm jednu položku a
 * přepočítá učebnici i karty — výsledek je stejný, jako by přišlo všechno naráz.
 */
export function addLectureFor(userId, rawSlug, lecture) {
  const slug = normalizeSlug(rawSlug)
  if (!slug) return { error: 'bad-slug' }
  const source = readPackSource(userId, slug)
  if (!source) return { error: 'unknown-pack' }
  const lectures = Array.isArray(source.lectures) ? [...source.lectures] : []
  const id = String(lecture?.id ?? '')
  const at = lectures.findIndex((l) => String(l?.id ?? '') === id)
  if (at >= 0) lectures[at] = lecture
  else lectures.push(lecture)
  return savePackFor(userId, slug, { ...source, lectures })
}

/**
 * Založí prázdný balíček — jen hlavička, bez přednášek. Na disk se učebnice
 * zapíše až s první přednáškou, aby v rejstříku nesvítil prázdný předmět.
 */
export function startPackFor(userId, rawSlug, header) {
  const slug = normalizeSlug(rawSlug)
  if (!slug) return { error: 'bad-slug' }
  const existing = getUserPacks(userId)
  if (!existing[slug] && Object.keys(existing).length >= MAX_PACKS_PER_USER) {
    return { error: 'too-many-packs' }
  }
  const subject = typeof header?.subject === 'string' ? header.subject.trim() : ''
  if (!subject) return { error: 'missing-subject' }
  writePackSource(userId, slug, { ...header, subject, lectures: [] })
  return { slug, subject, lectures: 0, cards: 0 }
}

export function registerPubRoutes(app, { requireUser }) {
  // ---- uvnitř appky ----

  app.get('/api/pub/state', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    return { tokens: listPubTokens(user.id), packs: packSummary(user.id) }
  })

  app.post('/api/pub/token', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const label = typeof req.body?.label === 'string' ? req.body.label : ''
    // Token se vrací jen tady a jen teď — dál z něj server zná pouze otisk.
    return { token: createPubToken(user.id, label), tokens: listPubTokens(user.id) }
  })

  app.delete('/api/pub/token/:id', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!/^[0-9a-f]{6,64}$/.test(req.params.id)) return reply.code(400).send({ error: 'bad-id' })
    if (!revokePubToken(user.id, req.params.id)) return reply.code(404).send({ error: 'unknown-token' })
    return { tokens: listPubTokens(user.id) }
  })

  app.delete('/api/pub/pack/:slug', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!SLUG_RE.test(req.params.slug)) return reply.code(400).send({ error: 'bad-slug' })
    if (!deletePack(user.id, req.params.slug)) return reply.code(404).send({ error: 'unknown-pack' })
    return { packs: packSummary(user.id) }
  })

  // ---- zvenčí, na token ----

  app.get('/api/pub/whoami', async (req, reply) => {
    const userId = pubUserId(req, reply)
    if (!userId) return
    return { ok: true, packs: packSummary(userId) }
  })

  app.put('/api/pub/pack/:slug', async (req, reply) => {
    const userId = pubUserId(req, reply)
    if (!userId) return
    const result = savePackFor(userId, req.params.slug, req.body)
    if (result.error) return reply.code(400).send({ error: result.error })
    return result
  })

  app.post('/api/pub/start/:slug', async (req, reply) => {
    const userId = pubUserId(req, reply)
    if (!userId) return
    const result = startPackFor(userId, req.params.slug, req.body)
    if (result.error) return reply.code(400).send({ error: result.error })
    return result
  })

  app.put('/api/pub/lecture/:slug', async (req, reply) => {
    const userId = pubUserId(req, reply)
    if (!userId) return
    const result = addLectureFor(userId, req.params.slug, req.body)
    if (result.error) return reply.code(400).send({ error: result.error })
    return result
  })

  app.delete('/api/pub/token-pack/:slug', async (req, reply) => {
    const userId = pubUserId(req, reply)
    if (!userId) return
    if (!SLUG_RE.test(req.params.slug)) return reply.code(400).send({ error: 'bad-slug' })
    if (!deletePack(userId, req.params.slug)) return reply.code(404).send({ error: 'unknown-pack' })
    return { packs: packSummary(userId) }
  })
}
