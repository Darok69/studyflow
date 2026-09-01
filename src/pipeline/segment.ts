// Segmentation: extracted pages → semantic blocks. By structure (headings,
// paragraphs), never by character count — a definition cut in half generates a
// card that teaches nothing.
import type { Block, SourcePage } from './types'

/** Blocks longer than this are split at a paragraph boundary. */
export const MAX_BLOCK_CHARS = 1800
/** Shorter leftovers are merged into the previous block instead of standing alone. */
export const MIN_BLOCK_CHARS = 80

const NUMBERED = /^(\d+(\.\d+)*)[.)]?\s+\S/
const PARAGRAPH_SIGN = /^§+\s?\d/
const PAGE_NUMBER_ONLY = /^[-–—\s]*\d{1,4}[-–—\s]*$/

/**
 * A line reads as a heading when it is short, does not end like a sentence and
 * looks like a title: numbered ("2.1 Besitz"), a paragraph sign ("§ 823"),
 * ALL CAPS, or a capitalised line with no closing punctuation.
 */
export function isHeading(line: string): boolean {
  const s = line.trim()
  if (!s || s.length > 90) return false
  if (PAGE_NUMBER_ONLY.test(s)) return false
  if (/[.!?;,]$/.test(s)) return false
  if (PARAGRAPH_SIGN.test(s)) return true
  if (NUMBERED.test(s)) return true
  const letters = s.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true
  // A short capitalised line with at most a handful of words.
  return /^\p{Lu}/u.test(s) && s.split(/\s+/).length <= 8
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

function pushBlock(
  out: Block[],
  counters: Map<number, number>,
  page: number,
  heading: string,
  text: string,
): void {
  const body = text.trim()
  if (!body) return
  const prev = out[out.length - 1]
  // Too short to teach anything on its own — glue it to what came before, but
  // never past the point where the merged block would need splitting again.
  if (
    body.length < MIN_BLOCK_CHARS &&
    prev &&
    prev.page === page &&
    prev.heading === heading &&
    prev.text.length + body.length <= MAX_BLOCK_CHARS
  ) {
    prev.text = `${prev.text}\n${body}`
    return
  }
  const n = (counters.get(page) ?? 0) + 1
  counters.set(page, n)
  out.push({ id: `p${page}-b${n}`, heading, text: body, page })
}

/**
 * Split pages into blocks. Headings carry over between pages (a section usually
 * continues), so a block always knows which section it belongs to.
 */
export function segmentPages(pages: SourcePage[]): Block[] {
  const out: Block[] = []
  const counters = new Map<number, number>()
  let heading = ''

  for (const { page, text } of pages) {
    for (const para of paragraphs(text)) {
      const lines = para.split('\n')
      // A heading may sit on the first line of a paragraph block.
      if (lines.length > 1 && isHeading(lines[0])) {
        heading = lines[0].trim()
        lines.shift()
      } else if (lines.length === 1 && isHeading(lines[0])) {
        heading = lines[0].trim()
        continue
      }

      const body = lines.join(' ').trim()
      if (!body || PAGE_NUMBER_ONLY.test(body)) continue

      if (body.length <= MAX_BLOCK_CHARS) {
        pushBlock(out, counters, page, heading, body)
        continue
      }
      // Long paragraph: split on sentence ends, never mid-sentence.
      let chunk = ''
      for (const sentence of body.split(/(?<=[.!?])\s+/)) {
        if (chunk.length + sentence.length > MAX_BLOCK_CHARS && chunk) {
          pushBlock(out, counters, page, heading, chunk)
          chunk = ''
        }
        chunk = chunk ? `${chunk} ${sentence}` : sentence
      }
      pushBlock(out, counters, page, heading, chunk)
    }
  }

  return out
}

/** Total characters — used for the pre-run cost estimate. */
export function blocksLength(blocks: Block[]): number {
  return blocks.reduce((n, b) => n + b.text.length + b.heading.length, 0)
}
