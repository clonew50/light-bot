#!/usr/bin/env node
/**
 * autoUpdate.mjs — ينزّل تحديثات المشروع من GitHub (سحب فقط، مش بيرفع حاجة)
 * ==========================================================================
 * - المصدر الوحيد للتحديث هو ريبو GitHub. البوت **مايرفعش** أي ملفات خلاص.
 * - بيقارن بصمات الملفات المحلية بالريبو، وبيحمّل المتغيّر بس.
 * - الريبو عام، فمش محتاج أي مفتاح أو توكن.
 * - بيستثني الملفات الحساسة (الجلسات، الداتابيز، إعدادات البانل).
 *
 * كـ CLI:
 *   node system/autoUpdate.mjs --check   # يعرض التحديثات المتاحة
 *   node system/autoUpdate.mjs --pull    # ينزّل ويطبّق التحديثات
 *
 * كموديول:
 *   import { checkUpdate, pullOnce, applyUpdate } from './system/autoUpdate.mjs';
 *
 * قواعد العقد (مهمة):
 *   - كل شبكة محدودة بمهلة (AbortSignal.timeout) — مفيش تعليق على اتصال ميت.
 *   - مفيش unlink لمل محلي: الملف اللي الشات removed من الريبو بيتنقل
 *     لـ system/.removed-<timestamp>/ (نسخة كاملة قابلة للاسترجاع).
 *   - مفيش الكتابة فوق ملف معدّل محليًا إلا بـ AUTO_UPDATE_FORCE=1.
 *   - بعد سحب كود/حزم: npm install (لو package.json اتغيّر) + إعادة تشغيل
 *     كاملة نظيفة (process.exit(1)) — إعادة التشغيل الداخلية مش بتحمّل
 *     ES modules جديدة.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.LIGHTBOT_UPDATE_ROOT
  ? path.resolve(process.env.LIGHTBOT_UPDATE_ROOT)
  : path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.git-pull-state.json');

const OWNER = process.env.GH_OWNER || 'clonew50';
const REPO = process.env.GH_REPO || 'light-bot';
const BRANCH = process.env.GH_BRANCH || 'main';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}`;
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const UA = 'light-bot-updater';

/** مهلة أي طلب شبكة (الافتراضي 20s زي ما الخطة طالبة). */
export const FETCH_TIMEOUT_MS = Math.max(1000, Number(process.env.UPDATE_TIMEOUT_MS) || 20000);
/** أمر تثبيت الحزم — من غير --force ولا audit. */
export const INSTALL_ARGS = ['install', '--no-audit', '--no-fund', '--loglevel=error'];
const INSTALL_TIMEOUT_MS = Math.max(10_000, Number(process.env.UPDATE_INSTALL_TIMEOUT_MS) || 180_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- ملفات لا يلمسها التحديث أبداً ----------
const EXCLUDE_DIRS = ['node_modules', '.npm', '.git', 'sub', 'session', 'agent-backups'];
const EXCLUDE_FILES = new Set(['agent-models.json', 'agent-sessions.json', '.npmrc', '.', '..', '...', '.git-pull-state.json', '.git-sync-state.json']);
const EXCLUDE_REL = new Set(['system/database.json', 'system/panel-config.json', 'system/one-config.json']);

export function excluded(rel) {
  if (typeof rel !== 'string' || !rel.length) return true;
  if (rel.includes('\\')) return true;                       // مخاريط الفول للسلاش = مسار مشبوه
  const parts = rel.split('/');
  if (parts.some((p) => p === '..' || p === '.')) return true; // path traversal
  if (parts.some((p) => EXCLUDE_DIRS.includes(p))) return true;
  if (EXCLUDE_FILES.has(parts[parts.length - 1])) return true;
  if (EXCLUDE_REL.has(rel)) return true;
  if (rel.endsWith('.zip') || rel.endsWith('.log')) return true;
  return false;
}

// مفيش أي مسار ينزل من الريبو مسموح يطلع برة مجلد المشروع (حماية path traversal)
function safeJoin(rel) {
  if (typeof rel !== 'string' || !rel.length) return null;
  const full = path.resolve(ROOT, rel);
  const relCheck = path.relative(ROOT, full);
  if (!relCheck || relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return full;
}

// كتابة ذرية: بنتكب في ملف مؤقت بعدين rename — البوت المشغل عمري ما يشوف ملف نص مكتوب
function atomicWrite(full, buf) {
  const tmp = `${full}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, full);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw e;
  }
}

export function gitBlobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
function saveState(s) { atomicWrite(STATE_FILE, Buffer.from(JSON.stringify(s, null, 2))); }

function localSha(p) {
  try { return gitBlobSha(fs.readFileSync(path.join(ROOT, p))); } catch { return null; }
}

// fetch مع إعادة محاولة عند أي مشكلة شبكة عابرة — وكل محاولة محدودة بمهلة.
// المهلة فشل فوري (مش بيتعاد بلا فايدة): checkUpdate بيرجّع {error:'timeout'}.
async function fetchRetry(url, opts = {}, tries = 5, timeoutMs = FETCH_TIMEOUT_MS, fetchImpl = globalThis.fetch) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchImpl(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 500) lastErr = new Error(`HTTP ${res.status}`);
      else return res;
    } catch (e) {
      lastErr = e;
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError' || /timeout|abort/i.test(String(e?.message || ''));
      if (timedOut) throw new Error('timeout');
    }
    await sleep(600 * (i + 1));
  }
  throw lastErr;
}

// ---------- قراءة شجرة الريبو من GitHub (بدون مفتاح) ----------
async function fetchRemote({ timeoutMs = FETCH_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
  const br = await fetchRetry(`${API}/branches/${BRANCH}`, { headers }, 5, timeoutMs, fetchImpl);
  if (!br.ok) throw new Error(`GitHub ${br.status}${br.status === 403 ? ' (rate limit؟)' : ''}`);
  const bj = await br.json();
  const commitSha = bj.commit.sha;
  const treeSha = bj.commit.commit.tree.sha;

  const tr = await fetchRetry(`${API}/git/trees/${treeSha}?recursive=1`, { headers }, 5, timeoutMs, fetchImpl);
  if (!tr.ok) throw new Error(`GitHub tree ${tr.status}`);
  const tj = await tr.json();
  const remote = {};
  for (const e of tj.tree || []) if (e.type === 'blob') remote[e.path] = e.sha;
  return { commitSha, treeSha, remote };
}

/**
 * مقارنة محلية/بعيدة + كشف التعديل المحلي:
 *  - ملف محلي sha بتاعه = sha الريبو → مفيش حاجة.
 *  - ملف محلي sha بتاعه ≠ sha الريبو لكن = sha المسجّل في ملف الحالة → اتغيّر
 *    على الهوست: بيتخطّى (محلي - تم التجاوز) إلا مع AUTO_UPDATE_FORCE=1.
 */
function diff(remote, prev) {
  const download = [];
  const localEdited = [];
  for (const [p, sha] of Object.entries(remote)) {
    if (excluded(p)) continue;
    const cur = localSha(p);
    if (cur === sha) continue;
    const recorded = prev?.files?.[p];
    if (cur !== null && recorded && cur !== recorded) localEdited.push(p);
    else download.push(p);
  }
  const del = Object.keys(prev?.files || {})
    .filter((p) => !(p in remote) && !excluded(p) && fs.existsSync(path.join(ROOT, p)));
  return { download, del, localEdited };
}

/** فحص فقط — مفيش أي تغيير على الملفات */
export async function checkUpdate(opts = {}) {
  try {
    const { commitSha, remote } = await fetchRemote(opts);
    const prev = loadState();
    const { download, del, localEdited } = diff(remote, prev);
    return {
      commit: commitSha,
      download,
      deleted: del,
      localEdited,
      upToDate: !download.length && !del.length && !localEdited.length
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * تثبيت الحزم بعد ما package.json يتغيّر. الـ runner قابل للحقن (الاختبارات
 * بتتأكد من الأمر نفسه من غير ما تشغّل npm فعلًا).
 */
export async function runInstall({ runner, log = console.log, cwd = ROOT } = {}) {
  const run = runner || ((args, options) => new Promise((resolve, reject) => {
    execFile('npm', args, { ...options, windowsHide: true }, (err, stdout, stderr) => {
      if (err) { err.stdout = stdout; err.stderr = stderr; reject(err); return; }
      resolve({ stdout, stderr });
    });
  }));
  log(`📦 [UPDATE] تثبيت الحزم: npm ${INSTALL_ARGS.join(' ')}`);
  try {
    await run(INSTALL_ARGS, { cwd, timeout: INSTALL_TIMEOUT_MS });
    log('✅ [UPDATE] تم تثبيت الحزم بنجاح');
    return { ok: true };
  } catch (e) {
    log(`⚠️ [UPDATE] فشل تثبيت الحزم: ${e?.message || e}`);
    return { ok: false, error: e?.message || String(e) };
  }
}

let pullLocked = false;

/** تنزيل وتطبيق تحديثات الريبو على الملفات المحلية */
export async function pullOnce({ log = console.log, ...net } = {}) {
  if (pullLocked) return { error: 'تحديث بالفعل جارٍ تنفيذه — انتظر لحد ما يخلص' };
  pullLocked = true;
  try {
    const { commitSha, treeSha, remote } = await fetchRemote(net);
    const prev = loadState();
    const { download, del, localEdited } = diff(remote, prev);
    const force = process.env.AUTO_UPDATE_FORCE === '1';
    const skippedLocal = force ? [] : localEdited;
    if (force && localEdited.length) download.push(...localEdited);

    if (!download.length && !del.length && !skippedLocal.length) {
      saveState({ commit: commitSha, tree: treeSha, files: remote, at: new Date().toISOString() });
      log('✅ لا يوجد تحديث — أنت على آخر نسخة من الريبو.');   // سطر حاسم: "مفيش جديد"
      return { changes: 0, downloaded: [], deleted: [], skipped: 0, skippedLocal: [], commit: commitSha, needsRestart: false, needsInstall: false, upToDate: true };
    }

    if (skippedLocal.length) {
      log(`🛡️ ملفات معدّلة محليًا — تم التجاوز: ${skippedLocal.length}`);
    }
    log(`⬇️ فيه تحديث: ${download.length} ملف نزول، ${del.length} إزالة${skippedLocal.length ? `، ${skippedLocal.length} تجاوز` : ''}`);
    const headers = { 'User-Agent': UA };

    // المرحلة 1: تنزيل كل الملفات في الذاكرة الأول والتشييك على بصمة (sha) كل واحد
    // لو أي فحص فشل بنلغي التحديث كله — مفيش نص تحديث موزع على الكود الشغال
    const staged = new Map();
    let i = 0;
    for (const p of download) {
      const enc = p.split('/').map(encodeURIComponent).join('/');
      const res = await fetchRetry(`${RAW}/${commitSha}/${enc}`, { headers }, 5, net.timeoutMs || FETCH_TIMEOUT_MS, net.fetchImpl || globalThis.fetch);
      if (!res.ok) throw new Error(`تنزيل ${p} فشل (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const expectedSha = remote[p];
      if (expectedSha && gitBlobSha(buf) !== expectedSha) {
        throw new Error(`فحص سلامة ${p} فشل (محتوى مش مطابق لشجرة الكوميت) — تم إلغاء التحديث بالكامل`);
      }
      staged.set(p, buf);
      process.stdout.write(`\r  ⬇️  ${++i}/${download.length}`);
    }
    if (staged.size) console.log('');

    // المرحلة 2: التطبيق — مسارات آمنة بس + كتابة ذرية (tmp ثم rename)
    const appliedDown = [], delApplied = [], delSkipped = [];
    for (const [p, buf] of staged) {
      const full = safeJoin(p);
      if (!full) { log(`⚠️ تجاهل مسار مشبوه خارج مجلد المشروع: ${p}`); continue; }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      atomicWrite(full, buf);
      appliedDown.push(p);
    }

    // المرحلة 3: الإزالة = نقل لنسخة احتياطية (مفيش unlink نهائي)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join('system', `.removed-${stamp}`);
    for (const p of del) {
      const full = safeJoin(p);
      if (!full) { log(`⚠️ تجاهل مسار حذف مشبوه: ${p}`); continue; }
      const dest = safeJoin(path.posix.join(backupDir, p));
      if (!dest) { delSkipped.push(p); continue; }
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(full, dest);           // نقل — مش حذف
        delApplied.push(p);
      } catch (e) {
        // فشل النقل (مثلًا FS مش بيدعم rename) → نسيب الملف مكانه، ولا نمسحه
        delSkipped.push(p);
        log(`⚠️ تعذّر نقل ${p} لنسخة احتياطية (${e?.code || e?.message}) — الملف اتساب مكانه`);
      }
    }

    const applied = appliedDown.length + delApplied.length;
    const localSkipped = skippedLocal.slice();

    // الملفات اللي اتخطّت لأنها معدّلة محليًا بتفضل محتفظة ببصمتها المسجّلة، وإلا
    // هنفقد دليل "ده ملف معدّل على الهوست" أول ما نحدّث الحالة.
    const stateFiles = { ...remote };
    for (const p of skippedLocal) {
      if (prev?.files?.[p]) stateFiles[p] = prev.files[p];
    }
    saveState({ commit: commitSha, tree: treeSha, files: stateFiles, at: new Date().toISOString() });
    const needsInstall = appliedDown.includes('package.json');
    const needsRestart = [...appliedDown, ...delApplied].some((p) => /\.(mjs|js|cjs)$/.test(p));
    log(`✅ تم التحديث (${applied} ملف) من كوميت ${commitSha.slice(0, 8)}`);
    if (needsInstall) log('📦 [UPDATE] package.json اتغيّر — لازم تثبيت حزم قبل إعادة التشغيل');
    return {
      changes: applied,
      downloaded: appliedDown,
      deleted: delApplied,
      deletedSkipped: delSkipped,
      backupDir: delApplied.length ? backupDir : null,
      commit: commitSha,
      skipped: download.length + del.length - applied,
      skippedLocal: localSkipped,
      needsRestart,
      needsInstall,
      upToDate: false
    };
  } catch (e) {
    return { error: e.message };
  } finally {
    pullLocked = false;
  }
}

