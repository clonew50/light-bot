#!/usr/bin/env node
/**
 * autoSync.mjs — يرفع أي تعديل في المشروع على GitHub
 * ------------------------------------------------
 * - بيستخدم اتصال One (مش محتاج GitHub token).
 * - بيقارن الملفات المحلية بآخر حالة متزامنة وبيرفع المتغيّر بس.
 * - بيستثني الملفات الحساسة (الجلسات، الداتابيز، الأسرار).
 *
 * يُستخدم كـ CLI أو كموديول جوه البوت:
 *   import { syncOnce, initState, getStatus } from './system/autoSync.mjs';
 *
 * CLI:
 *   node system/autoSync.mjs            # مزامنة مرة واحدة
 *   node system/autoSync.mjs --watch    # مراقبة مستمرة
 *   node system/autoSync.mjs --status   # عرض الحالة
 *   node system/autoSync.mjs --init     # تجهيز الحالة من الريبو
 *
 * الإعدادات (env أو system/one-config.json):
 *   ONE_SECRET / secret       مفتاح One
 *   ONE_CONN   / connection   مفتاح اتصال GitHub في One
 *   GH_OWNER, GH_REPO, GH_BRANCH
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.git-sync-state.json');
const PULL_STATE_FILE = path.join(ROOT, '.git-pull-state.json');
const CONFIG_FILE = path.join(ROOT, 'system', 'one-config.json');

const DEFAULT_CONN = 'live::github::default::3a29bd8414ec4e5b988ca6b916502eef';
const BASE = 'https://api.withone.ai/v1/passthrough';

const A = {
  getRef: 'conn_mod_def::GJ3ZKe5vDKs::xb13z7ZBRnOWekJ-N_TG3w',
  getCommit: 'conn_mod_def::GJ3ZKX3Ay5c::Nm2AiGXOSZy3spF89Asrxw',
  getTree: 'conn_mod_def::GJ3ZKuuKOKA::SuUaMhp3QcmjoB8dtOfy1A',
  getBlob: 'conn_mod_def::GJ3ZKQY4im4::EeCEzsc8QVCrc9Zd-z9FeA',
  blob: 'conn_mod_def::GJ3ZJkM0oow::6pCvkMJYSue8xhH4Bvy6eQ',
  tree: 'conn_mod_def::GJ3ZKCHKkUA::xHBDE-LtSkWfVdTQxLIp3g',
  commit: 'conn_mod_def::GJ3ZJrwmLbo::Rp9vt2o3RBqDxBLQ1sRRng',
  updateRef: 'conn_mod_def::GJ3ZK-BoUAw::f8MXbEVgQJ2sEdoPzO3NPA',
};

// ---------- config ----------
let _cfg = null;
export function resolveConfig() {
  if (_cfg) return _cfg;
  let secret = process.env.ONE_SECRET || null;
  let conn = process.env.ONE_CONN || null;
  let owner = process.env.GH_OWNER || 'clonew50';
  let repo = process.env.GH_REPO || 'light-bot';
  let branch = process.env.GH_BRANCH || 'main';

  try {
    const j = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    secret = secret || j.secret || j.apiKey || null;
    conn = conn || j.connection || null;
    owner = process.env.GH_OWNER || j.owner || owner;
    repo = process.env.GH_REPO || j.repo || repo;
    branch = process.env.GH_BRANCH || j.branch || branch;
  } catch { /* no local config */ }

  if (!secret) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.one', 'config.json'), 'utf8'));
      secret = j.apiKey || null;
    } catch { /* ignore */ }
  }
  _cfg = { secret, conn: conn || DEFAULT_CONN, owner, repo, branch };
  return _cfg;
}

async function api(actionId, p, method, body) {
  const cfg = resolveConfig();
  if (!cfg.secret) {
    const e = new Error('مفيش مفتاح One');
    e.code = 'NO_SECRET';
    throw e;
  }
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'x-one-secret': cfg.secret,
      'x-one-connection-key': cfg.conn,
      'x-one-action-id': actionId,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} ${method} ${p}: ${typeof json === 'string' ? json.slice(0, 300) : JSON.stringify(json).slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return json;
}

