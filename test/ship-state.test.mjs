import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'scripts', 'ship-state.mjs');
const GATE = join(ROOT, 'hooks', 'gate.sh');

function run(args, input) {
  return execFileSync('node', [BIN, ...args], { input, encoding: 'utf8' });
}
function runFail(args, input) {
  const r = spawnSync('node', [BIN, ...args], { input, encoding: 'utf8' });
  assert.notEqual(r.status, 0, `expected non-zero exit for ${args.join(' ')}`);
  return r;
}
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-'));
  run(['init', '--dir', dir, '--product', 'Demo']);
  return dir;
}
function flPath(dir) {
  return join(dir, 'docs', 'ship-loop', 'feature_list.json');
}
const feat = (over = {}) =>
  JSON.stringify({
    title: 'a feature',
    type: 'feature',
    priority: 2,
    depends_on: [],
    verification: ['npm test passes'],
    ...over,
  });

test('init scaffolds an empty validated feature list', () => {
  const dir = fresh();
  const doc = JSON.parse(readFileSync(flPath(dir), 'utf8'));
  assert.deepEqual(doc, { version: 1, product: 'Demo', features: [] });
});

test('add assigns sequential ids and defaults', () => {
  const dir = fresh();
  const id1 = run(['add', '--dir', dir], feat()).trim();
  const id2 = run(['add', '--dir', dir], feat({ type: 'bug', priority: 1 })).trim();
  assert.equal(id1, 'F-001');
  assert.equal(id2, 'F-002');
  const doc = JSON.parse(readFileSync(flPath(dir), 'utf8'));
  assert.equal(doc.features[0].passes, false);
  assert.equal(doc.features[0].status, 'pending');
  assert.equal(doc.features[0].attempts, 0);
});

test('add rejects invalid features', () => {
  const dir = fresh();
  runFail(['add', '--dir', dir], feat({ verification: [] }));
  runFail(['add', '--dir', dir], feat({ type: 'wish' }));
  runFail(['add', '--dir', dir], feat({ depends_on: ['F-999'] }));
});

test('validate rejects corrupt or inconsistent files', () => {
  const dir = fresh();
  writeFileSync(flPath(dir), 'not json');
  runFail(['validate', '--dir', dir]);
  const doc = { version: 1, product: 'Demo', features: [] };
  const f = JSON.parse(feat());
  doc.features = [
    { id: 'F-001', passes: false, status: 'pending', attempts: 0, ...f },
    { id: 'F-001', passes: false, status: 'pending', attempts: 0, ...f },
  ];
  writeFileSync(flPath(dir), JSON.stringify(doc));
  runFail(['validate', '--dir', dir]);
});

test('next orders hotfix < bug < feature, then priority, and gates on deps', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat({ title: 'A', priority: 2 })); // F-001 feature
  run(['add', '--dir', dir], feat({ title: 'B', type: 'bug', priority: 1 })); // F-002
  run(['add', '--dir', dir], feat({ title: 'C', priority: 1, depends_on: ['F-001'] })); // F-003 blocked
  run(['add', '--dir', dir], feat({ title: 'H', type: 'hotfix', priority: 3 })); // F-004
  let next = JSON.parse(run(['next', '--dir', dir]));
  assert.deepEqual(next.map((f) => f.id), ['F-004', 'F-002', 'F-001']);
  run(['set', '--dir', dir, '--id', 'F-001', '--status', 'passed', '--passes', 'true']);
  next = JSON.parse(run(['next', '--dir', dir]));
  assert.ok(next.map((f) => f.id).includes('F-003'));
  const one = JSON.parse(run(['next', '--dir', dir, '--count', '1']));
  assert.equal(one.length, 1);
});

test('set updates status, passes, notes and bumps attempts', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat());
  run(['set', '--dir', dir, '--id', 'F-001', '--status', 'in_progress', '--bump-attempts']);
  run(['set', '--dir', dir, '--id', 'F-001', '--note', 'first try failed', '--bump-attempts']);
  const doc = JSON.parse(readFileSync(flPath(dir), 'utf8'));
  assert.equal(doc.features[0].attempts, 2);
  assert.match(doc.features[0].notes, /first try failed/);
  runFail(['set', '--dir', dir, '--id', 'F-999', '--status', 'passed']);
});

