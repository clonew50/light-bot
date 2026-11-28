import { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import { randomBytes } from 'node:crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);
const pending = new Map();
let isPatched = false;
const MAX_DURATION_SEC = 30;
const MAX_STICKER_BYTES = 950 * 1024;

function patchProto(M) {
  if (isPatched) return;
  isPatched = true;

  const patches = [
    [M, 'audioStickerMessage', 1074, M.FutureProofMessage],
    [M.StickerMessage, 'audioMessage', 210, M.AudioMessage],
  ];

  for (const [type, field, tag, schema] of patches) {
    if (!type || !schema) continue;
    const origEncode = type.encode;
    type.encode = (message, writer) =>
      message[field]
        ? schema
            .encode(
              message[field],
              origEncode(message, writer).uint32(tag).fork()
            )
            .ldelim()
        : origEncode(message, writer);
  }
}

async function getVideoFPS(inputPath) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
      { timeout: 10000 }
    );
    let fps = stdout.trim();
    if (fps.includes('/')) {
      const [num, den] = fps.split('/').map(Number);
      fps = Math.round(num / (den || 1));
    }
    return Math.min(Math.max(parseInt(fps, 10) || 12, 8), 15);
  } catch {
    return 12;
  }
}

async function getMediaDurationSec(filePath) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 10000 }
    );
    const sec = Math.round(parseFloat(stdout.trim()));
    return Number.isFinite(sec) && sec > 0 ? sec : MAX_DURATION_SEC;
  } catch {
    return MAX_DURATION_SEC;
  }
}

async function videoToStickerWebp(videoBuffer) {
  const id = `${Date.now()}_${randomBytes(3).toString('hex')}`;
  const inPath = join(tmpdir(), `vid_in_${id}.mp4`);
  const outPath = join(tmpdir(), `vid_out_${id}.webp`);

  writeFileSync(inPath, videoBuffer);

  const tempFiles = [inPath, outPath];

  try {
    const baseFps = await getVideoFPS(inPath);
    const dur = Math.min(await getMediaDurationSec(inPath), MAX_DURATION_SEC);

    const attempts = [
      { fps: baseFps, size: 512, q: 45, comp: 4 },
      { fps: Math.min(baseFps, 10), size: 512, q: 30, comp: 6 },
      { fps: 8, size: 320, q: 35, comp: 6 },
      { fps: 6, size: 256, q: 25, comp: 6 },
    ];

    let chosenBuf = null;

    for (let i = 0; i < attempts.length; i++) {
      const { fps, size, q, comp } = attempts[i];
      const tryPath = i === 0 ? outPath : join(tmpdir(), `vid_try${i}_${id}.webp`);
      if (i > 0) tempFiles.push(tryPath);

      const vf = `fps=${fps},scale=${size}:${size}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
      const cmd = `ffmpeg -y -i "${inPath}" -vf "${vf}" -c:v libwebp -lossless 0 -compression_level ${comp} -q:v ${q} -loop 0 -preset default -an -t ${dur} "${tryPath}"`;
      await execAsync(cmd, { timeout: 120000 });

      if (existsSync(tryPath)) {
        const buf = readFileSync(tryPath);
        chosenBuf = buf;
        if (buf.length <= MAX_STICKER_BYTES) break;
      }
    }

    if (!chosenBuf?.length) {
      throw new Error('فشل تحويل الفيديو إلى ملصق');
    }

    console.log('[ANIM STICKER READY] bytes:', chosenBuf.length, '| dur:', dur);

    return {
      stickerBuffer: chosenBuf,
      seconds: dur
    };
  } finally {
    for (const f of tempFiles) {
      try { if (existsSync(f)) unlinkSync(f); } catch {}
    }
  }
}

async function extractAudioM4a(inputBuffer, isVideo = true, maxDurationSec = null) {
  const id = `${Date.now()}_${randomBytes(3).toString('hex')}`;
  const ext = isVideo ? 'mp4' : 'bin';
  const inPath = join(tmpdir(), `aud_in_${id}.${ext}`);
  const outPath = join(tmpdir(), `aud_out_${id}.m4a`);

  writeFileSync(inPath, inputBuffer);

  try {
    let hasAudio = true;
    if (isVideo) {
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${inPath}"`,
          { timeout: 10000 }
        );
        hasAudio = stdout.trim().includes('audio');
      } catch {
        hasAudio = false;
      }
    }

    const durArg = maxDurationSec ? `-t ${maxDurationSec}` : '';

    if (isVideo && !hasAudio) {
      const silentDur = maxDurationSec ? Math.min(maxDurationSec, MAX_DURATION_SEC) : 3;
      const silentCmd = `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${silentDur} -c:a aac -b:a 128k "${outPath}"`;
      await execAsync(silentCmd, { timeout: 90000 });
    } else {
      const cmd = `ffmpeg -y -i "${inPath}" ${durArg} -vn -c:a aac -b:a 128k -ar 44100 -ac 2 "${outPath}"`;
      await execAsync(cmd, { timeout: 90000 });
    }

    if (!existsSync(outPath)) {
      throw new Error('فشل استخراج الصوت');
    }

    const m4aBuffer = readFileSync(outPath);
    const seconds = await getMediaDurationSec(outPath);
    return { m4aBuffer, seconds };
  } finally {
    try { if (existsSync(inPath)) unlinkSync(inPath); } catch {}
    try { if (existsSync(outPath)) unlinkSync(outPath); } catch {}
  }
}

