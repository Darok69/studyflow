// Auth: email + access code (no email sending — Daniel hands codes to friends
// himself). Codes are scrypt-hashed; sessions are random tokens in an
// httpOnly cookie. A tiny in-memory rate limiter blunts brute force.
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto'
import {
  findUserByEmail,
  findUserById,
  getSessions,
  getUsers,
  saveSessions,
  saveUsers,
} from './store.js'

export const SESSION_COOKIE = 'sf_session'
const SESSION_DAYS = 120

// Readable code alphabet: no 0/O/1/I lookalikes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateCode() {
  const bytes = randomBytes(12)
  let raw = ''
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

function hashCode(code, salt) {
  return scryptSync(code.replace(/[\s-]/g, '').toUpperCase(), salt, 32).toString('hex')
}

export function makeCredentials(code) {
  const salt = randomBytes(16).toString('hex')
  return { salt, codeHash: hashCode(code, salt) }
}

export function verifyCode(user, code) {
  const candidate = Buffer.from(hashCode(code, user.salt), 'hex')
  const stored = Buffer.from(user.codeHash, 'hex')
  return candidate.length === stored.length && timingSafeEqual(candidate, stored)
}

// ---- rate limiting (in-memory, per key) ----
const attempts = new Map()
const WINDOW_MS = 15 * 60_000
const MAX_ATTEMPTS = 8

export function rateLimited(key) {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > MAX_ATTEMPTS
}

// ---- sessions ----
export function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const sessions = getSessions()
  sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(),
  }
  saveSessions(sessions)
  return token
}

export function destroySession(token) {
  const sessions = getSessions()
  if (sessions[token]) {
    delete sessions[token]
    saveSessions(sessions)
  }
}

/** Resolve a session token to its user, or null. */
export function userFromToken(token) {
  if (!token) return null
  const s = getSessions()[token]
  if (!s || new Date(s.expiresAt).getTime() < Date.now()) return null
  return findUserById(s.userId)
}

/** Drop all sessions belonging to a user (used when the user is deleted). */
export function destroyUserSessions(userId) {
  const sessions = getSessions()
  let changed = false
  for (const [token, s] of Object.entries(sessions)) {
    if (s.userId === userId) {
      delete sessions[token]
      changed = true
    }
  }
  if (changed) saveSessions(sessions)
}

// ---- user management ----
export function createUser(email, { isAdmin = false } = {}) {
  const norm = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return { error: 'invalid-email' }
  if (findUserByEmail(norm)) return { error: 'exists' }
  const code = generateCode()
  const users = getUsers()
  const user = {
    id: randomUUID(),
    email: norm,
    ...makeCredentials(code),
    isAdmin,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  }
  users.push(user)
  saveUsers(users)
  return { user, code }
}

export function resetUserCode(id) {
  const users = getUsers()
  const user = users.find((u) => u.id === id)
  if (!user) return null
  const code = generateCode()
  Object.assign(user, makeCredentials(code))
  saveUsers(users)
  destroyUserSessions(id)
  return code
}

export function deleteUser(id) {
  const users = getUsers()
  const next = users.filter((u) => u.id !== id)
  if (next.length === users.length) return false
  saveUsers(next)
  destroyUserSessions(id)
  return true
}

export function touchLastLogin(id) {
  const users = getUsers()
  const user = users.find((u) => u.id === id)
  if (user) {
    user.lastLoginAt = new Date().toISOString()
    saveUsers(users)
  }
}
