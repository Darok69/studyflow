// Full-app backup: every table in one JSON file, so the whole study history
// (FSRS state included) can move between browsers/devices. Validation is pure;
// the actual DB swap lives in the repository.
import type { Card, Review, Settings, Subject } from '../db/db'
import { t } from '../i18n'

export const BACKUP_KIND = 'studyflow-backup'
export const BACKUP_VERSION = 1

export interface Backup {
  kind: typeof BACKUP_KIND
  version: number
  exportedAt: string // ISO
  subjects: Subject[]
  cards: Card[]
  reviews: Review[]
  settings: Settings | null
}

export function backupToJson(data: Omit<Backup, 'kind' | 'version'>): string {
  return JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, ...data }, null, 2)
}

/** Parse + sanity-check a backup file. Never throws. */
export function parseBackup(raw: string): { backup: Backup | null; error: string | null } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { backup: null, error: t('errBackupNotJson') }
  }

  const b = data as Partial<Backup> | null
  if (!b || typeof b !== 'object' || b.kind !== BACKUP_KIND) {
    return { backup: null, error: t('errBackupForeign') }
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    return { backup: null, error: t('errBackupNewer') }
  }
  if (!Array.isArray(b.subjects) || !Array.isArray(b.cards) || !Array.isArray(b.reviews)) {
    return { backup: null, error: t('errBackupMissingData') }
  }
  const idsOk = [...b.subjects, ...b.cards, ...b.reviews].every(
    (r) => r && typeof (r as { id?: unknown }).id === 'string',
  )
  if (!idsOk) return { backup: null, error: t('errBackupCorrupt') }

  return { backup: b as Backup, error: null }
}
