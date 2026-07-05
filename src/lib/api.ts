// Thin client for the StudyFlow server API. SERVER_MODE builds (VITE_SERVER=1)
// gate the app behind login and enable sync + push; the static GitHub-Pages
// style build leaves all of this off.

export const SERVER_MODE = import.meta.env.VITE_SERVER === '1'

export interface Account {
  email: string
  isAdmin: boolean
}

export interface UserRow {
  id: string
  email: string
  isAdmin: boolean
  createdAt: string
  lastLoginAt: string | null
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Fired when a request hits 401 mid-session → App drops back to login. */
export const AUTH_EXPIRED_EVENT = 'sf-auth-expired'

async function api<T>(path: string, init?: RequestInit & { skipAuthEvent?: boolean }): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })
  if (res.status === 401 && !init?.skipAuthEvent) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
  if (!res.ok && res.status !== 204) {
    let code = `http-${res.status}`
    try {
      code = ((await res.json()) as { error?: string }).error ?? code
    } catch {
      /* body not json */
    }
    throw new ApiError(res.status, code)
  }
  if (res.status === 204) return null as T
  return (await res.json()) as T
}

export function getConfig(): Promise<{ server: boolean; pushEnabled: boolean }> {
  return api('/api/config')
}

export function getMe(): Promise<Account> {
  return api('/api/me', { skipAuthEvent: true })
}

export function login(email: string, code: string): Promise<Account> {
  return api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    skipAuthEvent: true,
  })
}

export function logout(): Promise<void> {
  return api('/api/logout', { method: 'POST' })
}

export function getSyncSnapshot(): Promise<{ updatedAt: string; data: string } | null> {
  return api('/api/sync')
}

export function putSyncSnapshot(data: string): Promise<{ updatedAt: string }> {
  return api('/api/sync', { method: 'PUT', body: JSON.stringify({ data }) })
}

export function getPushKey(): Promise<{ publicKey: string }> {
  return api('/api/push/key')
}

export function subscribePush(body: {
  subscription: PushSubscriptionJSON
  time: string
  tz: string
  lang: string
}): Promise<{ ok: true }> {
  return api('/api/push/subscribe', { method: 'POST', body: JSON.stringify(body) })
}

export function unsubscribePush(endpoint?: string): Promise<{ ok: true }> {
  return api('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) })
}

export function listUsers(): Promise<UserRow[]> {
  return api('/api/users')
}

export function addUser(email: string): Promise<{ id: string; email: string; code: string }> {
  return api('/api/users', { method: 'POST', body: JSON.stringify({ email }) })
}

export function resetUserCode(id: string): Promise<{ code: string }> {
  return api(`/api/users/${id}/reset`, { method: 'POST' })
}

export function removeUser(id: string): Promise<{ ok: true }> {
  return api(`/api/users/${id}`, { method: 'DELETE' })
}
