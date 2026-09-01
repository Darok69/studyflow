// Rule-based generator — the free path, and the DEFAULT one. No model, no key,
// no bill: patterns that carry their own answer are turned into cards, and
// anything that does not match is left alone rather than faked.
//
// Everything here is deliberately conservative. A wrong card is worse than a
// missing one: it gets learned.
import type { CardKind, Discipline } from '../db/cardKinds'
import { normalizeQuestion } from './dedupe'
import { splitSentences } from './segment'
import { checkCard } from './qc'
import type { Block, GeneratedCard, Outline, OutlineTopic } from './types'

export const FALLBACK_TAG = 'koncept'
export const MAX_CARDS_PER_BLOCK = 6

export interface FallbackOptions {
  /** Which patterns to try first — a norm is worth more in law than a figure. */
  discipline?: Discipline
  maxCards?: number
}

/** Question stems per source language — a card never leaves its own language. */
const STEMS = {
  cs: {
    what: (t: string) => `Co je ${t}?`,
    features: (t: string) => `Jaké znaky má ${t}?`,
    norm: (t: string) => `Co stanoví ${t}?`,
    leads: (t: string) => `K čemu vede ${t}?`,
    differs: (a: string, b: string) => `Čím se ${a} liší od ${b}?`,
  },
  de: {
    what: (t: string) => `Was ist ${t}?`,
    features: (t: string) => `Welche Merkmale hat ${t}?`,
    norm: (t: string) => `Was besagt ${t}?`,
    leads: (t: string) => `Wozu führt ${t}?`,
    differs: (a: string, b: string) => `Worin unterscheidet sich ${a} von ${b}?`,
  },
  en: {
    what: (t: string) => `What is ${t}?`,
    features: (t: string) => `What are the elements of ${t}?`,
    norm: (t: string) => `What does ${t} say?`,
    leads: (t: string) => `What does ${t} lead to?`,
    differs: (a: string, b: string) => `How does ${a} differ from ${b}?`,
  },
} as const

type Lang = keyof typeof STEMS

interface DefinitionPattern {
  lang: Lang
  re: RegExp
}

// "X je Y" / "X ist Y" / "X means Y", plus the legal phrasings that really do
// carry a definition ("liegt vor, wenn", "se rozumí", "versteht man unter").
const DEFINITIONS: DefinitionPattern[] = [
  {
    lang: 'cs',
    re: /^(.{2,60}?)\s+(?:je|jsou|se nazývá|nazývá se|označuje se jako|označuje|znamená|představuje|se rozumí|rozumíme|chápeme jako|spočívá v)\s+(.{15,400})$/u,
  },
  {
    lang: 'cs',
    re: /^(.{2,60}?)\s+(?:je dán[oa]?|nastává|je splněn[oa]?),?\s+(?:pokud|jestliže|když)\s+(.{15,400})$/u,
  },
  { lang: 'de', re: /^(.{2,60}?)\s+(?:ist|sind|bezeichnet|bedeutet|meint|umfasst)\s+(.{15,400})$/u },
  { lang: 'de', re: /^(.{2,60}?)\s+liegt vor,?\s+wenn\s+(.{15,400})$/u },
  { lang: 'de', re: /^Unter\s+(.{2,60}?)\s+versteht man\s+(.{15,400})$/u },
  { lang: 'en', re: /^(.{2,60}?)\s+(?:is|are|refers to|means|denotes)\s+(.{15,400})$/u },
]

/** "Pojem: definice" on its own line. */
const COLON_DEFINITION = /^([^:\n]{2,60}):\s+(.{15,400})$/u
/** "Pojem = definice". */
const EQUALS_DEFINITION = /^([^=\n]{2,60})\s*=\s*(.{10,400})$/u

/** A paragraph or article reference: § 823 BGB, čl. 5, Art. 6 EMRK. */
const NORM_REF =
  /(?:§+\s?\d+[a-z]?(?:\s+(?:Abs\.|odst\.)\s?\d+)?(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]{1,8})?|(?:čl\.|Art\.)\s?\d+[a-z]?(?:\s+[A-ZÄÖÜ]{2,8})?)/u

/** Enumerations: "…: a) x, b) y" or "…: první, druhý a třetí". */
const LIST_INTRO = /^(.{4,80}?)\s*:\s*(.+)$/u
const LIST_SPLIT = /\s*(?:;|,|\b[a-h]\)\s*|\s\d[.)]\s*)\s*/u
/** Czech and German lists join the last two items with a bare "a" / "und". */
const LAST_JOINER = /\s+(?:a|und|and)\s+/u
/** An intro that already names the elements: "Znaky deliktu jsou". */
const ELEMENTS_INTRO = /^(?:znaky|náležitosti|prvky|podmínky|merkmale|voraussetzungen|elements)\b/iu
const TRAILING_COPULA = /\s+(?:jsou|je|sind|ist|are|is)$/iu
/** Articles are not part of a term: "Ein Schaden" asks about "Schaden". */
const LEADING_ARTICLE = /^(?:der|die|das|dem|den|des|ein|eine|einer|eines|einem|the|a|an)\s+/iu
/** A sentence that starts by pointing at a norm is a norm card, not a definition. */
const NORM_LEAD = /^(?:podle|dle|nach|gemäß|laut|according to)\b/iu

