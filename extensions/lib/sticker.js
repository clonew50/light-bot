import { Sticker } from 'wa-sticker-formatter'

function normalizeText(value, fallback = '') {
  const text = String(value ?? fallback).trim()
  return text.slice(0, 512)
}

/**
 * Add WhatsApp sticker EXIF (pack and author) to an image or video buffer.
 */
export async function addExif(buffer, packname, author) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('addExif expects a Buffer')
  }
  if (!buffer.length) {
    throw new Error('Cannot add EXIF to an empty buffer')
  }

  const sticker = new Sticker(buffer, {
    pack: normalizeText(packname, 'LIGHT BOT'),
    author: normalizeText(author, 'LIGHT BOT'),
    type: 'full',
    quality: 90,
  })

  const result = await sticker.build()
  if (!Buffer.isBuffer(result) || !result.length) {
    throw new Error('Sticker formatter returned an empty buffer')
  }
  return result
}

export default addExif
