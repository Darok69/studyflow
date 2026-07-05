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
