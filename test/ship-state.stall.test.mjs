import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Hermeticity rule (contracts F-002/F-012): EVERY test in this file runs a
// COPY of ship-state.mjs with an appending stub notify.sh beside it. Sibling
// resolution makes the stub authoritative, so `node --test` can never pop a
// real desktop notification, even on failing runs.
const ENGINE_DIR = mkdtempSync(join(tmpdir(), 'shiploop-engine-stall-'));
const BIN = join(ENGINE_DIR, 'ship-state.mjs');
copyFileSync(join(ROOT, 'scripts', 'ship-state.mjs'), BIN);
const NOTIFY_LOG = join(ENGINE_DIR, 'notify.log');
// Deliberately NOT chmod +x: the engine must invoke it via `bash` as argv0.
writeFileSync(
  join(ENGINE_DIR, 'notify.sh'),
  '#!/usr/bin/env bash\nprintf \'%s\\n%s\\n\' "$1" "$2" >> "$(dirname "$0")/notify.log"\n'
);
// Second copy with NO notify.sh sibling, for the notify-absent stall case.
const BARE_DIR = mkdtempSync(join(tmpdir(), 'shiploop-bare-stall-'));
const BARE_BIN = join(BARE_DIR, 'ship-state.mjs');
copyFileSync(join(ROOT, 'scripts', 'ship-state.mjs'), BARE_BIN);

// Pinned stall strings (contract F-012 — byte-exact, em-dashes included).
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
const row = (ts, pending) =>
  `- [ ] ${ts} gate: loop stalled (${pending} pending, state unchanged across 3 stop attempts) — run stopped; inspect docs/ship-loop/loop-run-log.md and docs/ship-loop/feature_list.json, then /ship:resume to re-enter the round or /ship:pause to stand down\n`;
const NOTIFY_TITLE = 'ship-loop: gate stopped (stall)';
const notifyBody = (pending) =>
  `NEEDS_HUMAN.md: loop stalled (${pending} pending, unchanged across 3 stop attempts) — inspect docs/ship-loop/loop-run-log.md, then /ship:resume or /ship:pause`;

const sd = (dir) => join(dir, 'docs', 'ship-loop');
const notifyLog = () => (existsSync(NOTIFY_LOG) ? readFileSync(NOTIFY_LOG, 'utf8') : '');

function stopHook(dir, bin = BIN) {
  return spawnSync('node', [bin, 'stop-hook'], {
    input: JSON.stringify({ cwd: dir, stop_hook_active: false, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
}

// Active, unfinished product dir with `pending` pending features. Two by
// default: the pinned row must interpolate stats.pending, not hardcode the
// 1-pending count the main suite's stall test uses.
function product({ pending = 2, bin = BIN } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-stall-'));
  execFileSync('node', [bin, 'init', '--dir', dir, '--product', 'Demo'], { encoding: 'utf8' });
  for (let i = 0; i < pending; i++) {
    execFileSync('node', [bin, 'add', '--dir', dir], {
      input: JSON.stringify({ title: `feature ${i + 1}`, verification: ['x'] }),
      encoding: 'utf8',
    });
  }
  writeFileSync(join(sd(dir), 'ACTIVE'), 'run');
  return dir;
}

function assertBlocks(r) {
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  assert.equal(JSON.parse(r.stdout).decision, 'block');
}
function assertAllowsSilently(r) {
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
}
// Byte-exact stall row: NEEDS_HUMAN.md contains exactly one pinned row.
function assertStallRow(dir, pending) {
  const needs = readFileSync(join(sd(dir), 'NEEDS_HUMAN.md'), 'utf8');
  const m = needs.match(new RegExp(`^- \\[ \\] (${ISO_RE.source}) gate:`));
  assert.ok(m, `NEEDS_HUMAN.md row malformed: ${JSON.stringify(needs)}`);
  assert.equal(needs, row(m[1], pending));
}

// (1) Byte-exact stall: row pinned, notify fires once, spin cleared, NO PAUSED.
test('third identical stop appends the pinned stall row, notifies once, clears spin, allows', () => {
  const dir = product(); // 2 pending — pins the stats.pending interpolation
  const before = notifyLog();
  assertBlocks(stopHook(dir));
  assertBlocks(stopHook(dir));
  assert.equal(notifyLog(), before, 'blocking stops must not notify');
  const r3 = stopHook(dir);
  assertAllowsSilently(r3);
  assertStallRow(dir, 2);
  assert.ok(!existsSync(join(sd(dir), '.gate-spin')), '.gate-spin must be cleared at escalation');
  assert.ok(!existsSync(join(sd(dir), 'PAUSED')), 'stall must NOT pause the run');
  assert.equal(notifyLog(), `${before}${NOTIFY_TITLE}\n${notifyBody(2)}\n`);
});

// (2) Stall is not a pause: the gate re-arms, with no duplicate row or banner.
test('fourth identical stop after a stall blocks again: one row, notify log unchanged', () => {
  const dir = product();
  stopHook(dir);
  stopHook(dir);
  assertAllowsSilently(stopHook(dir)); // the stall event
  const needsAfterStall = readFileSync(join(sd(dir), 'NEEDS_HUMAN.md'), 'utf8');
  const before = notifyLog();
  const r4 = stopHook(dir);
  assertBlocks(r4); // spin counter restarted at 1 — run is stopped, not paused
  assert.equal(readFileSync(join(sd(dir), 'NEEDS_HUMAN.md'), 'utf8'), needsAfterStall);
  assert.equal(notifyLog(), before, 'no notification between stall events');
});

// (3) notify.sh absent beside the engine → stall still escalates and allows.
test('stall with notify.sh absent beside the engine still escalates byte-exactly, exits 0', () => {
  const dir = product({ bin: BARE_BIN });
  const before = notifyLog();
  stopHook(dir, BARE_BIN);
  stopHook(dir, BARE_BIN);
  const r3 = stopHook(dir, BARE_BIN);
  assertAllowsSilently(r3);
  assertStallRow(dir, 2);
  assert.ok(!existsSync(join(sd(dir), 'PAUSED')));
  assert.equal(notifyLog(), before, 'stubbed engine log must be untouched by the bare engine');
});

// (4) Append-failure safety: a failed escalation write must not crash the hook
// — stopping is the safe direction, and the notification still goes out.
test(
  'read-only state dir at the third stop: stall still exits 0 silently and notifies',
  { skip: process.getuid?.() === 0 }, // root ignores file modes; chmod denies nothing
  () => {
    const dir = product();
    const stateDir = sd(dir);
    stopHook(dir);
    stopHook(dir); // .gate-spin now at count 2, while the dir is still writable
    chmodSync(stateDir, 0o555);
    try {
      const before = notifyLog();
      const r3 = stopHook(dir);
      assertAllowsSilently(r3); // pre-F-012: uncaught EACCES — stack trace, exit 1
      assert.ok(!existsSync(join(stateDir, 'NEEDS_HUMAN.md')), 'escalation write must have failed');
      assert.equal(notifyLog(), `${before}${NOTIFY_TITLE}\n${notifyBody(2)}\n`);
    } finally {
      chmodSync(stateDir, 0o755);
    }
  }
);
