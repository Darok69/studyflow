// Rule-based generator — the promise that the app keeps working with no model,
// no key and no network (BRIEF §4.8). It is deliberately conservative: it only
// makes cards out of shapes that carry their own answer (definitions, dates,
// figures), and everything it produces is tagged `koncept` so the user can see
// where it came from.
import type { CardKind } from '../db/cardKinds'
import type { Block, GeneratedCard, Outline, OutlineTopic } from './types'

export const FALLBACK_TAG = 'koncept'
export const MAX_CARDS_PER_BLOCK = 4

/** Question stems per source language — the card never leaves its own language. */
const STEMS = {
  cs: (term: string) => `Co je ${term}?`,
  de: (term: string) => `Was ist ${term}?`,
  en: (term: string) => `What is ${term}?`,
} as const

type Lang = keyof typeof STEMS

interface DefinitionPattern {
  lang: Lang
  re: RegExp
}

// "X je Y" / "X ist Y" / "X means Y". The term side is kept short on purpose:
// a whole clause before the verb is a sentence, not a definiendum.
const DEFINITIONS: DefinitionPattern[] = [
  { lang: 'cs', re: /^(.{2,60}?)\s+(?:je|jsou|se nazývá|nazývá se|označuje|znamená|představuje)\s+(.{15,400})$/u },
  { lang: 'de', re: /^(.{2,60}?)\s+(?:ist|sind|bezeichnet|bedeutet|versteht man)\s+(.{15,400})$/u },
  { lang: 'en', re: /^(.{2,60}?)\s+(?:is|are|refers to|means)\s+(.{15,400})$/u },
]

/** "Pojem: definice" on its own line. */
const COLON_DEFINITION = /^([^:\n]{2,60}):\s+(.{15,400})$/u

const YEAR = /\b(?:\d{1,4}\s*př\.\s*n\.\s*l\.|1\d{3}|20\d{2})\b/u
const FIGURE = /\b\d[\d\s.,]*\s?(?:%|‰|km²|km2|km|m\b|mm|cm|°C|mil\.|mld\.|tis\.|Mio\.|Mrd\.)/u

const STOPWORDS = new Set([
  'který','která','které','jejich','tento','tato','toto','protože','pouze','tedy','proto','také',
  'welche','welcher','dieser','diese','dieses','werden','wurde','durch','zwischen','sowie',
  'which','their','these','those','because','however','therefore',
])

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25)
}

function detectLang(text: string): Lang {
  if (/\b(?:der|die|das|und|ist|werden|nicht)\b/u.test(text)) return 'de'
  if (/\b(?:the|and|of|is|are)\b/u.test(text)) return 'en'
  return 'cs'
}

function cloze(text: string, target: string): string {
  const at = text.indexOf(target)
  if (at < 0) return text
  return `${text.slice(0, at)}{{${target}}}${text.slice(at + target.length)}`
}

/** The most distinctive word of a sentence: longest non-stopword term. */
export function significantTerm(sentence: string): string | null {
  const words = sentence.match(/\p{L}[\p{L}\p{M}-]{4,}/gu) ?? []
  let best: string | null = null
  for (const w of words) {
    if (STOPWORDS.has(w.toLowerCase())) continue
    if (!best || w.length > best.length) best = w
  }
  return best
}

function card(
  partial: Omit<GeneratedCard, 'level' | 'tags' | 'sourceRef' | 'topic'>,
  block: Block,
  topic: string,
): GeneratedCard {
  return {
    ...partial,
    level: 1,
    topic: topic || undefined,
    tags: [FALLBACK_TAG],
    sourceRef: { page: block.page, block: block.id },
  }
}

function definitionCard(sentence: string, block: Block, topic: string): GeneratedCard | null {
  for (const { lang, re } of DEFINITIONS) {
    const m = re.exec(sentence)
    if (!m) continue
    const term = m[1].trim().replace(/[,;]$/u, '')
    const definition = m[2].trim().replace(/[.]$/u, '')
    // A term that is itself a sentence is a false positive.
    if (term.split(/\s+/u).length > 6) continue
    return card(
      { type: 'basic', kind: 'definice' satisfies CardKind, front: STEMS[lang](term), back: definition },
      block,
      topic,
    )
  }
  return null
}

/**
 * Cards from one block, in order of trustworthiness: definitions first, then
 * dates and figures, and only then a cloze on the most distinctive term.
 */
export function fallbackCardsFromBlock(
  block: Block,
  maxCards: number = MAX_CARDS_PER_BLOCK,
): GeneratedCard[] {
  const topic = block.heading
  const out: GeneratedCard[] = []
  const used = new Set<string>()

  // Colon definitions sit on their own lines, before sentence splitting.
  for (const line of block.text.split('\n')) {
    const m = COLON_DEFINITION.exec(line.trim())
    if (!m) continue
    const term = m[1].trim()
    if (term.split(/\s+/u).length > 6) continue
    const lang = detectLang(line)
    out.push(
      card(
        { type: 'basic', kind: 'definice', front: STEMS[lang](term), back: m[2].trim() },
        block,
        topic,
      ),
    )
    used.add(line.trim())
    if (out.length >= maxCards) return out
  }

  for (const sentence of sentences(block.text)) {
    if (used.has(sentence)) continue

    const def = definitionCard(sentence, block, topic)
    if (def) {
      out.push(def)
      used.add(sentence)
      if (out.length >= maxCards) return out
      continue
    }

    const year = YEAR.exec(sentence)
    if (year) {
      out.push(card({ type: 'cloze', kind: 'cloze', text: cloze(sentence, year[0]) }, block, topic))
      used.add(sentence)
      if (out.length >= maxCards) return out
      continue
    }

    const figure = FIGURE.exec(sentence)
    if (figure) {
      out.push(card({ type: 'cloze', kind: 'cloze', text: cloze(sentence, figure[0].trim()) }, block, topic))
      used.add(sentence)
      if (out.length >= maxCards) return out
      continue
    }
  }

  // Nothing recognisable — one cloze on the most distinctive term, so the block
  // is not silently skipped.
  if (out.length === 0) {
    for (const sentence of sentences(block.text)) {
      const term = significantTerm(sentence)
      if (!term) continue
      out.push(card({ type: 'cloze', kind: 'cloze', text: cloze(sentence, term) }, block, topic))
      break
    }
  }

  return out
}

export function fallbackCards(blocks: Block[], maxPerBlock = MAX_CARDS_PER_BLOCK): GeneratedCard[] {
  return blocks.flatMap((b) => fallbackCardsFromBlock(b, maxPerBlock))
}

/**
 * Outline without a model: headings become topics, blocks without a heading go
 * to one "Ostatní" bucket. Estimates are rough by definition — they exist so
 * the approval screen has something to show offline.
 */
export function fallbackOutline(blocks: Block[]): Outline {
  const byHeading = new Map<string, Block[]>()
  for (const b of blocks) {
    const key = b.heading || ''
    const list = byHeading.get(key)
    if (list) list.push(b)
    else byHeading.set(key, [b])
  }

  const topics: OutlineTopic[] = []
  let i = 0
  for (const [heading, list] of byHeading) {
    i++
    const chars = list.reduce((n, b) => n + b.text.length, 0)
    topics.push({
      id: `t${i}`,
      title: heading || 'Ostatní',
      blockIds: list.map((b) => b.id),
      difficulty: 2,
      // ~1200 characters of material ≈ 5 minutes of reading + carding.
      estimatedMinutes: Math.max(5, Math.round(chars / 240)),
      cardEstimate: list.length * 2,
    })
  }
  return { topics }
}
