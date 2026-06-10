---
name: design-intake
description: Phase 0 of ship-loop - turns a vague idea, an existing MVP, or a PRD into the frozen document set (PRD, TECH_SPEC, DESIGN_SPEC, BUILD_CHARTER) plus a derived feature_list.json, through a human-rich staged dialogue ending at the FREEZE GATE.
---

# Design Intake — human-rich Phase 0

Principle: **the human owns design; the machine owns the build.** Question density here
is what makes autonomy safe later. feature_list.json is ALWAYS derived from documents,
never directly from conversation — documents are the single source of truth.

## Mode detection (first action)
- `docs/ship-loop/` already holds frozen docs → **Path 2b: Iterate** (also the
  dedicated entry of `/ship:iterate`).
- Argument is a readable file path → **Path 3: PRD-given** (or the feedback list of
  Path 2b when iterate mode was detected).
- cwd has git history + a manifest (package.json/pyproject/etc.) + runnable entry →
  ask the user to confirm **Path 2: Brownfield refinement**.
- Otherwise → **Path 1: Greenfield**.
- `--autonomous` flag anywhere → degraded mode (below).

## Profile prefills (all paths, before the first question)
Read `~/.claude/ship-loop/profile/` if it exists:
1. Pending `proposals.md` entries → confirm each with ONE line ("Make pnpm the default?
   evidence: 3 products [y/n]"); apply accepted ones to their target files and append to
   `evolution.log`; a proposal rejected twice → mark `rejected-final`, stop re-proposing.
2. `intake-prefills.md` + `USER_PROFILE.md` → pre-fill stage questions and ask for
   confirmation instead of cold-asking. Prefills are offers, not decisions: **the
   project's explicit answer always overrides the profile** (local beats global).

## Path 1 — Greenfield: the document cascade
Stage questions per document so the human's context never switches back and forth.
If `superpowers:brainstorming` is installed (check with the Skill tool list /
capability-map), invoke it for the questioning style; otherwise run the built-in flow.
Either way: **one question at a time, multiple-choice preferred, no question cap —
ask until the document is solid.**

1. **Product stage** → write `docs/ship-loop/PRD.md` from templates/PRD.template.md.
   Must cover: who exactly, the pain, ≥2 quantified success metrics, user journeys,
   non-goals, business model, launch definition. → human approves.
2. **Tech stage** → `TECH_SPEC.md` from templates/TECH_SPEC.template.md. Respect the
   scope rule banner (half-day-rework decisions only). → human approves.
3. **Taste stage** → `DESIGN_SPEC.md` from templates/DESIGN_SPEC.template.md. Insist on
   ≥3 reference sites and product-specific anti-examples — this file calibrates the
   evaluator; a lazy one produces a mediocre product. → human approves.
4. **Run parameters** → `BUILD_CHARTER.md` from templates/BUILD_CHARTER.template.md
   (budgets, parallelism, denylist, keys present). → human approves.
5. Dispatch **ship-initializer** → feature_list.json. Show the human: total count +
   first 5 in execution order + all ASSUMPTIONS entries. Human skims.

## Path 2 — Brownfield: audit first, then direction
1. Dispatch **ship-triage** (Mode A) BEFORE asking anything → `CURRENT_STATE.md`.
2. Present the audit, then ask directional questions informed by it: refinement goals
   (perf / UX / feature gaps / monetization)? no-touch zones? user-behavior signals to
   protect? quantified success criteria? One at a time, until clear.
3. Write `REFINEMENT_PRD.md` (delta-PRD: what changes, what must not), extract
   TECH_SPEC from reality + change decisions only, DESIGN_SPEC as in Path 1.
4. Initializer derives the delta feature list (`type: fix|improve|new` via bug/feature
   types + notes). The existing test suite is the regression floor — record that in the
   charter denylist section.

## Path 2b — Iterate: a new campaign on a product with ship-loop history
Boundary one-liner: **operate** maintains health (patrol + small fixes), **iterate**
wages a new campaign (systematic dissatisfaction → delta docs → full build loop),
**ship** starts from zero.

1. **First-class input**: an optional feedback/complaint list (file path or pasted
   text) — user gripes, issue exports, the owner's "this feels wrong" notes.
2. **Reproduce first**: dispatch ship-triage on the list BEFORE any questions. Each
   reproduced complaint becomes a bug feature whose `verification` IS the repro steps
   (the fix-definition comes for free). Not reproduced → a cannot-reproduce list back
   to the human; unconfirmed complaints never enter the queue.
3. **Delta questions only**: read the existing frozen docs; ask only what changed —
   direction shifts, this round's quantified success criteria, no-touch zones. Never
   re-ask anything the docs already answer. Profile prefills apply here too.
4. **Amend, don't rewrite**: PRD gains `## Round N amendments` (date + motive);
   TECH_SPEC records change-decisions only; DESIGN_SPEC updates only if taste direction
   changed. Re-freeze. Prior `contracts/` and passed features remain untouched — they
   are the regression floor and the audit history.
5. Derive the delta feature list (initializer appends; existing ids never reused),
   FREEZE GATE as usual, then conductor.

## Path 3 — PRD-given: gap questions only
Read the user's PRD → diff against the four templates → ask ONLY about holes (missing
acceptance criteria, missing non-goals, undecided stack, absent design direction).
Never re-ask what their document already answers. Confirm your completed understanding,
then write the four files (quoting their PRD verbatim where possible) and derive.