/**
 * إعادة تشغيل كاملة نظيفة (خطوة السلّم المشتركة): تفريغ الداتابيز + process.exit(1)
 * عشان مدير العمليات يرجّع البوت وتتحمّل ES modules الجديدة. مفيش غير كده بيعمل
 * "التغييرات اتطبقت" فعلًا — إعادة التشغيل الداخلية بتفضل بنفس الموديولات.
 */
function defaultRestart(reason) {
  if (typeof global.restartBotClean === 'function') return global.restartBotClean(reason);
  if (typeof global.restartBot === 'function') return global.restartBot(reason);
  return false;
}

/**
 * orchestrator: سحب → (تثبيت حزم) → نشر الملخص → إعادة تشغيل نظيفة.
 * كل مدخل بيحقن (pull/install/restart) عشان نقدر نختبر العقد من غير تشغيل.
 */
export async function applyUpdate({ pull = pullOnce, install = runInstall, restart = defaultRestart, log = console.log, event = () => {}, delayMs = 1000 } = {}) {
  const r = await pull({ log });
  if (r.error) {
    log(`⚠️ [UPDATE] فشل التحديث التلقائي: ${r.error}`);
    event('فشل التحديث التلقائي: ' + r.error);
    return { ...r, installed: null, restarted: false, summary: 'فشل التحديث' };
  }

  const summary = [];
  if (r.upToDate) summary.push('لا يوجد تحديث');
  if (r.downloaded?.length) summary.push(`سحب ${r.downloaded.length}`);
  if (r.skipped) summary.push(`تخطّي ${r.skipped}`);
  if (r.deleted?.length) summary.push(`إزالة ${r.deleted.length} → ${r.backupDir || 'نسخة احتياطية'}`);
  if (r.deletedSkipped?.length) summary.push(`تعذّر نقل ${r.deletedSkipped.length}`);
  if (r.skippedLocal?.length) summary.push(`محلي - تم التجاوز ${r.skippedLocal.length}`);
  if (r.needsInstall) summary.push('محتاج تثبيت حزم');
  if (!summary.length) summary.push('مفيش تغييرات');
  const summaryText = summary.join(' — ');
  event(summaryText);

  let installed = null;
  if (r.needsInstall) {
    installed = await install({ log });
    if (!installed?.ok) {
      // مفيش إعادة تشغيل على تثبيت فاشل: النسخة الشغالة تكمل، والنتيجة متسجلة
      event('فشل تثبيت الحزم — مفيش إعادة تشغيل: ' + (installed?.error || ''));
      return { ...r, installed, restarted: false, summary: summaryText };
    }
  }

  const needsCleanRestart = (r.changes && r.needsRestart) || !!r.needsInstall;
  if (!needsCleanRestart) return { ...r, installed, restarted: false, summary: summaryText };

  log('🔁 [UPDATE] فيه كود/حزم اتغيّرت — إعادة تشغيل كاملة نظيفة (process.exit(1))');
  event('كود/حزم اتغيّرت — إعادة تشغيل كاملة نظيفة لتطبيق التحديث');
  if (delayMs > 0) await sleep(delayMs);
  restart('تحديث تلقائي من الريبو');
  return { ...r, installed, restarted: true, summary: summaryText };
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const r = await checkUpdate();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
    if (r.upToDate) console.log('✅ لا يوجد تحديث — أنت على آخر نسخة من الريبو.');
    else {
      const bits = [`⬇️ للتنزيل: ${r.download.length}`];
      if (r.deleted.length) bits.push(`للإزالة: ${r.deleted.length}`);
      if (r.localEdited?.length) bits.push(`محلي - تم التجاوز: ${r.localEdited.length}`);
      console.log(bits.join(' | '));
      r.download.slice(0, 20).forEach((p) => console.log('  ↓', p));
      r.deleted.slice(0, 20).forEach((p) => console.log('  ✗', p));
    }
    // خروج طبيعي بصفر: مفيش استدعاء خروج صريح هنا — أي مسار فاشل بيفضل 1
  } else {
    const r = await pullOnce();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
    console.log(JSON.stringify(r, null, 2));
  }
}