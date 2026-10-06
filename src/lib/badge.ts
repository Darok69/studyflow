// App-icon badge = the "widget": once the PWA is installed (iOS 16.4+,
// Android/Chrome, desktop), the icon shows how many cards wait today.
export function updateAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (count > 0) {
    void nav.setAppBadge?.(count).catch(() => {})
  } else {
    void nav.clearAppBadge?.().catch(() => {})
  }
}

/**
 * Vynuluje číslo na ikoně i oznámení, která v systému po appce zůstala.
 * Číslo se jinak samo přepočítá při dalším otevření úvodní obrazovky — pokud
 * je odznak zapnutý (Settings.appBadge).
 */
export async function clearAppNotifications(): Promise<void> {
  updateAppBadge(0)
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const shown = (await reg?.getNotifications()) ?? []
    for (const n of shown) n.close()
  } catch {
    /* bez service workeru nejsou ani oznámení */
  }
}
