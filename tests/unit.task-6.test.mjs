/**
 * tests/unit.task-6.test.mjs — todo 6:
 * "Back up and restore the WhatsApp session, and flush state on signals"
 * ==========================================================================================
 * GAP-4  : session/creds.json has no backup/restore -> a truncated auth file
 *          forces a full re-pair.
 * GAP-18 : no SIGTERM / SIGINT handler -> the last DB writes are lost on every
 *          hosting-panel stop.
 *
 * Every case asserts a VALUE (a file's content, a return value, a recorded
 * call) — never "the log said it worked".
 *
 * The Arabic literals are written as \u escapes on purpose: the shell locale
 * in this environment is NOT utf-8, and an escape sequence cannot be mangled
 * by a re-encode.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync,
  readdirSync, copyFileSync, rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const {
  restoreSessionFromBackup,
  backupSessionCreds,
  createBackupState,
  installShutdownHandlers,
  warnSubBotSessionsNotCovered,
  isValidCreds,
  readCredsFile,
  RESTORE_MESSAGE,
  SUB_BOT_WARNING,
  LIVE_FILE,
  BACKUP_FILE,
  BACKUP_MIN_INTERVAL_MS
} = await import(pathToFileURL(path.join(repoRoot, 'system', 'sessionBackup.js')).href);

/* the exact Arabic string the todo requires, escaped so no re-encode can break it */
const EXPECTED_RESTORE_MSG =
  '\u267b\ufe0f \u0627\u0633\u062a\u064f\u0639\u064a\u062f\u062a \u062c\u0644\u0633\u0629 \u0648\u0627\u062a\u0633\u0627\u0628 \u0645\u0646 \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629';

const VALID_CREDS = {
  me: { id: '12345:5@s.whatsapp.net', name: 'LightBot' },
  noiseKey: { privateKey: 'PRIVATE', publicKey: 'PUBLIC' },
  registered: true,
  platform: 'android'
};

function newSessionDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lightbot-session-'));
  return dir;
}

function writeCreds(dir, name, value) {
  const file = path.join(dir, name);
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
}

/* ------------------------------------------------------------------ *
 * 1. the restore path (the acceptance criterion "creds restore")
 * ------------------------------------------------------------------ */

