/*
 * ═══════════════════════════════════════════════════════════════
 * 🗄️ حماية جلسة واتساب (Session Backup) + حفظ الحالة عند الإيقاف
 * ═══════════════════════════════════════════════════════════════
 * المشكلة: بنستخدم useMultiFileAuthState من Baileys — وهو مكتوب في
 * وثائقه إنه "مش للإنتاج". لو ملف `session/creds.json` اتلخبط أو اتقطع
 * في نص الكتابة (قطع كهرباء / kill -9 / تحديث framework)، البوت
 * بيفقد جلسته بالكامل والمالك لازم يعمل ربط (pairing) من جديد.
 *
 * الحل هنا:
 *   1) نسخة احتياطية: كل مرة الـ framework يحدّث بيانات الاعتماد
 *      (event: creds.update) بننسخ `session/creds.json` لـ
 *      `session/creds.json.bak` — كتابة ذرّية (ملف مؤقت + rename)
 *      وبحد أقصى مرة كل 10 ثواني عشان ما نعملش disk I/O على كل رسالة.
 *   2) استرجاع: أول ما البوت يقلع، لو `session/creds.json` ناقص أو
 *      مش JSON أو ناقص `me`/`noiseKey` → بنرجّعه من النسخة الاحتياطية.
 *      لو مفيش نسخة → البوت يقلع من غير ربط (unpaired) من غير ما
 *      نمسح أي حاجة ومن غير ما نعمل كراش.
 *
 * ⚠️ حدودCoverage (مهم):
 *   جلسات البوتات الفرعية (sub/) ملفات LevelDB — مش بنقدر ننسخها
 *   احتياطي وهي شغالة من غير ما نكسرها، وهي مستثناة من التحديث
 *   التلقائي (system/autoUpdate.mjs — EXCLUDE_DIRS). فالنسخة الاحتياطية
 *   بتغطي جلسة البوت الرئيسي بس.
 *
 * كمان هنا: معالج إشارات الإيقاف (SIGTERM / SIGINT) — بيحفظ الداتابيز
 * فورًا (flush) ويقفل سيرفر اللوحة وبيخرج من العملية بـ exit code 0.
 */

import fs from 'node:fs';
import path from 'node:path';

/** اسم ملف الجلسة الحي */
export const LIVE_FILE = 'creds.json';
/** اسم ملف النسخة الاحتياطية */
export const BACKUP_FILE = 'creds.json.bak';
/** أقل مدة بين كتابتين للنسخة الاحتياطية (10 ثواني) */
export const BACKUP_MIN_INTERVAL_MS = 10_000;
/** مهلة صغيرة نأجل فيها النسخة عشان الإطار يكمّل كتابة creds.json الأول */
const DEFAULT_DEFER_MS = 400;
/** مدة فحص السوكيت (نفس فكرة healer) */
const DEFAULT_POLL_MS = 800;

const defaultLog = (m) => { try { console.log(m); } catch {} };

/* ─────────────── مسارات ─────────────── */
export function sessionPaths(sessionDir = './session') {
  const dir = path.resolve(sessionDir || './session');
  return { dir, live: path.join(dir, LIVE_FILE), backup: path.join(dir, BACKUP_FILE) };
}

/* ─────────────── قراءة وتقييم الملف ─────────────── */
/**
 * ملف creds.json سليم = JSON object فيه `me` و `noiseKey`.
 * (baileys: initAuthCreds() بيرجّع me + noiseKey + registered)
 */
export function isValidCreds(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!value.me || typeof value.me !== 'object') return false;
  if (!value.noiseKey || typeof value.noiseKey !== 'object') return false;
  return true;
}

/**
 * يقرأ ملف JSON ويرجّع حالته:
 *  { ok:true,  reason:'valid', raw, value }
 *  { ok:false, reason:'missing'|'empty'|'unparsable'|'incomplete'|'unreadable:..' }
 */
export function readCredsFile(file) {
  try {
    if (!fs.existsSync(file)) return { ok: false, reason: 'missing', raw: null, value: null };
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw || !raw.trim()) return { ok: false, reason: 'empty', raw: raw ?? '', value: null };
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'unparsable', raw, value: null };
    }
    if (!isValidCreds(value)) return { ok: false, reason: 'incomplete', raw, value };
    return { ok: true, reason: 'valid', raw, value };
  } catch (e) {
    return { ok: false, reason: 'unreadable:' + (e?.message || e), raw: null, value: null };
  }
}

/* ─────────────── الاسترجاع وقت الإقلاع ─────────────── */
/** الرسالة اللي بتتطبع لما نرجّع الجلسة من النسخة الاحتياطية */
export const RESTORE_MESSAGE =
  '♻️ استُعيدت جلسة واتساب من النسخة الاحتياطية';

