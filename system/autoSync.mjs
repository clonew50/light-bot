#!/usr/bin/env node
/**
 * autoSync.mjs — يرفع أي تعديل في المشروع على GitHub تلقائياً
 * ------------------------------------------------
 * - بيستخدم اتصال One (مش محتاج GitHub token).
 * - بيقارن الملفات المحلية بآخر حالة متزامنة وبيرفع المتغيّر بس.
 * - بيستثني الملفات الحساسة (الجلسات، الداتابيز، الأسرار).
 *
 * الاستخدام:
 *   node system/autoSync.mjs            # مزامنة مرة واحدة
 *   node system/autoSync.mjs --watch    # مراقبة مستمرة (تلقائي)
 *   node system/autoSync.mjs --status   # عرض الحالة فقط
 *
 * الإعدادات (اختيارية) عبر متغيّرات البيئة:
 *   ONE_SECRET    مفتاح One (لو مش موجود بيقرأه من ~/.one/config.json)
 *   ONE_CONN      مفتاح اتصال GitHub في One
 *   GH_OWNER      صاحب الريبو (افتراضي clonew50)
 *   GH_REPO       اسم الريبو (افتراضي light-bot)
 *   SYNC_DEBOUNCE ثواني الانتظار بعد آخر تعديل (افتراضي 5)
 *   SYNC_INTERVAL فحص دوري بالثواني (افتراضي 120)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.git-sync-state.json');

const OWNER = process.env.GH_OWNER || 'clonew50';
const REPO = process.env.GH_REPO || 'light-bot';
const BRANCH = process.env.GH_BRANCH || 'main';
const CONN = process.env.ONE_CONN || 'live::github::default::3a29bd8414ec4e5b988ca6b916502eef';
const BASE = 'https://api.withone.ai/v1/passthrough';
const DEBOUNCE = Number(process.env.SYNC_DEBOUNCE || 5) * 1000;
const INTERVAL = Number(process.env.SYNC_INTERVAL || 120) * 1000;

const A = {
  blob: 'conn_mod_def::GJ3ZJkM0oow::6pCvkMJYSue8xhH4Bvy6eQ',
  tree: 'conn_mod_def::GJ3ZKCHKkUA::xHBDE-LtSkWfVdTQxLIp3g',
  commit: 'conn_mod_def::GJ3ZJrwmLbo::Rp9vt2o3RBqDxBLQ1sRRng',
  updateRef: 'conn_mod_def::GJ3ZK-BoUAw::f8MXbEVgQJ2sEdoPzO3NPA',
};

// ---------- secret ----------
function getSecret() {
  if (process.env.ONE_SECRET) return process.env.ONE_SECRET;
  for (const p of [path.join(os.homedir(), '.one', 'config.json')]) {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j.apiKey) return j.apiKey;
    } catch { /* ignore */ }
  }
  return null;
}
const SECRET = getSecret();
if (!SECRET) {
  console.error('❌ مفيش مفتاح One. حِط ONE_SECRET في البيئة أو سجّل دخول عبر `one login`.');
  process.exit(1);
}

