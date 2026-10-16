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
  const parts = rel.split('/');
  if (parts.some((p) => EXCLUDE_DIRS.includes(p))) return true;
  if (EXCLUDE_FILES.has(parts[parts.length - 1])) return true;
  if (EXCLUDE_REL.has(rel)) return true;
  if (rel.endsWith('.zip') || rel.endsWith('.log')) return true;
  return false;
}

export function gitBlobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

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

/** تنزيل وتطبيق تحديثات الريبو على الملفات المحلية */
export async function pullOnce({ log = console.log } = {}) {
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
    let i = 0;
    for (const p of download) {
      const enc = p.split('/').map(encodeURIComponent).join('/');
      const res = await fetchRetry(`${RAW}/${commitSha}/${enc}`, { headers });
      if (!res.ok) throw new Error(`تنزيل ${p} فشل (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const full = path.join(ROOT, p);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, buf);
      process.stdout.write(`\r  ⬇️  ${++i}/${download.length}`);
    }
    for (const p of del) fs.rmSync(path.join(ROOT, p), { force: true });
    if (download.length) console.log('');

    saveState({ commit: commitSha, tree: treeSha, files: remote, at: new Date().toISOString() });
    const needsRestart = [...download, ...del].some((p) => /\.(mjs|js|cjs)$/.test(p));
    log(`✅ تم التحديث (${download.length + del.length} ملف) من كوميت ${commitSha.slice(0, 8)}`);
    return {
      changes: download.length + del.length,
      downloaded: download,
      deleted: del,
      commit: commitSha,
      needsRestart,
      needsInstall: download.includes('package.json'),
    };
  } catch (e) {
    return { error: e.message };
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
