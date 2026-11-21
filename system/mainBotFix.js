import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PAIR_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NON_RETRYABLE_STATUS = new Set([401, 403, 411, 440]);
const SESSION_LOGGED_OUT_CODES = new Set([401, 403]);

export function sanitizePhone(raw) {
  let s = String(raw || '').trim();
  if (s.includes('@')) s = s.split('@')[0];
  if (s.includes(':')) s = s.split(':')[0];
  const digits = s.replace(/[^0-9]/g, '');
  if (!/^\d{6,20}$/.test(digits)) return '';
  return digits;
}

export function generateMainPairCode() {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += PAIR_CODE_CHARS[bytes[i] % PAIR_CODE_CHARS.length];
  return out;
}

export function isSessionRegistered(sessionDir) {
  try {
    const p = path.join(path.resolve(sessionDir || './session'), 'creds.json');
    if (!fs.existsSync(p)) return false;
    const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    return !!(creds?.registered && creds?.me?.id);
  } catch {
    return false;
  }
}

export function backupUnregisteredSession(sessionDir, { forceIfRegistered = false } = {}) {
  const sp = path.resolve(sessionDir || './session');
  if (!fs.existsSync(sp)) return { moved: false, reason: 'missing' };
  const credsPath = path.join(sp, 'creds.json');
  if (!forceIfRegistered && isSessionRegistered(sp)) {
    return { moved: false, reason: 'registered' };
  }
  if (!forceIfRegistered && !fs.existsSync(credsPath)) {
    try {
      const files = fs.readdirSync(sp);
      if (files.length === 0) return { moved: false, reason: 'empty' };
    } catch {
      return { moved: false, reason: 'unreadable' };
    }
  }
  let bak = `${sp}.bak-${Date.now()}`;
  let n = 0;
  while (fs.existsSync(bak)) {
    n += 1;
    bak = `${sp}.bak-${Date.now()}-${n}`;
  }
  fs.renameSync(sp, bak);
  return { moved: true, backupPath: bak };
}

function disconnectInfo(update) {
  const err = update?.lastDisconnect?.error;
  const code = Number(err?.output?.statusCode ?? err?.status ?? NaN);
  const message = String(err?.message || err || '');
  return {
    code: Number.isFinite(code) ? code : null,
    message
  };
}

function isWsOpen(ws) {
  if (!ws) return false;
  try {
    if (typeof ws.readyState === 'number') return ws.readyState === 1;
    if (typeof ws.socket?.readyState === 'number') return ws.socket.readyState === 1;
    if (typeof ws.isOpen === 'boolean') return ws.isOpen;
  } catch {}
  return false;
}

function waitForSocketReady(sock, timeoutMs = 10000) {
  if (!sock) return Promise.resolve(false);
  if (isWsOpen(sock.ws)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    let poll = null;
    let timer = null;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (poll) clearInterval(poll);
      if (timer) clearTimeout(timer);
      try { sock.ev?.off?.('connection.update', onEv); } catch {}
      try { sock.ev?.removeListener?.('connection.update', onEv); } catch {}
      resolve(ok);
    };
    const onEv = (u) => {
      if (u?.connection === 'close') { finish(false); return; }
      if (isWsOpen(sock.ws) || u?.qr || u?.connection === 'open') {
        finish(true);
      }
    };
    try { sock.ev?.on?.('connection.update', onEv); } catch {}
    poll = setInterval(() => {
      if (isWsOpen(sock.ws)) finish(true);
    }, 150);
    poll.unref?.();
    timer = setTimeout(() => finish(isWsOpen(sock.ws)), timeoutMs);
    timer.unref?.();
  });
}

/**
 * Runtime connection & pairing fix for meowsab's Client (`En`).
 * Fixes:
 *  1) `client.reconnectAttempts` was `undefined`, so `undefined < 10` was false and Client never auto-reconnected.
 *  2) `on=Ko` set `this.isRunning = false` leaving `this.running = true`, blocking `client.start()` retries.
 *  3) `Client.start()` called `requestPairingCode` in a blind 2000ms timer before WS handshake was ready,
 *     never retried on failure, and swallowed errors without notifying the web panel.
 *  4) Normalizes phoneNumber and prevents concurrent double pairing calls on the same socket.
 */
