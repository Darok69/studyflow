// Tiny dictionary-based i18n. Czech is the source of truth (and the default);
// English and German dictionaries are type-checked for completeness. Language
// switching does a full page reload, so components can call t() freely without
// any React context.
import { cs, type Messages } from './cs'
import { en } from './en'
import { de } from './de'

export type Lang = 'cs' | 'en' | 'de'

export type MsgKey = keyof Messages
type MsgArgs<K extends MsgKey> = Messages[K] extends (...args: infer A) => string ? A : []

const dicts: Record<Lang, Messages> = { cs, en, de }

const STORAGE_KEY = 'studyflow-lang'

/**
 * The active language. Node-safe: tests run without localStorage/navigator and
 * must always get Czech texts.
 */
export function currentLang(): Lang {
  if (typeof localStorage === 'undefined' || typeof navigator === 'undefined') return 'cs'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'cs' || stored === 'en' || stored === 'de') return stored
  const nav = navigator.language ?? ''
  if (nav.startsWith('en')) return 'en'
  if (nav.startsWith('de')) return 'de'
  return 'cs'
}

/** Persist the language and reload so the whole app re-renders in it. */
export function setLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang)
  window.location.reload()
}

/** Translate a message key; parametrised messages take their arguments after the key. */
export function t<K extends MsgKey>(key: K, ...args: MsgArgs<K>): string {
  const entry: unknown = dicts[currentLang()][key]
  return typeof entry === 'function' ? (entry as (...a: unknown[]) => string)(...args) : (entry as string)
}
