// Image occlusion — the geography half of the degree, and entirely free: a map,
// a few rectangles, one card per named place. Coordinates are ALWAYS relative
// (0–1), so the same masks fit a phone, a laptop and a printout (BRIEF §7).
import type { Occlusion, OcclusionMask } from '../db/db'
import type { CardDraft } from '../import/parseDeck'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Anything smaller than this is a stray tap, not a mask. */
export const MIN_MASK_SIZE = 0.015

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** A rectangle from two dragged corners, clamped to the image and never negative. */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x1 = clamp01(Math.min(a.x, b.x))
  const y1 = clamp01(Math.min(a.y, b.y))
  const x2 = clamp01(Math.max(a.x, b.x))
  const y2 = clamp01(Math.max(a.y, b.y))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function isTooSmall(rect: Rect, min = MIN_MASK_SIZE): boolean {
  return rect.w < min || rect.h < min
}

/** Which mask is under a point — the last one drawn wins, as on any canvas. */
export function maskAt(masks: OcclusionMask[], point: Point): OcclusionMask | undefined {
  for (let i = masks.length - 1; i >= 0; i--) {
    const m = masks[i]
    if (point.x >= m.x && point.x <= m.x + m.w && point.y >= m.y && point.y <= m.y + m.h) return m
  }
  return undefined
}

/** Pixel position inside an element → relative coordinates. */
export function toRelative(point: Point, box: { width: number; height: number }): Point {
  return {
    x: box.width > 0 ? clamp01(point.x / box.width) : 0,
    y: box.height > 0 ? clamp01(point.y / box.height) : 0,
  }
}

export type MaskRole = 'target' | 'context' | 'hidden-context'

/**
 * How each mask is drawn for a given card. `hide-one-guess-one` covers only the
 * asked place and leaves the rest of the map readable (recognition with
 * context); `hide-all-guess-one` covers everything and marks the asked one, so
 * the neighbours cannot be used as clues.
 */
export function maskRoles(occlusion: Occlusion, targetId: string): Map<string, MaskRole> {
  const roles = new Map<string, MaskRole>()
  for (const mask of occlusion.masks) {
    if (mask.id === targetId) roles.set(mask.id, 'target')
    else roles.set(mask.id, occlusion.mode === 'hide-all-guess-one' ? 'hidden-context' : 'context')
  }
  return roles
}

export interface OcclusionCardInput {
  /** The whole map, kept on every card so the place has its context. */
  masks: OcclusionMask[]
  mode: Occlusion['mode']
  imageKey: string
  /** Alt text of the picture — required, and reused as the question. */
  alt: string
  topic?: string
}

/**
 * One card per labelled mask. The label is the answer, so a typed answer works
 * exactly as on any other card; unlabelled masks are context only.
 */
export function occlusionCards({ masks, mode, imageKey, alt, topic }: OcclusionCardInput): CardDraft[] {
  const labelled = masks.filter((m) => m.label.trim())
  return labelled.map((target) => ({
    type: 'basic' as const,
    kind: 'mapa' as const,
    level: 1 as const,
    topic,
    front: alt.trim() ? `${alt.trim()} — co je zakryté?` : 'Co je zakryté?',
    back: target.label.trim(),
    tags: ['mapa'],
    // The asked mask comes first; the study screen reads that order.
    occlusion: { imageKey, mode, masks: [target, ...masks.filter((m) => m.id !== target.id)] },
    images: [{ key: imageKey, role: 'prompt' as const, alt: alt.trim() || target.label.trim() }],
  }))
}
