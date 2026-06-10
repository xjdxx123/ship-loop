import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'scripts', 'ship-state.mjs');
const FIXTURE = join(ROOT, 'test', 'fixtures', 'transcript.jsonl');

const EXPECTED = { input: 116, output: 235, cache_read: 333, cache_creation: 444, total: 1128 };
const ZEROS = { input: 0, output: 0, cache_read: 0, cache_creation: 0, total: 0 };

function cost(args, opts = {}) {
  return spawnSync('node', [BIN, 'cost', ...args], { encoding: 'utf8', ...opts });
}

test('cost sums the committed fixture to the pinned totals — exact stdout, empty stderr', () => {
  const r = cost(['--transcript', FIXTURE]);
  assert.equal(r.status, 0);
  // Single string-equality assertion pins key order, values, 2-space formatting,
  // and the trailing newline (JSON.stringify(obj, null, 2) + '\n').
  assert.equal(r.stdout, JSON.stringify(EXPECTED, null, 2) + '\n');
  assert.equal(r.stderr, '');
});

test('cost accepts and ignores --dir (frozen feature-list command, verbatim)', () => {
  const r = spawnSync(
    'node',
    ['scripts/ship-state.mjs', 'cost', '--dir', '.', '--transcript', 'test/fixtures/transcript.jsonl'],
    { encoding: 'utf8', cwd: ROOT }
  );
  assert.equal(r.status, 0);
  assert.equal(r.stdout, JSON.stringify(EXPECTED, null, 2) + '\n');
  assert.equal(r.stderr, '');
});

test('cost missing or unreadable transcript reports zeros, one stderr warning, exit 0', () => {
  const missing = join(mkdtempSync(join(tmpdir(), 'shiploop-')), 'no-such-transcript.jsonl');
  const r = cost(['--transcript', missing]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, JSON.stringify(ZEROS, null, 2) + '\n');
  assert.equal(r.stderr, `ship-state: cost: cannot read transcript at ${missing}; reporting zeros\n`);

  // Unreadable (EISDIR: path is a directory) takes the same fail-safe path.
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-'));
  const r2 = cost(['--transcript', dir]);
  assert.equal(r2.status, 0);
  assert.equal(r2.stdout, JSON.stringify(ZEROS, null, 2) + '\n');
  assert.equal(r2.stderr, `ship-state: cost: cannot read transcript at ${dir}; reporting zeros\n`);
});

test('cost empty or blank-only transcript is a legitimate zero measurement — silent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shiploop-'));
  const empty = join(dir, 'empty.jsonl');
  writeFileSync(empty, '');
  const r = cost(['--transcript', empty]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, JSON.stringify(ZEROS, null, 2) + '\n');
  assert.equal(r.stderr, '');

  const blanks = join(dir, 'blanks.jsonl');
  writeFileSync(blanks, '\n\n  \n\n');
  const r2 = cost(['--transcript', blanks]);
  assert.equal(r2.status, 0);
  assert.equal(r2.stdout, JSON.stringify(ZEROS, null, 2) + '\n');
  assert.equal(r2.stderr, '');
});

test('cost without a --transcript value is a usage error: exit 1, empty stdout', () => {
  // Flag absent entirely, and flag present with no value (parseArgs yields boolean true).
  for (const args of [[], ['--transcript']]) {
    const r = cost(args);
    assert.equal(r.status, 1, `args: cost ${args.join(' ')}`);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'ship-state: cost requires --transcript\n');
  }
});
