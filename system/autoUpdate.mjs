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
 *   import { checkUpdate, pullOnce } from './system/autoUpdate.mjs';
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.git-pull-state.json');

const OWNER = process.env.GH_OWNER || 'clonew50';
const REPO = process.env.GH_REPO || 'light-bot';
const BRANCH = process.env.GH_BRANCH || 'main';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}`;
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const UA = 'light-bot-updater';

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

// fetch مع إعادة محاولة عند أي مشكلة شبكة عابرة
async function fetchRetry(url, opts = {}, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status >= 500) lastErr = new Error(`HTTP ${res.status}`);
      else return res;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw lastErr;
}

// ---------- قراءة شجرة الريبو من GitHub (بدون مفتاح) ----------
async function fetchRemote() {
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
  const br = await fetchRetry(`${API}/branches/${BRANCH}`, { headers });
  if (!br.ok) throw new Error(`GitHub ${br.status}${br.status === 403 ? ' (rate limit؟)' : ''}`);
  const bj = await br.json();
  const commitSha = bj.commit.sha;
  const treeSha = bj.commit.commit.tree.sha;

  const tr = await fetchRetry(`${API}/git/trees/${treeSha}?recursive=1`, { headers });
  if (!tr.ok) throw new Error(`GitHub tree ${tr.status}`);
  const tj = await tr.json();
  const remote = {};
  for (const e of tj.tree || []) if (e.type === 'blob') remote[e.path] = e.sha;
  return { commitSha, treeSha, remote };
}

function diff(remote) {
  const download = [];
  for (const [p, sha] of Object.entries(remote)) {
    if (excluded(p)) continue;
    let localSha = null;
    try { localSha = gitBlobSha(fs.readFileSync(path.join(ROOT, p))); } catch { /* missing locally */ }
    if (localSha !== sha) download.push(p);
  }
  const prev = loadState()?.files || {};
  const del = Object.keys(prev).filter((p) => !(p in remote) && !excluded(p) && fs.existsSync(path.join(ROOT, p)));
  return { download, del };
}

/** فحص فقط — مفيش أي تغيير على الملفات */
export async function checkUpdate() {
  try {
    const { commitSha, remote } = await fetchRemote();
    const { download, del } = diff(remote);
    return { commit: commitSha, download, deleted: del, upToDate: !download.length && !del.length };
  } catch (e) {
    return { error: e.message };
  }
}

let pullLocked = false;

/** تنزيل وتطبيق تحديثات الريبو على الملفات المحلية */
export async function pullOnce({ log = console.log } = {}) {
  if (pullLocked) return { error: 'تحديث بالفعل جارٍ تنفيذه — انتظر لحد ما يخلص' };
  pullLocked = true;
  try {
    const { commitSha, treeSha, remote } = await fetchRemote();
    const { download, del } = diff(remote);

    if (!download.length && !del.length) {
      saveState({ commit: commitSha, tree: treeSha, files: remote, at: new Date().toISOString() });
      log('✅ انت على آخر نسخة من الريبو — مفيش تحديثات.');
      return { changes: 0, commit: commitSha, needsRestart: false };
    }

    log(`⬇️ فيه تحديث: ${download.length} ملف نزول، ${del.length} حذف`);
    const headers = { 'User-Agent': UA };

    // المرحلة 1: تنزيل كل الملفات في الذاكرة الأول والتشييك على بصمة (sha) كل واحد
    // لو أي فحص فشل بنلغي التحديث كله — مفيش نص تحديث موزع على الكود الشغال
    const staged = new Map();
    let i = 0;
    for (const p of download) {
      const enc = p.split('/').map(encodeURIComponent).join('/');
      const res = await fetchRetry(`${RAW}/${commitSha}/${enc}`, { headers });
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
    const appliedDown = [], delApplied = [];
    for (const [p, buf] of staged) {
      const full = safeJoin(p);
      if (!full) { log(`⚠️ تجاهل مسار مشبوه خارج مجلد المشروع: ${p}`); continue; }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      atomicWrite(full, buf);
      appliedDown.push(p);
    }
    for (const p of del) {
      const full = safeJoin(p);
      if (!full) { log(`⚠️ تجاهل مسار حذف مشبوه: ${p}`); continue; }
      try { fs.rmSync(full, { force: true }); delApplied.push(p); } catch {}
    }
    const applied = appliedDown.length + delApplied.length;

    saveState({ commit: commitSha, tree: treeSha, files: remote, at: new Date().toISOString() });
    const needsRestart = [...appliedDown, ...delApplied].some((p) => /\.(mjs|js|cjs)$/.test(p));
    log(`✅ تم التحديث (${applied} ملف) من كوميت ${commitSha.slice(0, 8)}`);
    return {
      changes: applied,
      downloaded: appliedDown,
      deleted: delApplied,
      commit: commitSha,
      skipped: download.length + del.length - applied,
      needsRestart,
      needsInstall: appliedDown.includes('package.json'),
    };
  } catch (e) {
    return { error: e.message };
  } finally {
    pullLocked = false;
  }
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const r = await checkUpdate();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
    if (r.upToDate) console.log('✅ انت على آخر نسخة من الريبو.');
    else {
      console.log(`⬇️ للتنزيل: ${r.download.length} | للحذف: ${r.deleted.length}`);
      r.download.slice(0, 20).forEach((p) => console.log('  ↓', p));
      r.deleted.slice(0, 20).forEach((p) => console.log('  ✗', p));
    }
  } else {
    const r = await pullOnce();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
  }
}
