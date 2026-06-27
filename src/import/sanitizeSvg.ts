// Basic allowlist sanitizer for inline SVG markup. Strips scripting, foreign
// content, event handlers and external/dangerous references so user-imported
// diagrams can be rendered with dangerouslySetInnerHTML without XSS risk.
// (Sprint 1 scope — for a hardened pipeline a vetted library like DOMPurify
// with its SVG profile would be the long-term choice.)

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'title', 'desc', 'symbol', 'switch',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textpath',
  'marker', 'use', 'pattern', 'mask', 'clippath',
  'lineargradient', 'radialgradient', 'stop',
  'filter', 'fegaussianblur', 'feoffset', 'feblend', 'femerge',
  'femergenode', 'fecolormatrix', 'fecomposite', 'feflood', 'femorphology',
])

function sanitizeAttrs(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    const value = attr.value.trim().toLowerCase()
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name) // event handlers
    } else if (name === 'href' || name.endsWith(':href')) {
      // Only allow same-document fragment references (e.g. <use href="#id">).
      if (!value.startsWith('#')) el.removeAttribute(attr.name)
    } else if (name === 'style' && (value.includes('javascript:') || value.includes('expression('))) {
      el.removeAttribute(attr.name)
    } else if (value.includes('javascript:')) {
      el.removeAttribute(attr.name)
    }
  }
}

function cleanTree(el: Element): void {
  sanitizeAttrs(el)
  for (const child of Array.from(el.children)) {
    if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
      child.remove()
    } else {
      cleanTree(child)
    }
  }
}

/** Returns sanitized SVG markup, or null if the input is not a usable SVG. */
export function sanitizeSvg(input: string): string | null {
  if (!input || typeof input !== 'string') return null
  if (typeof DOMParser === 'undefined') return null // SSR / non-browser guard

  const doc = new DOMParser().parseFromString(input.trim(), 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length > 0) return null

  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg') return null

  cleanTree(root)

  // Make the diagram responsive to the card width.
  if (!root.getAttribute('viewBox')) {
    const w = root.getAttribute('width')
    const h = root.getAttribute('height')
    if (w && h) root.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`)
  }
  root.removeAttribute('width')
  root.removeAttribute('height')
  root.setAttribute('width', '100%')

  return new XMLSerializer().serializeToString(root)
}
