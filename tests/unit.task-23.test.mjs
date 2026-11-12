/**
 * tests/unit.task-23.test.mjs — todo 23: "Replace the dead AI endpoint with a working provider chain"
 * ==========================================================================================
 * GAP-6 (the AI-provider part): plugins/ai/OpenAi.js used to call the old
 * provider, which answers HTTP 402 ("DEPLOYMENT_DISABLED") for EVERY request,
 * so `.اوبن` was 100% broken.
 *
 * These cases assert the VALUE (not just a status code):
 *  - a 200 provider response is replied verbatim (the provider text, not a status)
 *  - a 402 / non-2xx provider response replies the Arabic
 *    "تعذر الوصول إلى مزود الذكاء الاصطناعي" and never crashes
 *  - a 200 response whose BODY is a dead marker / HTML page / error JSON is refused
 *  - ATTEMPT 2: a 200 body that merely CONTAINS a dead marker (inside a longer
 *    text) is refused too — the exact-match-only check leaked the dead
 *    provider's real body ("Payment required\n\nDEPLOYMENT_DISABLED\n\nfra1::...")
 *    verbatim to the user. A 19-body battery pins every one of those bodies.
 *  - a hanging provider is cut off by the timeout — the command never hangs
 *  - the default chain is the free no-key Pollinations text endpoint
 *  - AI_API_URL / AI_API_KEY override the provider (URL + Authorization header)
 *  - no repository file references the dead provider anymore
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const pluginUrl = pathToFileURL(path.join(repoRoot, 'plugins', 'ai', 'OpenAi.js')).href;
const configUrl = pathToFileURL(path.join(repoRoot, 'system', 'config.js')).href;

const mod = await import(pluginUrl);
const handler = mod.default;
const { AI_ERROR, USAGE_TEXT, DEFAULT_API_BASE, hasDeadMarker, isPlausibleCompletion } = mod;
const { buildInfo } = await import(configUrl);

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const ENV_KEYS = ['AI_API_URL', 'AI_API_KEY', 'AI_API_MODEL', 'AI_API_TIMEOUT', 'AI_API_FALLBACK'];

function cleanEnv(t) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  t.after(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

function stubFetch(t, impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => {
    globalThis.fetch = original;
  });
}

function fakeMessage(sender) {
  const replies = [];
  const reacts = [];
  const m = {
    sender,
    chat: sender,
    isGroup: false,
    reply: async (text) => {
      replies.push(String(text));
      return m;
    },
    react: async (emoji) => {
      reacts.push(String(emoji));
    }
  };
  return { m, replies, reacts };
}

/** the real bot config (config.info) — the plugin reads bot.config.info.urls.api */
function realBot() {
  return { config: { info: buildInfo() } };
}

const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body
});

/* ------------------------------------------------------------------ *
 * 1. the happy path — the provider TEXT reaches the user
 * ------------------------------------------------------------------ */