// ---------- file scan ----------
const EXCLUDE_DIRS = ['node_modules', '.npm', '.git', 'sub', 'session', 'agent-backups'];
const EXCLUDE_FILES = new Set(['agent-models.json', 'agent-sessions.json', '.npmrc', '.', '..', '...', '.git-sync-state.json', '.git-pull-state.json']);
const EXCLUDE_REL = new Set(['system/database.json', 'system/panel-config.json', 'system/one-config.json']);

export function excluded(rel) {
  const parts = rel.split('/');
  if (parts.some((p) => EXCLUDE_DIRS.includes(p))) return true;
  if (EXCLUDE_FILES.has(parts[parts.length - 1])) return true;
  if (EXCLUDE_REL.has(rel)) return true;
  if (rel.endsWith('.zip') || rel.endsWith('.log')) return true;
  return false;
}
function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (excluded(rel)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}
export function gitBlobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}
export function scan() {
  const map = {};
  for (const rel of walk(ROOT)) map[rel] = gitBlobSha(fs.readFileSync(path.join(ROOT, rel)));
  return map;
}

// ---------- state ----------
export function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

export function getStatus() {
  const s = loadState();
  const local = scan();
  if (!s) return { ready: false, pending: Object.keys(local).length, deleted: 0, changed: [] };
  const changed = Object.entries(local).filter(([p, sha]) => s.files?.[p] !== sha).map(([p]) => p);
  const deleted = Object.keys(s.files || {}).filter((p) => !(p in local));
  return { ready: true, at: s.at, commit: s.commit, pending: changed.length + deleted.length, changed, deleted };
}

// ---------- init (seed state from remote HEAD) ----------
export async function initState({ log = console.log } = {}) {
  const cfg = resolveConfig();
  try {
    const ref = await api(A.getRef, `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads%2F${cfg.branch}`, 'GET');
    const commitSha = ref.object.sha;
    const commit = await api(A.getCommit, `/repos/${cfg.owner}/${cfg.repo}/git/commits/${commitSha}`, 'GET');
    const treeSha = commit.tree.sha;
    const t = await api(A.getTree, `/repos/${cfg.owner}/${cfg.repo}/git/trees/${treeSha}?recursive=1`, 'GET');
    const files = {};
    for (const e of t.tree || []) if (e.type === 'blob') files[e.path] = e.sha;
    saveState({ commit: commitSha, tree: treeSha, files, at: new Date().toISOString() });
    log(`✅ تم تجهيز الحالة من الريبو (${Object.keys(files).length} ملف)`);
    return { ok: true, files: Object.keys(files).length, commit: commitSha };
  } catch (e) {
    if (e.code === 'NO_SECRET') return { error: 'no-secret' };
    return { error: e.message };
  }
}

