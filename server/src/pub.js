// Publikační tokeny a uživatelské učebnice.
//
// Cizí Claude se nedostane k session cookie, a dávat mu přístupový kód účtu by
// znamenalo dát mu celý účet. Proto zvláštní token: nese JEN právo nahrát a
// smazat vlastní učebnice, jde kdykoli zneplatnit, a v souboru leží jen jeho
// otisk (token sám vidí uživatel jednou, při vytvoření).
//
// Balíčky uživatele leží v /data/materials/users/<userId>/ — tedy vedle
// Danielových, ale v samostatné složce, takže se ID přednášek nemohou potkat.
// Navíc každý balíček dostane šestiznakový prefix, který se lepí před ID
// přednášky: bez něj by cizí „PD01“ přebilo to pravé v rejstříku.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DATA_DIR } from './store.js'

const TOKENS_FILE = join(DATA_DIR, 'pubtokens.json')
const USERS_MATERIALS_DIR = join(DATA_DIR, 'materials', 'users')

/** Kolik balíčků unese jeden účet. Strop je proti omylu, ne proti uživateli. */
export const MAX_PACKS_PER_USER = 20

const PREFIX_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, file)
}

// ---- tokeny ----

function tokenHash(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function getTokens() {
  return readJson(TOKENS_FILE, {})
}

function saveTokens(tokens) {
  writeJson(TOKENS_FILE, tokens)
}

/** Nový token pro uživatele. Vrací ho v čitelné podobě — naposledy. */
export function createPubToken(userId, label = '') {
  const token = `sf_${randomBytes(24).toString('hex')}`
  const tokens = getTokens()
  tokens[tokenHash(token)] = {
    userId,
    label: String(label).slice(0, 60),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  }
  saveTokens(tokens)
  return token
}

/** Popis tokenů uživatele — bez tokenů samotných, ty už nikdo nezjistí. */
export function listPubTokens(userId) {
  return Object.entries(getTokens())
    .filter(([, t]) => t.userId === userId)
    .map(([hash, t]) => ({
      id: hash.slice(0, 12),
      label: t.label ?? '',
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function revokePubToken(userId, id) {
  const tokens = getTokens()
  let removed = false
  for (const [hash, t] of Object.entries(tokens)) {
    if (t.userId === userId && hash.startsWith(id)) {
      delete tokens[hash]
      removed = true
    }
  }
  if (removed) saveTokens(tokens)
  return removed
}

export function revokeAllPubTokens(userId) {
  const tokens = getTokens()
  let changed = false
  for (const [hash, t] of Object.entries(tokens)) {
    if (t.userId === userId) {
      delete tokens[hash]
      changed = true
    }
  }
  if (changed) saveTokens(tokens)
}

/**
 * Token → userId. Porovnává se v konstantním čase; `lastUsedAt` se zapisuje
 * nejvýš jednou za hodinu, aby každý požadavek nepsal na disk.
 */
export function userIdFromPubToken(token) {
  if (typeof token !== 'string' || !token.startsWith('sf_')) return null
  const want = Buffer.from(tokenHash(token), 'hex')
  const tokens = getTokens()
  for (const [hash, entry] of Object.entries(tokens)) {
    const have = Buffer.from(hash, 'hex')
    if (have.length === want.length && timingSafeEqual(have, want)) {
      const last = entry.lastUsedAt ? Date.parse(entry.lastUsedAt) : 0
      if (Date.now() - last > 3_600_000) {
        entry.lastUsedAt = new Date().toISOString()
        saveTokens(tokens)
      }
      return entry.userId
    }
  }
  return null
}

// ---- balíčky na disku ----

function userDir(userId) {
  return join(USERS_MATERIALS_DIR, userId)
}

function packsFile(userId) {
  return join(userDir(userId), 'packs.json')
}

/**
 * Zdrojová podoba balíčku — přesně to, co poslal Claude. Drží se proto, aby
 * šlo přidat další přednášku, aniž by se posílalo celé znovu: server si načte
 * zdroj, přepíše v něm jednu přednášku a přepočítá učebnici i karty.
 */
export function readPackSource(userId, slug) {
  return readJson(join(userDir(userId), `src-${slug}.json`), null)
}

export function writePackSource(userId, slug, source) {
  mkdirSync(userDir(userId), { recursive: true })
  writeJson(join(userDir(userId), `src-${slug}.json`), source)
}

/** Rejstřík balíčků uživatele: { slug: { prefix, subject, lectures, cards, updatedAt } }. */
export function getUserPacks(userId) {
  return readJson(packsFile(userId), {})
}

function savePacks(userId, packs) {
  mkdirSync(userDir(userId), { recursive: true })
  writeJson(packsFile(userId), packs)
}

/** Prefix balíčku — existující se nemění, nový se losuje mimo už použité. */
export function prefixFor(userId, slug) {
  const packs = getUserPacks(userId)
  if (packs[slug]?.prefix) return packs[slug].prefix
  const used = new Set(Object.values(packs).map((p) => p.prefix))
  for (let attempt = 0; attempt < 50; attempt++) {
    let prefix = ''
    for (const b of randomBytes(6)) prefix += PREFIX_ALPHABET[b % PREFIX_ALPHABET.length]
    if (!used.has(prefix)) return prefix
  }
  return null
}

/**
 * Uloží normalizovaný balíček. Staré soubory přednášek se mažou jako první,
 * aby po přejmenování nebo zkrácení nezůstala v rejstříku přednáška, na kterou
 * už nic neodkazuje.
 */
export function writePack(userId, pack, prefix) {
  const dir = userDir(userId)
  mkdirSync(dir, { recursive: true })
  const packs = getUserPacks(userId)
  const previous = packs[pack.slug]
  if (previous) {
    for (const id of previous.lectureIds ?? []) {
      try {
        unlinkSync(join(dir, `${id}.json`))
      } catch {
        /* už tam není, to nevadí */
      }
    }
  }
  for (const [id, lecture] of Object.entries(pack.lectures)) {
    writeJson(join(dir, `${id}.json`), lecture)
  }
  writeJson(join(dir, `index-${pack.slug}.json`), pack.index)
  writeJson(join(dir, `deck-${pack.slug}.json`), pack.deck)
  packs[pack.slug] = {
    prefix,
    subject: pack.subject,
    examDate: pack.examDate,
    lectures: Object.keys(pack.lectures).length,
    cards: pack.deck.cards.length,
    lectureIds: Object.keys(pack.lectures),
    updatedAt: new Date().toISOString(),
  }
  savePacks(userId, packs)
  return packs[pack.slug]
}

export function deletePack(userId, slug) {
  const packs = getUserPacks(userId)
  const entry = packs[slug]
  if (!entry) return false
  const dir = userDir(userId)
  for (const id of entry.lectureIds ?? []) {
    try {
      unlinkSync(join(dir, `${id}.json`))
    } catch {
      /* už tam není */
    }
  }
  for (const file of [`index-${slug}.json`, `deck-${slug}.json`, `src-${slug}.json`]) {
    try {
      unlinkSync(join(dir, file))
    } catch {
      /* už tam není */
    }
  }
  delete packs[slug]
  savePacks(userId, packs)
  return true
}

/** Všechno, co uživatel nahrál — používá se při mazání účtu. */
export function deleteAllUserMaterials(userId) {
  try {
    rmSync(userDir(userId), { recursive: true, force: true })
  } catch {
    /* nic tam nebylo */
  }
}

/** Soubory rejstříků uživatele, pro slévání v materials-routes. */
export function userIndexFiles(userId) {
  const dir = userDir(userId)
  if (!userId || !existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^index-[a-z0-9-]{1,41}\.json$/.test(f))
    .sort()
    .map((f) => join(dir, f))
}

/** Adresář uživatele — materials-routes v něm hledá přednášky a balíčky karet. */
export function userMaterialsDir(userId) {
  return userId ? userDir(userId) : null
}