test('creds restore: a corrupt creds.json plus a valid .bak is restored and the function returns true', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, LIVE_FILE, 'not json');           // truncated / corrupt live file
    writeCreds(dir, BACKUP_FILE, VALID_CREDS);        // good backup

    const logs = [];
    const r = restoreSessionFromBackup(dir, { log: (m) => logs.push(m) });

    assert.equal(r.restored, true, 'the backup must be restored');
    assert.equal(r.reason, 'restored');

    // the ASSERTED VALUE: the live file now holds the backup's content
    const live = JSON.parse(readFileSync(path.join(dir, LIVE_FILE), 'utf8'));
    assert.deepEqual(live, VALID_CREDS);
    assert.equal(isValidCreds(live), true);

    // and the exact Arabic line the todo asks for
    assert.deepEqual(logs, [EXPECTED_RESTORE_MSG]);
    assert.equal(RESTORE_MESSAGE, EXPECTED_RESTORE_MSG);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creds restore: with no backup the function returns false and deletes nothing', () => {
  const dir = newSessionDir();
  try {
    const live = writeCreds(dir, LIVE_FILE, 'not json');   // broken, no .bak at all

    const r = restoreSessionFromBackup(dir, { log: () => {} });

    assert.equal(r.restored, false);
    assert.equal(r.reason, 'no-backup');
    // nothing was deleted: the file it started with is still there, byte for byte
    assert.equal(existsSync(live), true);
    assert.equal(readFileSync(live, 'utf8'), 'not json');
    // and no crash: no exception escaped
    assert.deepEqual(readdirSync(dir), [LIVE_FILE]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creds restore: a missing creds.json is restored from the backup', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, BACKUP_FILE, VALID_CREDS);
    assert.equal(existsSync(path.join(dir, LIVE_FILE)), false);

    const r = restoreSessionFromBackup(dir, { log: () => {} });

    assert.equal(r.restored, true);
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, LIVE_FILE), 'utf8')), VALID_CREDS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creds restore: a live file without me/noiseKey counts as broken and is restored', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, LIVE_FILE, { registered: false });     // parses, but no me/noiseKey
    writeCreds(dir, BACKUP_FILE, VALID_CREDS);

    const r = restoreSessionFromBackup(dir, { log: () => {} });

    assert.equal(r.restored, true);
    assert.equal(r.liveReason, 'incomplete');
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, LIVE_FILE), 'utf8')), VALID_CREDS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creds restore: a broken backup is left alone, nothing is deleted, no crash', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, LIVE_FILE, 'not json');
    writeCreds(dir, BACKUP_FILE, '{"me":');               // truncated backup

    const r = restoreSessionFromBackup(dir, { log: () => {} });

    assert.equal(r.restored, false);
    assert.equal(r.reason, 'backup-invalid');
    assert.equal(existsSync(path.join(dir, LIVE_FILE)), true);
    assert.equal(existsSync(path.join(dir, BACKUP_FILE)), true);
    assert.equal(readFileSync(path.join(dir, LIVE_FILE), 'utf8'), 'not json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creds restore: a stale backup is NEVER restored over a healthy live file (stale_state)', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, LIVE_FILE, VALID_CREDS);              // healthy live file
    // an OLD backup that carries a different identity
    const oldCreds = { ...VALID_CREDS, me: { id: '99999:1@s.whatsapp.net', name: 'Old' } };
    writeCreds(dir, BACKUP_FILE, oldCreds);

    const r = restoreSessionFromBackup(dir, { log: () => {} });

    assert.equal(r.restored, false);
    assert.equal(r.reason, 'live-ok');
    // the live file still holds ITS content, not the backup's
    const live = JSON.parse(readFileSync(path.join(dir, LIVE_FILE), 'utf8'));
    assert.deepEqual(live, VALID_CREDS);
    assert.equal(live.me.id, '12345:5@s.whatsapp.net');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creds restore: an interrupted restore (cancel_resume) still leaves a valid creds.json', () => {
  const dir = newSessionDir();
  try {
    // a leftover temp file from a restore that was cut short mid-write
    writeCreds(dir, `${LIVE_FILE}.tmp-restore-999-1`, '{"me":{"id":"partial"');
    writeCreds(dir, BACKUP_FILE, VALID_CREDS);

    // first boot: the live file is missing/corrupt -> the restore runs and the
    // half-written temp file never becomes the live file
    writeCreds(dir, LIVE_FILE, '{"me":');
    const r = restoreSessionFromBackup(dir, { log: () => {} });
    assert.equal(r.restored, true);

    const live = JSON.parse(readFileSync(path.join(dir, LIVE_FILE), 'utf8'));
    assert.deepEqual(live, VALID_CREDS);           // valid JSON, complete creds

    // a second boot with the now-healthy file must not touch it again
    const r2 = restoreSessionFromBackup(dir, { log: () => {} });
    assert.equal(r2.restored, false);
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, LIVE_FILE), 'utf8')), VALID_CREDS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 2. the backup writer
 * ------------------------------------------------------------------ */

