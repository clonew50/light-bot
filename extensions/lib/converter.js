import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const AUDIO_EXTENSIONS = new Set([
  'aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'webm',
])

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (typeof data === 'string') return Buffer.from(data)
  throw new TypeError('toAudio expects a Buffer, Uint8Array, ArrayBuffer, or base64 string')
}

function normalizeExtension(ext) {
  return String(ext || '').replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inputPath,
      '-vn',
      '-codec:a', 'libmp3lame',
      '-q:a', '2',
      outputPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 16_384) stderr = stderr.slice(-16_384)
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

/**
 * Convert downloaded media into an MP3 audio buffer.
 *
 * The helper uses the system ffmpeg binary when conversion is necessary and
 * safely returns already-audio data when no conversion is required.
 */
export async function toAudio(data, ext = '') {
  const buffer = toBuffer(data)
  const extension = normalizeExtension(ext)

  if (extension === 'mp3') {
    return { data: buffer, mimetype: 'audio/mpeg' }
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return { data: buffer, mimetype: `audio/${extension === 'oga' ? 'ogg' : extension}` }
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lightbot-audio-'))
  const inputPath = path.join(tempDir, `input${extension ? `.${extension}` : '.bin'}`)
  const outputPath = path.join(tempDir, 'output.mp3')

  try {
    await writeFile(inputPath, buffer)
    await runFfmpeg(inputPath, outputPath)
    const converted = await readFile(outputPath)
    if (!converted.length) throw new Error('ffmpeg produced an empty audio file')
    return { data: converted, mimetype: 'audio/mpeg' }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

export default toAudio
