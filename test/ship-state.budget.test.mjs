import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'test', 'fixtures', 'transcript.jsonl'); // pinned cumulative total: 1128

// Hermeticity rule (contract F-002): EVERY test in this file — expected-breach
// and expected-non-breach alike — runs a COPY of ship-state.mjs with an
// appending stub notify.sh beside it. Sibling resolution makes the stub
// authoritative, so `node --test` can never pop a real desktop notification,
// even on failing runs (which are exactly the runs tests exist for).
const ENGINE_DIR = mkdtempSync(join(tmpdir(), 'shiploop-engine-'));
const BIN = join(ENGINE_DIR, 'ship-state.mjs');
copyFileSync(join(ROOT, 'scripts', 'ship-state.mjs'), BIN);
const NOTIFY_LOG = join(ENGINE_DIR, 'notify.log');
// Deliberately NOT chmod +x: the engine must invoke it via `bash` as argv0.
writeFileSync(
  join(ENGINE_DIR, 'notify.sh'),
  '#!/usr/bin/env bash\nprintf \'%s\\n%s\\n\' "$1" "$2" >> "$(dirname "$0")/notify.log"\n'
);
// Second copy with NO notify.sh sibling, for the notify-absent breach case (f).
const BARE_DIR = mkdtempSync(join(tmpdir(), 'shiploop-bare-'));
const BARE_BIN = join(BARE_DIR, 'ship-state.mjs');
copyFileSync(join(ROOT, 'scripts', 'ship-state.mjs'), BARE_BIN);

// Pinned breach strings (contract F-002 — byte-exact, em-dashes included).
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
const row = (ts, total, budget) =>
  `- [ ] ${ts} gate: token budget exceeded (${total} tokens > token_budget_day ${budget}) — run paused; review spend, then raise token_budget_day in docs/ship-loop/BUILD_CHARTER.md and rm docs/ship-loop/PAUSED to resume\n`;
const pausedBody = (ts, total, budget) => `token budget exceeded: ${total} > ${budget} at ${ts}\n`;
const NOTIFY_TITLE = 'ship-loop: gate paused (budget)';
const notifyBody = (total, budget) =>
  `NEEDS_HUMAN.md: token budget exceeded (${total} > ${budget} tokens) — raise token_budget_day in docs/ship-loop/BUILD_CHARTER.md, then rm docs/ship-loop/PAUSED`;

const sd = (dir) => join(dir, 'docs', 'ship-loop');
const notifyLog = () => (existsSync(NOTIFY_LOG) ? readFileSync(NOTIFY_LOG, 'utf8') : '');
const charterRow = (value) => `| Key | Value |\n|---|---|\n| token_budget_day | ${value} |\n`;

function stopHook(dir, hook = {}, bin = BIN) {
  return spawnSync('node', [bin, 'stop-hook'], {
    input: JSON.stringify({ cwd: dir, stop_hook_active: false, hook_event_name: 'Stop', ...hook }),
    encoding: 'utf8',
  });
}

// Active, unfinished product dir with one pending feature (and optionally a charter).
function product({ charter, active = true, bin = BIN } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-budget-'));
  execFileSync('node', [bin, 'init', '--dir', dir, '--product', 'Demo'], { encoding: 'utf8' });
  execFileSync('node', [bin, 'add', '--dir', dir], {
    input: JSON.stringify({ title: 'a feature', verification: ['x'] }),
    encoding: 'utf8',
  });
  if (active) writeFileSync(join(sd(dir), 'ACTIVE'), 'run');
  if (charter !== undefined) writeFileSync(join(sd(dir), 'BUILD_CHARTER.md'), charter);
  return dir;
}

