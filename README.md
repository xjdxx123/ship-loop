# ship-loop

**One command from a vague idea (or a PRD) to a shipped, commercializable product.**

A [Claude Code](https://claude.com/claude-code) plugin implementing real loop
engineering: a human-rich design phase freezes intent into documents, then an autonomous
loop implements, *discovers its own bugs*, fixes them, verifies adversarially, and ships
— deploying for real when API keys are present.

[中文说明 → README.zh-CN.md](README.zh-CN.md)

```
/ship "a paid newsletter platform for niche podcasters"
        │
        ▼
  Phase 0 · Design Intake (human-rich)        Phase 1 · Build Loop (autonomous)
  ────────────────────────────────            ─────────────────────────────────
  staged questions → PRD.md                   conductor (never writes code)
                   → TECH_SPEC.md               ├─ worktree per feature
                   → DESIGN_SPEC.md             ├─ implementer ⇄ evaluator
                   → BUILD_CHARTER.md           │    contract first, then code,
  initializer → feature_list.json              │    then adversarial verdict
  FREEZE GATE (you say "go")                    ├─ findings → living feature list
                                                └─ Stop-hook gate: can't quit early
        ┌───────────────────────────────────────────────┘
        ▼
  Phase 2 · Ship
  ──────────────
  3-vote final panel → .env keys scan → real deploy + test payments
  → launch-checklist.md + NEEDS_HUMAN.md + LOOP.md (the product leaves
    with its own maintenance loop attached)
```

## Status: it built itself (v0.3.0)

The reference run for this plugin is this repo. v0.3.0 (the trust pack below) was built
BY ship-loop ON ship-loop: frozen docs, a freeze gate, then 8 autonomous conductor
rounds — **16/16 features passed, 7 of them discovered mid-run by the evaluators**
rather than planned (the living list grew 78%). Contract negotiation caught a real
regex bug before a line of code existed; an evaluator caught the fail-open that would
have blinded the budget gate on exactly the most expensive sessions. Receipts, not
claims: [the run story](stories/2026-06-10-v0.3.0-dogfood.md) — including the honest
part: the run exceeded its own charter budget 2×, because the budget gate was built
*during* the run and could not arm for it — plus all 16
[contracts](docs/ship-loop/contracts/) and the
[round-by-round log](docs/ship-loop/loop-run-log.md).

Versions: **v0.1** core loop (state engine, contracts, adversarial eval, Stop-hook
gate) · **v0.2** `/ship:iterate` + three-layer self-evolution · **v0.3** developer
trust pack (cost metering, budget hard-stop, notifications, PR mode, rollback,
permissions preflight).

Known-untested, honestly: the K=3 repair → park/reset circuit breaker and 3-vote panel
mode have fixture coverage but have never fired in a production run (16/16 were
first-attempt passes). The first run on an external product should watch both.

## Install

```bash
# from the Claude Code REPL
/plugin marketplace add xjdxx123/ship-loop
/plugin install ship-loop@ship-loop

# or clone and add as a local marketplace
git clone https://github.com/xjdxx123/ship-loop
/plugin marketplace add ./ship-loop
/plugin install ship-loop@ship-loop
```

Requires Claude Code ≥ 2.x and Node 20+. Browser verification uses your connected
Playwright/Chrome MCP when available, `npx playwright` otherwise.

## Use

| Command | What it does |
|---|---|
| `/ship "<idea>"` | greenfield: staged design dialogue → freeze → autonomous build |
| `/ship path/to/PRD.md` | PRD intake: asks only about the holes in your document |
| `/ship` in an existing repo | brownfield: audits your MVP first, then asks refinement direction |
| `/ship:status` | progress, parked items, budget, next action |
| `/ship:iterate [feedback.md]` | new campaign on a shipped product: complaints reproduced into bug features, delta questions only, re-freeze, build |
| `/ship:pause` / `/ship:resume` | clean kill switch / continue from checkpoint |
| `/ship:operate` | post-ship maintenance round (report-only first week) |
| `/ship:rollback <F-id> "<reason>"` | revert a delivered feature (pr mode: close its PR), reopen it as `pending`, record the learning |
| `scripts/headless.sh <dir>` | unattended Ralph-style outer loop (degraded design mode) |

## Walkthrough: your first run

1. **Start.** `cd` an empty directory (greenfield) or an existing repo (brownfield —
   it will audit before asking anything) and run `/ship "your idea"`. Restart your
   Claude Code session after install so the plugin's Stop hook arms.
2. **Answer the staged questions.** One document at a time, each ending in your
   approval: product questions → `PRD.md`; tech questions → `TECH_SPEC.md`; taste
   questions → `DESIGN_SPEC.md` — be opinionated here, this file literally calibrates
   the evaluator's rubric; run parameters → `BUILD_CHARTER.md` (budget, parallelism,
   `merge_strategy: merge|pr`). Profile prefills shorten this from your second run on.
