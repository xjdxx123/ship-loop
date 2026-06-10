#!/usr/bin/env node
/**
 * Structural validator for the ship-loop plugin repo. CI gate.
 * Checks manifests, frontmatter, executability, and cross-references.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const ok = (label) => process.stdout.write(`  ok ${label}\n`);
const err = (msg) => errors.push(msg);

function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return fields;
}

// 1. plugin.json
try {
  const p = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  for (const k of ['name', 'version', 'description']) if (!p[k]) err(`plugin.json missing ${k}`);
  ok('plugin.json');
} catch (e) {
  err(`plugin.json: ${e.message}`);
}

// 2. commands + agents frontmatter
for (const dir of ['commands', 'agents']) {
  const d = join(ROOT, dir);
  if (!existsSync(d)) {
    err(`${dir}/ missing`);
    continue;
  }
  for (const f of readdirSync(d).filter((x) => x.endsWith('.md'))) {
    const fm = frontmatter(join(d, f));
    if (!fm) err(`${dir}/${f}: no frontmatter`);
    else if (!fm.description) err(`${dir}/${f}: frontmatter missing description`);
  }
  ok(`${dir}/ frontmatter`);
}

// 3. skills frontmatter
const skillsDir = join(ROOT, 'skills');
const skillNames = new Set();
if (!existsSync(skillsDir)) err('skills/ missing');
else {
  for (const s of readdirSync(skillsDir).filter((x) => statSync(join(skillsDir, x)).isDirectory())) {
    const p = join(skillsDir, s, 'SKILL.md');
    if (!existsSync(p)) {
      err(`skills/${s}/SKILL.md missing`);
      continue;
    }
    const fm = frontmatter(p);
    if (!fm || !fm.name || !fm.description) err(`skills/${s}/SKILL.md: frontmatter needs name+description`);
    skillNames.add(s);
  }
  ok('skills/ frontmatter');
}

// 4. schema parses
try {
  JSON.parse(readFileSync(join(ROOT, 'templates', 'feature_list.schema.json'), 'utf8'));
  ok('feature_list.schema.json');
} catch (e) {
  err(`feature_list.schema.json: ${e.message}`);
}

// 5. hooks wiring
try {
  const h = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  if (!h.hooks || !h.hooks.Stop) err('hooks.json: no Stop hook registered');
  const gate = join(ROOT, 'hooks', 'gate.sh');
  if (!existsSync(gate)) err('hooks/gate.sh missing');
  else if (!(statSync(gate).mode & 0o111)) err('hooks/gate.sh not executable');
  ok('hooks wiring');
} catch (e) {
  err(`hooks.json: ${e.message}`);
}

// 6. runner scripts executable
for (const s of ['relay.sh', 'headless.sh']) {
  const p = join(ROOT, 'scripts', s);
  if (!existsSync(p)) err(`scripts/${s} missing`);
  else if (!(statSync(p).mode & 0o111)) err(`scripts/${s} not executable`);
}
ok('runner scripts');

// 7. cross-references: skills mentioned in commands exist; templates mentioned in skills exist
const refErrors = [];
if (existsSync(join(ROOT, 'commands'))) {
  for (const f of readdirSync(join(ROOT, 'commands')).filter((x) => x.endsWith('.md'))) {
    const text = readFileSync(join(ROOT, 'commands', f), 'utf8');
    for (const m of text.matchAll(/skills\/([a-z-]+)\b/g)) {
      if (!skillNames.has(m[1])) refErrors.push(`commands/${f} references unknown skill ${m[1]}`);
    }
  }
}
if (existsSync(skillsDir)) {
  for (const s of skillNames) {
    const text = readFileSync(join(skillsDir, s, 'SKILL.md'), 'utf8');
    for (const m of text.matchAll(/templates\/([A-Za-z0-9_.-]+)/g)) {
      if (!existsSync(join(ROOT, 'templates', m[1]))) refErrors.push(`skills/${s} references missing templates/${m[1]}`);
    }
  }
}
refErrors.forEach(err);
if (!refErrors.length) ok('cross-references');

// 8. required docs
for (const f of ['README.md', 'LICENSE', 'LOOP.md', 'STATE.md', 'docs/architecture.md', 'docs/failure-modes.md']) {
  if (!existsSync(join(ROOT, f))) err(`${f} missing`);
}
ok('required docs');

if (errors.length) {
  process.stderr.write(`\nFAIL (${errors.length}):\n  ${errors.join('\n  ')}\n`);
  process.exit(1);
}
process.stdout.write('\nvalidate-repo: all checks passed\n');