async function sendStickerOnly(conn, chat, stickerBuffer, m4aBuffer, seconds) {
  const prepAud = await prepareWAMessageMedia(
    {
      audio: m4aBuffer,
      mimetype: 'audio/mp4',
      ptt: false,
      seconds
    },
    { upload: conn.waUploadToServer }
  );

  const p = await prepareWAMessageMedia(
    {
      sticker: stickerBuffer,
      isAnimated: true
    },
    { upload: conn.waUploadToServer }
  );

  patchProto(p.constructor);

  const payload = {
    ...p,
    stickerMessage: {
      ...p.stickerMessage,
      height: p.stickerMessage?.height || 512,
      width: p.stickerMessage?.width || 512,
      isAnimated: true,
      audioMessage: prepAud.audioMessage
    },
    messageContextInfo: {
      messageSecret: randomBytes(32)
    }
  };

  await conn.relayMessage(chat, payload, {});
}

let handler = async (m, { conn }) => {
  try {
    if (!m.quoted) {
      return m.reply('❌ رد على **فيديو** أو **استيكر** أو **صوت** بالأمر `.asticker`');
    }

    const qMsg = m.quoted.message || m.quoted.fakeObj?.message || {};
    const video =
      qMsg.videoMessage ||
      (m.quoted.mtype === 'videoMessage' ? m.quoted.msg : null);
    const audio =
      qMsg.audioMessage ||
      (m.quoted.mtype === 'audioMessage' ? m.quoted.msg : null);
    const isSticker =
      Boolean(qMsg.stickerMessage) || m.quoted.mtype === 'stickerMessage';

    if (!video && !audio && !isSticker) {
      return m.reply('❌ لازم ترد على **فيديو** أو **استيكر** أو **صوت**.');
    }

    if (video) {
      await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

      const vidBuf = await m.quoted.download();
      if (!vidBuf?.length) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply('❌ فشل تحميل الفيديو.');
      }

      const { stickerBuffer, seconds } = await videoToStickerWebp(vidBuf);
      const { m4aBuffer, seconds: audSec } = await extractAudioM4a(vidBuf, true, seconds);

      await sendStickerOnly(conn, m.chat, stickerBuffer, m4aBuffer, audSec || seconds);
      await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
      return;
    }

    const key = `${m.chat}:${m.sender}`;
    const state = pending.get(key) || {};

    if (isSticker) {
      const buf = await m.quoted.download();
      if (!buf?.length) return m.reply('❌ فشل تحميل الاستيكر.');
      state.sticker = buf;
    }

    if (audio) {
      const audBuf = await m.quoted.download();
      if (!audBuf?.length) return m.reply('❌ فشل تحميل الصوت.');
      const { m4aBuffer, seconds } = await extractAudioM4a(audBuf, false, MAX_DURATION_SEC);
      state.m4aBuffer = m4aBuffer;
      state.seconds = seconds;
    }

    if (!state.sticker) {
      pending.set(key, state);
      return m.reply('✅ تم تجهيز الصوت، دلوقتي رد على **استيكر** بـ `.asticker`');
    }

    if (!state.m4aBuffer) {
      pending.set(key, state);
      return m.reply('✅ تم حفظ الاستيكر، دلوقتي رد على **صوت** بـ `.asticker`');
    }

    pending.delete(key);
    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
    await sendStickerOnly(conn, m.chat, state.sticker, state.m4aBuffer, state.seconds || 5);
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
  } catch (err) {
    console.error('[AUDIOSTICKER ERROR]', err);
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
    m.reply(`❌ حصل خطأ: ${err.message || err}`);
  }
};

handler.help = ['audiosticker'];
handler.tags = ['sticker'];
handler.command = /^(صوت_استيكر|asticker|صوت_ستيك|st)$/i;

export default handler;