3. **The freeze gate.** You see: the feature list derived from your documents, the
   first-5 execution order, a cost estimate (real medians once your profile holds ≥2
   delivery records; an honest fallback range before that), and the permissions ask —
   confirm auto-approval is armed or expect a stall on the first prompt. Reply **go**.
4. **Walk away.** The loop stops asking questions. You get a desktop notification (and
   optional `SHIP_LOOP_WEBHOOK` POST) only when something needs you: a parked item, a
   budget pause, a stall, or delivery. `/ship:status` any time for progress, parked
   items, and spend.
5. **Where everything lives** — the run is files, not chat history:

   ```
   docs/ship-loop/
   ├── PRD.md TECH_SPEC.md DESIGN_SPEC.md BUILD_CHARTER.md   # frozen — yours, loop reads only
   ├── feature_list.json     # the living queue (engine-owned; bugs outrank features)
   ├── contracts/F-xxx.md    # what "done" meant, per feature — the audit trail
   ├── learnings.json        # append-only lessons, injected into future implementers
   ├── loop-run-log.md       # append-only round accounting
   ├── NEEDS_HUMAN.md        # your action items (each row fired one notification)
   ├── HANDOFF.md            # the baton between conductor sessions
   └── ACTIVE / PAUSED       # lifecycle markers (gate and relay read these)
   ```

6. **If it pauses on budget:** review spend
   (`node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" cost --transcript <path>`),
   raise `token_budget_day` in `BUILD_CHARTER.md` (the charter is yours to edit — the
   loop may not touch it), then `rm docs/ship-loop/PAUSED` and `/ship:resume`.
7. **Delivery and after.** You get a one-screen handover with evidence, a
   `launch-checklist.md`, the final `NEEDS_HUMAN.md`, and a generated `LOOP.md` — the
   product leaves with its own maintenance loop. Then: `/ship:operate` on a schedule
   (report-only the first week), `/ship:iterate` with a complaint list when you want
   the next campaign, `/ship:rollback F-xxx "reason"` when something delivered needs
   to come back out.

## What makes it a *loop*, not a long prompt

- **Living feature list** — the evaluator actually uses your app (real browser, real
  commands) and every bug it finds becomes a new work item. The loop generates its own
  backlog: that is the "discovers problems" half of autonomy.
- **Contract negotiation** — before a line of code, the implementer and evaluator
  negotiate what "done" means, via files on disk, and acceptance is graded against that
  contract. A fixed plan has nobody arguing with it; this does.
- **Adversarial verification with evidence rules** — verdicts without executed commands
  (`commandsRun` + output excerpts) are structurally invalid. The builder never grades
  its own homework; the critic's default stance is REJECT.
- **Deterministic gate** — a script Stop-hook counts the JSON state and refuses to let
  the session declare victory while features remain. The judge runs `jq`-grade logic,
  not vibes. (Anti-spin: 3 stops with unchanged state → escalate to a human instead.)
- **State on the file system** — `feature_list.json` (JSON because models respect it
  more than markdown), append-only learnings, one-screen handoffs, git-committed
  checkpoints. Sessions are disposable; the run is not.
- **Frozen documents** — you own PRD/TECH_SPEC/DESIGN_SPEC/BUILD_CHARTER; the loop may
  not edit them. Spec-level conflicts come back to you. Human owns design, machine owns
  build.

## Commercialization boundary (read this)

