// Extraction: an uploaded file → text per page. The page number travels with
// every block and ends up on every card, so a card can always be traced back to
// the page it came from.
//
// Page RENDERS (PNG per page, for schemes and maps) are deliberately not here:
// they need a native canvas on the server, and the browser already renders and
// downscales images (src/lib/image.ts). That belongs to the image phase.
import { extractText } from 'unpdf'
import { normalizePdfText } from '../gen/pipeline.mjs'

/** Text pages are cut on form feeds; without them the whole file is page 1. */
export function extractTextPages(text) {
  const parts = String(text).split('\f')
  return parts
    .map((part, i) => ({ page: i + 1, text: normalizePdfText(part) }))
    .filter((p) => p.text.length > 0)
}

export async function extractPdfPages(buffer) {
  // unpdf keeps pdf.js's line breaks; normalizePdfText turns those visual lines
  // back into paragraphs and headings.
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: false })
  return text
    .map((raw, i) => ({ page: i + 1, text: normalizePdfText(raw) }))
    .filter((p) => p.text.length > 0)
}

const EXT_BY_TYPE = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/markdown': 'md',
}

/** What kind of source this is — the upload's content type wins over its name. */
export function sniffKind(contentType, name = '') {
  const type = String(contentType ?? '').split(';')[0].trim().toLowerCase()
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return { kind: 'pdf', ext: 'pdf' }
  if (type.startsWith('image/')) return { kind: 'image', ext: EXT_BY_TYPE[type] ?? 'img' }
  if (/\.(png|jpe?g|webp)$/i.test(name)) return { kind: 'image', ext: name.split('.').pop().toLowerCase() }
  return { kind: 'text', ext: EXT_BY_TYPE[type] ?? 'txt' }
}

export const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