function assertBlocks(r) {
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /^ship-loop: /); // reason string shape unchanged from today
}
function assertNoBudgetArtifacts(dir) {
  assert.ok(!existsSync(join(sd(dir), 'PAUSED')), 'PAUSED must not exist');
  assert.ok(!existsSync(join(sd(dir), 'NEEDS_HUMAN.md')), 'NEEDS_HUMAN.md must not exist');
}
// Byte-exact breach artifacts; returns the shared ISO timestamp used by both.
function assertBreachArtifacts(dir, total, budget) {
  const needs = readFileSync(join(sd(dir), 'NEEDS_HUMAN.md'), 'utf8');
  const m = needs.match(new RegExp(`^- \\[ \\] (${ISO_RE.source}) gate:`));
  assert.ok(m, `NEEDS_HUMAN.md row malformed: ${JSON.stringify(needs)}`);
  const ts = m[1];
  assert.equal(needs, row(ts, total, budget)); // exactly one row, pinned format
  assert.equal(readFileSync(join(sd(dir), 'PAUSED'), 'utf8'), pausedBody(ts, total, budget)); // same ts
  return ts;
}

// (a) breach: over budget in an active unfinished run → allow stop + artifacts + notify.
test('breach pauses the run, escalates, notifies once, clears spin, allows the stop', () => {
  const dir = product({ charter: charterRow('1000') });
  // Pre-seed a stale spin file: the breach must unlink it so a later resume
  // cannot inherit a phantom stall count.
  writeFileSync(join(sd(dir), '.gate-spin'), JSON.stringify({ hash: 'stale', count: 2 }));
  const before = notifyLog();
  const r = stopHook(dir, { transcript_path: FIXTURE });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  assertBreachArtifacts(dir, 1128, 1000);
  assert.ok(!existsSync(join(sd(dir), '.gate-spin')), 'stale .gate-spin must be unlinked');
  assert.equal(notifyLog(), `${before}${NOTIFY_TITLE}\n${notifyBody(1128, 1000)}\n`);
});

// (b) immediate second stop while paused → fully silent, no duplicate row, no second banner.
test('second stop while paused is fully silent: escalation count still 1, notify log unchanged', () => {
  const dir = product({ charter: charterRow('1000') });
  stopHook(dir, { transcript_path: FIXTURE });
  assert.ok(existsSync(join(sd(dir), 'PAUSED')), 'setup: first stop must have paused');
  const before = notifyLog();
  const r = stopHook(dir, { transcript_path: FIXTURE });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  const needs = readFileSync(join(sd(dir), 'NEEDS_HUMAN.md'), 'utf8');
  assert.equal(needs.split('token budget exceeded').length - 1, 1, 'still exactly one escalation row');
  assert.equal(notifyLog(), before);
});

// (c) under budget AND exact equality (strict >) → normal block, zero budget artifacts.
test('under-budget and exact-equality totals block normally with zero budget artifacts', () => {
  for (const value of ['2000000', '1128', '2000000 (est)']) {
    const dir = product({ charter: charterRow(value) });
    const before = notifyLog();
    const r = stopHook(dir, { transcript_path: FIXTURE });
    assertBlocks(r);
    assertNoBudgetArtifacts(dir);
    assert.equal(notifyLog(), before, `charter value ${JSON.stringify(value)} must not notify`);
  }
});

// (d) no-enforcement matrix → normal block, no crash, no artifacts.
test('no-enforcement matrix: missing/unparseable budget rows block normally, never cross lines', () => {
  const cases = [
    undefined, // charter file absent
    '| Key | Value |\n|---|---|\n| other_key | 3 |\n', // token_budget_day row absent
    charterRow('TBD'), // value cell not digit-leading
    charterRow('0'), // zero disables enforcement
    charterRow('9007199254740993'), // beyond Number.MAX_SAFE_INTEGER
    '| token_budget_day |\n3000 spent so far\n', // contract's literal malformed-row shape
    // Discriminating variant: a \s-style regex would borrow 1000 from the next
    // line and breach (1128 > 1000); the [ \t]-only regex must not match at all.
    '| token_budget_day |\n1000 spent so far\n',
  ];
  for (const charter of cases) {
    const dir = product({ charter });
    const before = notifyLog();
    const r = stopHook(dir, { transcript_path: FIXTURE });
    assertBlocks(r);
    assertNoBudgetArtifacts(dir);
    assert.equal(notifyLog(), before, `charter ${JSON.stringify(charter)} must not notify`);
  }
});

