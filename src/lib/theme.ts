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