/** Contrast markers that really mean "these two get confused at the exam". */
const CONTRAST =
  /^(.{3,70}?)\s+(?:na rozdíl od|oproti|im Gegensatz zu|im Unterschied zu|unlike|as opposed to)\s+(.{3,70}?)[,.]\s*(.{10,400})$/u

/** Causal markers — the backbone of a geography process card. */
const CAUSAL =
  /^(.{10,160}?)\s+(?:vede k|vedou k|způsobuje|způsobují|má za následek|führt zu|führen zu|verursacht|bewirkt|causes|leads to)\s+(.{8,300})$/u

// A "b. c." year ends on a full stop, so the trailing word boundary has to go
// on the plain years only — otherwise "451 př. n. l." never matches.
const YEAR = /(?:\b\d{1,4}\s*př\.\s*n\.\s*l\.|\b1\d{3}\b|\b20\d{2}\b)/u
const FIGURE = /\b\d[\d\s.,]*\s?(?:%|‰|km²|km2|km|m\b|mm|cm|°C|mil\.|mld\.|tis\.|Mio\.|Mrd\.|Einwohner|obyvatel)/u

const STOPWORDS = new Set([
  'který','která','které','kterého','jejich','tento','tato','toto','protože','pouze','tedy','proto',
  'také','podle','ovšem','avšak','přičemž','zatímco','jakož','tímto',
  'welche','welcher','dieser','diese','dieses','werden','wurde','durch','zwischen','sowie','jedoch',
  'dabei','damit','sodass','wobei','deren','dessen',
  'which','their','these','those','because','however','therefore','within','between',
])

function sentences(text: string): string[] {
  return splitSentences(text)
}

function detectLang(text: string): Lang {
  if (/\b(?:der|die|das|und|ist|sind|werden|nicht|eine|einer)\b/u.test(text)) return 'de'
  if (/\b(?:the|and|of|is|are|that)\b/u.test(text)) return 'en'
  return 'cs'
}

function cloze(text: string, target: string): string {
  const at = text.indexOf(target)
  if (at < 0) return text
  return `${text.slice(0, at)}{{${target}}}${text.slice(at + target.length)}`
}

function tidyTerm(term: string): string {
  return term
    .trim()
    .replace(/^[-–—•\s]+/u, '')
    .replace(/[,;:]$/u, '')
    .replace(LEADING_ARTICLE, '')
    .trim()
}

/** Czech terms read better lowercase mid-question; German nouns must not be. */
function lowerFirstCs(term: string, lang: Lang): string {
  if (lang !== 'cs' || term.length < 2) return term
  // Keep acronyms and proper names as they are.
  if (/^\p{Lu}\p{Lu}/u.test(term)) return term
  return term[0].toLowerCase() + term.slice(1)
}

/** A "term" that is really a whole clause is a false positive, not a definiendum. */
function looksLikeTerm(term: string): boolean {
  const words = term.split(/\s+/u).filter(Boolean)
  return words.length > 0 && words.length <= 6 && term.length <= 60
}

/**
 * The most distinctive word of a sentence. Domain terms win over long ordinary
 * words: a paragraph reference, a quoted expression or a noun in the middle of
 * a German sentence is what the exam actually asks about.
 */
export function significantTerm(sentence: string): string | null {
  const quoted = /[„"»']([^"“«']{3,40})[""«']/u.exec(sentence)
  if (quoted) return quoted[1]

  const norm = NORM_REF.exec(sentence)
  if (norm) return norm[0]

  const words = sentence.match(/\p{L}[\p{L}\p{M}-]{3,}/gu) ?? []
  const midCapital = words.slice(1).find((w) => /^\p{Lu}/u.test(w) && !STOPWORDS.has(w.toLowerCase()))
  if (midCapital) return midCapital

  let best: string | null = null
  for (const w of words) {
    if (STOPWORDS.has(w.toLowerCase())) continue
    if (!best || w.length > best.length) best = w
  }
  return best
}

function card(
  partial: Omit<GeneratedCard, 'level' | 'tags' | 'sourceRef' | 'topic'> & { level?: 1 | 2 | 3 },
  block: Block,
): GeneratedCard {
  return {
    level: 1,
    ...partial,
    topic: block.heading || undefined,
    tags: [FALLBACK_TAG],
    sourceRef: { page: block.page, block: block.id },
  }
}

