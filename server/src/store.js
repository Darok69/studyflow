// File-backed storage — a handful of users, no DB needed. Every write is
// atomic (tmp + rename) so a crash can't corrupt state.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data')
const BACKUP_DIR = join(DATA_DIR, 'backups')
mkdirSync(BACKUP_DIR, { recursive: true })

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

const USERS_FILE = join(DATA_DIR, 'users.json')
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json')
const PUSH_FILE = join(DATA_DIR, 'push.json')

// ---- users ----
// [{ id, email, codeHash, salt, isAdmin, createdAt, lastLoginAt }]
export function getUsers() {
  return readJson(USERS_FILE, [])
}

export function saveUsers(users) {
  writeJson(USERS_FILE, users)
}

export function findUserByEmail(email) {
  const norm = email.trim().toLowerCase()
  return getUsers().find((u) => u.email === norm) ?? null
}

export function findUserById(id) {
  return getUsers().find((u) => u.id === id) ?? null
}

// ---- sessions ----
// { [token]: { userId, createdAt, expiresAt } }
export function getSessions() {
  return readJson(SESSIONS_FILE, {})
}

export function saveSessions(sessions) {
  // Prune expired entries on every write so the file can't grow forever.
  const now = Date.now()
  const pruned = {}
  for (const [token, s] of Object.entries(sessions)) {
    if (new Date(s.expiresAt).getTime() > now) pruned[token] = s
  }
  writeJson(SESSIONS_FILE, pruned)
}

// ---- per-user backup snapshot (the sync payload) ----
function backupFile(userId) {
  // userId is a server-generated UUID, safe as a filename.
  return join(BACKUP_DIR, `${userId}.json`)
}

export function getBackup(userId) {
  return readJson(backupFile(userId), null)
}

export function saveBackup(userId, data) {
  const snapshot = { updatedAt: new Date().toISOString(), data }
  writeJson(backupFile(userId), snapshot)
  return snapshot
}

export function deleteBackup(userId) {
  try {
    unlinkSync(backupFile(userId))
  } catch {
    /* absent is fine */
  }
}

// ---- push subscriptions ----
// [{ userId, subscription, time: 'HH:MM', tz, lang, lastSentDate }]
export function getPushSubs() {
  return readJson(PUSH_FILE, [])
}

export function savePushSubs(subs) {
  writeJson(PUSH_FILE, subs)
}

export { DATA_DIR, existsSync }