test('ai provider chain: a 200 provider response is replied with the provider text', async (t) => {
  cleanEnv(t);
  const seen = [];
  stubFetch(t, async (url, opts) => {
    seen.push({ url: String(url), opts });
    return res(200, 'نص الإجابة من المزود');
  });

  const { m, replies } = fakeMessage('201000000001@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'ما هي عاصمة مصر؟', bot: realBot() });

  assert.equal(replies.length, 1);
  assert.equal(replies[0], 'نص الإجابة من المزود'); // the VALUE, not just a 200
  assert.equal(seen.length, 1);
  assert.ok(seen[0].url.startsWith('https://text.pollinations.ai/'), seen[0].url);
  assert.ok(decodeURIComponent(seen[0].url).includes('ما هي عاصمة مصر؟'));
});

test('ai provider chain: the default provider is the free no-key Pollinations chain', async (t) => {
  cleanEnv(t);
  const seen = [];
  stubFetch(t, async (url, opts) => {
    seen.push({ url: String(url), opts });
    return res(200, 'ok');
  });

  const { m } = fakeMessage('201000000002@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'ping', bot: realBot() });

  assert.equal(buildInfo().urls.api, DEFAULT_API_BASE);
  assert.equal(DEFAULT_API_BASE, 'https://text.pollinations.ai');
  assert.equal(seen[0].opts.headers.Authorization, undefined); // no key required
  assert.ok(seen[0].url.includes('model=openai'));
});

/* ------------------------------------------------------------------ *
 * 2. the failure path — Arabic, actionable, no crash
 * ------------------------------------------------------------------ */

test('ai provider chain: a 402 provider response replies in Arabic and does not crash', async (t) => {
  cleanEnv(t);
  stubFetch(t, async () => res(402, 'Payment required\n\nDEPLOYMENT_DISABLED'));

  const { m, replies } = fakeMessage('201000000003@s.whatsapp.net');
  let threw = null;
  try {
    await handler(m, { conn: {}, text: 'اختبار', bot: realBot() });
  } catch (e) {
    threw = e;
  }

  assert.equal(threw, null, 'the handler must not throw');
  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes('تعذر الوصول إلى مزود الذكاء الاصطناعي'), replies[0]);
  assert.ok(replies[0].includes('402'), 'the reply must say what went wrong');
});

test('ai provider chain: a misleading 200 body (dead marker / HTML / error JSON) is refused', async (t) => {
  cleanEnv(t);
  const bodies = ['DEPLOYMENT_DISABLED', '<!DOCTYPE html><html><body>gateway</body></html>', '{"error":"Payment required"}'];
  let i = 0;
  stubFetch(t, async () => res(200, bodies[i++ % bodies.length]));

  for (const sender of ['201000000004@s.whatsapp.net', '201000000005@s.whatsapp.net', '201000000006@s.whatsapp.net']) {
    const { m, replies } = fakeMessage(sender);
    await handler(m, { conn: {}, text: 'اختبار', bot: realBot() });
    assert.equal(replies.length, 1);
    assert.ok(replies[0].includes(AI_ERROR), `expected the Arabic error, got: ${replies[0]}`);
    assert.ok(!replies[0].includes('DEPLOYMENT_DISABLED'), 'a dead marker must never be shown as an answer');
    assert.ok(!replies[0].includes('<!DOCTYPE'), 'an HTML page must never be shown as an answer');
  }
});

/* ------------------------------------------------------------------ *
 * 2b. ATTEMPT 2 — the 19-body battery
 *      The attempt-1 defect: the dead-marker guard was an EXACT equality
 *      test against the whole body, so a 200 body that merely CONTAINED a
 *      marker was surfaced VERBATIM as the AI's answer. Every body below
 *      must be REFUSED and must never reach the user.
 *      [body, the fragment that must never appear in the reply]
 * ------------------------------------------------------------------ */

const DEAD_BODY_BATTERY = [
  ['DEPLOYMENT_DISABLED', 'DEPLOYMENT_DISABLED'],
  ['Payment required\n\nDEPLOYMENT_DISABLED\n\nfra1::tp286-1794514422636-df7de0237fe3', 'DEPLOYMENT_DISABLED'],
  ['Error: DEPLOYMENT_DISABLED', 'DEPLOYMENT_DISABLED'],
  ['DEPLOYMENT_DISABLED (deployment off)', 'DEPLOYMENT_DISABLED'],
  ['402 Payment required', 'Payment required'],
  ['Payment required', 'Payment required'],
  ['payment required', 'payment required'],
  ['PAYMENT_REQUIRED', 'PAYMENT_REQUIRED'],
  ['INSUFFICIENT_QUOTA', 'INSUFFICIENT_QUOTA'],
  ['insufficient quota', 'insufficient quota'],
  ['QUOTA_EXCEEDED', 'QUOTA_EXCEEDED'],
  ['quota exceeded', 'quota exceeded'],
  ['DEPLOYMENT DISABLED', 'DEPLOYMENT DISABLED'],
  ['DEPLOYMENTDISABLED', 'DEPLOYMENTDISABLED'],
  ['<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>gateway</body></html>', '<!DOCTYPE'],
  ['{"error":"Payment required"}', '"error"'],
  ['{"status":402,"message":"Payment required"}', '"status"'],
  ['null', 'null'],
  ['ok', null]
];

test('ai provider chain: the 19-body battery — every dead/misleading 200 body is refused and never shown', async (t) => {
  cleanEnv(t);
  assert.equal(DEAD_BODY_BATTERY.length, 19, 'the battery must hold exactly 19 bodies');

  let current = '';
  const served = [];
  stubFetch(t, async () => {
    served.push(current);
    return res(200, current);
  });

  for (const [i, [body, leak]] of DEAD_BODY_BATTERY.entries()) {
    current = body;
    const { m, replies } = fakeMessage(`20100000${String(30 + i).padStart(4, '0')}@s.whatsapp.net`);
    await handler(m, { conn: {}, text: 'اختبار', bot: realBot() });

    assert.equal(replies.length, 1, `body #${i} must produce exactly one reply`);
    assert.ok(
      replies[0].includes(AI_ERROR),
      `body #${i} (${JSON.stringify(body)}) must be refused with the Arabic error, got: ${replies[0]}`
    );
    assert.notEqual(replies[0].trim(), body.trim(), `body #${i} must never be the answer`);
    if (leak) {
      assert.ok(
        !replies[0].includes(leak),
        `body #${i} leaked ${JSON.stringify(leak)} into the reply: ${replies[0]}`
      );
    }
  }

  assert.equal(served.length, 19, 'every body must have been served exactly once');
});

test('ai provider chain: a dead 200 body fails over to the next provider in the chain', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  const seen = [];
  stubFetch(t, async (url) => {
    seen.push(String(url));
    if (String(url).includes('my-provider.example'))
      return res(200, 'Payment required\n\nDEPLOYMENT_DISABLED\n\nfra1::tp286-1794514422636-df7de0237fe3');
    return res(200, 'رد المزود المجاني');
  });

  const { m, replies } = fakeMessage('201000000049@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(seen.length, 2, 'the dead provider must be skipped, not surfaced');
  assert.ok(seen[0].includes('my-provider.example'));
  assert.ok(seen[1].startsWith('https://text.pollinations.ai/'));
  assert.equal(replies[0], 'رد المزود المجاني');
  assert.ok(!replies[0].includes('DEPLOYMENT_DISABLED'), 'the dead body must never be shown');
});

test('ai provider chain: hasDeadMarker / isPlausibleCompletion pin the refusal rules', () => {
  // dead markers — exact, embedded, case and separator variants
  for (const mk of ['DEPLOYMENT_DISABLED', 'PAYMENT_REQUIRED', 'PAYMENT REQUIRED', 'INSUFFICIENT_QUOTA', 'QUOTA_EXCEEDED']) {
    assert.equal(hasDeadMarker(mk), true, mk);
  }
  assert.equal(hasDeadMarker('Payment required\n\nDEPLOYMENT_DISABLED\n\nfra1::x'), true);
  assert.equal(hasDeadMarker('Error: DEPLOYMENT_DISABLED'), true);
  assert.equal(hasDeadMarker('DEPLOYMENT_DISABLED (deployment off)'), true);
  assert.equal(hasDeadMarker('402 Payment required'), true);
  assert.equal(hasDeadMarker('deployment disabled'), true);
  assert.equal(hasDeadMarker('DEPLOYMENTDISABLED'), true);
  assert.equal(hasDeadMarker('The capital of France is Paris.'), false);

  // plausibility — a real answer passes, junk does not
  assert.equal(isPlausibleCompletion('pong'), true);
  assert.equal(isPlausibleCompletion('2 + 2 equals 4.'), true);
  assert.equal(isPlausibleCompletion('نص الإجابة من المزود'), true);
  assert.equal(isPlausibleCompletion(''), false);
  assert.equal(isPlausibleCompletion('ok'), false); // below the minimum length
  assert.equal(isPlausibleCompletion('!!!'), false); // no letter/digit
  assert.equal(isPlausibleCompletion('<!DOCTYPE html><html></html>'), false);
  assert.equal(isPlausibleCompletion('404 Not Found'), false);
  assert.equal(isPlausibleCompletion('Service Unavailable'), false);
  assert.equal(isPlausibleCompletion('null'), false);
});

test('ai provider chain: a hanging provider is cut off by the timeout and never hangs', async (t) => {
  cleanEnv(t);
  process.env.AI_API_TIMEOUT = '400';
  process.env.AI_API_FALLBACK = '0';
  stubFetch(t, () => new Promise(() => {})); // never settles, ignores the abort signal

  const { m, replies } = fakeMessage('201000000007@s.whatsapp.net');
  const started = Date.now();
  let threw = null;
  try {
    await handler(m, { conn: {}, text: 'اختبار', bot: realBot() });
  } catch (e) {
    threw = e;
  }
  const elapsed = Date.now() - started;

  assert.equal(threw, null);
  assert.ok(elapsed < 5000, `the command must not hang (took ${elapsed}ms)`);
  assert.ok(elapsed >= 300, `the timeout must really fire (took ${elapsed}ms)`);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes(AI_ERROR), replies[0]);
});

