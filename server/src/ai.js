// The only place in the codebase that holds the Anthropic API key. The browser
// never sees it: everything model-shaped happens behind these functions.
//
// Model routing (DECISIONS.md): Opus 5 decides about hundreds of cards at once
// (outline, quality control), Sonnet 5 does the bulk work (per-topic generation,
// vision transcription).
import Anthropic from '@anthropic-ai/sdk'
import {
  CARDS_SCHEMA,
  OUTLINE_SCHEMA,
  SYSTEM_PROMPT,
  VERDICTS_SCHEMA,
  cardsPrompt,
  costUsd,
  outlinePrompt,
  parseGeneratedCards,
  parseOutline,
  parseVerdicts,
  qcPrompt,
} from '../gen/pipeline.mjs'

const MODEL_OUTLINE = 'claude-opus-5'
const MODEL_CARDS = 'claude-sonnet-5'
const MODEL_QC = 'claude-opus-5'
const MODEL_VISION = 'claude-sonnet-5'

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 800

export class AiError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.code = code // 'no-key' | 'rate-limited' | 'api-error' | 'refused' | 'bad-output'
  }
}

/** Env is read at call time, never at import: the key may arrive with the container. */
export function aiEnabled() {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? '').trim())
}

let client = null
function getClient() {
  if (!aiEnabled()) throw new AiError('no-key')
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() })
  return client
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry what is worth retrying: rate limits, 5xx and connection errors back off
 * exponentially; a 400 is a bug in our request and repeating it only burns time.
 */
async function withRetry(fn) {
  let lastError = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const status = error?.status ?? 0
      const retryable = status === 429 || status >= 500 || error instanceof Anthropic.APIConnectionError
      if (!retryable || attempt === MAX_ATTEMPTS) break
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
    }
  }
  if (lastError?.status === 429) throw new AiError('rate-limited', lastError.message)
  throw new AiError('api-error', lastError?.message ?? 'unknown')
}

function usageOf(response) {
  const u = response.usage ?? {}
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
  }
}

function textOf(response) {
  const block = [...response.content].reverse().find((b) => b.type === 'text')
  return block?.text ?? ''
}

/**
 * One JSON call. Structured outputs guarantee the shape, the pipeline
 * validators guarantee the meaning.
 *
 * A policy refusal (a legal text about a crime is a realistic trigger) is
 * retried once on the other model rather than failing the whole run — the
 * client-side equivalent of server-side fallbacks, without a beta header.
 */
async function callJson({ model, user, schema, effort = 'high', maxTokens = 16000, allowFallback = true }) {
  const anthropic = getClient()
  const request = (m) =>
    anthropic.messages.create({
      model: m,
      max_tokens: maxTokens,
      // The system prompt is frozen (src/pipeline/prompts.ts) — a stray
      // timestamp here would invalidate the cache on every single call.
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: user }],
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema } },
    })

  let response = await withRetry(() => request(model))
  if (response.stop_reason === 'refusal' && allowFallback && model !== MODEL_CARDS) {
    response = await withRetry(() => request(MODEL_CARDS))
  }
  if (response.stop_reason === 'refusal') {
    throw new AiError('refused', response.stop_details?.explanation ?? 'refusal')
  }

  let data
  try {
    data = JSON.parse(textOf(response))
  } catch {
    throw new AiError('bad-output', 'response was not JSON')
  }

  return { data, usage: usageOf(response), model: response.model, costUsd: costUsd(model, usageOf(response)) }
}

/** Step 4: the outline the user approves before a single card is generated. */
export async function generateOutline({ blocks, subjectName, discipline }) {
  const { data, usage, costUsd: spent } = await callJson({
    model: MODEL_OUTLINE,
    user: outlinePrompt({ subjectName, discipline, blocks }),
    schema: OUTLINE_SCHEMA,
    effort: 'high',
    maxTokens: 8000,
  })
  const { value, errors } = parseOutline(data, blocks.map((b) => b.id))
  if (value.topics.length === 0) throw new AiError('bad-output', errors.join('; '))
  return { outline: value, usage, costUsd: spent, warnings: errors }
}

/** Step 5: one topic, one call — a failure costs one topic, never the batch. */
export async function generateCards({ topic, blocks, subjectName, discipline }) {
  const { data, usage, costUsd: spent } = await callJson({
    model: MODEL_CARDS,
    user: cardsPrompt({ subjectName, discipline, topic, blocks }),
    schema: CARDS_SCHEMA,
    effort: 'medium',
    maxTokens: 16000,
  })
  const pages = Object.fromEntries(blocks.map((b) => [b.id, b.page]))
  const { value, errors } = parseGeneratedCards(data, { topic: topic.title, pages })
  return { cards: value, usage, costUsd: spent, warnings: errors }
}

/**
 * Step 7, the half the rules cannot do: does the card follow from the source and
 * is it answerable from memory? Never deletes — the caller demotes to draft.
 */
export async function reviewCards({ cards, sourceText }) {
  const compact = cards.map((c) => ({ front: c.front, back: c.back, text: c.text, kind: c.kind }))
  const { data, usage, costUsd: spent } = await callJson({
    model: MODEL_QC,
    user: qcPrompt({ cards: compact, sourceText }),
    schema: VERDICTS_SCHEMA,
    effort: 'high',
    maxTokens: 8000,
  })
  const { value } = parseVerdicts(data, cards.length)
  return { verdicts: value, usage, costUsd: spent }
}

/**
 * A photographed page or a map: the model transcribes the text AND describes the
 * graphic, because a scheme carries as much of the exam as the sentences do.
 */
export async function transcribeImage({ buffer, mediaType }) {
  const anthropic = getClient()
  const response = await withRetry(() =>
    anthropic.messages.create({
      model: MODEL_VISION,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
            },
            {
              type: 'text',
              text: [
                'Přepiš veškerý text z obrázku v původním jazyce, zachovej strukturu a nadpisy.',
                'Pokud je na obrázku schéma, mapa nebo graf, popiš ho slovy tak, aby se z popisu',
                'dalo učit i bez obrázku: co znázorňuje, jaké má části a jaké vztahy mezi nimi.',
                'Nic nedomýšlej. Vrať pouze přepis, bez úvodní věty.',
              ].join(' '),
            },
          ],
        },
      ],
      output_config: { effort: 'low' },
    }),
  )
  const usage = usageOf(response)
  return { text: textOf(response), usage, costUsd: costUsd(MODEL_VISION, usage) }
}

/** Token count of a planned call — feeds the estimate shown before a run. */
export async function countPromptTokens({ model, user }) {
  const anthropic = getClient()
  const res = await anthropic.messages.countTokens({
    model,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: user }],
  })
  return res.input_tokens
}

export const MODELS = { outline: MODEL_OUTLINE, cards: MODEL_CARDS, qc: MODEL_QC, vision: MODEL_VISION }
