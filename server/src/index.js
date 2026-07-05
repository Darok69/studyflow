// StudyFlow server: serves the built PWA and a small API — access-code auth,
// per-user sync snapshots, push reminders, and an admin user list.
// Static shell is public (the code is open source anyway); every piece of
// DATA sits behind the session cookie.
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createSession,
  createUser,
  deleteUser,
  destroySession,
  rateLimited,
  resetUserCode,
  SESSION_COOKIE,
  touchLastLogin,
  userFromToken,
  verifyCode,
} from './auth.js'
import { findUserByEmail, getBackup, getPushSubs, getUsers, saveBackup, savePushSubs, deleteBackup, DATA_DIR } from './store.js'
import { publicKey, pushEnabled, startPushCron } from './push.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = process.env.DIST_DIR ?? join(__dirname, '../../dist')
const PORT = Number(process.env.PORT ?? 3000)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
const SECURE_COOKIES = process.env.INSECURE_COOKIES !== '1' // dev opt-out only
const MAX_SYNC_BYTES = 8 * 1024 * 1024

const app = Fastify({ logger: true, bodyLimit: MAX_SYNC_BYTES })
await app.register(fastifyCookie)

// ---- bootstrap: ensure the admin account exists ----
if (ADMIN_EMAIL && !findUserByEmail(ADMIN_EMAIL)) {
  const { user, code, error } = createUser(ADMIN_EMAIL, { isAdmin: true })
  if (error) {
    app.log.error({ error }, 'failed to bootstrap admin')
  } else {
    // Printed exactly once — Daniel reads it from the container log.
    app.log.info(`ADMIN ACCOUNT CREATED: ${user.email} — ACCESS CODE: ${code}`)
  }
}

function currentUser(req) {
  return userFromToken(req.cookies[SESSION_COOKIE])
}

function requireUser(req, reply) {
  const user = currentUser(req)
  if (!user) {
    reply.code(401).send({ error: 'unauthorized' })
    return null
  }
  return user
}

function requireAdmin(req, reply) {
  const user = requireUser(req, reply)
  if (user && !user.isAdmin) {
    reply.code(403).send({ error: 'forbidden' })
    return null
  }
  return user
}

// ---- public ----
app.get('/api/config', async () => ({ server: true, pushEnabled }))

app.post('/api/login', async (req, reply) => {
  const { email, code } = req.body ?? {}
  if (typeof email !== 'string' || typeof code !== 'string') {
    return reply.code(400).send({ error: 'bad-request' })
  }
  const ipKey = `ip:${req.ip}`
  const emailKey = `em:${email.trim().toLowerCase()}`
  if (rateLimited(ipKey) || rateLimited(emailKey)) {
    return reply.code(429).send({ error: 'rate-limited' })
  }
  const user = findUserByEmail(email)
  if (!user || !verifyCode(user, code)) {
    return reply.code(401).send({ error: 'invalid-credentials' })
  }
  touchLastLogin(user.id)
  const token = createSession(user.id)
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: 'lax',
    path: '/',
    maxAge: 120 * 86_400,
  })
  return { email: user.email, isAdmin: !!user.isAdmin }
})

// ---- session ----
app.post('/api/logout', async (req, reply) => {
  const token = req.cookies[SESSION_COOKIE]
  if (token) destroySession(token)
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
  return { ok: true }
})

app.get('/api/me', async (req, reply) => {
  const user = requireUser(req, reply)
  if (!user) return
  return { email: user.email, isAdmin: !!user.isAdmin }
})

// ---- sync (whole-app snapshot per user) ----
app.get('/api/sync', async (req, reply) => {
  const user = requireUser(req, reply)
  if (!user) return
  const snapshot = getBackup(user.id)
  if (!snapshot) return reply.code(204).send()
  return snapshot
})

