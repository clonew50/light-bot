import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PAIR_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const NON_RETRYABLE_STATUS = new Set([401, 403, 411, 440]);
const SESSION_LOGGED_OUT_CODES = new Set([401, 403]);

export function toAsciiDigits(raw) {
  return String(raw || '')
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

export function sanitizePhone(raw) {
  let s = toAsciiDigits(raw).trim();
  if (s.includes('@')) s = s.split('@')[0];
  if (s.includes(':')) s = s.split(':')[0];
  let digits = s.replace(/[^0-9]/g, '');
  if (digits.startsWith('00') && digits.length >= 10) {
    digits = digits.slice(2);
  }
  // Auto-fix common Egyptian typo: 20 + 010xxxxxxxx -> 2010xxxxxxxx
  if (/^200(1[0125]\d{8})$/.test(digits)) {
    digits = '20' + digits.slice(3);
  }
  if (!/^\d{6,20}$/.test(digits)) return '';
  return digits;
}

export function validatePairingPhone(raw) {
  const s = toAsciiDigits(raw).trim();
  const rawDigits = s.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (!rawDigits) {
    return {
      ok: false,
      phone: '',
      error: 'أدخل رقم واتساب مع رمز الدولة بدون + (8 إلى 15 رقماً، مثال: 201505362172)'
    };
  }
  if (/^0[1-9]\d{7,12}$/.test(rawDigits)) {
    return {
      ok: false,
      phone: '',
      error: 'الرقم يبدأ بصفر محلي — اكتب رمز الدولة في البداية بدون صفر أو + (مثال: 201505362172 بدلاً من 01505362172)'
    };
  }
  const phone = sanitizePhone(raw);
  if (!phone || phone.length < 8 || phone.length > 15 || phone.startsWith('0')) {
    return {
      ok: false,
      phone: '',
      error: 'رقم الهاتف غير صالح — اكتب الرقم مع رمز الدولة بدون + أو أصفار زائدة (مثال: 201505362172)'
    };
  }
  return { ok: true, phone };
}

export function generateMainPairCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.randomBytes(8);
    let out = '';
    for (let i = 0; i < 8; i++) out += PAIR_CODE_CHARS[bytes[i] % PAIR_CODE_CHARS.length];
    if (out !== 'VENI1234') return out;
  }
  return 'LB2489XY';
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

function hasRealBaileysWs(sock) {
  return Boolean(sock?.ws && typeof sock.ws.on === 'function' && typeof sock.sendNode === 'function');
}

function trackPairDeviceReady(sock) {
  if (!sock || sock.__pairReadyTracked) return;
  sock.__pairReadyTracked = true;
  const markReady = () => { sock.__pairDeviceReady = true; };
  try {
    sock.ev?.on?.('connection.update', (u) => {
      if (u?.qr) markReady();
      if (u?.connection === 'close') sock.__pairClosed = true;
    });
  } catch {}
  try {
    sock.ws?.on?.('CB:iq,type:set,pair-device', markReady);
  } catch {}
}

/**
 * Waits until a real Baileys socket finishes Noise validateConnection() and receives
 * WhatsApp's pair-device IQ (emitting `qr`), so requestPairingCode never corrupts
 * creds.me mid-handshake. Falls back to `isWsOpen` for plain unit-test mock sockets.
 */
export function waitForPairingReady(sock, timeoutMs = 15000) {
  if (!sock) return Promise.resolve(false);
  trackPairDeviceReady(sock);
  if (sock.__pairDeviceReady) return Promise.resolve(true);

  const realWs = hasRealBaileysWs(sock);
  if (!realWs && isWsOpen(sock.ws)) return Promise.resolve(true);

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
      try { sock.ws?.off?.('CB:iq,type:set,pair-device', onPairDevice); } catch {}
      try { sock.ws?.removeListener?.('CB:iq,type:set,pair-device', onPairDevice); } catch {}
      resolve(ok);
    };
    const onPairDevice = () => {
      sock.__pairDeviceReady = true;
      finish(true);
    };
    const onEv = (u) => {
      if (u?.connection === 'close') { finish(false); return; }
      if (u?.qr) {
        sock.__pairDeviceReady = true;
        finish(true);
        return;
      }
      if (!realWs && (isWsOpen(sock.ws) || u?.connection === 'open')) {
        finish(true);
      }
    };
    try { sock.ev?.on?.('connection.update', onEv); } catch {}
    try { sock.ws?.on?.('CB:iq,type:set,pair-device', onPairDevice); } catch {}
    poll = setInterval(() => {
      if (sock.__pairDeviceReady) { finish(true); return; }
      if (!realWs && isWsOpen(sock.ws)) finish(true);
    }, 120);
    poll.unref?.();
    timer = setTimeout(() => {
      finish(Boolean(sock.__pairDeviceReady || (!realWs && isWsOpen(sock.ws))));
    }, timeoutMs);
    timer.unref?.();
  });
}

