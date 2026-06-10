#!/usr/bin/env node
/**
 * ship-loop state engine. Zero dependencies.
 * Owns docs/ship-loop/feature_list.json (+ learnings.json, gate markers).
 * Every read and write revalidates the document (anti state-rot).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, appendFileSync, unlinkSync, openSync, readSync, closeSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const TYPES = ['feature', 'bug', 'hotfix', 'spec-conflict'];
const STATUSES = ['pending', 'in_progress', 'passed', 'parked', 'reset'];
const TYPE_ORDER = { hotfix: 0, bug: 1, 'spec-conflict': 2, feature: 3 };

function fail(msg) {
  process.stderr.write(`ship-state: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) fail(`unexpected argument: ${a}`);
    const key = a.slice(2);
    if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
      flags[key] = rest[++i];
    } else {
      flags[key] = true;
    }
  }
  return { cmd, flags };
}

const stateDir = (dir) => join(dir, 'docs', 'ship-loop');
const flPath = (dir) => join(stateDir(dir), 'feature_list.json');

function validateFeature(f, i, ids) {
  const at = `features[${i}]`;
  const errs = [];
  if (typeof f !== 'object' || f === null || Array.isArray(f)) return [`${at}: not an object`];
  if (typeof f.id !== 'string' || !/^F-\d{3,}$/.test(f.id)) errs.push(`${at}.id invalid`);
  if (typeof f.title !== 'string' || !f.title) errs.push(`${at}.title required`);
  if (!TYPES.includes(f.type)) errs.push(`${at}.type must be one of ${TYPES.join('|')}`);
  if (![1, 2, 3].includes(f.priority)) errs.push(`${at}.priority must be 1|2|3`);
  if (!Array.isArray(f.depends_on)) errs.push(`${at}.depends_on must be an array`);
  else for (const d of f.depends_on) if (!ids.has(d)) errs.push(`${at}.depends_on references unknown ${d}`);
  if (!Array.isArray(f.verification) || f.verification.length < 1 || f.verification.some((v) => typeof v !== 'string' || !v))
    errs.push(`${at}.verification needs >=1 non-empty step`);
  if (typeof f.passes !== 'boolean') errs.push(`${at}.passes must be boolean`);
  if (!STATUSES.includes(f.status)) errs.push(`${at}.status must be one of ${STATUSES.join('|')}`);
  if (!Number.isInteger(f.attempts) || f.attempts < 0) errs.push(`${at}.attempts must be int>=0`);
  if ('contract' in f && f.contract !== null && typeof f.contract !== 'string') errs.push(`${at}.contract must be string|null`);
  if ('notes' in f && typeof f.notes !== 'string') errs.push(`${at}.notes must be string`);
  const known = new Set(['id', 'title', 'type', 'priority', 'depends_on', 'verification', 'passes', 'status', 'attempts', 'contract', 'notes']);
  for (const k of Object.keys(f)) if (!known.has(k)) errs.push(`${at}.${k} unknown property`);
  return errs;
}

function validateDoc(doc) {
  const errs = [];
  if (typeof doc !== 'object' || doc === null) return ['document is not an object'];
  if (doc.version !== 1) errs.push('version must be 1');
  if (typeof doc.product !== 'string' || !doc.product) errs.push('product required');
  if (!Array.isArray(doc.features)) return [...errs, 'features must be an array'];
  const ids = new Set(doc.features.map((f) => f && f.id));
  const seen = new Set();
  doc.features.forEach((f, i) => {
    errs.push(...validateFeature(f, i, ids));
    if (f && f.id) {
      if (seen.has(f.id)) errs.push(`duplicate id ${f.id}`);
      seen.add(f.id);
    }
  });
  return errs;
}

function readDoc(dir) {
  const p = flPath(dir);
  if (!existsSync(p)) fail(`no feature list at ${p} (run: ship-state.mjs init)`);
  let doc;
  try {
    doc = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`feature_list.json is not valid JSON: ${e.message}`);
  }
  const errs = validateDoc(doc);
  if (errs.length) fail(`invalid feature list:\n  ${errs.join('\n  ')}`);
  return doc;
}

function writeDoc(dir, doc) {
  const errs = validateDoc(doc);
  if (errs.length) fail(`refusing to write invalid feature list:\n  ${errs.join('\n  ')}`);
  const p = flPath(dir);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  renameSync(tmp, p);
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function computeStats(doc) {
  const by = (s) => doc.features.filter((f) => f.status === s).length;
  const open_bugs = doc.features.filter(
    (f) => (f.type === 'bug' || f.type === 'hotfix') && f.status !== 'passed' && f.status !== 'parked'
  ).length;
  const done =
    doc.features.length > 0 && doc.features.every((f) => f.status === 'passed' || f.status === 'parked');
  return {
    total: doc.features.length,
    passed: by('passed'),
    parked: by('parked'),
    pending: by('pending'),
    in_progress: by('in_progress'),
    open_bugs,
    done,
  };
}

/**
 * Shared transcript token accounting — the single transcript read site, used
 * by both `cost` and the stop-hook. Sums message.usage counts across every
 * line that parses as JSON and carries a non-null usage object; a usage field
 * contributes only when it is a non-negative integer. A missing or unreadable
 * transcript yields zeros plus `unreadable: true`; the CALLER owns any
 * warning (`cost` warns on stderr, the stop-hook stays silent).
 *
 * F-010: the file is read synchronously in READ_CHUNK slices (openSync/
 * readSync) and split into lines by hand — no whole-file string ever exists,
 * so transcripts past V8's ~512MiB string cap sum correctly instead of
 * failing open to zeros. StringDecoder keeps a multi-byte UTF-8 character
 * split across a chunk boundary intact, exactly as a whole-file decode
 * would. Peak string cost is one line plus one chunk; a single LINE past the
 * V8 cap stays out of scope and degrades to the pre-F-010 shape (zeros +
 * unreadable). Any open or read error — even mid-file — reports all-zero
 * totals, never a partial sum, matching the all-or-nothing whole-file read
 * this replaces.
 */