// (d, breach half) separator stripping + first-MATCHING-line-wins semantics.
test('separator values parse and breach; scanning continues past a non-matching TBD row', () => {
  const breachCharters = [
    charterRow('1,000'), // comma separators strip to 1000
    '\t| token_budget_day | 1_000 |\n', // leading indentation + underscore separators
    // First token_budget_day row (TBD) is not a match; the later digit-leading
    // row wins, so enforcement stays armed at 1000.
    '| Key | Value |\n|---|---|\n| token_budget_day | TBD |\n| token_budget_day | 1000 |\n',
  ];
  for (const charter of breachCharters) {
    const dir = product({ charter });
    const r = stopHook(dir, { transcript_path: FIXTURE });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '', `charter ${JSON.stringify(charter)} must breach silently`);
    assert.equal(r.stderr, '');
    assertBreachArtifacts(dir, 1128, 1000);
  }
});

// (e) transcript_path absent / empty / pointing nowhere → normal block, no artifacts,
// and — load-bearing — EMPTY stderr (the "cannot read" warning is cost-CLI-only).
test('absent, empty, or unreadable transcript_path: normal block, no artifacts, empty stderr', () => {
  const tiny = charterRow('1');
  const hooks = [
    {}, // transcript_path absent
    { transcript_path: '' }, // empty string
    { transcript_path: join(tmpdir(), 'shiploop-no-such-transcript.jsonl') }, // nonexistent file
  ];
  for (const hook of hooks) {
    const dir = product({ charter: tiny });
    const before = notifyLog();
    const r = stopHook(dir, hook);
    assertBlocks(r); // includes stderr === ''
    assertNoBudgetArtifacts(dir);
    assert.equal(notifyLog(), before);
  }
});

// (f) notify.sh absent beside the engine → breach still pauses + escalates + exits 0.
test('breach with notify.sh absent beside the engine still pauses, escalates, exits 0', () => {
  const dir = product({ charter: charterRow('1000'), bin: BARE_BIN });
  const before = notifyLog();
  const r = stopHook(dir, { transcript_path: FIXTURE }, BARE_BIN);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  assertBreachArtifacts(dir, 1128, 1000);
  assert.equal(notifyLog(), before, 'stubbed engine log must be untouched by the bare engine');
});

// (g) gate position: the existing done/ACTIVE checks win over a tiny budget.
test('done run or missing ACTIVE wins over a tiny budget: silent allow, no budget artifacts', () => {
  // Run done: every feature passed.
  let dir = product({ charter: charterRow('1') });
  execFileSync(
    'node',
    [BIN, 'set', '--dir', dir, '--id', 'F-001', '--status', 'passed', '--passes', 'true'],
    { encoding: 'utf8' }
  );
  let before = notifyLog();
  let r = stopHook(dir, { transcript_path: FIXTURE });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  assertNoBudgetArtifacts(dir);
  assert.equal(notifyLog(), before);
  // No ACTIVE marker.
  dir = product({ charter: charterRow('1'), active: false });
  before = notifyLog();
  r = stopHook(dir, { transcript_path: FIXTURE });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
  assertNoBudgetArtifacts(dir);
  assert.equal(notifyLog(), before);
});

// (h) write-failure safety: every breach step is individually best-effort and the
// stop is still allowed — stopping is the safe direction once over budget.
test(
  'read-only state dir: breach still exits 0 silently and notifies, despite failed writes',
  { skip: process.getuid?.() === 0 }, // root ignores file modes; chmod denies nothing
  () => {
    const dir = product({ charter: charterRow('1000') });
    const stateDir = sd(dir);
    chmodSync(stateDir, 0o555);
    try {
      const before = notifyLog();
      const r = stopHook(dir, { transcript_path: FIXTURE });
      assert.equal(r.status, 0);
      assert.equal(r.stdout, '');
      assert.equal(r.stderr, '');
      assert.ok(!existsSync(join(stateDir, 'PAUSED')), 'PAUSED write must have failed');
      assert.ok(!existsSync(join(stateDir, 'NEEDS_HUMAN.md')), 'escalation write must have failed');
      assert.equal(notifyLog(), `${before}${NOTIFY_TITLE}\n${notifyBody(1128, 1000)}\n`);
    } finally {
      chmodSync(stateDir, 0o755);
    }
  }
);
