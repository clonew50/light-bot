/**
 * tests/unit.task-23.test.mjs — todo 23: "Replace the dead AI endpoint with a working provider chain"
 * ==========================================================================================
 * ATTEMPT 3 — the verifier of attempt 2 returned needs-fix(product): the
 * plausibility filter discarded LEGITIMATE short answers and false-refused
 * correct content. The three defects fixed here:
 *
 *   D1. MIN_ANSWER_LENGTH was 3, so a correct 1-2 char answer like "42"
 *       was refused. The floor is now 1 — only EMPTY bodies are rejected.
 *   D2. The dead-marker check compacted the body (stripped ALL
 *       non-alphanumeric chars) before matching, so a correct answer that
 *       merely MENTIONS "402 Payment Required" (e.g. an explanation of
 *       HTTP 402) was falsely refused. Markers are now matched in the
 *       ORIGINAL text only: whole-body equality (any capitalization /
 *       separator variant) plus substring for the code-like markers
 *       (DEPLOYMENT_DISABLED, PAYMENT_REQUIRED, INSUFFICIENT_QUOTA,
 *       QUOTA_EXCEEDED). No character is stripped before matching.
 *   D3. HTML_DOC_RE matched <body>/<html> ANYWHERE, so a correct answer
 *       containing those tags mid-text was refused. Only a body that
 *       STARTS with an HTML document marker is refused now.
 *
 * MUST KEEP (regression-pinned here): the attempt-1 exact-equality marker
 * leak stays closed (an exact / embedded DEPLOYMENT_DISABLED body is
 * refused and never reaches the user); AI_API_URL / AI_API_KEY overrides
 * work; AI_API_FALLBACK=0 disables the free fallback; no file references
 * the dead provider; timeout / cooldown / Arabic errors unchanged.
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
const { AI_ERROR, USAGE_TEXT, DEFAULT_API_BASE, hasDeadMarker, isPlausibleCompletion, runChain } = mod;
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

/** the compact check the OLD (defective) code used — kept ONLY to prove
 *  the new code no longer false-positives on it. */
const compactOf = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ================================================================== *
 * D1 — short answers are accepted; only EMPTY bodies are refused
 * ================================================================== */