const READ_CHUNK = 65536;
function sumTranscript(transcript) {
  const totals = { input: 0, output: 0, cache_read: 0, cache_creation: 0, total: 0 };
  const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  const addLine = (line) => {
    if (!line.trim()) return; // blank/whitespace-only lines are skipped silently
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      return; // tolerate non-JSON lines silently
    }
    const msg = entry && typeof entry === 'object' ? entry.message : undefined;
    const usage = msg && typeof msg === 'object' ? msg.usage : undefined;
    if (!usage || typeof usage !== 'object') return;
    totals.input += count(usage.input_tokens);
    totals.output += count(usage.output_tokens);
    totals.cache_read += count(usage.cache_read_input_tokens);
    totals.cache_creation += count(usage.cache_creation_input_tokens);
  };
  let unreadable = false;
  let fd = null;
  try {
    fd = openSync(transcript, 'r');
    const decoder = new StringDecoder('utf8');
    const chunk = Buffer.alloc(READ_CHUNK);
    let carry = ''; // text after the last newline seen so far — at most one line
    for (;;) {
      const n = readSync(fd, chunk, 0, READ_CHUNK, null);
      if (n === 0) break;
      const parts = (carry + decoder.write(chunk.subarray(0, n))).split('\n');
      carry = parts.pop();
      for (const part of parts) addLine(part);
    }
    addLine(carry + decoder.end()); // EOF without a trailing newline still counts its last line
  } catch {
    // unreadable (open failure, EISDIR, or a mid-file read error): report
    // zeros, never a partial sum — identical to the whole-file read replaced.
    unreadable = true;
    totals.input = totals.output = totals.cache_read = totals.cache_creation = 0;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* best-effort */
      }
    }
  }
  totals.total = totals.input + totals.output + totals.cache_read + totals.cache_creation;
  return { totals, unreadable };
}

