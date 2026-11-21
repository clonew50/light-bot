import sharp from 'sharp'

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&' + 'apos;')
}

function getInitials(number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits.slice(-2).padStart(2, '•')
}

async function makeAvatar(input, size, number) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )

  if (input?.length) {
    return sharp(input)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
  }

  const initials = escapeXml(getInitials(number))
  const placeholder = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#334155"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#e2e8f0" font-family="sans-serif" font-size="${Math.round(size * 0.32)}" font-weight="700">${initials}</text></svg>`,
  )
  return sharp(placeholder).png().toBuffer()
}

export async function createWelcomeImage({
  avatar,
  background,
  number = '',
  title = 'WELCOME TO GROUP',
  brand = 'LIGHT BOT',
} = {}) {
  const size = 1080
  const avatarSize = 360
  const avatarBuffer = await makeAvatar(avatar, avatarSize, number)
  const left = Math.round((size - avatarSize) / 2)
  const top = 245

  const overlay = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="690" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="58" font-weight="700">+${escapeXml(number)}</text>
    <text x="50%" y="770" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="38" font-weight="600">${escapeXml(title)}</text>
    <text x="28" y="1040" fill="#cbd5e1" font-family="sans-serif" font-size="24">${escapeXml(brand)}</text>
  </svg>`)

  const base = background?.length
    ? sharp(background).resize(size, size, { fit: 'cover' })
    : sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 15, g: 23, b: 42, alpha: 1 },
        },
      })

  return base
    .composite([
      { input: avatarBuffer, left, top },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer()
}

export default createWelcomeImage