app.put('/api/sync', async (req, reply) => {
  const user = requireUser(req, reply)
  if (!user) return
  const { data } = req.body ?? {}
  if (typeof data !== 'string' || data.length > MAX_SYNC_BYTES) {
    return reply.code(400).send({ error: 'bad-payload' })
  }
  const snapshot = saveBackup(user.id, data)
  return { updatedAt: snapshot.updatedAt }
})

// ---- push subscriptions ----
app.get('/api/push/key', async (req, reply) => {
  const user = requireUser(req, reply)
  if (!user) return
  if (!pushEnabled) return reply.code(404).send({ error: 'push-disabled' })
  return { publicKey: publicKey() }
})

app.post('/api/push/subscribe', async (req, reply) => {
  const user = requireUser(req, reply)
  if (!user) return
  const { subscription, time, tz, lang } = req.body ?? {}
  if (!subscription?.endpoint || !/^\d{2}:\d{2}$/.test(time ?? '')) {
    return reply.code(400).send({ error: 'bad-payload' })
  }
  const subs = getPushSubs().filter(
    (s) => s.subscription?.endpoint !== subscription.endpoint,
  )
  subs.push({
    userId: user.id,
    subscription,
    time,
    tz: typeof tz === 'string' ? tz : 'Europe/Prague',
    lang: ['cs', 'en', 'de'].includes(lang) ? lang : 'cs',
    lastSentDate: null,
  })
  savePushSubs(subs)
  return { ok: true }
})

app.delete('/api/push/subscribe', async (req, reply) => {
  const user = requireUser(req, reply)
  if (!user) return
  const { endpoint } = req.body ?? {}
  const subs = getPushSubs().filter(
    (s) => !(s.userId === user.id && (!endpoint || s.subscription?.endpoint === endpoint)),
  )
  savePushSubs(subs)
  return { ok: true }
})

// ---- admin: user management ----
app.get('/api/users', async (req, reply) => {
  if (!requireAdmin(req, reply)) return
  return getUsers().map((u) => ({
    id: u.id,
    email: u.email,
    isAdmin: !!u.isAdmin,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }))
})

app.post('/api/users', async (req, reply) => {
  if (!requireAdmin(req, reply)) return
  const { email } = req.body ?? {}
  const result = createUser(String(email ?? ''))
  if (result.error === 'invalid-email') return reply.code(400).send({ error: 'invalid-email' })
  if (result.error === 'exists') return reply.code(409).send({ error: 'exists' })
  // The code is returned exactly once — it is never stored in plain text.
  return { id: result.user.id, email: result.user.email, code: result.code }
})

app.post('/api/users/:id/reset', async (req, reply) => {
  if (!requireAdmin(req, reply)) return
  const code = resetUserCode(req.params.id)
  if (!code) return reply.code(404).send({ error: 'not-found' })
  return { code }
})

app.delete('/api/users/:id', async (req, reply) => {
  const admin = requireAdmin(req, reply)
  if (!admin) return
  if (req.params.id === admin.id) return reply.code(400).send({ error: 'cannot-delete-self' })
  if (!deleteUser(req.params.id)) return reply.code(404).send({ error: 'not-found' })
  deleteBackup(req.params.id)
  savePushSubs(getPushSubs().filter((s) => s.userId !== req.params.id))
  return { ok: true }
})

// ---- static PWA shell ----
await app.register(fastifyStatic, {
  root: DIST_DIR,
  setHeaders(res, path) {
    // Hashed assets cache forever; the shell entry points revalidate.
    if (/\.(js|css|woff2?|png|svg)$/.test(path) && path.includes('assets')) {
      res.setHeader('cache-control', 'public, max-age=31536000, immutable')
    } else {
      res.setHeader('cache-control', 'no-cache')
    }
  },
})

app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not-found' })
  return reply.sendFile('index.html')
})

startPushCron(app.log)
app.log.info(`data dir: ${DATA_DIR}`)
await app.listen({ port: PORT, host: '0.0.0.0' })