/**
 * لو `session/creds.json` ناقص/مكسور/ناقص me+noiseKey → يرجّعه من
 * `session/creds.json.bak` (كتابة ذرّية: tmp + rename).
 *
 * القواعد الصارمة:
 *  - ملف حي سليم → ممنوع الاسترجاع (حتى لو النسخة أقدم) — stale_state.
 *  - مفيش نسخة → نرجّع false وميحذفش أي حاجة (إقلاع unpaired من غير كراش).
 *  - النسخة الاحتياطية نفسها مكسورة → نرجّع false وميحذفش أي حاجة.
 *
 * @returns {{restored:boolean, reason:string, live:string, backup:string}}
 */
export function restoreSessionFromBackup(sessionDir = './session', opts = {}) {
  const { log = defaultLog, now = Date.now } = opts;
  const { dir, live, backup } = sessionPaths(sessionDir);

  const liveState = readCredsFile(live);
  if (liveState.ok) {
    // الملف الحي سليم → ممنوع نكتب فوقه من نسخة أقدم.
    return { restored: false, reason: 'live-ok', live, backup, liveReason: liveState.reason };
  }

  if (!fs.existsSync(backup)) {
    // مفيش نسخة → نكمل إقلاع من غير ربط. من غير حذف أي حاجة.
    return { restored: false, reason: 'no-backup', live, backup, liveReason: liveState.reason };
  }

  const bakState = readCredsFile(backup);
  if (!bakState.ok) {
    // النسخة نفسها مكسورة → نسيبها زي ما هي، من غير حذف.
    return {
      restored: false, reason: 'backup-invalid', live, backup,
      liveReason: liveState.reason, backupReason: bakState.reason
    };
  }

  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${live}.tmp-restore-${process.pid}-${now()}`;
    fs.writeFileSync(tmp, bakState.raw);
    fs.renameSync(tmp, live); // rename ذرّي — الملف ما بيطلعش نصّه مكتوب نص
  } catch (e) {
    return {
      restored: false, reason: 'restore-failed:' + (e?.message || e), live, backup,
      liveReason: liveState.reason
    };
  }

  try { log(RESTORE_MESSAGE); } catch {}
  return { restored: true, reason: 'restored', live, backup, liveReason: liveState.reason };
}

/* ─────────────── الكتابة (النسخة الاحتياطية) ─────────────── */
/** حالة داخلية للنسخة (العدّاد + وقت آخر كتابة + المؤقّت المؤجّل) */
export function createBackupState() {
  return { lastWriteAt: 0, writes: 0, skipped: 0, attachedSock: null, deferred: null };
}

/**
 * ينسخ `creds.json` الحالي لـ `creds.json.bak` — ذرّياً (tmp + rename)
 * وبحد أقصى مرة كل `minIntervalMs` (10 ثواني افتراضياً).
 * ماينسخش ملف مكسور (ماينسخش غير JSON سليم) عشان ما ننسدّرش نسخة فاسدة.
 *
 * @returns {{written:boolean, reason:string}}
 */
export function backupSessionCreds(sessionDir = './session', opts = {}) {
  const {
    state = createBackupState(),
    now = Date.now,
    minIntervalMs = BACKUP_MIN_INTERVAL_MS
  } = opts;
  const { live, backup } = sessionPaths(sessionDir);
  const t = now();

  if (state.lastWriteAt && t - state.lastWriteAt < minIntervalMs) {
    state.skipped++;
    return { written: false, reason: 'throttled', live, backup };
  }

  const liveState = readCredsFile(live);
  if (!liveState.ok) {
    // الملف الحي ناقص/مكسور → ما نكتبش نسخة (ما نخزّنش فساد).
    return { written: false, reason: 'live-' + liveState.reason, live, backup };
  }

  const bakState = readCredsFile(backup);
  if (bakState.ok && bakState.raw === liveState.raw) {
    state.lastWriteAt = t;
    return { written: false, reason: 'identical', live, backup };
  }

  try {
    const tmp = `${backup}.tmp-${process.pid}-${t}`;
    fs.writeFileSync(tmp, liveState.raw);
    fs.renameSync(tmp, backup); // rename ذرّي
  } catch (e) {
    return { written: false, reason: 'write-failed:' + (e?.message || e), live, backup };
  }

  state.lastWriteAt = t;
  state.writes++;
  return { written: true, reason: 'written', live, backup };
}

/* ─────────────── الربط بالسوكيت ─────────────── */
/**
 * يربط مستمع `creds.update` على سوكيت البوت الحالي، ويعيد الربط
 * تلقائياً لما السوكيت يتبدّل (بعد ريستارت داخلي).
 * الكتابة نفسها مؤجّلة شوية + مخفّفة (10 ثواني) — يعني مش I/O على كل رسالة.
 */
export function attachSessionBackup(client, opts = {}) {
  const {
    sessionDir = client?.config?.sessionPath || './session',
    pollMs = DEFAULT_POLL_MS,
    minIntervalMs = BACKUP_MIN_INTERVAL_MS,
    deferMs = DEFAULT_DEFER_MS,
    log = defaultLog
  } = opts;

  const state = createBackupState();

  const onCredsUpdate = () => {
    // بنأجل شوية: الإطار بيبدأ يكتب creds.json لما يسمع نفس الحدث،
    // فلازم نستنى لحد ما الكتابة تخلص.
    if (state.deferred) return;
    const t = setTimeout(() => {
      state.deferred = null;
      const r = backupSessionCreds(sessionDir, { state, minIntervalMs });
      if (r.written) {
        try { log('💾 [SESSION] اتعملت نسخة احتياطية من جلسة واتساب'); } catch {}
      }
    }, deferMs);
    t.unref?.();
    state.deferred = t;
  };

  const timer = setInterval(() => {
    const sock = client?.sock;
    if (!sock || !sock?.ev) return;
    if (sock === state.attachedSock) return;
    state.attachedSock = sock;
    try {
      sock.ev.on('creds.update', onCredsUpdate);
    } catch (e) {
      try { log('⚠️ [SESSION] تعذّر ربط مستمع تحديث الجلسة: ' + (e?.message || e)); } catch {}
    }
  }, pollMs);
  timer.unref?.();

  return {
    state,
    stop: () => {
      clearInterval(timer);
      if (state.deferred) { clearTimeout(state.deferred); state.deferred = null; }
      try { state.attachedSock?.ev?.removeListener?.('creds.update', onCredsUpdate); } catch {}
      state.attachedSock = null;
    }
  };
}

/* ─────────────── تحذير البوتات الفرعية ─────────────── */
/**
 * جلسات البوتات الفرعية (sub/) LevelDB — مش بننسخها احتياطي.
 * بنرفع التحذير ده كـ panel event (مش مجرد سطر لوج).
 */
export const SUB_BOT_WARNING =
  '⚠️ [SESSION] جلسات البوتات الفرعية (sub/) مش داخل في النسخة الاحتياطية — ' +
  'ملفات LevelDB بتتلف لو اتنسخت وهي شغالة، فلازم إعادة ربط يدوية لو اتلفت.';

export function warnSubBotSessionsNotCovered(opts = {}) {
  const { push = null, log = defaultLog } = opts;
  try { log(SUB_BOT_WARNING); } catch {}
  try { push?.(SUB_BOT_WARNING); } catch {}
  return SUB_BOT_WARNING;
}

/* ─────────────── إشارات الإيقاف ─────────────── */
/**
 * بيستقبل SIGTERM / SIGINT → يحفظ الداتابيز فورًا (flush) → يقفل
 * سيرفر اللوحة → يخرج من العملية بـ exit code 0.
 *
 * مهم: مفيش step هنا يقدر يرمي exception يمسك العملية — كل حاجة في
 * try/catch، لأن رمي خطأ جوّه معالج الإشارة بيسيب العملية معلقة.
 *
 * @param {object} opts
 * @param {{flush?:Function}} opts.db   الداتابيز (عبر flush() فورًا)
 * @param {{close?:Function, closeAllConnections?:Function}} [opts.server] سيرفر اللوحة
 * @param {(code:number)=>void} [opts.exit] بديل process.exit (للاختبار)
 */
export function installShutdownHandlers(opts = {}) {
  const {
    db = global.db,
    server = null,
    exit = (code) => process.exit(code),
    log = defaultLog,
    signals = ['SIGTERM', 'SIGINT']
  } = opts;

  let done = false;
  const state = { done: false, flushed: false, closed: false, code: null };

  const shutdown = (signal) => {
    if (done) return state;
    done = true;
    state.done = true;
    try { log(`🛑 [SHUTDOWN] استلمنا ${signal} — بنحفظ الداتابيز قبل الخروج`); } catch {}

    // 1) حفظ الداتابيز فورًا (المؤقّت المعلّق بيتكتب دلوقتي)
    try {
      if (db && typeof db.flush === 'function') { db.flush(); state.flushed = true; }
    } catch (e) {
      try { log('⚠️ [SHUTDOWN] فشل حفظ الداتابيز: ' + (e?.message || e)); } catch {}
    }

    // 2) قفل سيرفر اللوحة
    try {
      if (server && typeof server.close === 'function') { server.close(); state.closed = true; }
      try { server?.closeAllConnections?.(); } catch {}
    } catch (e) {
      try { log('⚠️ [SHUTDOWN] فشل قفل لوحة التحكم: ' + (e?.message || e)); } catch {}
    }

    // 3) خروج نظيف
    state.code = 0;
    try { exit(0); } catch {}
    return state;
  };

  const handlers = {};
  for (const sig of signals) {
    handlers[sig] = () => shutdown(sig);
    process.on(sig, handlers[sig]);
  }

  return {
    state,
    shutdown,
    stop: () => {
      for (const sig of signals) {
        try { process.removeListener(sig, handlers[sig]); } catch {}
      }
    }
  };
}

export default {
  restoreSessionFromBackup,
  backupSessionCreds,
  attachSessionBackup,
  installShutdownHandlers,
  warnSubBotSessionsNotCovered,
  isValidCreds,
  readCredsFile,
  sessionPaths,
  createBackupState,
  LIVE_FILE,
  BACKUP_FILE,
  BACKUP_MIN_INTERVAL_MS,
  SUB_BOT_WARNING
};
