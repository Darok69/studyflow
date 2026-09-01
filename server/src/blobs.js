// Source-material storage. The heavy things — the uploaded file, the extracted
// text, generated cards — live on disk under /data, NOT in the sync snapshot:
// that snapshot carries the whole app state through one 32 MB request, and a
// single PDF script would blow it apart.
//
// Layout:  /data/sources/{userId}/{sourceId}/{meta.json,original.bin,pages.json,
//          blocks.json,outline.json,cards/{topicId}.json,deck.json}
//          /data/usage/{userId}.json          — the monthly AI ledger
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data')
const SOURCES_DIR = join(DATA_DIR, 'sources')
const USAGE_DIR = join(DATA_DIR, 'usage')
mkdirSync(SOURCES_DIR, { recursive: true })
mkdirSync(USAGE_DIR, { recursive: true })

/** Ids come from crypto.randomUUID(); anything else never touches the filesystem. */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertId(value, what) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new Error(`invalid ${what}`)
  }
  return value
}

function writeAtomic(file, data) {
  const tmp = `${file}.${randomUUID()}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, file)
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  writeAtomic(file, JSON.stringify(value, null, 2))
}

function sourceDir(userId, sourceId) {
  return join(SOURCES_DIR, assertId(userId, 'user id'), assertId(sourceId, 'source id'))
}

// ---- metadata ----

export function listSources(userId) {
  const dir = join(SOURCES_DIR, assertId(userId, 'user id'))
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((id) => ID_RE.test(id) && statSync(join(dir, id)).isDirectory())
    .map((id) => readJson(join(dir, id, 'meta.json'), null))
    .filter(Boolean)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function getSourceMeta(userId, sourceId) {
  return readJson(join(sourceDir(userId, sourceId), 'meta.json'), null)
}

export function createSource(userId, { subjectId, kind, name, ext }) {
  const id = randomUUID()
  const dir = sourceDir(userId, id)
  mkdirSync(join(dir, 'cards'), { recursive: true })
  const meta = {
    id,
    subjectId: String(subjectId ?? ''),
    kind,
    name: String(name ?? '').slice(0, 200) || 'Podklad',
    ext: ext ?? '',
    pages: 0,
    status: 'uploaded',
    createdAt: new Date().toISOString(),
    error: null,
  }
  writeJson(join(dir, 'meta.json'), meta)
  return meta
}

/** Merge a patch into the metadata; unknown source ids simply return null. */
export function patchSource(userId, sourceId, patch) {
  const dir = sourceDir(userId, sourceId)
  const meta = readJson(join(dir, 'meta.json'), null)
  if (!meta) return null
  const next = { ...meta, ...patch }
  writeJson(join(dir, 'meta.json'), next)
  return next
}

export function deleteSource(userId, sourceId) {
  rmSync(sourceDir(userId, sourceId), { recursive: true, force: true })
}

// ---- the original file ----

export function saveOriginal(userId, sourceId, buffer) {
  writeAtomic(join(sourceDir(userId, sourceId), 'original.bin'), buffer)
}

export function readOriginal(userId, sourceId) {
  const file = join(sourceDir(userId, sourceId), 'original.bin')
  return existsSync(file) ? readFileSync(file) : null
}

// ---- pipeline artefacts ----

const ARTEFACTS = { pages: 'pages.json', blocks: 'blocks.json', outline: 'outline.json', deck: 'deck.json' }

export function readArtefact(userId, sourceId, name) {
  const file = ARTEFACTS[name]
  if (!file) throw new Error('unknown artefact')
  return readJson(join(sourceDir(userId, sourceId), file), null)
}

export function writeArtefact(userId, sourceId, name, value) {
  const file = ARTEFACTS[name]
  if (!file) throw new Error('unknown artefact')
  writeJson(join(sourceDir(userId, sourceId), file), value)
  return value
}

/**
 * Cards already generated for one topic. This is the idempotence key of the
 * whole pipeline: re-running a generation never pays for the same topic twice.
 */
export function readTopicCards(userId, sourceId, topicId) {
  const safe = String(topicId).replace(/[^a-z0-9_-]/gi, '')
  if (!safe) return null
  return readJson(join(sourceDir(userId, sourceId), 'cards', `${safe}.json`), null)
}

export function writeTopicCards(userId, sourceId, topicId, payload) {
  const safe = String(topicId).replace(/[^a-z0-9_-]/gi, '')
  if (!safe) throw new Error('invalid topic id')
  const dir = join(sourceDir(userId, sourceId), 'cards')
  mkdirSync(dir, { recursive: true })
  writeJson(join(dir, `${safe}.json`), payload)
  return payload
}

// ---- monthly AI ledger ----

export function getLedger(userId) {
  return readJson(join(USAGE_DIR, `${assertId(userId, 'user id')}.json`), null)
}

export function saveLedger(userId, ledger) {
  writeJson(join(USAGE_DIR, `${assertId(userId, 'user id')}.json`), ledger)
  return ledger
}
