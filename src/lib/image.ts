// Photo attachments for cards. Files from the picker/camera are downscaled on
// a canvas and stored as JPEG data URLs — they live inside the card record, so
// they work offline and travel with backup/sync/export automatically.

const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.78
/** Hard ceiling per photo AFTER compression (data URLs count against the sync snapshot). */
export const MAX_PHOTO_BYTES = 600 * 1024

/**
 * Read + downscale a picked image into a JPEG data URL.
 * Throws Error('unreadable') for non-decodable files (e.g. HEIC on non-Safari)
 * and Error('too-big') when even the compressed result stays huge.
 */
export async function fileToCardPhoto(file: File): Promise<string> {
  let bitmap: ImageBitmap
  try {
    // from-image = respect EXIF rotation (phone photos).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('unreadable')
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('unreadable')
  // JPEG has no alpha — flatten transparent PNGs onto white instead of black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  // Base64 is ~4/3 of the raw size; compare against the encoded length we store.
  if (dataUrl.length > MAX_PHOTO_BYTES * (4 / 3)) throw new Error('too-big')
  return dataUrl
}