function definitionCard(sentence: string, block: Block): GeneratedCard | null {
  for (const { lang, re } of DEFINITIONS) {
    const m = re.exec(sentence)
    if (!m) continue
    const term = tidyTerm(m[1])
    const body = m[2].trim().replace(/[.]$/u, '')
    if (!looksLikeTerm(term)) continue
    // "Podle § 823 BGB je každý povinen…" states a norm, it does not define
    // "Podle § 823 BGB".
    if (NORM_LEAD.test(term) || NORM_REF.test(term)) continue
    return card(
      { type: 'basic', kind: 'definice' satisfies CardKind, front: STEMS[lang].what(term), back: body },
      block,
    )
  }
  return null
}

/** "Znaky jsou: jednání, protiprávnost, zavinění" → a list card, one item per line. */
function listCard(line: string, block: Block, discipline: Discipline): GeneratedCard | null {
  const m = LIST_INTRO.exec(line.trim())
  if (!m) return null
  const intro = tidyTerm(m[1]).replace(TRAILING_COPULA, '')
  if (!looksLikeTerm(intro)) return null

  // A reflowed PDF paragraph puts whole sentences after the colon; the list is
  // only the first of them, everything after belongs to the next thought.
  const listBody = splitSentences(m[2], 1)[0] ?? m[2]
  const parts = listBody
    .split(LIST_SPLIT)
    .map((i) => i.trim().replace(/[.]$/u, ''))
    .filter(Boolean)
  // The last item usually carries "… a škoda" / "… und Schaden" with it.
  const items = parts
    .flatMap((part, i) => (i === parts.length - 1 ? part.split(LAST_JOINER) : [part]))
    .map((i) => i.trim())
    .filter((i) => i.length >= 3)
  if (items.length < 2 || items.length > 8) return null

  const lang = detectLang(line)
  const front = ELEMENTS_INTRO.test(intro)
    ? lang === 'de'
      ? `Welche ${lowerFirstCs(intro, lang)}?`
      : `Jaké jsou ${lowerFirstCs(intro, lang)}?`
    : STEMS[lang].features(lowerFirstCs(intro, lang))
  // Items on their own lines: the study screen then reveals them one at a time.
  return card(
    {
      type: 'basic',
      kind: discipline === 'law' ? 'znaky' : 'basic',
      front,
      back: items.join('\n'),
    },
    block,
  )
}

function normCard(sentence: string, block: Block): GeneratedCard | null {
  const ref = NORM_REF.exec(sentence)
  if (!ref) return null
  // The reference alone is not a card — the sentence has to say something.
  const rest = sentence.replace(ref[0], '').trim()
  if (rest.length < 25) return null
  const lang = detectLang(sentence)
  return card(
    { type: 'basic', kind: 'norma', front: STEMS[lang].norm(ref[0].trim()), back: sentence },
    block,
  )
}

function contrastCard(sentence: string, block: Block): GeneratedCard | null {
  const m = CONTRAST.exec(sentence)
  if (!m) return null
  const a = tidyTerm(m[1])
  const b = tidyTerm(m[2])
  if (!looksLikeTerm(a) || !looksLikeTerm(b)) return null
  const lang = detectLang(sentence)
  const explanation = m[3].trim().replace(/[.]$/u, '')
  return card(
    {
      type: 'basic',
      kind: 'rozliseni',
      level: 2,
      front: STEMS[lang].differs(lowerFirstCs(a, lang), lowerFirstCs(b, lang)),
      back: explanation,
    },
    block,
  )
}

function processCard(sentence: string, block: Block): GeneratedCard | null {
  const m = CAUSAL.exec(sentence)
  if (!m) return null
  const cause = tidyTerm(m[1])
  const effect = m[2].trim().replace(/[.]$/u, '')
  if (cause.length < 8 || effect.length < 8) return null
  const lang = detectLang(sentence)
  return card(
    { type: 'basic', kind: 'proces', level: 2, front: STEMS[lang].leads(cause), back: effect },
    block,
  )
}

/**
 * Order of the patterns for a discipline. Law subsumes, so norms and
 * distinctions come early; geography explains, so processes do.
 */
function patternOrder(discipline: Discipline): ((s: string, b: Block) => GeneratedCard | null)[] {
  if (discipline === 'law') return [normCard, definitionCard, contrastCard, processCard]
  if (discipline === 'geography') return [definitionCard, processCard, contrastCard]
  return [definitionCard, contrastCard, processCard]
}

