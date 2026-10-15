const handler = async (m, { args }) => {
  const input = args?.join(' ') || '';
  // Simulate extractVideoId from yt.js
  const extractVideoId = (value) => {
    const input = String(value || '').trim();
    const rawMatch = input.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    if (rawMatch) return rawMatch[1];

    const rawId = input.match(/^[A-Za-z0-9_-]{11}$/);
    if (rawId) return rawId[0];

    try {
      const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      let id = parsed.searchParams.get('v') || '';

      if (host === 'youtu.be') {
        id = parsed.pathname.split('/').filter(Boolean)[0] || '';
      } else if (
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'youtube-nocookie.com'
      ) {
        if (!id) {
          const parts = parsed.pathname.split('/').filter(Boolean);
          const markerIndex = parts.findIndex((part) => ['shorts', 'embed', 'live', 'v'].includes(part));
          if (markerIndex >= 0) id = parts[markerIndex + 1] || '';
        }
      }

      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  };
  const id = extractVideoId(input);
  await m.reply(JSON.stringify({ input, id }));
};
handler.command = ['debugyt2'];
handler.usage = ['debugyt2 <رابط>'];
handler.category = 'tools';
export default handler;