## FREEZE GATE (all paths converge here)
Present: the four documents + feature count + first-5 execution order + open
ASSUMPTIONS + the cost estimate (protocol below). Say exactly what autonomy means now:
"After freeze I stop asking questions. Blockers get parked to NEEDS_HUMAN.md, frozen
docs are read-only to the loop (spec-conflicts come back to you), and the standing
human gate is real-money charges. Build will run unattended: confirm auto-approval is
armed — auto mode, bypassPermissions, or an allowlist covering Bash/Edit/Write/Agent —
or expect the loop to stall on the first prompt. Reply **go** to start the build."
On go: create `docs/ship-loop/ACTIVE`, hand off to skills/conductor.

### Cost estimate (quoted with the gate, before go — never after)
1. **Count**: N = `.total` from `node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" stats
   --dir "$PWD"` — the derived feature_list.json is the only count source, never a hand
   count (stats always exits 0 on a readable list — the exit-1-until-done behavior
   belongs to gate; read stdout).
2. **History**: `~/.claude/ship-loop/profile/cost-history.json` — an append-only JSON
   array of `{product, features_done, est_tokens_total, ts}`, one record per delivered
   run, appended by the retrospective (skills/retrospect) from loop-run-log accounting
   lines. Usable record: `features_done` ≥ 1 and `est_tokens_total` ≥ 1, both finite.
3. **≥2 usable records**: per-run rate `r = est_tokens_total / features_done`; sort the
   rates ascending; median `R` = the middle value (even count: mean of the two middle).
   Quote, figures rounded to 2 significant digits: "~N×R tokens (N features × ~R
   tokens/feature, median of K runs; range N×min(r)–N×max(r))", plus "≈ D charter-days"
   (D = N×R / `token_budget_day`, 1 decimal) when the charter carries that row.
4. **Fewer than 2 usable records** (first run; file missing, unreadable, or malformed —
   fall back, never crash): say verbatim "no history yet: comparable harnesses measured
   ~$200 / 6 hours for a full product; small tools land in single-digit dollars" (the
   README Cost-honesty number).
5. Either branch, add the pace guess, labeled as one: ~2 implementer/evaluator turns per
   feature, ~10–30 min wall clock per feature (N×10–N×30 min total) — a guess, not a
   commitment.
6. Close verbatim: "This estimate is an offer, not a meter — real metering is the gate's
   job: `ship-state.mjs cost` totals (F-001) against the charter `token_budget_day`
   hard-stop (F-002)."

### Permissions preflight (asked at the gate — no skill can read the mode)
The Stop-hook gate keeps the SESSION alive; a tool-permission prompt stops the
individual TOOL CALL — under default permission mode an unattended build stalls on a
confirmation dialog nobody will click (the most common unattended failure, ahead of
budget burn). No skill can read the session's permission mode, so the preflight is two
halves: the gate sentence above (the human confirms before go) and an observable probe
at conductor entry (skills/conductor entry checklist, the permissions-probe step) that
detects a prompting session from inside. Note `acceptEdits` auto-approves file edits
only — Bash still prompts; the conductor probe catches exactly that misread. Headless
paths are pre-armed: `scripts/headless.sh` and `scripts/relay.sh` pass
`--dangerously-skip-permissions` on every `claude` invocation.

## Degraded autonomous mode (--autonomous / headless)
No human available: self-answer every stage using prior-art search + defaults, log every
bet as an ASSUMPTIONS.md entry, skip approvals, auto-freeze, start. This is a degraded
mode — design quality is on the operator. Never silently enter it: log loudly at start.