test('backup: creds.json is copied to creds.json.bak and the write is atomic', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, LIVE_FILE, VALID_CREDS);
    const state = createBackupState();

    const r = backupSessionCreds(dir, { state });

    assert.equal(r.written, true);
    assert.equal(r.reason, 'written');
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, BACKUP_FILE), 'utf8')), VALID_CREDS);
    // atomic write: no temp file left behind
    assert.deepEqual(readdirSync(dir).sort(), [LIVE_FILE, BACKUP_FILE]);
    // no full-folder copy, no extra files
    assert.equal(readdirSync(dir).filter((f) => f.endsWith('.tmp') || f.includes('tmp-')).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backup: the backup is written at most once every 10 seconds', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, LIVE_FILE, VALID_CREDS);
    const state = createBackupState();
    let now = 1_000_000;

    const first = backupSessionCreds(dir, { state, now: () => now });
    assert.equal(first.written, true);

    // 9.9s later: throttled
    now += 9_900;
    const second = backupSessionCreds(dir, { state, now: () => now });
    assert.equal(second.written, false);
    assert.equal(second.reason, 'throttled');
    assert.equal(state.writes, 1);
    assert.equal(state.skipped, 1);

    // 10.1s later: allowed again
    now += 200;
    writeCreds(dir, LIVE_FILE, { ...VALID_CREDS, platform: 'ios' });
    const third = backupSessionCreds(dir, { state, now: () => now });
    assert.equal(third.written, true);
    assert.equal(state.writes, 2);
    assert.equal(
      JSON.parse(readFileSync(path.join(dir, BACKUP_FILE), 'utf8')).platform, 'ios'
    );
    assert.equal(BACKUP_MIN_INTERVAL_MS, 10_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backup: a broken live file never overwrites a good backup', () => {
  const dir = newSessionDir();
  try {
    writeCreds(dir, BACKUP_FILE, VALID_CREDS);
    writeCreds(dir, LIVE_FILE, 'not json');           // the live file got corrupted

    const r = backupSessionCreds(dir, { state: createBackupState() });

    assert.equal(r.written, false);
    assert.equal(r.reason, 'live-unparsable');
    // the good backup survived
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, BACKUP_FILE), 'utf8')), VALID_CREDS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backup: the session folder is never deleted and never emptied', () => {
  const dir = newSessionDir();
  try {
    // a session folder with the real auth files baileys keeps next to creds.json
    writeCreds(dir, LIVE_FILE, VALID_CREDS);
    writeCreds(dir, 'app-state-sync-key-main.json', { key: 'x' });
    writeCreds(dir, 'pre-key-1.json', { key: 'y' });

    const state = createBackupState();
    backupSessionCreds(dir, { state });

    // the other auth files are still there, untouched
    assert.equal(existsSync(path.join(dir, 'app-state-sync-key-main.json')), true);
    assert.equal(existsSync(path.join(dir, 'pre-key-1.json')), true);
    assert.deepEqual(
      readdirSync(dir).sort(),
      ['app-state-sync-key-main.json', LIVE_FILE, BACKUP_FILE, 'pre-key-1.json']
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backup: readCredsFile reports why a file is unusable', () => {
  const dir = newSessionDir();
  try {
    const missing = readCredsFile(path.join(dir, 'nope.json'));
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'missing');

    writeCreds(dir, 'empty.json', '   ');
    assert.equal(readCredsFile(path.join(dir, 'empty.json')).reason, 'empty');

    writeCreds(dir, 'bad.json', '{oops');
    assert.equal(readCredsFile(path.join(dir, 'bad.json')).reason, 'unparsable');

    writeCreds(dir, 'partial.json', { me: { id: 'x' } });
    assert.equal(readCredsFile(path.join(dir, 'partial.json')).reason, 'incomplete');

    writeCreds(dir, 'good.json', VALID_CREDS);
    assert.equal(readCredsFile(path.join(dir, 'good.json')).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 3. flush() on the DB + the signal handlers
 * ------------------------------------------------------------------ */

test('UltraDB: flush() writes the pending value to disk immediately', async () => {
  // UltraDB resolves its file next to its own module -> run a COPY in a temp
  // dir so the repo's own system/database.json is never touched.
  const dir = mkdtempSync(path.join(tmpdir(), 'lightbot-db-'));
  try {
    copyFileSync(path.join(repoRoot, 'system', 'UltraDB.js'), path.join(dir, 'UltraDB.js'));
    const mod = await import(pathToFileURL(path.join(dir, 'UltraDB.js')).href);
    const dbFile = path.join(dir, 'database.json');

    const db = new mod.default();
    db.users['111@s.whatsapp.net'] = { name: 'flushed' };

    // the save is debounced by 50ms -> the file does not exist yet
    assert.equal(existsSync(dbFile), false, 'the debounced save must not have run yet');

    assert.equal(db.flush(), true);

    // the ASSERTED VALUE: the pending write is on disk right now
    assert.equal(existsSync(dbFile), true);
    const raw = readFileSync(dbFile, 'utf8');
    assert.ok(raw.includes('111@s.whatsapp.net'), 'the flushed value must be in the file');
    assert.deepEqual(JSON.parse(raw).users['111@s.whatsapp.net'], { name: 'flushed' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('signal flush: SIGTERM calls db.flush(), closes the panel server and exits with code 0', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lightbot-signal-'));
  const marker = path.join(dir, 'calls.txt');
  try {
    const modUrl = pathToFileURL(path.join(repoRoot, 'system', 'sessionBackup.js')).href;
    const script = `
      import { installShutdownHandlers } from ${JSON.stringify(modUrl)};
      import { writeFileSync, appendFileSync } from 'node:fs';
      const marker = ${JSON.stringify(marker)};
      const record = (what) => { try { appendFileSync(marker, what + '\\n'); } catch {} };
      const db = { flush: () => record('FLUSH') };
      const server = { close: () => record('CLOSE') };
      installShutdownHandlers({ db, server, log: () => {} });
      console.log('READY');
      setInterval(() => {}, 1000);
    `;

    const child = spawn(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', () => {});

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('child never became READY: ' + out)), 15000);
      child.stdout.on('data', () => {
        if (out.includes('READY')) { clearTimeout(t); resolve(); }
      });
    });

    child.kill('SIGTERM');
    const code = await new Promise((resolve) => child.on('exit', (c) => resolve(c)));

    assert.equal(code, 0, 'the process must exit cleanly with code 0 on SIGTERM');
    // the ASSERTED VALUE: the flush CALL happened (a side effect, not a log line)
    const calls = readFileSync(marker, 'utf8').trim().split('\n').filter(Boolean);
    assert.deepEqual(calls, ['FLUSH', 'CLOSE']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('signal flush: a handler that throws can never take the process down', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lightbot-signal-'));
  try {
    const calls = [];
    const h = installShutdownHandlers({
      db: { flush: () => { calls.push('flush'); throw new Error('db exploded'); } },
      server: { close: () => { calls.push('close'); throw new Error('server exploded'); } },
      exit: () => { calls.push('exit'); },
      log: () => {}
    });
    const st = h.shutdown('SIGTERM');
    // both steps were ATTEMPTED and the exit still happened
    assert.deepEqual(calls, ['flush', 'close', 'exit']);
    assert.equal(st.flushed, false, 'a throwing flush must not be reported as flushed');
    assert.equal(st.closed, false);
    h.stop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('signal flush: a second SIGTERM does not flush twice', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lightbot-signal-'));
  try {
    let flushes = 0;
    const h = installShutdownHandlers({
      db: { flush: () => { flushes++; } },
      server: { close: () => {} },
      exit: () => {},
      log: () => {}
    });
    h.shutdown('SIGTERM');
    h.shutdown('SIGTERM');
    h.shutdown('SIGINT');
    assert.equal(flushes, 1);
    h.stop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 4. the sub-bot limitation is surfaced, not hidden
 * ------------------------------------------------------------------ */

test('sub-bot sessions: the limitation is raised as a panel event, not swallowed', () => {
  const pushed = [];
  const msg = warnSubBotSessionsNotCovered({ push: (m) => pushed.push(m), log: () => {} });

  // the CALL to the panel event channel happened, with the real message
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0], msg);
  assert.equal(pushed[0], SUB_BOT_WARNING);
  assert.ok(pushed[0].includes('sub/'), 'the warning must name the uncovered folder');
  assert.ok(pushed[0].includes('LevelDB'), 'the warning must say why it cannot be copied');
});

test('sub-bot sessions: the warning says the coverage is the main session only', () => {
  const dir = newSessionDir();
  try {
    // the module's own coverage claim: the backup is a single file next to the
    // main session, NOT a copy of the session folder and NOT the sub-bot shards
    writeCreds(dir, LIVE_FILE, VALID_CREDS);
    const state = createBackupState();
    backupSessionCreds(dir, { state });

    const files = readdirSync(dir).sort();
    assert.deepEqual(files, [LIVE_FILE, BACKUP_FILE]);
    assert.ok(!files.some((f) => f.startsWith('sub')), 'no sub-bot shard may be copied');
    assert.equal(files.includes(BACKUP_FILE), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ *
 * 5. the wiring inside index.js
 * ------------------------------------------------------------------ */

test('index: the session backup and the signal handlers are wired in', () => {
  const src = readFileSync(path.join(repoRoot, 'index.js'), 'utf8');

  assert.ok(src.includes('restoreSessionFromBackup('), 'the boot restore must be called');
  assert.ok(src.includes('attachSessionBackup(client)'), 'the creds.update listener must be attached');
  assert.ok(src.includes('warnSubBotSessionsNotCovered('), 'the sub-bot limitation must be raised');
  assert.ok(src.includes('installShutdownHandlers('), 'the signal handlers must be installed');

  // the restore happens BEFORE client.start() (the framework reads creds.json there)
  const restoreAt = src.indexOf('restoreSessionFromBackup(');
  const startAt = src.indexOf('client.start();');
  assert.ok(restoreAt > -1 && startAt > -1);
  assert.ok(restoreAt < startAt, 'the restore must run before the client starts');

  // the panel server instance is kept so it can be closed on shutdown
  assert.ok(src.includes('panelServer = startWebPanel(client)'));
  assert.ok(/installShutdownHandlers\(\{ db: global\.db, server: panelServer \}\)/.test(src));
});