// ---------- API ----------
async function api(actionId, p, method, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'x-one-secret': SECRET,
      'x-one-connection-key': CONN,
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
const EXCLUDE_FILES = new Set(['agent-models.json', 'agent-sessions.json', '.npmrc', '.', '..', '...', '.git-sync-state.json']);
const EXCLUDE_REL = new Set(['system/database.json', 'system/panel-config.json', 'system/one-config.json']);

function excluded(rel) {
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
function gitBlobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}
function scan() {
  const map = {};
  for (const rel of walk(ROOT)) {
    map[rel] = gitBlobSha(fs.readFileSync(path.join(ROOT, rel)));
  }
  return map;
}

// ---------- state ----------
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// ---------- sync ----------
let syncing = false;
async function sync({ quiet = false } = {}) {
  if (syncing) return { skipped: true };
  syncing = true;
  try {
    const state = loadState();
    if (!state || !state.commit || !state.tree) {
      console.log('ℹ️  مفيش حالة سابقة. شغّل `node system/autoSync.mjs --init` مرة واحدة.');
      return { error: 'no-state' };
    }
    const local = scan();
    const prev = state.files || {};
    const changed = [];
    for (const [p, sha] of Object.entries(local)) if (prev[p] !== sha) changed.push(p);
    const deleted = Object.keys(prev).filter((p) => !(p in local));
    if (!changed.length && !deleted.length) {
      if (!quiet) console.log('✅ الريبو متزامن — مفيش تغييرات.');
      return { changes: 0 };
    }
    console.log(`🔄 تغييرات: ${changed.length} معدّل/جديد، ${deleted.length} محذوف`);

    const entries = [];
    let i = 0;
    for (const rel of changed) {
      const buf = fs.readFileSync(path.join(ROOT, rel));
      const b = await api(A.blob, `/repos/${OWNER}/${REPO}/git/blobs`, 'POST', { content: buf.toString('base64'), encoding: 'base64' });
      entries.push({ path: rel, mode: '100644', type: 'blob', sha: b.sha });
      if (!quiet) process.stdout.write(`\r  ⬆️  ${++i}/${changed.length}`);
    }
    for (const rel of deleted) entries.push({ path: rel, mode: '100644', type: 'blob', sha: null });
    if (!quiet) console.log('');

    const tree = await api(A.tree, `/repos/${OWNER}/${REPO}/git/trees`, 'POST', { base_tree: state.tree, tree: entries });
    const msg = `auto-sync: ${changed.length} updated, ${deleted.length} deleted`;
    const commit = await api(A.commit, `/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
      message: msg,
      tree: tree.sha,
      parents: [state.commit],
    });
    await api(A.updateRef, `/repos/${OWNER}/${REPO}/git/refs/heads%2F${BRANCH}`, 'PATCH', { sha: commit.sha, force: true });
    saveState({ commit: commit.sha, tree: tree.sha, files: local, at: new Date().toISOString() });
    console.log(`✅ اترفع: https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
    return { changes: changed.length + deleted.length, commit: commit.sha };
  } catch (e) {
    console.error('❌ فشل المزامنة:', e.message);
    return { error: e.message };
  } finally {
    syncing = false;
  }
}

// ---------- init (seed state from remote HEAD) ----------
async function init() {
  const ref = await api(
    'conn_mod_def::GJ3ZKe5vDKs::xb13z7ZBRnOWekJ-N_TG3w',
    `/repos/${OWNER}/${REPO}/git/ref/heads%2F${BRANCH}`,
    'GET',
  );
  const commitSha = ref.object.sha;
  const commit = await api(
    'conn_mod_def::GJ3ZKX3Ay5c::Nm2AiGXOSZy3spF89Asrxw',
    `/repos/${OWNER}/${REPO}/git/commits/${commitSha}`,
    'GET',
  );
  const treeSha = commit.tree.sha;
  const t = await api(
    'conn_mod_def::GJ3ZKuuKOKA::SuUaMhp3QcmjoB8dtOfy1A',
    `/repos/${OWNER}/${REPO}/git/trees/${treeSha}?recursive=1`,
    'GET',
  );
  // نجهّز الحالة من محتوى الريبو على GitHub (مش من الملفات المحلية)
  const files = {};
  for (const e of t.tree || []) if (e.type === 'blob') files[e.path] = e.sha;
  saveState({ commit: commitSha, tree: treeSha, files, at: new Date().toISOString() });
  console.log(`✅ تم تجهيز الحالة من الريبو. commit=${commitSha.slice(0, 8)} tree=${treeSha.slice(0, 8)} ملفات=${Object.keys(files).length}`);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.includes('--init')) {
  await init();
} else if (args.includes('--status')) {
  const s = loadState();
  const local = scan();
  if (!s) { console.log('مفيش حالة. شغّل --init'); process.exit(0); }
  const changed = Object.entries(local).filter(([p, sha]) => s.files?.[p] !== sha).map(([p]) => p);
  const deleted = Object.keys(s.files || {}).filter((p) => !(p in local));
  console.log(`آخر مزامنة: ${s.at || '-'}`);
  console.log(`تعديلات معلّقة: ${changed.length} | محذوف: ${deleted.length}`);
  changed.slice(0, 20).forEach((p) => console.log('  M', p));
  deleted.slice(0, 20).forEach((p) => console.log('  D', p));
} else if (args.includes('--watch')) {
  console.log('👀 وضع المراقبة شغّال... (Ctrl+C للإيقاف)');
  await sync({ quiet: false });
  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => sync({ quiet: true }), DEBOUNCE); };
  try {
    fs.watch(ROOT, { recursive: true }, (_ev, f) => {
      if (!f) return schedule();
      if (excluded(String(f))) return;
      schedule();
    });
  } catch { /* recursive watch unsupported → rely on interval */ }
  setInterval(() => sync({ quiet: true }), INTERVAL);
} else {
  await sync({ quiet: false });
}
