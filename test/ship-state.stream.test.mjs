import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, openSync, writeSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'scripts', 'ship-state.mjs');
const SRC = readFileSync(BIN, 'utf8');

// Contract F-010: the chunk size is a pinned source-level constant. The
// boundary fixture below sizes every line from it, so the test adapts if the
// constant is ever retuned — and fails loudly (here) if it is renamed.
const CHUNK_MATCH = SRC.match(/^const READ_CHUNK = (\d+);$/m);

const pretty = (o) => JSON.stringify(o, null, 2) + '\n';
const ZEROS = { input: 0, output: 0, cache_read: 0, cache_creation: 0, total: 0 };

function cost(transcript) {
  return spawnSync('node', [BIN, 'cost', '--transcript', transcript], { encoding: 'utf8' });
}

test('engine streams the transcript: fixed-size readSync chunks, never a whole-file string (source-pinned)', () => {
  assert.ok(CHUNK_MATCH, 'const READ_CHUNK = <bytes>; must exist — the streaming read site is missing');
  assert.equal(Number(CHUNK_MATCH[1]), 65536, 'READ_CHUNK is contract-pinned to 65536');
  // Extract sumTranscript up to its first column-0 closing brace.
  const body = SRC.match(/function sumTranscript\(transcript\) \{[\s\S]*?\n\}/);
  assert.ok(body, 'shared sumTranscript helper must exist');
  assert.match(body[0], /(?<![A-Za-z])readSync\(/, 'transcript read site must use chunked readSync');
  assert.ok(
    !body[0].includes('readFileSync('),
    'sumTranscript must never read the transcript as one whole-file string'
  );
});

test('lines longer than one chunk — boundaries mid-character, mid-line, and exactly at a newline — sum byte-exactly', () => {
  assert.ok(CHUNK_MATCH, 'needs the pinned READ_CHUNK constant to size the fixture');
  const c = Number(CHUNK_MATCH[1]);
  const usage = (i, o, cr, cc) =>
    `"usage":{"input_tokens":${i},"output_tokens":${o},"cache_read_input_tokens":${cr},"cache_creation_input_tokens":${cc}}`;

  // Build the file as byte-exact segments so every chunk boundary (multiples
  // of c, file-absolute) lands where this test plans it to.
  const segs = [];
  let off = 0;
  const push = (s) => {
    const b = Buffer.from(s);
    segs.push(b);
    off += b.length;
  };

  // Line A (~1.5c): a run of 3-byte UTF-8 chars positioned so the FIRST chunk
  // boundary (byte c) falls strictly inside one character; the usage object
  // sits after the boundary. Per-chunk decoding would mangle the char; per-
  // chunk parsing would never see a complete JSON line.
  const headA = '{"type":"assistant","message":{"content":"';
  let align = '';
  while ((c - (Buffer.byteLength(headA) + align.length)) % 3 !== 1) align += 'x';
  const runStart = Buffer.byteLength(headA) + align.length;
  const run = '言'.repeat(Math.ceil((1.5 * c) / 3)); // 言 = 3 bytes (e8 a8 80)
  const runBytes = Buffer.byteLength(run);
  assert.ok(runStart < c && c < runStart + runBytes, 'boundary 1 must land inside the multi-byte run');
  assert.equal((c - runStart) % 3, 1, 'boundary 1 must split a 3-byte character after its first byte');
  push(`${headA}${align}${run}",${usage(1, 2, 3, 4)}}}`);
  assert.ok(off > c, 'line A must be longer than one chunk');
  push('\n');

  // Line B: long ASCII padding placing boundary 2 (byte 2c) mid-string,
  // before the usage object.
  const headB = '{"pad":"';
  const padStart = off + Buffer.byteLength(headB);
  assert.ok(padStart < 2 * c, 'line B padding must begin before boundary 2');
  const padLen = 2 * c - padStart + Math.floor(c / 4);
  push(`${headB}${'y'.repeat(padLen)}","message":{${usage(10, 20, 30, 40)}}}`);
  push('\n');

  // Line C: short CRLF-terminated usage line — split('\n') leaves the \r,
  // JSON.parse tolerates it (unchanged from the whole-file behavior).
  push(`{"message":{${usage(100, 200, 300, 400)}}}\r\n`);

  // Whitespace-only line: skipped silently.
  push('  \n');

  // Line D: non-JSON garbage crossing boundary 3 (byte 3c) and ending so its
  // newline is EXACTLY byte 4c — the first byte of a chunk. Skipped silently;
  // no line around the edge case may be lost or double-counted.
  const garbageLen = 4 * c - off;
  assert.ok(garbageLen > c, 'garbage line must cross a chunk boundary');
  push(`not json {{{${'z'.repeat(garbageLen - 12)}`);
  assert.equal(off, 4 * c, "garbage line must end so its newline sits exactly at a chunk's first byte");
  push('\n');

  // Junk-fields line: string "9" and null contribute 0 (no Number() coercion
  // through the streamed path either); output 6 still counts.
  push('{"message":{"usage":{"input_tokens":"9","output_tokens":6,"cache_read_input_tokens":null}}}\n');

  // Line G: final usage line with NO trailing newline — EOF carry flush.
  push('{"message":{"usage":{"input_tokens":1000,"output_tokens":2000}}}');

  const file = join(mkdtempSync(join(tmpdir(), 'shiploop-stream-')), 'boundaries.jsonl');
  writeFileSync(file, Buffer.concat(segs));

  // input 1+10+100+0+1000, output 2+20+200+6+2000, cache_read 3+30+300, cache_creation 4+40+400
  const EXPECTED = { input: 1111, output: 2228, cache_read: 333, cache_creation: 444, total: 4116 };
  const r = cost(file);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, pretty(EXPECTED));
  assert.equal(r.stderr, '');
});

