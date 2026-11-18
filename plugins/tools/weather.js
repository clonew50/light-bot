/*
  ═══════════════════════════════════════════
  🌤️ حالة الطقس — Open-Meteo (مجاني، بدون مفتاح)
  الأمر: .طقس <مدينة>  |  .جو <مدينة>
  ═══════════════════════════════════════════
*/
import axios from 'axios'
import { pruneCooldown } from '../../system/cooldowns.js'

const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const COOLDOWN = 15 * 1000
const cooldown = new Map()

const handler = async (m, { conn, text }) => {
  try {
    const city = (text || '').trim()
    if (!city) return m.reply('📍 اكتب اسم المدينة: .طقس القاهرة')

    /* كولداون ضد السبام */
    const now = Date.now()
    const last = cooldown.get(m.sender) || 0
    if (now - last < COOLDOWN)
      return m.reply(`⏳ استنى ${Math.ceil((COOLDOWN - (now - last)) / 1000)} ثانية تانية قبل عملية جديدة`)

    pruneCooldown(cooldown, COOLDOWN)
    cooldown.set(m.sender, now)

    const { data: geo } = await axios.get(GEOCODE, { params: { name: city, count: 1, language: 'ar', format: 'json' } })
    if (!geo?.results?.length) return m.reply('❌ مدينة غير معروفة')

    const { latitude, longitude, name, country, admin1 } = geo.results[0]
    const { data: fc } = await axios.get(FORECAST, {
      params: {
        latitude, longitude,
        current_weather: true,
        daily: 'temperature_2m_max,temperature_2m_min,weathercode',
        timezone: 'auto'
      }
    })

    const cw = fc.current_weather
    const daily = fc.daily
    const codes = {
      0: '☀️ صافٍ', 1: '🌤️ غائم جزئياً', 2: '⛅ غائم', 3: '☁️ مغطى',
      45: '🌫️ ضباب', 48: '🌫️ ضباب متجمد', 51: '🌦️ رذاذ خفيف', 53: '🌦️ رذاذ متوسط',
      55: '🌧️ رذاذ كثيف', 61: '🌧️ مطر خفيف', 63: '🌧️ مطر متوسط', 65: '🌧️ مطر غزير',
      71: '❄️ ثلج خفيف', 73: '❄️ ثلج متوسط', 75: '❄️ ثلج كثيف', 80: '🌦️ زخات مطر',
      95: '⛈️ عاصفة', 99: '⛈️ عاصفة ببرد'
    }

    const today = daily?.weathercode?.[0] ? codes[daily.weathercode[0]] : '—'
    const maxT = daily?.temperature_2m_max?.[0] ?? '—'
    const minT = daily?.temperature_2m_min?.[0] ?? '—'

    const msg = `🌤️ *حالة الطقس: ${name}${admin1 ? `، ${admin1}` : ''}${country ? `، ${country}` : ''}*\n\n` +
      `🌡️ *الحالية:* ${cw?.temperature}°C (رياح ${cw?.windspeed} كم/س)\n` +
      `☁️ *الحالة:* ${codes[cw?.weathercode] || 'غير معروف'}\n\n` +
      `📅 *اليوم:* ${today}\n` +
      `🔺 *العليا:* ${maxT}°C | 🔻 *الصغرى:* ${minT}°C`

    await m.reply(msg)
  } catch (e) {
    console.error('weather:', e)
    m.reply('❌ فشل جلب الطقس')
  }
}

handler.command = ['طقس', 'جو', 'weather']
handler.usage = ['طقس القاهرة', 'طقس دبي', 'جو الرياض']
handler.category = 'tools'
export default handler