/* ------------------------------------------------------------------ *
 * 3. the operator override
 * ------------------------------------------------------------------ */

test('ai provider chain: AI_API_URL / AI_API_KEY override the provider', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  process.env.AI_API_KEY = 'sekret-key';
  const seen = [];
  stubFetch(t, async (url, opts) => {
    seen.push({ url: String(url), opts });
    return res(200, 'رد المزود الخاص');
  });

  const { m, replies } = fakeMessage('201000000008@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies[0], 'رد المزود الخاص');
  assert.equal(seen.length, 1);
  assert.ok(seen[0].url.startsWith('https://my-provider.example/v1/'), seen[0].url);
  assert.equal(seen[0].opts.headers.Authorization, 'Bearer sekret-key');
});

test('ai provider chain: the chain falls back to the free provider when the custom one fails', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  const seen = [];
  stubFetch(t, async (url) => {
    seen.push(String(url));
    if (String(url).includes('my-provider.example')) return res(500, 'boom');
    return res(200, 'رد المزود المجاني');
  });

  const { m, replies } = fakeMessage('201000000009@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies[0], 'رد المزود المجاني');
  assert.equal(seen.length, 2);
  assert.ok(seen[0].includes('my-provider.example'));
  assert.ok(seen[1].startsWith('https://text.pollinations.ai/'));
});