// ---------- sync ----------
let syncing = false;
export async function syncOnce({ quiet = true, autoInit = true, log = console.log } = {}) {
  const cfg = resolveConfig();
  if (!cfg.secret) return { error: 'no-secret' };
  if (syncing) return { error: 'busy' };
  syncing = true;
  try {
    let state = loadState();
    if ((!state || !state.commit || !state.tree) && autoInit) {
      const r = await initState({ log });
      if (r.error) return r;
      state = loadState();
    }
    if (!state) return { error: 'no-state' };

    const local = scan();
    const prev = state.files || {};
    const changed = [];
    for (const [p, sha] of Object.entries(local)) if (prev[p] !== sha) changed.push(p);
    const deleted = Object.keys(prev).filter((p) => !(p in local));
    if (!changed.length && !deleted.length) {
      if (!quiet) log('✅ الريبو متزامن — مفيش تغييرات.');
      return { changes: 0 };
    }
    log(`🔄 تغييرات: ${changed.length} معدّل/جديد، ${deleted.length} محذوف`);

    const entries = [];
    let i = 0;
    for (const rel of changed) {
      const buf = fs.readFileSync(path.join(ROOT, rel));
      const b = await api(A.blob, `/repos/${cfg.owner}/${cfg.repo}/git/blobs`, 'POST', { content: buf.toString('base64'), encoding: 'base64' });
      entries.push({ path: rel, mode: '100644', type: 'blob', sha: b.sha });
      if (!quiet) process.stdout.write(`\r  ⬆️  ${++i}/${changed.length}`);
    }
    for (const rel of deleted) entries.push({ path: rel, mode: '100644', type: 'blob', sha: null });
    if (!quiet) console.log('');

    const tree = await api(A.tree, `/repos/${cfg.owner}/${cfg.repo}/git/trees`, 'POST', { base_tree: state.tree, tree: entries });
    const msg = `auto-sync: ${changed.length} updated, ${deleted.length} deleted`;
    const commit = await api(A.commit, `/repos/${cfg.owner}/${cfg.repo}/git/commits`, 'POST', {
      message: msg, tree: tree.sha, parents: [state.commit],
    });
    await api(A.updateRef, `/repos/${cfg.owner}/${cfg.repo}/git/refs/heads%2F${cfg.branch}`, 'PATCH', { sha: commit.sha, force: true });
    saveState({ commit: commit.sha, tree: tree.sha, files: local, at: new Date().toISOString() });
    log(`✅ اترفع: https://github.com/${cfg.owner}/${cfg.repo}/commit/${commit.sha}`);
    return { changes: changed.length + deleted.length, commit: commit.sha, url: `https://github.com/${cfg.owner}/${cfg.repo}/commit/${commit.sha}` };
  } catch (e) {
    if (e.code === 'NO_SECRET') return { error: 'no-secret' };
    return { error: e.message };
  } finally {
    syncing = false;
  }
}

// ---------- pull (repo → local) ----------
export function loadPullState() {
  try { return JSON.parse(fs.readFileSync(PULL_STATE_FILE, 'utf8')); } catch { return null; }
}
function savePullState(s) { fs.writeFileSync(PULL_STATE_FILE, JSON.stringify(s, null, 2)); }

async function fetchRemote() {
  const cfg = resolveConfig();
  const ref = await api(A.getRef, `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads%2F${cfg.branch}`, 'GET');
  const commitSha = ref.object.sha;
  const commit = await api(A.getCommit, `/repos/${cfg.owner}/${cfg.repo}/git/commits/${commitSha}`, 'GET');
  const treeSha = commit.tree.sha;
  const t = await api(A.getTree, `/repos/${cfg.owner}/${cfg.repo}/git/trees/${treeSha}?recursive=1`, 'GET');
  const remote = {};
  for (const e of t.tree || []) if (e.type === 'blob') remote[e.path] = e.sha;
  return { commitSha, treeSha, remote };
}

function diffRemote(remote) {
  const download = [];
  for (const [p, sha] of Object.entries(remote)) {
    if (excluded(p)) continue;
    let ls = null;
    try { ls = gitBlobSha(fs.readFileSync(path.join(ROOT, p))); } catch { /* missing */ }
    if (ls !== sha) download.push(p);
  }
  const prev = loadPullState()?.files || {};
  const del = Object.keys(prev).filter((p) => !(p in remote) && !excluded(p) && fs.existsSync(path.join(ROOT, p)));
  return { download, del };
}

/** يفحص الريبو من غير ما يغيّر أي حاجة */
export async function checkUpdate() {
  const cfg = resolveConfig();
  if (!cfg.secret) return { error: 'no-secret' };
  try {
    const { commitSha, remote } = await fetchRemote();
    const { download, del } = diffRemote(remote);
    return { commit: commitSha, download, deleted: del, upToDate: !download.length && !del.length };
  } catch (e) {
    if (e.code === 'NO_SECRET') return { error: 'no-secret' };
    return { error: e.message };
  }
}