export function installMainBotConnectionFix(client, opts = {}) {
  if (!client || client.__mainBotFixInstalled) return client?.__mainBotFixHandle || null;
  client.__mainBotFixInstalled = true;

  const {
    isStopped = () => false,
    onPairingCode = () => {},
    onPairingError = () => {},
    onEvent = () => {},
    onOpen = () => {},
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (h) => clearTimeout(h),
    log = (...a) => console.log(...a),
    logError = (...a) => console.error(...a),
  } = opts;

  const state = {
    reconnectTimer: null,
    reconnectFailures: 0,
    attachedSock: null,
    listener: null,
    lastIssuedCode: null,
    lastError: null,
  };

  if (!Number.isFinite(client.reconnectAttempts)) {
    client.reconnectAttempts = 0;
  }
  if (client.config && typeof client.config.phoneNumber === 'string') {
    const clean = sanitizePhone(client.config.phoneNumber);
    if (clean || client.config.phoneNumber) {
      client.config.phoneNumber = clean;
    }
  }

  function clearReconnectTimer() {
    if (state.reconnectTimer != null) {
      try { clearTimer(state.reconnectTimer); } catch {}
      state.reconnectTimer = null;
    }
  }

  function wrapRequestPairingCode(sock) {
    if (!sock || typeof sock.requestPairingCode !== 'function' || sock.__pairWrapped) return;
    sock.__pairWrapped = true;
    const origReq = sock.requestPairingCode.bind(sock);

    sock.requestPairingCode = async (phoneArg, customCodeArg) => {
      if (sock.__pairCodeResult) return sock.__pairCodeResult;
      if (sock.__pairPromise) return sock.__pairPromise;

      const phone = sanitizePhone(phoneArg || client.config?.phoneNumber);
      if (!phone) {
        const err = new Error('رقم الهاتف غير صالح للربط');
        state.lastError = err.message;
        onPairingError(err);
        throw err;
      }

      const customCode = customCodeArg && /^[A-Z0-9]{8}$/i.test(String(customCodeArg)) && customCodeArg !== 'VENI1234'
        ? String(customCodeArg).toUpperCase()
        : generateMainPairCode();

      sock.__pairPromise = (async () => {
        try {
          const ready = await waitForSocketReady(sock, 10000);
          if (!ready && !isWsOpen(sock.ws)) {
            throw new Error('انتهت مهلة فتح اتصال واتساب قبل إصدار الكود');
          }
          // Small settle delay after WS open for Noise handshake readiness
          await new Promise((r) => setTimeout(r, 400));
          let code;
          try {
            code = await origReq(phone, customCode);
          } catch (firstErr) {
            if (sock !== client.sock || !isWsOpen(sock.ws)) throw firstErr;
            await new Promise((r) => setTimeout(r, 1200));
            code = await origReq(phone, customCode);
          }
          sock.__pairCodeResult = code || customCode;
          state.lastIssuedCode = sock.__pairCodeResult;
          state.lastError = null;
          onPairingCode(sock.__pairCodeResult, phone);
          return sock.__pairCodeResult;
        } catch (err) {
          sock.__pairPromise = null;
          state.lastError = err?.message || String(err);
          onPairingError(err);
          onEvent('warn', `⚠️ تعذّر إصدار كود ربط البوت الرئيسي: ${state.lastError}`);
          throw err;
        }
      })();

      return sock.__pairPromise;
    };
  }

  function triggerPairingForSock(sock) {
    if (!sock || sock !== client.sock) return;
    if (client.config?.printQR) return;
    const phone = sanitizePhone(client.config?.phoneNumber);
    if (!phone) return;
    if (sock.authState?.creds?.registered) return;
    if (sock.__pairCodeResult || sock.__pairPromise || sock.__pairTriggered) return;
    sock.__pairTriggered = true;

    const timer = setTimer(async () => {
      if (sock !== client.sock || sock.__pairCodeResult || sock.__pairPromise) return;
      if (sock.authState?.creds?.registered) return;
      try {
        const code = await sock.requestPairingCode(phone, generateMainPairCode());
        log(`🔐 [MAIN] Pairing Code: ${code}`);
      } catch (e) {
        sock.__pairTriggered = false;
        logError('⚠️ [MAIN] فشل طلب كود الربط:', e?.message || e);
      }
    }, 1500);
    timer.unref?.();
  }

  function scheduleSafeReconnect(reason, code) {
    if (isStopped()) return;
    if (state.reconnectTimer != null) return;
    // Wait briefly to see if meowsab's own reconnectTimeout already scheduled one
    state.reconnectFailures += 1;
    const delay = Math.min(30_000, Math.round(3000 * Math.pow(1.5, Math.max(0, state.reconnectFailures - 1))));
    onEvent('boot', `🔄 انقطع اتصال البوت الرئيسي (${code ?? reason}) — إعادة محاولة بعد ${Math.round(delay / 1000)}ث`);
    state.reconnectTimer = setTimer(() => {
      state.reconnectTimer = null;
      if (isStopped()) return;
      if (client.sock?.user && isWsOpen(client.sock?.ws)) return;
      if (client.reconnectTimeout) return; // framework already restarting
      client.running = false;
      void client.start(true).catch(() => {});
    }, delay);
    state.reconnectTimer.unref?.();
  }

  function detachSock(sock) {
    if (sock && state.listener && sock.ev) {
      try { sock.ev.removeListener?.('connection.update', state.listener); } catch {}
      try { sock.ev.off?.('connection.update', state.listener); } catch {}
    }
    if (sock === state.attachedSock) {
      state.attachedSock = null;
      state.listener = null;
    }
  }

  function hookSocket(sock) {
    if (!sock || sock === state.attachedSock) return;
    if (state.attachedSock) detachSock(state.attachedSock);

    state.attachedSock = sock;
    wrapRequestPairingCode(sock);

    const listener = (update) => {
      if (sock !== client.sock) return;
      const { connection, qr } = update || {};

      if ((qr || connection === 'connecting') && !client.config?.printQR && !sock.authState?.creds?.registered) {
        triggerPairingForSock(sock);
      }

      if (connection === 'open') {
        clearReconnectTimer();
        state.reconnectFailures = 0;
        state.lastError = null;
        client.reconnectAttempts = 0;
        client.running = true;
        onOpen(sock);
        return;
      }

      if (connection === 'close') {
        const { code, message } = disconnectInfo(update);
        // Framework sets this.isRunning = false, leaving this.running = true! Fix that immediately.
        client.running = false;

        if (code === 401 || /logged out/i.test(message)) {
          clearReconnectTimer();
          state.lastError = 'تم تسجيل خروج الجلسة من واتساب (401) — أعد الربط من اللوحة';
          onEvent('warn', `⚠️ ${state.lastError}`);
          return;
        }
        if (code === 440) {
          clearReconnectTimer();
          state.lastError = 'تم استبدال الاتصال بجلسة أخرى (440)';
          onEvent('warn', `⚠️ ${state.lastError}`);
          return;
        }
        if (code === 411) {
          clearReconnectTimer();
          state.lastError = 'عدم تطابق الأجهزة المرتبطة (411) — أعد الربط';
          onEvent('warn', `⚠️ ${state.lastError}`);
          return;
        }
        if (code === 515) {
          // meowsab handles 515 via t.restart(!0), just ensure pairing flags reset cleanly
          return;
        }
        if (code === 500) {
          // system/healer.js handles badSession 500
          return;
        }
        if (!NON_RETRYABLE_STATUS.has(code)) {
          // Wait a tick so meowsab's own reconnectTimeout (if any) can arm first
          const check = setTimer(() => {
            if (!client.reconnectTimeout && !isStopped() && client.sock === sock) {
              scheduleSafeReconnect(message || 'close', code);
            }
          }, 150);
          check.unref?.();
        }
      }
    };

    state.listener = listener;
    try {
      sock.ev?.on?.('connection.update', listener);
    } catch (e) {
      logError('⚠️ [MAIN] تعذّر ربط مستمع البوت الرئيسي:', e?.message || e);
    }
  }

  // Chain cleanly onto client.sock property descriptor (preserves installPresenceCap setter)
  const desc = Object.getOwnPropertyDescriptor(client, 'sock');
  if (desc && typeof desc.get === 'function' && typeof desc.set === 'function') {
    const prevGet = desc.get;
    const prevSet = desc.set;
    Object.defineProperty(client, 'sock', {
      configurable: true,
      enumerable: true,
      get() { return prevGet.call(this); },
      set(val) {
        prevSet.call(this, val);
        if (val) hookSocket(val);
      }
    });
  } else {
    let cur = client.sock ?? null;
    Object.defineProperty(client, 'sock', {
      configurable: true,
      enumerable: true,
      get() { return cur; },
      set(val) {
        cur = val;
        if (val) hookSocket(val);
      }
    });
  }

  if (client.sock) hookSocket(client.sock);

  // Wrap client.start so retries never silently no-op when sock is closed
  if (typeof client.start === 'function' && !client.__startWrapped) {
    client.__startWrapped = true;
    const origStart = client.start.bind(client);
    client.start = async (force = false) => {
      clearReconnectTimer();
      if (client.config && typeof client.config.phoneNumber === 'string') {
        client.config.phoneNumber = sanitizePhone(client.config.phoneNumber);
      }
      if (!Number.isFinite(client.reconnectAttempts)) {
        client.reconnectAttempts = 0;
      }
      const deadSock = !client.sock || (client.sock.ws && !isWsOpen(client.sock.ws));
      const effectiveForce = force || (client.running && deadSock);
      return origStart(effectiveForce);
    };
  }

  const handle = {
    state,
    hookSocket,
    clearReconnectTimer,
    stop: () => {
      clearReconnectTimer();
      detachSock(state.attachedSock);
    }
  };
  client.__mainBotFixHandle = handle;
  return handle;
}