// The filed bug, reproduced for real: a transcript past V8's string cap
// (0x1fffffe8 chars ≈ 512MiB) made readFileSync('utf8') throw, so the run
// read as zero spend and evaded the budget tripwire. Opt-in because it writes
// ~537MiB to tmpdir; contract F-010 requires running it once per change here:
//   SHIP_LOOP_BIG_FIXTURE=1 node --test test/ship-state.stream.test.mjs
test(
  'transcript past the V8 string cap sums exact totals instead of failing open to zeros',
  { skip: process.env.SHIP_LOOP_BIG_FIXTURE !== '1' && 'set SHIP_LOOP_BIG_FIXTURE=1 (writes ~537MiB to tmpdir)' },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'shiploop-big-'));
    try {
      const line =
        '{"type":"assistant","message":{"id":"msg_big","usage":{"input_tokens":3,"output_tokens":5,"cache_read_input_tokens":7,"cache_creation_input_tokens":11}}}\n';
      const per = Buffer.byteLength(line);
      const V8_MAX_STRING = 0x1fffffe8; // 536,870,888 one-byte chars
      const blocks = Math.ceil(Math.ceil(V8_MAX_STRING / per + 1024) / 4096);
      const block = Buffer.from(line.repeat(4096));
      const totalLines = blocks * 4096;
      assert.ok(totalLines * per > V8_MAX_STRING, 'fixture must exceed the V8 string cap');
      const big = join(dir, 'big.jsonl');
      const fd = openSync(big, 'w');
      try {
        for (let i = 0; i < blocks; i++) writeSync(fd, block);
      } finally {
        closeSync(fd);
      }
      const r = cost(big);
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '', 'a readable giant transcript must not warn (that is the fail-open bug)');
      assert.equal(
        r.stdout,
        pretty({
          input: 3 * totalLines,
          output: 5 * totalLines,
          cache_read: 7 * totalLines,
          cache_creation: 11 * totalLines,
          total: 26 * totalLines,
        })
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

test('/dev/null stays a silent zero measurement through the chunked reader', () => {
  const r = cost('/dev/null');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, pretty(ZEROS));
  assert.equal(r.stderr, '');
});