function mapPairingIqError(code, text) {
  const c = String(code || '');
  const t = String(text || '');
  if (c === '429' || /rate/i.test(t)) {
    return new Error('طلبات ربط كثيرة متتالية على هذا الرقم (429) — انتظر دقيقة ثم حاول مجدداً');
  }
  if (c === '406' || /not-acceptable/i.test(t)) {
    return new Error('رفض واتساب هذا الرقم أو الجهاز (406) — تحقق من الرقم مع رمز الدولة بدون + أو أصفار زائدة');
  }
  if (c === '400' || /bad-request/i.test(t)) {
    return new Error('رفض واتساب طلب إصدار الكود (400) — تأكد من صحة الرقم مع رمز الدولة وإعدادات المتصفح');
  }
  return new Error(`رفض واتساب طلب الربط (${c || t || 'error'})`);
}

function invokeAndVerifyPairingIq(sock, origReq, phone, customCode) {
  const realWs = typeof sock.ws?.on === 'function';
  if (!realWs) {
    return origReq(phone, customCode);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let ackTimer = null;
    const cleanup = () => {
      if (ackTimer) clearTimeout(ackTimer);
      try { sock.ws?.off?.('CB:iq', onIq); } catch {}
      try { sock.ws?.removeListener?.('CB:iq', onIq); } catch {}
      try { sock.ev?.off?.('connection.update', onConn); } catch {}
      try { sock.ev?.removeListener?.('connection.update', onConn); } catch {}
    };
    let returnedCode = '';
    const resetUnregisteredCreds = () => {
      try {
        if (sock.authState?.creds && !sock.authState.creds.registered) {
          sock.authState.creds.me = undefined;
          sock.authState.creds.pairingCode = undefined;
        }
      } catch {}
    };
    const onConn = (u) => {
      if (u?.connection === 'close' && !settled) {
        settled = true;
        cleanup();
        resetUnregisteredCreds();
        const { code, message } = disconnectInfo(u);
        reject(new Error(`انقطع اتصال واتساب أثناء إصدار الكود (${code ?? (message || 'closed')})`));
      }
    };
    const onIq = (node) => {
      if (settled || !node?.attrs) return;
      const t = node.attrs.type;
      const firstTag = Array.isArray(node.content) ? node.content[0]?.tag : '';
      if (t === 'set' && firstTag === 'pair-device') return;
      if (t === 'result' && firstTag === 'link_code_companion_reg') {
        settled = true;
        cleanup();
        resolve(returnedCode || customCode);
        return;
      }
      if (t === 'error') {
        const errNode = Array.isArray(node.content) ? node.content.find((x) => x?.tag === 'error') : null;
        settled = true;
        cleanup();
        resetUnregisteredCreds();
        reject(mapPairingIqError(errNode?.attrs?.code, errNode?.attrs?.text));
      }
    };
    try { sock.ws.on('CB:iq', onIq); } catch {}
    try { sock.ev?.on?.('connection.update', onConn); } catch {}

    Promise.resolve()
      .then(() => origReq(phone, customCode))
      .then((code) => {
        returnedCode = code || customCode;
        if (settled) return;
        ackTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(returnedCode);
        }, 2500);
        ackTimer.unref?.();
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        cleanup();
        resetUnregisteredCreds();
        reject(err);
      });
  });
}

export function wrapSocketPairing(sock, {
  fallbackPhone = () => '',
  onCode = () => {},
  onError = () => {},
  isCurrentSock = () => true,
} = {}) {
  if (!sock || typeof sock.requestPairingCode !== 'function' || sock.__pairWrapped) return;
  sock.__pairWrapped = true;
  trackPairDeviceReady(sock);
  const origReq = sock.requestPairingCode.bind(sock);

  sock.requestPairingCode = async (phoneArg, customCodeArg) => {
    if (sock.__pairCodeResult) return sock.__pairCodeResult;
    if (sock.__pairPromise) return sock.__pairPromise;

    const rawInput = phoneArg || fallbackPhone();
    const checked = validatePairingPhone(rawInput);
    if (!checked.ok) {
      const err = new Error(checked.error || 'رقم الهاتف غير صالح للربط');
      onError(err);
      throw err;
    }
    const phone = checked.phone;

    const candidate = String(customCodeArg || '').trim().toUpperCase();
    const customCode = candidate && /^[A-Z0-9]{8}$/.test(candidate) && candidate !== 'VENI1234'
      ? candidate
      : generateMainPairCode();

    sock.__pairPromise = (async () => {
      try {
        const ready = await waitForPairingReady(sock, 15000);
        if (!ready && !isWsOpen(sock.ws)) {
          throw new Error('انتهت مهلة فتح اتصال واتساب قبل إصدار الكود');
        }
        await new Promise((r) => setTimeout(r, 150));
        let code;
        try {
          code = await invokeAndVerifyPairingIq(sock, origReq, phone, customCode);
        } catch (firstErr) {
          const msg = String(firstErr?.message || '');
          if (/400|406|429|غير صالح|بصفر/.test(msg) || !isCurrentSock(sock) || !isWsOpen(sock.ws)) {
            throw firstErr;
          }
          await new Promise((r) => setTimeout(r, 1000));
          code = await invokeAndVerifyPairingIq(sock, origReq, phone, customCode);
        }
        const finalCode = String(code || customCode).toUpperCase();
        if (finalCode === 'VENI1234') {
          throw new Error('تم حظر الكود الافتراضي — أعد طلب كود جديد');
        }
        sock.__pairCodeResult = finalCode;
        onCode(finalCode, phone);
        return finalCode;
      } catch (err) {
        sock.__pairPromise = null;
        onError(err);
        throw err;
      }
    })();

    return sock.__pairPromise;
  };
}