test('attempt3 D1: a correct 2-char answer "42" reaches the user verbatim', async (t) => {
  cleanEnv(t);
  stubFetch(t, async () => res(200, '42'));

  const { m, replies } = fakeMessage('203000000001@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'ما ناتج 21+21؟', bot: realBot() });

  assert.equal(replies.length, 1);
  assert.equal(replies[0], '42'); // the VALUE — a short real answer is not discarded
});

test('attempt3 D1: unit pins — the length floor is 1, empty is the only length refusal', () => {
  assert.equal(isPlausibleCompletion('42'), true);   // 2 chars
  assert.equal(isPlausibleCompletion('7'), true);    // 1 char
  assert.equal(isPlausibleCompletion('ok'), true);   // 2 chars — a real (if terse) answer
  assert.equal(isPlausibleCompletion('ن'), true);    // 1 Arabic char
  assert.equal(isPlausibleCompletion(''), false);    // empty
  assert.equal(isPlausibleCompletion('   '), false); // whitespace-only
});

test('attempt3 D1: a JSON envelope whose content is "42" is extracted and accepted', async (t) => {
  cleanEnv(t);
  stubFetch(t, async () => res(200, '{"choices":[{"message":{"content":"42"}}]}'));

  const { m, replies } = fakeMessage('203000000002@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies[0], '42');
});

/* ------------------------------------------------------------------ *
 * D1 regression — an EMPTY 200 body is still refused (Arabic error)
 * ------------------------------------------------------------------ */

test('attempt3 D1: an empty 200 body is still refused with the Arabic error', async (t) => {
  cleanEnv(t);
  stubFetch(t, async () => res(200, '   '));

  const { m, replies } = fakeMessage('203000000003@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes(AI_ERROR), replies[0]);
  assert.ok(!replies[0].includes('42'));
});

/* ================================================================== *
 * D2 — dead markers are matched in the ORIGINAL text only
 * ================================================================== */

test('attempt3 D2: a correct answer that MENTIONS "402 Payment Required" is accepted', async (t) => {
  cleanEnv(t);
  const answer = 'The HTTP 402 status code means Payment Required — it is reserved for future use.';
  stubFetch(t, async () => res(200, answer));

  const { m, replies } = fakeMessage('203000000004@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'ما معنى HTTP 402؟', bot: realBot() });

  assert.equal(replies.length, 1);
  assert.equal(replies[0], answer); // the explanation, not the Arabic error
});

test('attempt3 D2: the marker check uses the ORIGINAL text — compacting alone would false-positive here', async (t) => {
  cleanEnv(t);
  // Compacting this body yields "...SAIDPAYMENTREQUIREDFIELDS..." which the
  // old compacted matcher matched -> false refusal. The ORIGINAL text does
  // not contain any dead marker ("Payment" and "Required" are separated).
  const answer = 'The provider said: Payment. Required fields are missing from the request.';
  assert.equal(compactOf(answer).includes('PAYMENTREQUIRED'), true, 'precondition: the old compact check WOULD match');

  stubFetch(t, async () => res(200, answer));

  const { m, replies } = fakeMessage('203000000005@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(hasDeadMarker(answer), false);
  assert.equal(replies[0], answer); // accepted — no character-stripping before matching
});

test('attempt3 D2: unit pins — whole-body marker equality still refuses, prose mentions pass', () => {
  // whole-body refusals (any capitalization / separator variant)
  for (const body of [
    'DEPLOYMENT_DISABLED', 'deployment disabled', 'DEPLOYMENTDISABLED', ' Deployment Disabled ',
    'payment required', 'PAYMENT REQUIRED', 'INSUFFICIENT_QUOTA', 'insufficient quota',
    'QUOTA_EXCEEDED', 'quota exceeded', 'PAYMENT_REQUIRED'
  ]) {
    assert.equal(hasDeadMarker(body), true, body);
  }
  // prose mentions are NOT dead markers
  for (const body of [
    'The HTTP 402 status code means Payment Required - reserved for future use.',
    'Payment was required last year, but not anymore.',
    'The flag DEPLOYMENT-DISABLED-FALSE means the deployment is on.' // contains dashes inside a longer token
  ]) {
    assert.equal(hasDeadMarker(body), false, body);
  }
});

/* ================================================================== *
 * D3 — only a body that STARTS with an HTML marker is refused
 * ================================================================== */

test('attempt3 D3: a correct answer containing <body>/<html> mid-text is accepted', async (t) => {
  cleanEnv(t);
  const answer = 'In an HTML document the <body> element holds the content and <html> is the root element.';
  stubFetch(t, async () => res(200, answer));

  const { m, replies } = fakeMessage('203000000006@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'ايش وسم body؟', bot: realBot() });

  assert.equal(replies.length, 1);
  assert.equal(replies[0], answer); // the tags mid-text do not poison the answer
});

test('attempt3 D3: a body that IS an HTML page (starts with <html / <!DOCTYPE) is refused', async (t) => {
  cleanEnv(t);
  const bodies = ['<html><body>502 gateway</body></html>', '<!DOCTYPE html><html><body>boom</body></html>'];
  let i = 0;
  stubFetch(t, async () => res(200, bodies[i++]));

  for (const sender of ['203000000007@s.whatsapp.net', '203000000008@s.whatsapp.net']) {
    const { m, replies } = fakeMessage(sender);
    await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });
    assert.equal(replies.length, 1);
    assert.ok(replies[0].includes(AI_ERROR), `expected the Arabic error, got: ${replies[0]}`);
    assert.ok(!replies[0].includes('<html'), 'an HTML page must never be shown as an answer');
  }
});

/* ================================================================== *
 * MUST KEEP — the attempt-1 exact-equality marker leak stays closed
 * ================================================================== */

const DEAD_BODY_BATTERY = [
  'DEPLOYMENT_DISABLED',
  'Payment required\n\nDEPLOYMENT_DISABLED\n\nfra1::tp286-1794514422636-df7de0237fe3',
  'Error: DEPLOYMENT_DISABLED',
  'DEPLOYMENT_DISABLED (deployment off)',
  'deployment_disabled',
  'INSUFFICIENT_QUOTA',
  'QUOTA_EXCEEDED',
  '402 Payment required', // bare dead-provider status line
  '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>gateway</body></html>',
  '{"error":"Payment required"}',
  '{"status":402,"message":"Payment required"}',
  'null',
  '404 Not Found',
  'Service Unavailable'
];

test('attempt3 keep: every dead/misleading 200 body is refused and never reaches the user', async (t) => {
  cleanEnv(t);
  let current = '';
  const served = [];
  stubFetch(t, async () => {
    served.push(current);
    return res(200, current);
  });

  for (const [i, body] of DEAD_BODY_BATTERY.entries()) {
    current = body;
    const { m, replies } = fakeMessage(`20300001${String(10 + i).padStart(3, '0')}@s.whatsapp.net`);
    await handler(m, { conn: {}, text: 'اختبار', bot: realBot() });

    assert.equal(replies.length, 1, `body #${i} must produce exactly one reply`);
    assert.ok(
      replies[0].includes(AI_ERROR),
      `body #${i} (${JSON.stringify(body)}) must be refused with the Arabic error, got: ${replies[0]}`
    );
    assert.notEqual(replies[0].trim(), body.trim(), `body #${i} must never be the answer`);
    if (body.includes('DEPLOYMENT')) {
      assert.ok(!replies[0].includes('DEPLOYMENT_DISABLED'), `body #${i} leaked the dead marker`);
    }
  }
  assert.equal(served.length, DEAD_BODY_BATTERY.length);
});

test('attempt3 keep: a 200 with a bogus body is refused while a 200 with "42" is accepted (misleading_success_output)', async (t) => {
  cleanEnv(t);
  const served = [];
  let current = 'DEPLOYMENT_DISABLED';
  stubFetch(t, async () => {
    served.push(current);
    return res(200, current);
  });

  const { m, replies } = fakeMessage('203000000101@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });
  assert.ok(replies[0].includes(AI_ERROR), 'the bogus 200 body must take the refusal path');

  current = '42';
  const { m: m2, replies: replies2 } = fakeMessage('203000000102@s.whatsapp.net');
  await handler(m2, { conn: {}, text: 'سؤال', bot: realBot() });
  assert.equal(replies2[0], '42', 'a 200 with a real short answer must be accepted');
  assert.equal(served.length, 2);
});

test('attempt3 keep: a dead custom-provider body fails over to the free provider', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  const seen = [];
  stubFetch(t, async (url) => {
    seen.push(String(url));
    if (String(url).includes('my-provider.example'))
      return res(200, 'Payment required\n\nDEPLOYMENT_DISABLED\n\nfra1::tp286-1794514422636-df7de0237fe3');
    return res(200, 'رد المزود المجاني');
  });

  const { m, replies } = fakeMessage('203000000103@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(seen.length, 2, 'the dead provider must be skipped, not surfaced');
  assert.ok(seen[0].includes('my-provider.example'));
  assert.ok(seen[1].startsWith('https://text.pollinations.ai/'));
  assert.equal(replies[0], 'رد المزود المجاني');
  assert.ok(!replies[0].includes('DEPLOYMENT_DISABLED'));
});

/* ================================================================== *
 * MUST KEEP — overrides, AI_API_FALLBACK=0, default chain
 * ================================================================== */

test('attempt3 keep: AI_API_URL / AI_API_KEY override the provider (URL + Authorization)', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  process.env.AI_API_KEY = 'sekret-key';
  const seen = [];
  stubFetch(t, async (url, opts) => {
    seen.push({ url: String(url), opts });
    return res(200, '42');
  });

  const { m, replies } = fakeMessage('203000000104@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies[0], '42');
  assert.equal(seen.length, 1);
  assert.ok(seen[0].url.startsWith('https://my-provider.example/v1/'), seen[0].url);
  assert.equal(seen[0].opts.headers.Authorization, 'Bearer sekret-key');
});

test('attempt3 keep: AI_API_FALLBACK=0 disables the free fallback (single call, Arabic error)', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  process.env.AI_API_FALLBACK = '0';
  const seen = [];
  stubFetch(t, async (url) => {
    seen.push(String(url));
    return res(500, 'boom');
  });

  const { m, replies } = fakeMessage('203000000105@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(seen.length, 1, 'no free-fallback call when AI_API_FALLBACK=0');
  assert.ok(seen[0].includes('my-provider.example'));
  assert.ok(replies[0].includes(AI_ERROR), replies[0]);
  assert.ok(!replies[0].startsWith('https://text.pollinations.ai'));
});

test('attempt3 keep: the default chain is the free no-key Pollinations endpoint', async (t) => {
  cleanEnv(t);
  const seen = [];
  stubFetch(t, async (url, opts) => {
    seen.push({ url: String(url), opts });
    return res(200, 'pong');
  });

  const { m, replies } = fakeMessage('203000000106@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'ping', bot: realBot() });

  assert.equal(replies[0], 'pong');
  assert.equal(buildInfo().urls.api, DEFAULT_API_BASE);
  assert.equal(DEFAULT_API_BASE, 'https://text.pollinations.ai');
  assert.equal(seen[0].opts.headers.Authorization, undefined);
  assert.ok(seen[0].url.includes('model=openai'));
});

test('attempt3 keep: with fallback enabled a failing custom provider falls back to the free one', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://my-provider.example/v1';
  const seen = [];
  stubFetch(t, async (url) => {
    seen.push(String(url));
    if (String(url).includes('my-provider.example')) return res(500, 'boom');
    return res(200, 'رد المزود المجاني');
  });

  const { m, replies } = fakeMessage('203000000107@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });

  assert.equal(replies[0], 'رد المزود المجاني');
  assert.equal(seen.length, 2);
  assert.ok(seen[1].startsWith('https://text.pollinations.ai/'));
});

/* ================================================================== *
 * unchanged behaviour — HTTP status errors, timeout, cooldown, input
 * ================================================================== */

test('attempt3 keep: a 402 provider response replies in Arabic and does not crash', async (t) => {
  cleanEnv(t);
  stubFetch(t, async () => res(402, 'Payment required\n\nDEPLOYMENT_DISABLED'));

  const { m, replies } = fakeMessage('203000000108@s.whatsapp.net');
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

test('attempt3 keep: an unreachable host errors in bounded time (no hang)', async (t) => {
  cleanEnv(t);
  process.env.AI_API_URL = 'https://this-host-does-not-exist-xyz123.invalid';
  process.env.AI_API_TIMEOUT = '3000';
  process.env.AI_API_FALLBACK = '0';

  const { m, replies } = fakeMessage('203000000109@s.whatsapp.net');
  const started = Date.now();
  let threw = null;
  try {
    await handler(m, { conn: {}, text: 'سؤال', bot: realBot() });
  } catch (e) {
    threw = e;
  }
  const elapsed = Date.now() - started;

  assert.equal(threw, null);
  assert.ok(elapsed < 8000, `must return in bounded time (took ${elapsed}ms)`);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes(AI_ERROR), replies[0]);
});

test('attempt3 keep: a hanging provider is cut off by the timeout and never hangs', async (t) => {
  cleanEnv(t);
  process.env.AI_API_TIMEOUT = '400';
  process.env.AI_API_FALLBACK = '0';
  stubFetch(t, () => new Promise(() => {})); // never settles, ignores the abort signal

  const { m, replies } = fakeMessage('203000000110@s.whatsapp.net');
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

test('attempt3 keep: a per-user cooldown stops the provider from being hammered', async (t) => {
  cleanEnv(t);
  let calls = 0;
  stubFetch(t, async () => {
    calls++;
    return res(200, '42');
  });

  const { m, replies } = fakeMessage('203000000111@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'سؤال أول', bot: realBot() });
  await handler(m, { conn: {}, text: 'سؤال تاني', bot: realBot() });

  assert.equal(calls, 1, 'the second call must be blocked by the cooldown');
  assert.equal(replies.length, 2);
  assert.ok(replies[1].includes('استنى'), replies[1]);
});

test('attempt3 keep: malformed input (empty prompt) replies with the usage text and never calls the provider', async (t) => {
  cleanEnv(t);
  let calls = 0;
  stubFetch(t, async () => {
    calls++;
    return res(200, 'should not be reached');
  });

  const { m, replies } = fakeMessage('203000000112@s.whatsapp.net');
  await handler(m, { conn: {}, text: '   ', bot: realBot() });

  assert.equal(calls, 0, 'no provider call for an empty prompt');
  assert.equal(replies.length, 1);
  assert.equal(replies[0], USAGE_TEXT);
  assert.ok(replies[0].includes('اكتب سوألك بعد الامر'));
});

test('attempt3 keep: a >1000-char prompt is refused in Arabic before any provider call', async (t) => {
  cleanEnv(t);
  let calls = 0;
  stubFetch(t, async () => {
    calls++;
    return res(200, 'nope');
  });

  const { m, replies } = fakeMessage('203000000113@s.whatsapp.net');
  await handler(m, { conn: {}, text: 'س'.repeat(1001), bot: realBot() });

  assert.equal(calls, 0);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes('طويل أوي'), replies[0]);
});

/* ------------------------------------------------------------------ *
 * the dead-provider host is gone from the repo
 * ------------------------------------------------------------------ */

test('attempt3 keep: no repository file references the dead provider anymore', () => {
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
