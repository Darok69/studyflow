// Worked examples with fading (BRIEF §5.8). A case is first shown solved end to
// end; on later encounters fewer steps are handed over and more has to be
// produced from memory. Pure + testable: no React, no DB.
import type { CardKind } from '../db/cardKinds'

/**
 * Kinds whose answer is a sequence rather than one statement. A list of
 * elements belongs here too: at the exam they are recited one by one, so they
 * should be retrieved one by one.
 */
const STEPPED: ReadonlySet<CardKind> = new Set<CardKind>(['pripad', 'schema', 'proces', 'znaky'])

export function isStepped(kind: CardKind | undefined): boolean {
  return kind !== undefined && STEPPED.has(kind)
}

/**
 * Split an answer into steps. Lines win (that is how the generator is asked to
 * write schemes); a single line falls back to arrows and then to numbering.
 */
export function answerSteps(back: string): string[] {
  const lines = back
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length > 1) return lines

  const single = lines[0] ?? ''
  const arrows = single
    .split(/\s*(?:→|->|=>)\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (arrows.length > 1) return arrows

  const numbered = single
    .split(/\s*(?=\d[.)]\s)/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (numbered.length > 1) return numbered

  return single ? [single] : []
}

/**
 * How many steps are handed over for free when the answer is revealed.
 * First encounter = the whole worked example, then one fewer each time, until
 * only the task is left. Cards that are not stepped never fade.
 */
export function preRevealedSteps(kind: CardKind | undefined, reps: number, total: number): number {
  if (!isStepped(kind) || total <= 1) return total
  return Math.max(0, total - Math.max(0, reps))
}
