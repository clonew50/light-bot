/**
 * system/creativePackUtils.js
 * ---------------------------------------------------
 * أدوات مشتركة لبناء حزم الأوامر الإبداعية التفاعلية:
 * - تهيئة سجل المستخدم بأمان في global.db.users
 * - دوال مساعدة للتحليل الحسابي والنصي والتنسيق بالبطاقات
 * - توليد رقم عشوائي حتمي/مبذور ودوال التوزيع والمؤشرات
 */
import crypto from 'node:crypto';
import {
  formatCard,
  progressBar,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget,
  makeCopyButton,
  makeQuickButton
} from './interactiveUI.js';

export function ensureDbUser(sender) {
  if (!global.db) global.db = { users: {}, groups: {} };
  if (!global.db.users) global.db.users = {};
  const id = String(sender || 'guest@s.whatsapp.net');
  if (!global.db.users[id]) {
    global.db.users[id] = { money: 250, exp: 0, level: 1 };
  }
  const u = global.db.users[id];
  if (typeof u.money !== 'number') u.money = Number(u.money || 0);
  if (typeof u.exp !== 'number') u.exp = Number(u.exp || 0);
  return u;
}

export function awardUser(sender, coins = 0, xp = 0) {
  const u = ensureDbUser(sender);
  u.money = Math.max(0, u.money + Number(coins || 0));
  u.exp = Math.max(0, u.exp + Number(xp || 0));
  return u;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function seededPick(arr, seedStr) {
  const hash = crypto.createHash('sha256').update(String(seedStr || '')).digest();
  const idx = hash.readUInt32BE(0) % arr.length;
  return arr[idx];
}

export function seededNumber(seedStr, min = 0, max = 100) {
  const hash = crypto.createHash('sha256').update(String(seedStr || '')).digest();
  const ratio = hash.readUInt32BE(0) / 0xffffffff;
  return Math.floor(min + ratio * (max - min + 1));
}

export function parseNumbers(ctx, defaults = []) {
  const raw = String(ctx?.text || '')
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/,/g, '.');
  const matches = raw.match(/-?\d+(?:\.\d+)?/g) || [];
  return defaults.map((def, i) => {
    const n = parseFloat(matches[i]);
    return Number.isFinite(n) ? n : def;
  });
}

export function splitArgsPipe(ctx) {
  return String(ctx?.text || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function makeSimpleHtmlWidget(title, accent, rows = [], footerNote = 'LIGHT BOT LAB') {
  const items = rows
    .map(([k, v]) => `<div class="box"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
    .join('');
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}body{margin:0;padding:16px;background:#0b1120;color:#f8fafc}.card{background:#111827;border:1px solid ${accent};border-radius:16px;padding:18px;box-shadow:0 12px 28px rgba(0,0,0,.45)}.h{font-size:18px;font-weight:800;margin:0 0 12px;color:${accent}}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.box{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:10px}.k{font-size:11px;color:#94a3b8}.v{font-size:14px;font-weight:700;margin-top:4px;color:#f1f5f9}.ft{margin-top:12px;font-size:11px;color:#64748b;text-align:center}</style></head><body><div class="card"><div class="h">${escapeHtml(title)}</div><div class="grid">${items}</div><div class="ft">${escapeHtml(footerNote)}</div></div></body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDurationAr(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d) parts.push(`${d} يوم`);
  if (h) parts.push(`${h} ساعة`);
  if (m) parts.push(`${m} دقيقة`);
  if (!d && !h) parts.push(`${s} ثانية`);
  return parts.join(' و ') || '0 ثانية';
}

export {
  formatCard,
  progressBar,
  sendInteractiveCard,
  sendInteractivePoll,
  sendInteractiveWidget,
  makeCopyButton,
  makeQuickButton
};