const cmds = {
  init({ dir, product }) {
    if (!dir || !product) fail('init requires --dir and --product');
    mkdirSync(stateDir(dir), { recursive: true });
    if (existsSync(flPath(dir))) fail('feature list already exists');
    writeDoc(dir, { version: 1, product, features: [] });
  },

  validate({ dir }) {
    if (!dir) fail('validate requires --dir');
    readDoc(dir);
    process.stdout.write('ok\n');
  },

  add({ dir }) {
    if (!dir) fail('add requires --dir');
    const doc = readDoc(dir);
    let input;
    try {
      input = JSON.parse(readStdin());
    } catch (e) {
      fail(`stdin is not valid JSON: ${e.message}`);
    }
    const max = doc.features.reduce((m, f) => Math.max(m, parseInt(f.id.slice(2), 10)), 0);
    const id = `F-${String(max + 1).padStart(3, '0')}`;
    const feature = {
      id,
      title: input.title,
      type: input.type ?? 'feature',
      priority: input.priority ?? 2,
      depends_on: input.depends_on ?? [],
      verification: input.verification ?? [],
      passes: false,
      status: input.status ?? 'pending',
      attempts: 0,
      contract: input.contract ?? null,
      notes: input.notes ?? '',
    };
    doc.features.push(feature);
    writeDoc(dir, doc);
    process.stdout.write(`${id}\n`);
  },

  next({ dir, count }) {
    if (!dir) fail('next requires --dir');
    const doc = readDoc(dir);
    const passedIds = new Set(doc.features.filter((f) => f.passes).map((f) => f.id));
    const eligible = doc.features
      .filter((f) => f.status === 'pending' && f.depends_on.every((d) => passedIds.has(d)))
      .sort(
        (a, b) =>
          TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
          a.priority - b.priority ||
          a.id.localeCompare(b.id)
      );
    const n = count ? parseInt(count, 10) : eligible.length;
    process.stdout.write(JSON.stringify(eligible.slice(0, n), null, 2) + '\n');
  },

  set({ dir, id, status, passes, note, 'bump-attempts': bump }) {
    if (!dir || !id) fail('set requires --dir and --id');
    const doc = readDoc(dir);
    const f = doc.features.find((x) => x.id === id);
    if (!f) fail(`no feature ${id}`);
    if (status) {
      if (!STATUSES.includes(status)) fail(`bad status ${status}`);
      f.status = status;
    }
    if (passes !== undefined) f.passes = String(passes) === 'true';
    if (note) f.notes = f.notes ? `${f.notes}\n${note}` : String(note);
    if (bump) f.attempts += 1;
    writeDoc(dir, doc);
  },

  stats({ dir }) {
    if (!dir) fail('stats requires --dir');
    process.stdout.write(JSON.stringify(computeStats(readDoc(dir)), null, 2) + '\n');
  },

  gate({ dir }) {
    if (!dir) fail('gate requires --dir');
    const stats = computeStats(readDoc(dir));
    process.stdout.write(JSON.stringify(stats) + '\n');
    process.exit(stats.done ? 0 : 1);
  },

  /**
   * Token accounting over a Claude Code session transcript (JSONL), summed by
   * the shared sumTranscript helper. Fail-safe for the F-002 budget gate: a
   * missing or unreadable file reports zeros on stdout + one stderr warning,
   * exit 0. --dir is accepted and ignored; cost never reads feature_list.json.
   */
  cost({ transcript }) {
    if (typeof transcript !== 'string') fail('cost requires --transcript');
    const { totals, unreadable } = sumTranscript(transcript);
    if (unreadable) {
      process.stderr.write(`ship-state: cost: cannot read transcript at ${transcript}; reporting zeros\n`);
    }
    process.stdout.write(JSON.stringify(totals, null, 2) + '\n');
  },

  learn({ dir }) {
    if (!dir) fail('learn requires --dir');
    mkdirSync(stateDir(dir), { recursive: true });
    let input;
    try {
      input = JSON.parse(readStdin());
    } catch (e) {
      fail(`stdin is not valid JSON: ${e.message}`);
    }
    if (typeof input.lesson !== 'string' || !input.lesson) fail('learn requires {"lesson": "..."}');
    const p = join(stateDir(dir), 'learnings.json');
    const arr = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
    arr.push({ ts: new Date().toISOString(), lesson: input.lesson, tags: input.tags ?? [] });
    writeFileSync(p, JSON.stringify(arr, null, 2) + '\n');
  },

  lessons({ dir, grep }) {
    if (!dir) fail('lessons requires --dir');
    const p = join(stateDir(dir), 'learnings.json');
    const arr = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
    const out = grep
      ? arr.filter((l) => l.lesson.includes(grep) || (l.tags || []).some((t) => t.includes(grep)))
      : arr;
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  },

  /**
   * Claude Code Stop hook. Reads hook JSON on stdin.
   * Silent (exit 0, no output) in every situation except an active, unpaused,
   * unfinished run with fresh state — then it emits {"decision":"block"} so the
   * conductor keeps looping. Two escalations allow the stop instead:
   * - budget gate (F-002): this session's transcript token total (hook stdin's
   *   transcript_path, summed by sumTranscript) strictly exceeds the charter's
   *   token_budget_day → append the NEEDS_HUMAN.md escalation, write PAUSED,
   *   clear .gate-spin, notify once, allow. Fail-open: a missing/unparseable
   *   charter row, unreadable transcript, or any internal error means no
   *   enforcement — the hook never crashes or alters anyone's session.
   * - stall: three consecutive identical states → escalate to NEEDS_HUMAN.md
   *   and allow the stop.
   */
  'stop-hook'() {
    let input = {};
    try {
      input = JSON.parse(readStdin() || '{}');
    } catch {
      process.exit(0); // malformed hook payload: never break someone's session
    }
    const cwd = input.cwd || process.cwd();
    const sd = stateDir(cwd);
    if (!existsSync(join(sd, 'ACTIVE'))) process.exit(0);
    if (existsSync(join(sd, 'PAUSED'))) process.exit(0);
    if (!existsSync(flPath(cwd))) process.exit(0);
    let doc;
    try {
      doc = JSON.parse(readFileSync(flPath(cwd), 'utf8'));
      if (validateDoc(doc).length) process.exit(0);
    } catch {
      process.exit(0);
    }
    const stats = computeStats(doc);
    if (stats.done) process.exit(0);

    // Budget enforcement (F-002), evaluated only here — after every
    // pre-existing allow/skip check above, before the spin-stall logic below.
    let breach = null;
    try {
      const tp = input.transcript_path;
      if (typeof tp === 'string' && tp) {
        let budget = 0;
        try {
          const charter = readFileSync(join(sd, 'BUILD_CHARTER.md'), 'utf8');
          // First MATCHING row wins. Horizontal whitespace ([ \t]) only —
          // \s would cross the newline and borrow digits from the next line.
          const m = /^[ \t]*\|[ \t]*token_budget_day[ \t]*\|[ \t]*([0-9][0-9_,]*)/m.exec(charter);
          if (m) {
            const v = Number(m[1].replace(/[,_]/g, ''));
            if (Number.isSafeInteger(v) && v >= 1) budget = v;
          }
        } catch {
          /* charter missing or unreadable: no enforcement */
        }
        if (budget >= 1) {
          const { totals } = sumTranscript(tp); // silent: no stderr from the hook path
          if (totals.total > budget) breach = { total: totals.total, budget };
        }
      }
    } catch {
      /* unexpected internal error: no enforcement — never break someone's session */
    }
    if (breach) {
      // Over budget: pause the run, then allow the stop. Each step is
      // individually best-effort — stopping is the safe direction, so the
      // exit 0 below happens even when every write fails.
      const { total, budget } = breach;
      const ts = new Date().toISOString();
      try {
        appendFileSync(
          join(sd, 'NEEDS_HUMAN.md'),
          `- [ ] ${ts} gate: token budget exceeded (${total} tokens > token_budget_day ${budget}) — run paused; review spend, then raise token_budget_day in docs/ship-loop/BUILD_CHARTER.md and rm docs/ship-loop/PAUSED to resume\n`
        );
      } catch {
        /* best-effort */
      }
      try {
        writeFileSync(join(sd, 'PAUSED'), `token budget exceeded: ${total} > ${budget} at ${ts}\n`);
      } catch {
        /* best-effort */
      }
      try {
        unlinkSync(join(sd, '.gate-spin')); // a resume must not inherit a phantom stall count
      } catch {
        /* already gone */
      }
      try {
        // notify.sh resolved as a sibling of the running engine; bash as argv0
        // removes any exec-bit dependency. Fires after PAUSED is durable.
        const notifyPath = join(dirname(fileURLToPath(import.meta.url)), 'notify.sh');
        if (existsSync(notifyPath)) {
          spawnSync(
            'bash',
            [
              notifyPath,
              'ship-loop: gate paused (budget)',
              `NEEDS_HUMAN.md: token budget exceeded (${total} > ${budget} tokens) — raise token_budget_day in docs/ship-loop/BUILD_CHARTER.md, then rm docs/ship-loop/PAUSED`,
            ],
            { stdio: 'ignore', timeout: 8000 }
          );
        }
      } catch {
        /* notification is best-effort */
      }
      process.exit(0);
    }

    const hash = createHash('sha256').update(readFileSync(flPath(cwd))).digest('hex');
    const spinPath = join(sd, '.gate-spin');
    let spin = { hash: '', count: 0 };
    if (existsSync(spinPath)) {
      try {
        spin = JSON.parse(readFileSync(spinPath, 'utf8'));
      } catch {
        /* corrupt spin file: treat as fresh */
      }
    }
    spin = spin.hash === hash ? { hash, count: spin.count + 1 } : { hash, count: 1 };
    if (spin.count >= 3) {
      appendFileSync(
        join(sd, 'NEEDS_HUMAN.md'),
        `- [ ] ${new Date().toISOString()} gate: loop stalled (${stats.pending} pending, state unchanged across 3 stop attempts) — human intervention needed\n`
      );
      try {
        unlinkSync(spinPath);
      } catch {
        /* already gone */
      }
      process.exit(0);
    }
    writeFileSync(spinPath, JSON.stringify(spin));
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `ship-loop: ${stats.pending + stats.in_progress} features remain (${stats.open_bugs} open bugs). Re-enter the conductor round protocol (skills/conductor): pick next feature via ship-state.mjs next, run the implementer/evaluator pair, update state.`,
      }) + '\n'
    );
    process.exit(0);
  },
};

const { cmd, flags } = parseArgs(process.argv.slice(2));
if (!cmd || !cmds[cmd]) fail(`usage: ship-state.mjs <${Object.keys(cmds).join('|')}> [--flags]`);
cmds[cmd](flags);
