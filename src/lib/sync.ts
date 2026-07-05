// Whole-app sync: the existing backup JSON is the payload, the server stores
// one snapshot per user. Simple and honest for a single-person-many-devices
// pattern: pull on start, debounce-push after local changes, ask on conflict.
import { getSyncSnapshot, putSyncSnapshot, SERVER_MODE } from './api'
import { exportBackupJson, restoreBackup, getSubjects } from '../db/repo'
import { parseBackup } from '../import/backup'

const META_KEY = 'studyflow-sync-meta'
const PUSH_DEBOUNCE_MS = 15_000

interface SyncMeta {
  serverUpdatedAt: string | null
  dirty: boolean
  lastSyncAt: string | null
}

function readMeta(): SyncMeta {
  try {
    return { serverUpdatedAt: null, dirty: false, lastSyncAt: null, ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') }
  } catch {
    return { serverUpdatedAt: null, dirty: false, lastSyncAt: null }
  }
}

function writeMeta(meta: SyncMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function syncMeta(): SyncMeta {
  return readMeta()
}

let pushTimer: number | null = null

/** Push the current local state to the server now. */
export async function pushSync(): Promise<void> {
  if (!SERVER_MODE) return
  const data = await exportBackupJson()
  const { updatedAt } = await putSyncSnapshot(data)
  writeMeta({ serverUpdatedAt: updatedAt, dirty: false, lastSyncAt: new Date().toISOString() })
}

function schedulePush() {
  if (pushTimer !== null) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    pushTimer = null
    void pushSync().catch(() => {
      // Offline or expired session — stays dirty, retried on next change/start.
    })
  }, PUSH_DEBOUNCE_MS)
}

function markDirty() {
  if (!SERVER_MODE) return
  const meta = readMeta()
  if (!meta.dirty) writeMeta({ ...meta, dirty: true })
  schedulePush()
}

export type SyncStartResult = 'fresh' | 'pushed' | 'pulled' | 'in-sync' | 'kept-local' | 'error'

/**
 * Reconcile on app start (after login). Returns what happened so the caller
 * knows whether local data was replaced (→ reload views).
 */
export async function initSync(): Promise<SyncStartResult> {
  if (!SERVER_MODE) return 'fresh'
  try {
    const snapshot = await getSyncSnapshot()
    const meta = readMeta()

    if (!snapshot) {
      // Nothing on the server yet — seed it if we have anything locally.
      const hasData = (await getSubjects()).length > 0
      if (hasData || meta.dirty) {
        await pushSync()
        return 'pushed'
      }
      return 'fresh'
    }

    const serverIsNew = snapshot.updatedAt !== meta.serverUpdatedAt
    if (!serverIsNew) {
      if (meta.dirty) {
        await pushSync()
        return 'pushed'
      }
      return 'in-sync'
    }

    // Server moved on (another device). Apply unless we'd lose local edits.
    if (meta.dirty) {
      const useServer = window.confirm(
        'Na serveru jsou novější data (z jiného zařízení), ale i tady máš neuložené změny.\n\nOK = načíst data ze serveru (místní změny se zahodí)\nZrušit = nechat moje a přepsat server',
      )
      if (!useServer) {
        await pushSync()
        return 'kept-local'
      }
    }
    const { backup, error } = parseBackup(snapshot.data)
    if (!backup) throw new Error(error ?? 'bad backup')
    await restoreBackup(backup)
    writeMeta({ serverUpdatedAt: snapshot.updatedAt, dirty: false, lastSyncAt: new Date().toISOString() })
    return 'pulled'
  } catch {
    return 'error'
  }
}

/** Wire the repo's data-changed event to the debounce push. Call once. */
export function startSyncListener() {
  if (!SERVER_MODE) return
  window.addEventListener('sf-data-changed', markDirty)
  // Last-chance flush when the tab closes with unsaved changes.
  window.addEventListener('pagehide', () => {
    if (readMeta().dirty) {
      void exportBackupJson().then((data) =>
        fetch('/api/sync', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data }),
          keepalive: true,
        }),
      )
    }
  })
}