/**
 * Cards from one block, most trustworthy patterns first. A sentence is used at
 * most once, and every card goes through the same quality rules the model's
 * output does — a rule-made card that fails them is dropped, not shipped.
 */
export function fallbackCardsFromBlock(
  block: Block,
  opts: FallbackOptions | number = {},
): GeneratedCard[] {
  const { discipline = 'general' as Discipline, maxCards = MAX_CARDS_PER_BLOCK } =
    typeof opts === 'number' ? { maxCards: opts, discipline: 'general' as Discipline } : opts

  const out: GeneratedCard[] = []
  const usedSentences = new Set<string>()
  const seenQuestions = new Set<string>()

  const take = (c: GeneratedCard | null, sentence?: string): boolean => {
    if (!c || out.length >= maxCards) return false
    if (checkCard(c).length > 0) return false
    const key = normalizeQuestion(c.front ?? c.text ?? '')
    if (!key || seenQuestions.has(key)) return false
    seenQuestions.add(key)
    if (sentence) usedSentences.add(sentence)
    out.push(c)
    return true
  }

  // 1. Line-level shapes: enumerations, colon definitions, "X = Y".
  for (const rawLine of block.text.split('\n')) {
    const line = rawLine.trim()
    if (!line || out.length >= maxCards) break

    if (take(listCard(line, block, discipline), line)) continue

    const colon = COLON_DEFINITION.exec(line)
    if (colon && looksLikeTerm(tidyTerm(colon[1]))) {
      const lang = detectLang(line)
      const made = card(
        {
          type: 'basic',
          kind: 'definice',
          front: STEMS[lang].what(tidyTerm(colon[1])),
          back: colon[2].trim(),
        },
        block,
      )
      if (take(made, line)) continue
    }

    const equals = EQUALS_DEFINITION.exec(line)
    if (equals && looksLikeTerm(tidyTerm(equals[1]))) {
      const lang = detectLang(line)
      take(
        card(
          { type: 'basic', kind: 'definice', front: STEMS[lang].what(tidyTerm(equals[1])), back: equals[2].trim() },
          block,
        ),
        line,
      )
    }
  }

  // 2. Sentence-level patterns, in the order that matters for this discipline.
  //    Enumerations are tried here too: once a PDF paragraph is reflowed, the
  //    list no longer sits on a line of its own.
  const patterns = patternOrder(discipline)
  for (const sentence of sentences(block.text)) {
    if (out.length >= maxCards) break
    if (usedSentences.has(sentence)) continue
    if (take(listCard(sentence, block, discipline), sentence)) continue
    for (const pattern of patterns) {
      if (take(pattern(sentence, block), sentence)) break
    }
  }

  // 3. Dates and magnitudes: a cloze keeps the sentence's own wording. Figures
  //    become `cisla` cards so an order-of-magnitude answer is graded as right.
  for (const sentence of sentences(block.text)) {
    if (out.length >= maxCards) break
    if (usedSentences.has(sentence)) continue

    const year = YEAR.exec(sentence)
    if (year && take(card({ type: 'cloze', kind: 'cloze', text: cloze(sentence, year[0]) }, block), sentence)) {
      continue
    }
    const figure = FIGURE.exec(sentence)
    if (figure) {
      take(
        card(
          {
            type: 'cloze',
            kind: discipline === 'geography' ? 'cisla' : 'cloze',
            text: cloze(sentence, figure[0].trim()),
          },
          block,
        ),
        sentence,
      )
    }
  }

  // 4. Nothing recognisable — one cloze on the most distinctive term, so a block
  //    is never silently skipped.
  if (out.length === 0) {
    for (const sentence of sentences(block.text)) {
      const term = significantTerm(sentence)
      if (!term) continue
      if (take(card({ type: 'cloze', kind: 'cloze', text: cloze(sentence, term) }, block), sentence)) break
    }
  }

  return out
}

export function fallbackCards(blocks: Block[], opts: FallbackOptions | number = {}): GeneratedCard[] {
  return blocks.flatMap((b) => fallbackCardsFromBlock(b, opts))
}

/**
 * Outline without a model: headings become topics, blocks without a heading go
 * to one bucket. The card estimate is the number the rules would really
 * produce, so the approval screen tells the truth instead of guessing.
 */
export function fallbackOutline(blocks: Block[], opts: FallbackOptions = {}): Outline {
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
    const cardEstimate = list.reduce((n, b) => n + fallbackCardsFromBlock(b, opts).length, 0)
    topics.push({
      id: `t${i}`,
      title: heading || 'Ostatní',
      blockIds: list.map((b) => b.id),
      difficulty: 2,
      // ~1200 characters of material ≈ 5 minutes of reading + carding.
      estimatedMinutes: Math.max(5, Math.round(chars / 240)),
      cardEstimate,
    })
  }
  return { topics }
}
