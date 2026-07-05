// Client side of the daily reminder: Notification permission + PushManager
// subscription, registered with the server (which fires at the chosen time).
import { getPushKey, subscribePush, unsubscribePush } from './api'

const PREFS_KEY = 'studyflow-reminder'

export interface ReminderPrefs {
  enabled: boolean
  time: string // HH:MM
}

export function reminderPrefs(): ReminderPrefs {
  try {
    return { enabled: false, time: '18:00', ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { enabled: false, time: '18:00' }
  }
}

function savePrefs(prefs: ReminderPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Turn the reminder on (asks for permission) or update its time. */
export async function enableReminder(time: string, lang: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission-denied')

  const registration = await navigator.serviceWorker.ready
  const { publicKey } = await getPushKey()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }))

  await subscribePush({
    subscription: subscription.toJSON(),
    time,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang,
  })
  savePrefs({ enabled: true, time })
}

export async function disableReminder(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await unsubscribePush(subscription.endpoint)
      await subscription.unsubscribe()
    } else {
      await unsubscribePush()
    }
  } finally {
    savePrefs({ ...reminderPrefs(), enabled: false })
  }
}
