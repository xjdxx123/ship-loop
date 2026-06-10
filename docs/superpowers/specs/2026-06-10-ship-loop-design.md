# ship-loop v1 — Design Spec

Date: 2026-06-10
Status: Approved (4 design iterations with owner)
Repo: https://github.com/xjdxx123/ship-loop (public, MIT)

## 1. Positioning

A Claude Code plugin. The user runs `/ship "<vague idea | path/to/PRD.md>"`. A human-rich
design phase produces a frozen document set; then an autonomous loop designs features,
implements them, discovers its own bugs, fixes them, verifies adversarially, and ships a
commercializable product — deploying for real when API keys are present.

One-line vs. alternatives: official `/goal` is a loop *mechanism*; ship-loop is a loop
mechanism **plus the production harness around it** (contract negotiation, adversarial
evaluation, state engine, capability routing, commercialization delivery).

Philosophy (carried from owner's v0): **the human owns ~100% of design; the machine owns
100% of the build.** Design-phase question density is what makes build-phase autonomy safe.

Architecture lineage: Anthropic's long-running-agents harness (initializer + fresh-context
worker loop + adversarial generator/evaluator + contract negotiation + file-system state)
and cobusgreyling/loop-engineering's operational discipline (maturity levels, failure
catalog, budgets, kill switches).

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Form factor | Claude Code **plugin** (commands + agents + skills + hooks + scripts) |
| Runtime | Claude Code first; runner/prompt seam kept clean for future adapters |
| Loop mechanism | **Layered loop** (Scheme C, below) |
| Commercialization boundary | **Aggressive keys-unlock**: official-source skills auto-install; live keys trigger real deployment automatically; the only standing human gate is *executing real-money payments* |
| Parallelism | `max_parallel_pairs` default 3; cap `min(8, floor((cores-2)/2))` pairs; burst mode delegates big independent batches to a Workflow script |
| License / distribution | MIT; install via `claude plugin` marketplace or git clone |

## 3. Phase 0 — Design Intake (human-rich) → FREEZE GATE

`/ship` detects one of three intake paths. All three converge on the **same frozen document
set**; `feature_list.json` is always *mechanically derived from documents, never directly
from conversation*. Documents are the single source of truth.

### Path 1 — Greenfield (input is a vague idea): document cascade

```
brainstorm (Socratic, one question at a time, no question cap)
  → product questions  → PRD.md          (human approves)
  → tech questions     → TECH_SPEC.md    (human approves)
  → taste questions    → DESIGN_SPEC.md  (human approves)
  → run parameters     → BUILD_CHARTER.md (human approves)
  → initializer derives → feature_list.json (human skims)
  → FREEZE GATE → loop starts
```

- If `superpowers:brainstorming` is installed, use it (capability routing). Otherwise the
  plugin's built-in `design-intake` skill runs an equivalent staged question flow
  (purpose/users/constraints/success metrics/stack preference/business model),
  multiple-choice preferred.
- Questions are staged per document so the human's context never switches back and forth.

### Path 2 — Brownfield (existing MVP in cwd): audit first, then directional questions

- Detection signals: git history + manifest (package.json etc.) + runnable entry. Confirm
  with the user before entering refinement mode.