test('ai provider chain: a rejected key falls back to the keyless free entry on the same base', async (t) => {
  cleanEnv(t);
  // the operator pointed AI_API_URL at the free provider but sent a key it does not own
  process.env.AI_API_URL = 'https://text.pollinations.ai';
  process.env.AI_API_KEY = 'not-a-valid-key';
  const seen = [];
  stubFetch(t, async (url, opts) => {
    seen.push({ url: String(url), auth: opts?.headers?.Authorization ?? null });
    if (opts?.headers?.Authorization) return res(402, 'Payment required');
    return res(200, 'رد بدون مفتاح');
  });

  const { m, replies } = fakeMessage('201000000012@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies[0], 'رد بدون مفتاح');
  assert.equal(seen.length, 2);
  assert.equal(seen[0].auth, 'Bearer not-a-valid-key');
  assert.equal(seen[1].auth, null, 'the free fallback must never carry a key');
});

test('ai provider chain: buildInfo() exposes the override through config.info.urls.api', () => {
  assert.equal(buildInfo().urls.api, 'https://text.pollinations.ai');
  assert.equal(buildInfo({ AI_API_URL: 'https://my-provider.example/v1' }).urls.api, 'https://my-provider.example/v1');
});

/* ------------------------------------------------------------------ *
 * 4. malformed input + the repo scan
 * ------------------------------------------------------------------ */

test('ai provider chain: malformed input (empty prompt) replies with the usage text and never calls the provider', async (t) => {
  cleanEnv(t);
  let calls = 0;
  stubFetch(t, async () => {
    calls++;
    return res(200, 'should not be reached');
  });

  const { m, replies } = fakeMessage('201000000010@s.whatsapp.net');
  await handler(m, { conn: {}, text: '   ', bot: realBot() });

  assert.equal(calls, 0, 'no provider call for an empty prompt');
  assert.equal(replies.length, 1);
  assert.equal(replies[0], USAGE_TEXT);
  assert.ok(replies[0].includes('اكتب سوألك بعد الامر'));
});

test('ai provider chain: a per-user cooldown stops the provider from being hammered', async (t) => {
  cleanEnv(t);
  let calls = 0;
  stubFetch(t, async () => {
    calls++;
    return res(200, 'ok');
  });

  const { m, replies } = fakeMessage('201000000011@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال أول', bot: realBot() });
  await handler(m, { conn: {}, text: 'سؤال تاني', bot: realBot() });

  assert.equal(calls, 1, 'the second call must be blocked by the cooldown');
  assert.equal(replies.length, 2);
  assert.ok(replies[1].includes('استنى'), replies[1]);
});

test('ai provider chain: no repository file references the dead provider anymore', () => {
  const deadHost = ['emam-api', 'web', 'id'].join('.');
  const skipDirs = new Set(['node_modules', '.git', '.omo', 'session', 'tmp', 'agent-backups']);

  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name), out);
      } else if (entry.isFile()) {
        out.push(path.join(dir, entry.name));
      }
    }
    return out;
  };

  const offenders = [];
  for (const file of walk(repoRoot)) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (content.includes(deadHost)) offenders.push(path.relative(repoRoot, file));
  }

  assert.deepEqual(offenders, [], `dead provider still referenced in: ${offenders.join(', ')}`);
});
