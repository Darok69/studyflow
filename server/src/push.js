// Daily study-reminder push. Every minute, each subscription whose local time
// (in its own timezone) matches its chosen reminder time gets one notification
// with today's due-card count, computed from the user's latest sync snapshot.
import webpush from 'web-push'
import { getBackup, getPushSubs, savePushSubs } from './store.js'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:daniel.marek@dmarkalogistika.cz'

export const pushEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE)
if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export function publicKey() {
  return VAPID_PUBLIC
}

/**
 * Cards due today from a backup snapshot — a deliberately small replica of
 * the client scheduler's "due review" rule (state, due, suspended, buried).
 */
export function dueTodayCount(backupData, now = new Date()) {
  try {
    const parsed = typeof backupData === 'string' ? JSON.parse(backupData) : backupData
    const cards = Array.isArray(parsed?.cards) ? parsed.cards : []
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    const todayKey = now.toISOString().slice(0, 10)
    return cards.filter(
      (c) =>
        c &&
        c.state !== 'new' &&
        !c.suspended &&
        !(c.buriedUntil && c.buriedUntil >= todayKey) &&
        new Date(c.due).getTime() <= end.getTime(),
    ).length
  } catch {
    return null
  }
}

const MESSAGES = {
  cs: (n) =>
    n == null || n === 0
      ? { title: 'StudyFlow', body: 'Čas na chvilku učení? 🌿' }
      : { title: 'StudyFlow', body: `Dnes na tebe čeká ${n} ${n === 1 ? 'kartička' : n <= 4 ? 'kartičky' : 'kartiček'} 🌿` },
  en: (n) =>
    n == null || n === 0
      ? { title: 'StudyFlow', body: 'Time for a little studying? 🌿' }
      : { title: 'StudyFlow', body: `${n} card${n === 1 ? '' : 's'} waiting for you today 🌿` },
  de: (n) =>
    n == null || n === 0
      ? { title: 'StudyFlow', body: 'Zeit für ein bisschen Lernen? 🌿' }
      : { title: 'StudyFlow', body: `Heute warten ${n} Karte${n === 1 ? '' : 'n'} auf dich 🌿` },
}

/** Local 'HH:MM' + 'YYYY-MM-DD' for a timezone; null when tz is invalid. */
function localNow(tz, now = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false,
    })
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
    return {
      time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`,
      date: `${parts.year}-${parts.month}-${parts.day}`,
    }
  } catch {
    return null
  }
}

async function tick(log) {
  const subs = getPushSubs()
  if (subs.length === 0) return
  let changed = false
  const keep = []

  for (const sub of subs) {
    const local = localNow(sub.tz || 'Europe/Prague')
    let drop = false
    if (local && local.time === sub.time && sub.lastSentDate !== local.date) {
      sub.lastSentDate = local.date
      changed = true
      const n = dueTodayCount(getBackup(sub.userId)?.data)
      const msg = (MESSAGES[sub.lang] ?? MESSAGES.cs)(n)
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(msg), { TTL: 3600 })
      } catch (err) {
        // 404/410 = subscription expired → forget it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          drop = true
          changed = true
        } else {
          log?.warn({ err: err?.message }, 'push send failed')
        }
      }
    }
    if (!drop) keep.push(sub)
  }

  if (changed) savePushSubs(keep)
}

export function startPushCron(log) {
  if (!pushEnabled) {
    log?.info('push disabled (no VAPID keys)')
    return
  }
  setInterval(() => {
    tick(log).catch((err) => log?.warn({ err: err?.message }, 'push tick failed'))
  }, 60_000)
  log?.info('push reminder cron started')
}
