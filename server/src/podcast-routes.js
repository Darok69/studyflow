// Soukromý podcast: feed a zvukové soubory pro podcastovou aplikaci.
//
// Tohle je jediná část serveru BEZ session cookie — a schválně. Podcastová
// aplikace (Apple Podcasts, Overcast, …) se neumí přihlásit; jediné, co s sebou
// nese, je adresa. Autorizací je proto náhodný token v cestě. Token se
// porovnává v konstantním čase a je dost dlouhý na to, aby se nedal uhodnout.
//
// Rozložení: /data/podcast/{quiz,narration}/{feed.xml,cover.jpg,<ID>.m4a}
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'
import { DATA_DIR } from './store.js'

const PODCAST_DIR = join(DATA_DIR, 'podcast')
const TOKEN_FILE = join(DATA_DIR, 'podcast-token.json')

// Jména vyrábí pipeline, ne uživatel. Cokoli jiného se odmítne, než se to
// dostane k souborovému systému.
// Řady IREWI se jmenují `quiz` a `narration` — ta jména jsou zapsaná v odběru
// v podcastové aplikaci a nemění se. Každý další předmět má vlastní pořad
// s prefixem podle balíku, např. `pravni-dejiny-quiz`.
const SERIES_RE = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?(?:quiz|narration)$/
const FILE_RE = /^(?:[A-Za-z0-9]{2,12}\.m4a|feed\.xml|cover\.jpg)$/

const TYPES = { '.m4a': 'audio/x-m4a', '.xml': 'application/rss+xml', '.jpg': 'image/jpeg' }

let cached = null

/** Token feedu. Vyrobí se při prvním použití a dál se nemění. */
export function podcastToken() {
  if (cached) return cached
  if (existsSync(TOKEN_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'))
      if (typeof parsed.token === 'string' && parsed.token.length >= 32) {
        cached = parsed.token
        return cached
      }
    } catch {
      /* poškozený soubor — vyrobí se nový níž */
    }
  }
  // Token MUSÍ přežít restart: je zapsaný v odběru v podcastové aplikaci a
  // nová hodnota by odběr tiše rozbila.
  cached = randomBytes(24).toString('base64url')
  writeFileSync(TOKEN_FILE, JSON.stringify({ token: cached, createdAt: new Date().toISOString() }))
  return cached
}

/** Pořady, které na disku opravdu jsou — podle feedu, ne podle seznamu ve zdrojáku. */
export function podcastSeries() {
  if (!existsSync(PODCAST_DIR)) return []
  return readdirSync(PODCAST_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SERIES_RE.test(e.name))
    .filter((e) => existsSync(join(PODCAST_DIR, e.name, 'feed.xml')))
    .map((e) => e.name)
    .sort()
}

export function podcastAvailable() {
  return podcastSeries().length > 0
}

/** Porovnání odolné vůči měření času — token se jinak dá uhádnout po znacích. */
function tokenOk(given) {
  const expected = podcastToken()
  if (typeof given !== 'string' || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

/**
 * Rozsah bajtů z hlavičky Range. Přehrávače si o zvuk žádají po kusech —
 * bez odpovědi 206 se v delší epizodě nedá přetáčet a některé aplikace ji
 * odmítnou stáhnout celou.
 */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  if (!m) return null
  const [, rawStart, rawEnd] = m
  let start, end
  if (rawStart === '') {
    // "bytes=-500" = posledních 500 bajtů
    if (rawEnd === '') return null
    start = Math.max(0, size - Number(rawEnd))
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null
  return { start, end }
}

export function registerPodcastRoutes(app) {
  app.get('/podcast/:token/:series/:file', async (req, reply) => {
    const { token, series, file } = req.params
    // Stejná odpověď na špatný token i na neexistující soubor: kdo tipuje,
    // se z rozdílu nic nedozví.
    if (!tokenOk(token) || !SERIES_RE.test(series) || !FILE_RE.test(file)) {
      return reply.code(404).send({ error: 'not-found' })
    }
    const path = join(PODCAST_DIR, series, file)
    if (!existsSync(path)) return reply.code(404).send({ error: 'not-found' })

    const size = statSync(path).size
    const ext = file.slice(file.lastIndexOf('.'))
    reply.type(TYPES[ext] ?? 'application/octet-stream')
    reply.header('accept-ranges', 'bytes')
    // Feed se musí přečíst znovu, aby přišly nové epizody; zvuk pod stejným
    // jménem se nemění, takže si ho aplikace může nechat napořád.
    reply.header('cache-control', ext === '.xml' ? 'no-cache' : 'public, max-age=31536000, immutable')

    const range = parseRange(req.headers.range, size)
    if (range) {
      reply.code(206)
      reply.header('content-range', `bytes ${range.start}-${range.end}/${size}`)
      reply.header('content-length', String(range.end - range.start + 1))
      return reply.send(createReadStream(path, { start: range.start, end: range.end }))
    }
    reply.header('content-length', String(size))
    return reply.send(createReadStream(path))
  })
}
