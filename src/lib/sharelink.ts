// Deck sharing without a backend: the deck JSON travels inside the URL
// fragment (deflate-raw + base64url), so a friend opens the link and the
// Import screen is pre-filled. The fragment never leaves the browser — no
// server ever sees the deck.

const MARK_DEFLATE = '1.'
const MARK_PLAIN = '0.'

export const DECK_HASH_PREFIX = '#deck='

/** Links longer than this are unreliable across browsers/messengers. */
export const MAX_LINK_LENGTH = 60_000

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await res.arrayBuffer())
}

/** Deck JSON → compact fragment payload. Falls back to plain base64 where
 *  CompressionStream is unavailable (older Safari). */
export async function encodeDeckPayload(json: string): Promise<string> {
  const utf8 = new TextEncoder().encode(json)
  if (typeof CompressionStream === 'function') {
    const packed = await pipe(utf8, new CompressionStream('deflate-raw'))
    return MARK_DEFLATE + bytesToBase64Url(packed)
  }
  return MARK_PLAIN + bytesToBase64Url(utf8)
}

/** Fragment payload → deck JSON; null when malformed/unknown. Never throws. */
export async function decodeDeckPayload(payload: string): Promise<string | null> {
  try {
    if (payload.startsWith(MARK_DEFLATE)) {
      const raw = await pipe(base64UrlToBytes(payload.slice(2)), new DecompressionStream('deflate-raw'))
      return new TextDecoder().decode(raw)
    }
    if (payload.startsWith(MARK_PLAIN)) {
      return new TextDecoder().decode(base64UrlToBytes(payload.slice(2)))
    }
    return null
  } catch {
    return null
  }
}

/** Extract the deck payload from a location.hash, if present. */
export function payloadFromHash(hash: string): string | null {
  return hash.startsWith(DECK_HASH_PREFIX) ? hash.slice(DECK_HASH_PREFIX.length) : null
}