/**
 * In-process pairing flow for the Main Bot (similar to SubBots reliability,
 * without killing the process via process.exit).
 */
export async function requestMainBotPairing(client, options = {}) {
  const {
    phone: rawPhone = '',
    loginMode = 'code',
    panelCfg = null,
    savePanelConfig = null,
    onState = () => {},
    onEvent = () => {},
    waitMs = 9500,
    resetUnregistered = true,
  } = options;

  const mode = loginMode === 'qr' ? 'qr' : 'code';
  const phone = sanitizePhone(rawPhone);

  if (mode === 'code' && (!phone || phone.length < 8 || phone.length > 15)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'أدخل رقم البوت الرئيسي مع رمز الدولة بدون + (8 إلى 15 رقماً)'
    };
  }

  if (panelCfg) {
    panelCfg.loginMode = mode;
    panelCfg.phone = phone;
    try { savePanelConfig?.(panelCfg); } catch {}
  }

  if (client?.config) {
    client.config.printQR = mode === 'qr';
    client.config.phoneNumber = mode === 'code' ? phone : '';
  }

  const sessionPath = path.resolve(process.cwd(), client?.config?.sessionPath || './session');

  try {
    await client?.stop?.();
  } catch {}
  if (client) {
    client.running = false;
    client.reconnectAttempts = 0;
    client.__mainBotFixHandle?.clearReconnectTimer?.();
  }

  // If session is NOT registered (e.g. broken/aborted previous pairing or 401),
  // move it aside cleanly to session.bak-<ts> so Baileys generates clean pairing keys.
  if (resetUnregistered) {
    try {
      const bak = backupUnregisteredSession(sessionPath, { forceIfRegistered: false });
      if (bak.moved) {
        onEvent('تم أرشفة ملف الجلسة غير المكتمل وبدء جلسة ربط جديدة');
      }
    } catch {}
  }

  onState({
    stopped: false,
    qr: null,
    qrDataUrl: null,
    qrCacheFor: null,
    pairingCode: null,
    pairingError: null,
    mode
  });

  let gotCode = '';
  let gotQr = '';
  let gotErr = '';
  let gotOpen = false;

  const waitLoopStart = Date.now();
  const prevOnCode = options.getCode;
  const prevOnQr = options.getQr;
  const prevOnErr = options.getError;

  onEvent(mode === 'code'
    ? `جاري بدء ربط البوت الرئيسي برقم ${phone}...`
    : 'جاري تجهيز رمز QR للبوت الرئيسي...'
  );

  // Start / restart client cleanly in-process
  void (async () => {
    try {
      await client?.start?.(true);
    } catch (e) {
      gotErr = e?.message || String(e);
    }
  })();

  while ((Date.now() - waitLoopStart) < waitMs) {
    gotCode = prevOnCode ? prevOnCode() : (client?.__mainBotFixHandle?.state?.lastIssuedCode || '');
    gotQr = prevOnQr ? prevOnQr() : '';
    gotErr = prevOnErr ? prevOnErr() : (client?.__mainBotFixHandle?.state?.lastError || gotErr);
    gotOpen = Boolean(client?.sock?.user && isWsOpen(client?.sock?.ws));

    if (gotOpen) break;
    if (mode === 'code' && gotCode) break;
    if (mode === 'qr' && gotQr) break;
    if (gotErr && /غير صالح|401|403/.test(gotErr)) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    ok: Boolean(gotOpen || (mode === 'code' ? gotCode : gotQr) || !gotErr),
    connected: gotOpen,
    loginMode: mode,
    phone,
    pairingCode: gotCode || null,
    qrReady: Boolean(gotQr),
    error: gotErr || undefined,
    message: gotOpen
      ? 'تم اتصال البوت الرئيسي بنجاح!'
      : mode === 'code'
        ? (gotCode
            ? `تم إصدار كود الربط للبوت الرئيسي: ${gotCode}`
            : (gotErr ? `تعذّر إصدار الكود: ${gotErr}` : 'جاري إصدار كود الربط... سيتم تحديث اللوحة تلقائياً خلال ثوانٍ.'))
        : (gotQr
            ? 'تم تجهيز رمز QR — امسحه من واتساب الآن.'
            : (gotErr ? `تعذّر تجهيز QR: ${gotErr}` : 'جاري تجهيز رمز QR... سيتم تحديث اللوحة خلال ثوانٍ.'))
  };
}

export { SESSION_LOGGED_OUT_CODES };
export default {
  sanitizePhone,
  generateMainPairCode,
  isSessionRegistered,
  backupUnregisteredSession,
  installMainBotConnectionFix,
  requestMainBotPairing
};