ship-loop is **aggressive by default**: with keys in `.env` it really deploys
(Vercel/Netlify/Cloudflare), really provisions the database, really runs test-mode
payments, and really configures Stripe live mode. The single standing human gate is
**executing a real-money charge**. Official-org skills (Anthropic/Vercel/Stripe/
Supabase/Cloudflare/Netlify/Resend) auto-install from the
[awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) catalog when a
gap blocks work; third-party skills are only ever suggested. Everything the machine
couldn't or wasn't allowed to do lands in `NEEDS_HUMAN.md` with the exact action needed.

## Self-evolution (v0.2)

The loop learns from every run, at three layers with three risk postures:

| Layer | Travels with | What lives there | Autonomy |
|---|---|---|---|
| **L1 project** | the repo | this codebase's pitfalls (`learnings.json`) | automatic |
| **L2 profile** | you (`~/.claude/ship-loop/profile/`) | stack/taste/workflow preferences, charter defaults, learned routing | **proposal-first**: suggestions confirmed at your next intake; every applied change in an append-only `evolution.log` |
| **L3 community** | the ecosystem | protocol (human-PR only, never self-modified) + **[playbooks/](playbooks/)** — provider execution knowledge in SKILL.md format | drafts distilled locally after ≥2 verified deliveries; published by human PR |

A retrospective agent runs after every delivery: it reads the traces that already exist
(intake answers, run log, contract churn, verdicts, routing win-rates) and distills them
upward — one project's fact stays L1, a pattern across ≥2 products becomes an L2
proposal, a provider shipped twice becomes a playbook draft. Local always beats global;
prefills are offers, not decisions; the loop's own protocol is design, and the human
owns design.

The playbook pipeline is the compounding asset: official skills from
[awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) are consumed
first, real delivery evidence turns into provenance-stamped, secret-free playbooks
(validator-enforced), and every verified delivery makes the next one cheaper.

## Developer trust pack (v0.3)

Five mechanisms for handing an unattended loop your repo and your token budget — each
one shipped behavior you can read in this repo, none of it aspiration:

| Capability | What actually happens | Mechanism |
|---|---|---|
| **Cost metering** | `ship-state.mjs cost --transcript <path>` sums per-message `usage` token counts from the session transcript (JSONL) into five totals — input, output, cache read, cache creation, total — read in chunks, so transcripts past V8's ~512 MiB string cap still sum instead of failing to zeros. The Stop-hook gate runs the same sum against the charter's `token_budget_day`: over budget → `NEEDS_HUMAN.md` escalation row, `PAUSED` marker, one notification, stop allowed. Fail-open: a missing charter row or unreadable transcript means no enforcement, never a crashed session | [`scripts/ship-state.mjs`](scripts/ship-state.mjs) (`cost`, `stop-hook`) |
| **Notifications** | desktop banner (macOS `osascript`, Linux `notify-send`, stderr echo fallback) plus an optional `SHIP_LOOP_WEBHOOK` JSON POST — fired on every new `NEEDS_HUMAN.md` row, budget pause, stall, and delivery. Transport only: the body always names the item, the file, and the next action, and every path exits 0, so a failed notification never breaks the loop | [`scripts/notify.sh`](scripts/notify.sh) |
| **PR mode** | charter row `merge_strategy: pr` → a passed feature is pushed as `ship/<id>` and opened as a PR whose body is the evaluator's verdict (PASS line, evidence, `commandsRun` excerpt — never a bare LGTM). Merging stays the human's (or CI's) act; dependent features are held until the dependency's PR is `MERGED`. No `gh` or no `origin` remote → the feature parks, never a silent fallback to direct merge | [`skills/conductor/SKILL.md`](skills/conductor/SKILL.md) |
| **Rollback** | `/ship:rollback <F-id> "<reason>"` reverts the delivery merge (`git revert -m 1`; pr mode: close the PR — nothing merged, nothing to revert), reopens the feature as `pending` with `--passes false` so dependents stop counting it as satisfied, and records the learning. Refuses a dirty tree, never guesses a hash, never auto-resolves conflicts | [`commands/ship-rollback.md`](commands/ship-rollback.md) |
| **Permissions preflight** | the most common unattended failure is a tool-permission dialog nobody will click (the gate keeps the session alive; the prompt stops the tool call). Three-part mitigation: the freeze gate has you confirm auto-approval is armed before `go`, the conductor probes at entry with a harmless Bash no-op that exposes a prompting session, and headless/relay legs pass `--dangerously-skip-permissions` | [`skills/design-intake/SKILL.md`](skills/design-intake/SKILL.md) + [`skills/conductor/SKILL.md`](skills/conductor/SKILL.md) |

## Cost honesty

Loops are not cheap. Anthropic's comparable internal harness measured **~$200 / 6 hours**
for a full product build; small tools cost single-digit dollars. The charter carries a
daily token budget and the conductor accounts every round; over budget → checkpoint and
pause, never silent burn. Since v0.3 that budget is metered, not estimated:
`ship-state.mjs cost` sums real token usage from the session transcript, and the
Stop-hook gate hard-stops the run the moment the total exceeds the charter's
`token_budget_day` (mechanics in the trust pack above). What the money buys: a play
mode that actually plays, not one that "looks done." Read
[docs/failure-modes.md](docs/failure-modes.md) before your first unattended run.

### Using the budget

1. **Set** — one charter row: `| token_budget_day | 50000000 | ... |`. Separators are
   tolerated (`50,000,000`, `50_000_000`); `TBD`, `0`, or deleting the row disables
   enforcement (fail-open by contract — the gate never crashes a session).
2. **Calibrate (the part everyone gets wrong)** — the gate's unit is the *transcript
   total including cache reads*, an order of magnitude above "output tokens" intuition:
   cache reads dominate Claude Code session volume by design (the budget is a
   context/spend tripwire, not a billing invoice). Reference point: the 12-hour session
   that built v0.3.0 measured **187.8M total** by this meter. Calibrate empirically:
   run one normal session, measure it with `cost --transcript`, set the budget at 2–3×
   a healthy session's total. The template default is a placeholder, not a
   recommendation.
3. **Meter** — automatic: the Stop hook sums the session transcript at every stop.
   Honest boundaries: the count is per-transcript (relay legs across 5-hour windows
   each start a fresh count), and it meters the main session (sub-agent burn shows up
   indirectly, as main-context growth).
4. **Hard stop** — strictly over budget → one `NEEDS_HUMAN.md` row naming the numbers
   and the fix, a `PAUSED` marker (the relay self-disarms — no cron necromancy), one
   notification, and the stop is allowed: stopping is the safe direction when over
   budget. A paused run never stacks duplicate escalations.
5. **Resume** — review, raise the charter row, `rm docs/ship-loop/PAUSED`,
   `/ship:resume`. Three steps, all yours: the loop may not raise its own budget.

## vs. the alternatives

| | `/goal` | `/loop` | Ralph (`while true; claude -p`) | ultracode workflows | **ship-loop** |
|---|---|---|---|---|---|
| Loop driver | per-turn LLM check | timer | fresh process | one-shot DAG | deterministic state gate |
| Completion judge | small model reads chat | none | external script | script | **script counts JSON; evaluator ran the commands** |
| Work discovery | no | no | no | no | **yes (living feature list)** |
| Adversarial verify | no | no | no | optional | **structural (evidence rules)** |
| Design phase | no | no | no | no | **human-rich doc cascade** |
| Ships for real | no | no | no | no | **keys-unlocked deploy/payments** |

## Architecture & docs

- [docs/architecture.md](docs/architecture.md) — the layered loop, with lineage table
- [docs/failure-modes.md](docs/failure-modes.md) — 15 ways loops die and what's load-bearing here
- [docs/superpowers/specs/](docs/superpowers/specs/) — the full design spec this was built from
- [LOOP.md](LOOP.md) / [STATE.md](STATE.md) — this repo dogfoods its own operate phase
- [stories/](stories/) — honest run records (token cost required, failures welcome)

## Credits

The architecture stands on public work by **Boris Cherny** ("I don't prompt Claude
anymore… my job is to write loops"), **Peter Steinberger**, **Addy Osmani**
([Loop Engineering](https://addyosmani.com/blog/loop-engineering/)), **Anthropic's
applied-AI team** ([effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
and the AI Engineer workshop "Build Agents That Run for Hours"), **Geoffrey Huntley**
(the Ralph technique), and **Cobus Greyling**
([loop-engineering](https://github.com/cobusgreyling/loop-engineering) operational
discipline). MIT licensed.