test('stats and gate reflect done = every feature passed or parked', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat({ title: 'A' }));
  run(['add', '--dir', dir], feat({ title: 'B', type: 'bug' }));
  let stats = JSON.parse(run(['stats', '--dir', dir]));
  assert.equal(stats.done, false);
  assert.equal(stats.open_bugs, 1);
  const g1 = spawnSync('node', [BIN, 'gate', '--dir', dir], { encoding: 'utf8' });
  assert.equal(g1.status, 1);
  run(['set', '--dir', dir, '--id', 'F-001', '--status', 'passed', '--passes', 'true']);
  run(['set', '--dir', dir, '--id', 'F-002', '--status', 'parked', '--note', 'needs stripe key']);
  stats = JSON.parse(run(['stats', '--dir', dir]));
  assert.equal(stats.done, true);
  const g2 = spawnSync('node', [BIN, 'gate', '--dir', dir], { encoding: 'utf8' });
  assert.equal(g2.status, 0);
});

test('learn appends and lessons filters', () => {
  const dir = fresh();
  run(['learn', '--dir', dir], JSON.stringify({ lesson: 'sqlite needs WAL here', tags: ['db'] }));
  run(['learn', '--dir', dir], JSON.stringify({ lesson: 'vite proxy strips headers', tags: ['frontend'] }));
  const all = JSON.parse(run(['lessons', '--dir', dir]));
  assert.equal(all.length, 2);
  assert.ok(all[0].ts);
  const db = JSON.parse(run(['lessons', '--dir', dir, '--grep', 'sqlite']));
  assert.equal(db.length, 1);
});

function stopHook(cwd) {
  return spawnSync('node', [BIN, 'stop-hook'], {
    input: JSON.stringify({ cwd, stop_hook_active: false, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
}
const sd = (dir) => join(dir, 'docs', 'ship-loop');

test('stop-hook is silent outside an active run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-'));
  const r = stopHook(dir);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('stop-hook blocks while features remain, allows after 3 stale rounds with escalation', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat());
  writeFileSync(join(sd(dir), 'ACTIVE'), 'run');
  const r1 = stopHook(dir);
  assert.equal(r1.status, 0);
  assert.equal(JSON.parse(r1.stdout).decision, 'block');
  const r2 = stopHook(dir);
  assert.equal(JSON.parse(r2.stdout).decision, 'block');
  const r3 = stopHook(dir); // third consecutive identical state -> allow + escalate
  assert.equal(r3.status, 0);
  assert.equal(r3.stdout.trim(), '');
  assert.match(readFileSync(join(sd(dir), 'NEEDS_HUMAN.md'), 'utf8'), /stalled/);
});

test('stop-hook resets spin counter when state changes', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat());
  writeFileSync(join(sd(dir), 'ACTIVE'), 'run');
  stopHook(dir);
  stopHook(dir);
  run(['add', '--dir', dir], feat({ title: 'progress happened' })); // state hash changes
  const r3 = stopHook(dir);
  assert.equal(JSON.parse(r3.stdout).decision, 'block');
});

test('stop-hook allows stop when done or paused', () => {
  const dir = fresh();
  run(['add', '--dir', dir], feat());
  writeFileSync(join(sd(dir), 'ACTIVE'), 'run');
  run(['set', '--dir', dir, '--id', 'F-001', '--status', 'passed', '--passes', 'true']);
  assert.equal(stopHook(dir).stdout.trim(), '');
  const dir2 = fresh();
  run(['add', '--dir', dir2], feat());
  writeFileSync(join(sd(dir2), 'ACTIVE'), 'run');
  writeFileSync(join(sd(dir2), 'PAUSED'), 'paused');
  assert.equal(stopHook(dir2).stdout.trim(), '');
});

test('gate.sh end-to-end stays silent for unrelated sessions', () => {
  if (!existsSync(GATE)) return; // wired in Task 3
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-'));
  const r = spawnSync('bash', [GATE], {
    input: JSON.stringify({ cwd: dir, hook_event_name: 'Stop' }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});
