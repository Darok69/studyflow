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

export function getConfig(): Promise<{ server: boolean; pushEnabled: boolean; aiEnabled: boolean }> {
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

export function sendTestPush(): Promise<{ sent: number }> {
  return api('/api/push/test', { method: 'POST' })
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

// ---- source materials + the generation pipeline ----
// The API key lives on the server; the client only ever sees these results.

export type PipelineMode = 'model' | 'fallback' | 'local'
export type FallbackReason = 'no-key' | 'budget' | 'api-error' | 'offline'

export interface ServerSource {
  id: string
  subjectId: string
  kind: 'pdf' | 'image' | 'text' | 'audio' | 'url'
  name: string
  ext: string
  pages: number
  blocks?: number
  chars?: number
  bytes?: number
  /** Cards generated so far — what the "add to deck" button offers. */
  cards?: number
  importedAt?: string | null
  status:
    | 'uploaded'
    | 'extracting'
    | 'extracted'
    | 'outlined'
    | 'generating'
    | 'generated'
    | 'done'
    | 'error'
  createdAt: string
  error?: string | null
}

export interface AiStatus {
  enabled: boolean
  month: string
  spentUsd: number
  budgetUsd: number
}

export interface OutlineTopicDto {
  id: string
  title: string
  blockIds: string[]
  difficulty: 1 | 2 | 3
  estimatedMinutes: number
  cardEstimate: number
}

export interface SourceEstimate extends AiStatus {
  estimateUsd: number
  cardEstimate: number
  blocks: number
  mode: PipelineMode
  reason?: FallbackReason
}

export interface StepResult {
  mode: PipelineMode
  reason?: FallbackReason
}

export function listSources(): Promise<ServerSource[]> {
  return api('/api/sources')
}

export function aiStatus(): Promise<AiStatus> {
  return api('/api/ai/status')
}

export function setAiBudget(budgetUsd: number): Promise<AiStatus> {
  return api('/api/ai/budget', { method: 'PUT', body: JSON.stringify({ budgetUsd }) })
}

/**
 * Upload raw bytes — a File goes straight into the body, so a 30 MB script does
 * not get inflated by base64 on the way. The caller must not clear its file
 * input before this resolves (Safari invalidates the File the moment it does).
 */
export async function uploadSource(input: {
  subjectId: string
  name: string
  contentType: string
  body: Blob | string
}): Promise<ServerSource> {
  const query = new URLSearchParams({ subjectId: input.subjectId, name: input.name })
  const res = await fetch(`/api/sources?${query}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': input.contentType },
    body: input.body,
  })
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  if (!res.ok) throw new ApiError(res.status, `http-${res.status}`)
  return (await res.json()) as ServerSource
}

export function extractSource(
  id: string,
): Promise<{ source: ServerSource; pages: number; blocks: number } & StepResult> {
  return api(`/api/sources/${id}/extract`, { method: 'POST' })
}

export function sourcePage(id: string, page: number): Promise<{ page: number; text: string }> {
  return api(`/api/sources/${id}/pages/${page}`)
}

export function estimateSource(id: string): Promise<SourceEstimate> {
  return api(`/api/sources/${id}/estimate`)
}

export function proposeOutline(
  id: string,
  discipline: string,
): Promise<{ outline: { topics: OutlineTopicDto[] } } & StepResult> {
  return api(`/api/sources/${id}/outline?discipline=${discipline}`, { method: 'POST' })
}

export function getOutline(id: string): Promise<{ topics: OutlineTopicDto[] }> {
  return api(`/api/sources/${id}/outline`)
}

export function saveOutline(
  id: string,
  topics: OutlineTopicDto[],
): Promise<{ topics: OutlineTopicDto[] }> {
  return api(`/api/sources/${id}/outline`, { method: 'PUT', body: JSON.stringify({ topics }) })
}

export function generateTopic(
  id: string,
  topicId: string,
  discipline: string,
): Promise<{ topicId: string; cards: number; drafts?: number; cached?: boolean } & StepResult> {
  return api(`/api/sources/${id}/generate?discipline=${discipline}`, {
    method: 'POST',
    body: JSON.stringify({ topicId }),
  })
}

export function reviewTopic(
  id: string,
  topicId: string,
): Promise<{ topicId: string; reviewed: number; drafts?: number } & StepResult> {
  return api(`/api/sources/${id}/qc`, { method: 'POST', body: JSON.stringify({ topicId }) })
}

/** The finished deck in the app's own import format — parseDeck validates it. */
export function sourceDeck(id: string): Promise<{ subject: string; cards: unknown[]; mode: PipelineMode }> {
  return api(`/api/sources/${id}/deck`)
}

/** Stamp the source as landed in a deck, so it is not imported twice. */
export function markSourceImported(id: string): Promise<ServerSource> {
  return api(`/api/sources/${id}/imported`, { method: 'POST' })
}

export function deleteSource(id: string): Promise<{ ok: true }> {
  return api(`/api/sources/${id}`, { method: 'DELETE' })
}
