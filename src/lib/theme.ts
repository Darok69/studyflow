// Shared palette (kept in sync with the CSS custom properties in index.css).
export const palette = {
  desk: '#15151E',
  panel: '#1E1E2A',
  line: '#2E2E3C',
  ink: '#ECEAF4',
  muted: '#908EA2',
  paper: '#F4EFE3',
  paperInk: '#2A2722',
  accent: '#7A6FF0',
  // urgency by days-to-exam
  far: '#34C9A3',
  mid: '#E3A53A',
  near: '#E5564E',
} as const

export type Urgency = 'far' | 'mid' | 'near' | 'none'

/** URGENCY colour — used ONLY for the deadline countdown + progress bar. */
export function urgencyColor(u: Urgency): string {
  switch (u) {
    case 'far':
      return palette.far
    case 'mid':
      return palette.mid
    case 'near':
      return palette.near
    case 'none':
      return palette.muted
  }
}

// ---- Per-subject IDENTITY palette ----
// Eight curated hues, each chosen to read clearly on the dark base (#15151E).
// Used ONLY as identity (an accent bar / dot / chip) — never as body text and
// never for urgency — so identity and urgency signals can never be confused.
export const subjectPalette = [
  '#7A6FF0', // violet
  '#34C9A3', // teal
  '#E3A53A', // amber
  '#E5709A', // rose
  '#5BA8E5', // sky
  '#88C0A0', // sage
  '#E5784E', // coral
  '#B08FE8', // lavender
] as const

export const SUBJECT_COLOR_COUNT = subjectPalette.length

/**
 * Stable, deterministic colour index for a subject id (FNV-1a hash → 0..7).
 * Same id always maps to the same hue, so a subject's colour never drifts.
 */
export function subjectColorIndex(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % SUBJECT_COLOR_COUNT
}

/** Resolve a stored colorIndex to its hex hue (wraps defensively). */
export function subjectColor(colorIndex: number): string {
  const i = ((colorIndex % SUBJECT_COLOR_COUNT) + SUBJECT_COLOR_COUNT) % SUBJECT_COLOR_COUNT
  return subjectPalette[i]
}