/** ينزّل تحديثات الريبو ويطبّقها على الملفات المحلية */
export async function pullOnce({ log = console.log } = {}) {
  const cfg = resolveConfig();
  if (!cfg.secret) return { error: 'no-secret' };
  try {
    const { commitSha, treeSha, remote } = await fetchRemote();
    const { download, del } = diffRemote(remote);

    if (!download.length && !del.length) {
      savePullState({ commit: commitSha, tree: treeSha, files: remote, at: new Date().toISOString() });
      log('✅ انت على آخر نسخة من الريبو.');
      return { changes: 0, commit: commitSha, needsRestart: false };
    }

    log(`⬇️ تحديثات من الريبو: ${download.length} ملف، حذف: ${del.length}`);
    let i = 0;
    for (const p of download) {
      const b = await api(A.getBlob, `/repos/${cfg.owner}/${cfg.repo}/git/blobs/${remote[p]}`, 'GET');
      const buf = Buffer.from(String(b.content || '').replace(/\n/g, ''), b.encoding === 'base64' ? 'base64' : 'utf8');
      const full = path.join(ROOT, p);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, buf);
      process.stdout.write(`\r  ⬇️  ${++i}/${download.length}`);
    }
    for (const p of del) fs.rmSync(path.join(ROOT, p), { force: true });
    if (download.length) console.log('');

    savePullState({ commit: commitSha, tree: treeSha, files: remote, at: new Date().toISOString() });
    const needsRestart = download.some((p) => /\.(mjs|js|cjs)$/.test(p)) || del.some((p) => /\.(mjs|js|cjs)$/.test(p));
    log(`✅ تم التحديث (${download.length + del.length} ملف) من كوميت ${commitSha.slice(0, 8)}`);
    return { changes: download.length + del.length, downloaded: download, deleted: del, commit: commitSha, needsRestart };
  } catch (e) {
    if (e.code === 'NO_SECRET') return { error: 'no-secret' };
    return { error: e.message };
  }
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const DEBOUNCE = Number(process.env.SYNC_DEBOUNCE || 5) * 1000;
  const INTERVAL = Number(process.env.SYNC_INTERVAL || 120) * 1000;
  if (args.includes('--pull') || args.includes('--update')) {
    const r = await pullOnce();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
  } else if (args.includes('--check')) {
    const r = await checkUpdate();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
    if (r.upToDate) console.log('✅ انت على آخر نسخة من الريبو.');
    else {
      console.log(`⬇️ للتنزيل: ${r.download.length} | للحذف: ${r.deleted.length}`);
      r.download.slice(0, 20).forEach((p) => console.log('  ↓', p));
      r.deleted.slice(0, 20).forEach((p) => console.log('  ✗', p));
    }
  } else if (args.includes('--init')) {
    const r = await initState();
    if (r.error) { console.error('❌', r.error); process.exit(1); }
  } else if (args.includes('--status')) {
    const s = getStatus();
    if (!s.ready) { console.log('مفيش حالة. شغّل --init'); }
    else {
      console.log(`آخر مزامنة: ${s.at || '-'}`);
      console.log(`تعديلات معلّقة: ${s.changed.length} | محذوف: ${s.deleted.length}`);
      s.changed.slice(0, 20).forEach((p) => console.log('  M', p));
      s.deleted.slice(0, 20).forEach((p) => console.log('  D', p));
    }
  } else if (args.includes('--watch')) {
    console.log('👀 وضع المراقبة شغّال... (Ctrl+C للإيقاف)');
    await syncOnce({ quiet: false });
    let timer = null;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => syncOnce({ quiet: true }), DEBOUNCE); };
    try {
      fs.watch(ROOT, { recursive: true }, (_ev, f) => {
        if (!f) return schedule();
        if (excluded(String(f))) return;
        schedule();
      });
    } catch { /* recursive watch unsupported → rely on interval */ }
    setInterval(() => syncOnce({ quiet: true }), INTERVAL);
  } else {
    const r = await syncOnce({ quiet: false });
    if (r.error === 'no-secret') { console.error('❌ مفيش مفتاح One. حِط ONE_SECRET أو system/one-config.json'); process.exit(1); }
    else if (r.error) { console.error('❌ فشل:', r.error); process.exit(1); }
  }
}