/**
 * Hooks SubBots (`meowsab` Ae / ft) so every spawned SubBot socket:
 *  1) Never sends "VENI1234"
 *  2) Waits for pair-device/QR readiness instead of a blind 2s pre-Noise timer
 *  3) Verifies WhatsApp's CB:iq response instead of surfacing rejected 400/429 codes
 *  4) Clears unregistered `creds.me` before reconnect so `ft.start()` doesn't misdetect login state
 */
export function installSubBotsPairingFix(subBots, {
  onPairCode = () => {},
  onPairError = () => {},
} = {}) {
  if (!subBots || subBots.__subPairFixInstalled) return;
  subBots.__subPairFixInstalled = true;

  const hookSubBotInstance = (bot) => {
    if (!bot || bot.__subSockHooked) return;
    bot.__subSockHooked = true;

    const attachSock = (sock) => {
      if (!sock) return;
      wrapSocketPairing(sock, {
        fallbackPhone: () => bot.phoneNumber || bot.cfg?.phoneNumber || '',
        isCurrentSock: (s) => bot.sock === s && !bot.stopped,
        onCode: (code, phone) => onPairCode(bot.id, code, phone),
        onError: (err) => {
          onPairError(bot.id, err);
          try { bot.emit?.('error', bot.id, err); } catch {}
        },
      });
    };

    const desc = Object.getOwnPropertyDescriptor(bot, 'sock');
    if (desc && typeof desc.get === 'function' && typeof desc.set === 'function') {
      const prevGet = desc.get;
      const prevSet = desc.set;
      Object.defineProperty(bot, 'sock', {
        configurable: true,
        enumerable: true,
        get() { return prevGet.call(this); },
        set(val) {
          prevSet.call(this, val);
          if (val) attachSock(val);
        },
      });
    } else {
      let cur = bot.sock ?? null;
      Object.defineProperty(bot, 'sock', {
        configurable: true,
        enumerable: true,
        get() { return cur; },
        set(val) {
          cur = val;
          if (val) attachSock(val);
        },
      });
    }

    if (bot.sock) attachSock(bot.sock);

    if (typeof bot.start === 'function' && !bot.__startWrapped) {
      bot.__startWrapped = true;
      const origStart = bot.start.bind(bot);
      bot.start = async (...args) => {
        try {
          const creds = bot.auth?.state?.creds;
          if (creds && !creds.registered && creds.me) {
            creds.me = undefined;
            creds.pairingCode = undefined;
            await bot.auth.save?.();
          }
        } catch {}
        return origStart(...args);
      };
    }
  };

  if (subBots.bots instanceof Map) {
    for (const bot of subBots.bots.values()) hookSubBotInstance(bot);
    const origSet = subBots.bots.set.bind(subBots.bots);
    subBots.bots.set = (key, val) => {
      hookSubBotInstance(val);
      return origSet(key, val);
    };
  }
}

/**
 * Runtime connection & pairing fix for meowsab's Client (`En`).
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
    wrapSocketPairing(sock, {
      fallbackPhone: () => client.config?.phoneNumber,
      isCurrentSock: (s) => s === client.sock,
      onCode: (code, phone) => {
        state.lastIssuedCode = code;
        state.lastError = null;
        onPairingCode(code, phone);
      },
      onError: (err) => {
        state.lastError = err?.message || String(err);
        onPairingError(err);
        onEvent('warn', `⚠️ تعذّر إصدار كود ربط البوت الرئيسي: ${state.lastError}`);
      },
    });
  }

  function triggerPairingForSock(sock, immediate = false) {
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
    }, immediate ? 120 : 1200);
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
        triggerPairingForSock(sock, Boolean(qr));
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
  let phone = sanitizePhone(rawPhone);

  if (mode === 'code') {
    const checked = validatePairingPhone(rawPhone);
    if (!checked.ok) {
      return {
        ok: false,
        statusCode: 400,
        error: checked.error
      };
    }
    phone = checked.phone;
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
    if (gotErr && /غير صالح|بصفر|400|401|403|406|429/.test(gotErr)) break;
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
  toAsciiDigits,
  sanitizePhone,
  validatePairingPhone,
  generateMainPairCode,
  isSessionRegistered,
  backupUnregisteredSession,
  waitForPairingReady,
  wrapSocketPairing,
  installSubBotsPairingFix,
  installMainBotConnectionFix,
  requestMainBotPairing
};
