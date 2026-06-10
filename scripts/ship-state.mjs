#!/usr/bin/env node
/**
 * ship-loop state engine. Zero dependencies.
 * Owns docs/ship-loop/feature_list.json (+ learnings.json, gate markers).
 * Every read and write revalidates the document (anti state-rot).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
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
   * Silent (exit 0, no output) in every situation except: an active, unpaused,
   * unfinished run with fresh state — then it emits {"decision":"block"} so the
   * conductor keeps looping. Three consecutive identical states = stall →
   * escalate to NEEDS_HUMAN.md and allow the stop.
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
