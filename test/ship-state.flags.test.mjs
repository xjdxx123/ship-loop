import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// House hermeticity rule (contracts F-002/F-012): every engine invocation in
// this file runs a tmpdir COPY of ship-state.mjs with an appending stub
// notify.sh beside it, so `node --test` can never pop a real desktop
// notification — even under a buggy guard, even on failing runs. The copy is
// made fresh from the repo file, so these tests still pin the repo engine's
// exact bytes. (The one exception: test 2 runs the repo engine verbatim — it
// exits at the dispatch guard, before any state or notify path is reachable,
// the same trade ship-state.cost.test.mjs makes for its frozen command.)
const ENGINE_DIR = mkdtempSync(join(tmpdir(), 'shiploop-engine-flags-'));
const BIN = join(ENGINE_DIR, 'ship-state.mjs');
copyFileSync(join(ROOT, 'scripts', 'ship-state.mjs'), BIN);
writeFileSync(
  join(ENGINE_DIR, 'notify.sh'),
  '#!/usr/bin/env bash\nprintf \'%s\\n%s\\n\' "$1" "$2" >> "$(dirname "$0")/notify.log"\n'
);

function run(args, input) {
  return execFileSync('node', [BIN, ...args], { input, encoding: 'utf8' });
}
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-'));
  run(['init', '--dir', dir, '--product', 'Demo']);
  return dir;
}
const flPath = (dir) => join(dir, 'docs', 'ship-loop', 'feature_list.json');
const feat = JSON.stringify({
  title: 'a feature',
  type: 'feature',
  priority: 2,
  depends_on: [],
  verification: ['npm test passes'],
});

// Contract F-014: the guarded (command, flag) pairs — an independent copy of
// the engine's VALUE_FLAGS table, so an accidental engine-table edit fails
// here instead of silently shrinking coverage. Deliberately absent, per the
// contract: set --bump-attempts (valueless IS its valid form), cost
// --transcript (frozen in-command guard, pinned by ship-state.cost.test.mjs),
// cost --dir (accepted and ignored, F-001), stop-hook (no flags, never fails).
const GUARDED = {
  init: ['dir', 'product'],
  validate: ['dir'],
  add: ['dir'],
  next: ['dir', 'count'],
  set: ['dir', 'id', 'status', 'passes', 'note'],
  stats: ['dir'],
  gate: ['dir'],
  learn: ['dir'],
  lessons: ['dir', 'grep'],
};

/** The pinned F-014 stderr line for a valueless value-requiring flag. */
const usage = (cmd, flag) => `ship-state: ${cmd}: --${flag} requires a value\n`;

test('every value-requiring flag passed valueless is a one-line usage error', () => {
  for (const [cmd, flagList] of Object.entries(GUARDED)) {
    for (const flag of flagList) {
      const r = spawnSync('node', [BIN, cmd, `--${flag}`], { encoding: 'utf8' });
      assert.equal(r.status, 1, `${cmd} --${flag} should exit 1`);
      assert.equal(r.stdout, '', `${cmd} --${flag} should print nothing`);
      // Byte-equality on a single line is also the no-stack-trace proof.
      assert.equal(r.stderr, usage(cmd, flag), `${cmd} --${flag} stderr`);
    }
  }
});

test('frozen feature-list commands verbatim: validate --dir, next --dir . --count', () => {
  const v = spawnSync('node', ['scripts/ship-state.mjs', 'validate', '--dir'], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  assert.equal(v.status, 1);
  assert.equal(v.stdout, '');
  assert.equal(v.stderr, usage('validate', 'dir'));

  const n = spawnSync('node', ['scripts/ship-state.mjs', 'next', '--dir', '.', '--count'], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  assert.equal(n.status, 1);
  assert.equal(n.stdout, '', 'the pre-F-014 bug printed [] here at exit 0');
  assert.equal(n.stderr, usage('next', 'count'));
});

test('the guard fires before any state read or write', () => {
  // Before reads: a dir with no feature list still names the flag, not
  // readDoc's missing-list failure (and add exits before reading stdin).
  const empty = mkdtempSync(join(tmpdir(), 'shiploop-'));
  const r = spawnSync('node', [BIN, 'set', '--dir', empty, '--id'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stderr, usage('set', 'id'));

  // Before writes: valueless --passes leaves the document byte-identical
  // (pre-F-014 this silently flipped the feature to passing).
  const dir = fresh();
  run(['add', '--dir', dir], feat);
  const before = readFileSync(flPath(dir), 'utf8');
  const r2 = spawnSync('node', [BIN, 'set', '--dir', dir, '--id', 'F-001', '--passes'], {
    encoding: 'utf8',
  });
  assert.equal(r2.status, 1);
  assert.equal(r2.stderr, usage('set', 'passes'));
  assert.equal(readFileSync(flPath(dir), 'utf8'), before);
});

test('valued flags pass the guard: explicit set --passes true/false still mutates', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat);
  run(['set', '--dir', dir, '--id', 'F-001', '--passes', 'true']);
  assert.equal(JSON.parse(readFileSync(flPath(dir), 'utf8')).features[0].passes, true);
  run(['set', '--dir', dir, '--id', 'F-001', '--passes', 'false']);
  assert.equal(JSON.parse(readFileSync(flPath(dir), 'utf8')).features[0].passes, false);
});

test('set --bump-attempts stays legitimately valueless (boolean-allowed)', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat);
  run(['set', '--dir', dir, '--id', 'F-001', '--bump-attempts']); // trailing valueless: valid
  run(['set', '--dir', dir, '--id', 'F-001', '--note', 'try logged', '--bump-attempts']);
  const f = JSON.parse(readFileSync(flPath(dir), 'utf8')).features[0];
  assert.equal(f.attempts, 2);
  assert.match(f.notes, /try logged/);
});

test('a flag followed by another flag is valueless; first table entry is named', () => {
  // parseArgs makes BOTH flags boolean true here; the guard reports the
  // command's first-listed flag deterministically (set: dir before id).
  const r = spawnSync('node', [BIN, 'set', '--dir', '--id'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, usage('set', 'dir'));
});

test('stop-hook is exempt: stray valueless flags never fail a session', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'shiploop-'));
  const r = spawnSync('node', [BIN, 'stop-hook', '--dir'], {
    input: JSON.stringify({ cwd, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});