- **Audit before questions**: triage agent reads the codebase, actually runs the app,
  screenshots core flows (failure to run is itself finding #1) → `CURRENT_STATE.md`.
- Then directional questions, informed by the audit: refinement goals (perf / UX / feature
  gaps / monetization), no-touch zones, user-behavior signals to protect, quantified
  success criteria.
- Output: `REFINEMENT_PRD.md` (delta-PRD), TECH_SPEC extracted from reality + change
  decisions only, feature_list entries tagged `type: fix|improve|new`. The existing test
  suite automatically becomes the regression floor.

### Path 3 — PRD given (input is a file path): gap questions only

Extract the PRD → diff against the four-document template set → ask **only** about holes
(missing acceptance criteria, missing non-goals, undecided stack) → confirm the completed
understanding. Never re-ask what the PRD already answers.

### The frozen document set and its runtime consumers

A document exists only if something consumes it at runtime:

| Document | Contents | Runtime consumer |
|---|---|---|
| PRD.md | what/for whom/why, success metrics, non-goals, business model | initializer (derives features); final evaluator panel (verifies intent) |
| TECH_SPEC.md | stack, architecture, data model, directory layout, key decisions + rationale | injected into every implementer sub-agent (kills intent debt) |
| DESIGN_SPEC.md | visual direction, reference sites, anti-examples (what AI slop looks like) | **evaluator's design/originality rubric calibrates from this** |
| BUILD_CHARTER.md | budget, boundaries, parallelism, commercialization keys, denylist | conductor run parameters |
| feature_list.json (derived) | task queue | the loop itself |
| ASSUMPTIONS.md (running log) | every bet the machine made on its own | human audit trail |

### Over-specification guard

TECH_SPEC fixes only decisions at the "changing this means half a day of rework" level —
stack, data model, directory layout, auth approach. It must NOT contain function
signatures, component breakdowns, or implementation routes; those belong to per-feature
contract negotiation. Test: wrong decision costs half a day → spec; costs five minutes →
leave it to the loop. (Anthropic workshop lesson: upstream detail errors cascade and
magnify over multi-hour horizons.)

### Freeze semantics

After FREEZE, the four documents are read-only to the loop (enforced via charter denylist).
If the build discovers a document-level error (e.g. the data model cannot support a
feature), the loop must NOT self-amend: it parks the item as `type: spec-conflict` and
escalates. A human edits the document and re-freezes; only then does the loop continue.
This is the enforcement mechanism of "human owns design, machine owns build."

### Degraded autonomous mode

`--autonomous` flag / `headless.sh` keeps the old fully-autonomous behavior (self-design,
all bets logged to ASSUMPTIONS.md) because unattended runs physically cannot ask questions.
README marks it clearly as a degraded mode: design quality is on the operator.

## 4. Phase 1 — Build Loop (autonomous)

Conductor (main session) runs rounds; one round = one feature's full lifecycle:

```
1 ship-state.mjs next            → next feature (topological order; bugs outrank features)
2 implementer sub-agent          → fresh context + isolated git worktree; drafts a
                                   "definition of done" contract proposal first
3 evaluator sub-agent            → negotiates the contract (≤2 rounds, via files on disk,
                                   contracts/F-xxx.md); acceptance is judged against the
                                   NEGOTIATED contract, not the planner's spec
4 implementer implements         → verification steps first, then code (TDD)
5 evaluator verdict              → MUST execute commands itself (tests/lint/run); MUST
                                   exercise UI via Playwright/Chrome MCP when UI exists;
                                   scores 4-dim rubric (design/originality/craft/
                                   functionality, calibrated from DESIGN_SPEC.md);
                                   structured verdict REQUIRES commandsRun[] and
                                   outputExcerpt (anti verifier-theater); default REJECT
6 pass → merge worktree, git commit, passes:true, append learnings.json
  fail → critique returns to implementer; K=3 circuit breaker
       → park (missing external precondition) or
       → reset (evaluator judges "cannot hill-climb" → tear down, re-decompose the feature)
7 evaluator findings (new bugs/gaps discovered while testing) → ship-state.mjs add
                                   (the feature list is ALIVE — this is autonomous
                                   problem discovery)
8 round-start smoke              → init.sh + test snapshot; red main → hotfix item
                                   inserted at top priority (CI-sweeper instinct, built in)
9 conductor context discipline   → at N rounds or token threshold, write HANDOFF.md,
                                   checkpoint, relay via cron
```

Parallelism: independent features run as parallel implementer/evaluator pairs (default 3
pairs, worktree isolation). **Burst mode**: when ≥8 independent pure-code features are
pending, conductor MAY delegate the batch to a Workflow script (queueing, journal, resume);
headless limitation respected — UI/browser verification always returns to the main loop.

Conductor discipline: never writes code, never reads large files; consumes state-file
summaries only (structured handoffs). Each feature gets a brand-new sub-agent context
(the plugin-world equivalent of "fresh context window per work item").

Flake handling: an intermittently failing test is classified `flake`, quarantined, never
"fixed" by changing business code.

## 5. Phase 2 — Ship (commercialization delivery)

1. All green → final panel: 3 evaluator votes attempt to refute "product meets PRD and is
   commercializable"; majority refute → back to the loop.
2. `.env` scan → keys present route through installed skills (capability routing):
   Vercel/Netlify/Cloudflare deploy, Supabase, Resend, Stripe. Stripe test key → automated
   test payments. Stripe live key → automated live configuration; **the single standing
   human gate: executing a real-money charge**.
3. Deliverables: live URL (when deployable), `launch-checklist.md`, `NEEDS_HUMAN.md`
   (remaining parked items with placeholders documented).
4. Operate handoff: generate `LOOP.md` + `STATE.md` + a suggested `/ship:operate` cron —
   the product leaves with its own maintenance loop attached.

## 6. The five subsystems (owner-named requirements)

- **Context handling**: lean conductor; fresh sub-agent contexts; skills' progressive
  disclosure; HANDOFF.md + cron relay across 5-hour usage windows (inherits v0 resume
  protocol: checkpoint only at feature boundaries, never mid-edit).
- **Agent scheduling**: conductor is the sole dispatcher; topological order + priority;
  dead/timed-out sub-agent → one redispatch → park. Roles: initializer / implementer /
  evaluator / triage.
- **Memory** (3 layers): task state (feature_list.json, contracts/, PROGRESS.md);
  experience (learnings.json — append-only, timestamped "tried X / pitfall Y / fix Z
  worked" breadcrumbs, relevant entries injected into implementer startup); cross-project
  (optional: detect claude-mem or user memory dir and write back distilled lessons —
  detection-based, never required).
- **Bug fix**: smoke at every round start; evaluator findings appended as `type: bug`
  outranking features; K=3 → park with diagnosis; flake quarantine.
- **Capability routing**: Phase 0 scans installed skills/plugins/MCP servers →
  `capability-map.md`; routing is category-based pattern matching, **no hardcoded plugin
  names** (public repo requirement). Gaps → suggest from the awesome-agent-skills catalog
  (VoltAgent); official-team sources (Anthropic, Vercel, Stripe, Supabase, Cloudflare…)
  auto-install per the aggressive boundary; third-party sources go to NEEDS_HUMAN. If the
  user has `/code-review` or `/security-review`, they are automatically added as extra
  acceptance lenses.

## 7. Error handling & safety

- Every state read/write passes schema validation (`ship-state.mjs`) — anti state-rot.
- Charter token/cost budget; conductor accounts per round; over budget → checkpoint, pause,
  NEEDS_HUMAN entry.
- **Stop-hook safety (plugin-critical)**: `gate.sh` line 1 checks for an active-run marker
  (`docs/ship-loop/ACTIVE`) in the session cwd and exits 0 instantly when absent — the
  plugin's hook must never interfere with unrelated sessions. Anti-spin: if the gate blocks
  twice with an unchanged feature_list hash, it allows the stop and writes an escalation.
- `/ship:pause` is the kill switch: removes relay cron, drops a `paused` marker.
- README honesty: expected cost magnitude ($single-digit to $200+/run depending on scope —
  workshop measured $200/6h for a full product), and "the loop amplifies judgment, good or
  bad."

## 8. Repo testing & dogfooding

- `ship-state.mjs` and the stop-hook logic carry unit tests (`node --test`); zero runtime
  dependencies.
- `scripts/validate-repo.mjs` checks: plugin.json valid, all frontmatter parseable, all
  cross-references between skills/commands/templates resolve, schema parses. Runs in CI.
- Real end-to-end (a tiny goal run) is a manual release gate; outcomes recorded in
  `stories/` (wins AND failures, with token cost — loop-engineering repo norm).
- Dogfood: this repo carries its own `LOOP.md` + `STATE.md` and a daily-triage GitHub
  Action (workflow_dispatch + schedule; skips gracefully without `ANTHROPIC_API_KEY`).

## 9. Repo layout

```
ship-loop/
├── .claude-plugin/plugin.json
├── commands/        ship.md, ship-status.md, ship-resume.md, ship-pause.md, ship-operate.md
├── agents/          initializer.md, implementer.md, evaluator.md, triage.md
├── skills/          conductor/ design-intake/ contract-negotiation/ adversarial-eval/
│                    capability-routing/ ship-deliver/
├── hooks/           hooks.json, gate.sh
├── scripts/         ship-state.mjs, relay.sh, headless.sh, validate-repo.mjs
├── templates/       PRD / TECH_SPEC / DESIGN_SPEC / BUILD_CHARTER templates,
│                    feature_list.schema.json, LOOP.md.template,
│                    launch-checklist.template.md, HANDOFF.template.md
├── test/            ship-state.test.mjs, stop-hook.test.mjs
├── docs/            architecture.md, failure-modes.md, superpowers/specs/, superpowers/plans/
├── stories/         README.md (+ dogfood run logs)
├── .github/workflows/  ci.yml, daily-triage.yml
├── LOOP.md  STATE.md  README.md  README.zh-CN.md  LICENSE  .gitignore
```

## 10. Risks (honest section)

- Parallel pairs are token-hungry; default parallelism stays conservative.
- Contract negotiation capped at 2 rounds to prevent haggling spirals.
- Plugin Stop hook coexistence with users' own hooks needs testing on real setups.
- `headless.sh`/`relay.sh` support macOS/Linux only in v1.
- Aggressive commercialization boundary means real cloud resources get created when keys
  exist; charter denylist + the live-charge human gate are the backstops.

## 11. Out of scope (v1)

Multi-runtime adapters (Codex/Gemini), cloud/Agent-SDK deployment of the harness itself,
web dashboard, multi-product portfolio management, Windows support for runner scripts.
