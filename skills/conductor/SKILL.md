---
name: conductor
description: The ship-loop build-phase round protocol. Use after FREEZE to run the autonomous loop - dispatching implementer/evaluator pairs, keeping state, never writing code in the main session.
---

# Conductor — the build loop

You are the conductor. You schedule, you keep state, you decide. You NEVER write
product code, never edit product files, and never read large source files in this
session — implementers implement, evaluators evaluate, you conduct. Your context is
the scarcest resource in the system; spend it on state summaries only (structured
handoffs beat shared context).

`$SHIP` below = `node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs"` with `--dir "$PRODUCT_DIR"`.

## Entry checklist (once per session)
1. Frozen docs exist (PRD/TECH_SPEC/DESIGN_SPEC/BUILD_CHARTER in `docs/ship-loop/`) and
   `feature_list.json` validates (`$SHIP validate`). Missing → back to skills/design-intake.
2. Touch the marker: `docs/ship-loop/ACTIVE` (this arms the Stop-hook gate). Remove any `PAUSED`.
3. **Permissions probe** — the Stop-hook gate keeps the SESSION alive, but a
   tool-permission prompt stops the individual TOOL CALL; no skill can read the
   permission mode, only observe it. Run one harmless Bash no-op:
   `touch docs/ship-loop/.preflight && rm docs/ship-loop/.preflight`. If that call
   required manual approval just now, auto-approval is NOT armed — warn the human at
   the gate, now, instead of discovering it at round 3: "permission prompts are live;
   unattended, this run stalls at the first prompt. Arm auto-approval (bypassPermissions
   or an allowlist covering Bash/Edit/Write/Agent) or stay at the keyboard." Whoever
   approved the probe is present to read it; then continue. No prompt → auto-approval
   is armed; proceed. Headless and relay legs are pre-armed: `scripts/headless.sh` and
   `scripts/relay.sh` pass `--dangerously-skip-permissions`.
4. Read BUILD_CHARTER run parameters: `max_parallel_pairs`, `K`, `negotiation_rounds_max`,
   `burst_threshold`, `token_budget_day`, `handoff_after_rounds`, `merge_strategy`
   (`merge` or `pr`; row absent = `merge`). If
   `~/.claude/ship-loop/profile/charter-defaults.json` exists, merge it UNDER the
   charter (the frozen charter always wins; the profile only fills holes).
5. Read `HANDOFF.md` if present (you are a relay leg, not a fresh start).
6. Run capability scan if `capability-map.md` is missing (skills/capability-routing).

## The round (repeat until gate passes)

1. **Smoke**: `bash init.sh` boots + quick test snapshot. Red main → dispatch triage
   agent (Mode B); its regressions enter the list as `hotfix` (they outrank everything).
2. **Select**: `$SHIP next --count <max_parallel_pairs>`. Empty but features remain →
   everything is blocked or parked: write the blockage summary to NEEDS_HUMAN.md and stop.
3. **Dispatch pairs** (independent features only, one Agent call batch): per feature,
   create a worktree (`git worktree add ../wt-<id> -b ship/<id>`), mark
   `$SHIP set --id <id> --status in_progress`, dispatch **ship-implementer** with:
   feature object + worktree path + contract path. First dispatch is the contract
   proposal leg (skills/contract-negotiation) unless a contract already exists.
4. **Negotiate**: route the proposal to **ship-evaluator**; max `negotiation_rounds_max`
   rounds; agreed contract lands at `docs/ship-loop/contracts/<id>.md`.
5. **Build + verdict**: implementer builds under contract; evaluator verifies
   (skills/adversarial-eval). Discard any verdict with empty `commandsRun` and re-dispatch
   the evaluator once with a warning.
6. **Apply verdict**:
   - PASS → apply the charter's `merge_strategy`:
     - `merge` (default) → merge worktree (`git -C "$PRODUCT_DIR" merge --no-ff ship/<id>`),
       remove worktree.
     - `pr` → push the branch (`git -C "$PRODUCT_DIR" push -u origin ship/<id>`), then
       `gh pr create --head ship/<id> --title "<id>: <feature title>" --body "<verdict>"`
       where `<verdict>` is the evaluator verdict: the PASS line, its evidence, and a
       `commandsRun` excerpt — never a bare LGTM. The feature is `passed` at PR creation;
       merging is the human's (or CI's) act. Remove the worktree (the branch lives on
       origin). Rollback in pr mode = `gh pr close ship/<id>` + delete the branch —
       nothing merged, nothing to revert. No `gh` or no `origin` remote → park
       (withheld-secret), never silently fall back to `merge`.
       - Dependent gating: `passed` flips `passes: true`, so `$SHIP next` rightly
         starts offering this feature's dependents — but their worktrees branch from
         main (Dispatch pairs), and main lacks the unmerged PR. Hold them: at Select,
         filter the `$SHIP next` output — do NOT dispatch a feature whose `depends_on`
         names a pr-passed feature until, for each such dependency,
         `gh pr view ship/<dep-id> --json state` shows `MERGED`; anything else (OPEN,
         CLOSED, no `gh` answer) → treat the unmerged dependency as still-blocking.
         On `MERGED`, sync first (`git -C "$PRODUCT_DIR" pull --rebase`) so worktrees
         branch from a main that contains the dependency. The filter is conductor
         judgment — the engine's `next()` gates on `passes` by design; do not patch
         it. A hold that empties the round is Select's blockage case; the summary
         names the PRs awaiting merge. Advanced users may stack by hand (worktree off
         `ship/<dep-id>`), accepting that a squashed or rebased dependency PR orphans
         the stack; the loop never stacks.
     Either path: `$SHIP set --id <id> --status passed --passes true`, commit;
     implementer's `lesson` → `$SHIP learn`.
   - REJECT → `$SHIP set --id <id> --bump-attempts --note "<evidence>"`; attempts < K →
     re-dispatch implementer with the verdict's evidence; attempts ≥ K → **park**
     (`--status parked`, entry in NEEDS_HUMAN.md with diagnosis) or — if the verdict says
     `recommendReset` — **reset**: discard the worktree, `--status reset`, dispatch
     initializer to re-decompose that feature into smaller ones. Move on either way;
     never spin on a single feature.
   - `parked[]` items from the implementer → NEEDS_HUMAN.md rows (the four categories:
     money / withheld-secret / irreversible / deadlock). Every appended row fires one
     notify.sh call — exact command in Exit.
   - `needsSpecialist` in the implementer's report → next round, re-dispatch that
     feature routed per skills/capability-routing (+ profile routing-overrides). You
     remain the sole dispatcher; the implementer only requests.
7. **Absorb findings**: every `newFindings` entry → `$SHIP add` (bugs priority-1). The
   feature list is alive; discovery is half the loop's value. Re-validate after adds.
8. **Account**: append one line to `docs/ship-loop/loop-run-log.md`:
   `<ISO-ts> | round N | done X/Y | parked P | new findings F | est tokens T`.
   Budget exceeded → checkpoint, write NEEDS_HUMAN note, pause (see below).
9. **Checkpoint discipline**: feature boundaries only — never pause mid-edit. Every
   passed feature is already a commit; update PROGRESS notes in the same commit.

## Burst mode
When `$SHIP next` shows ≥ `burst_threshold` independent **pure-code** features (no UI
verification), you MAY delegate that batch to one Workflow script (pipeline of
implement→verify per item) to exploit queueing + journal resume. UI-bearing features
NEVER go in a burst — browser verification happens in the main loop only.

## Relay (context discipline)
After `handoff_after_rounds` rounds OR when context feels heavy OR before a usage-window
pause: write `HANDOFF.md` (templates/HANDOFF.template.md — one screen max), commit, arm
the relay (`scripts/relay.sh --arm "$PRODUCT_DIR" <epoch+5h>`), and end the session
cleanly. The Stop-hook gate knows the difference between a stall and a relay because the
state hash changed this round.

## Exit
`$SHIP gate` passes (every feature passed|parked) → proceed to skills/ship-deliver.
After delivery: remove `docs/ship-loop/ACTIVE`. Notify on EVERY new NEEDS_HUMAN.md row
at append time (parked feature, blockage summary, or budget pause — one call per row):
`bash "$CLAUDE_PLUGIN_ROOT/scripts/notify.sh" "ship-loop: <id or gate> parked (<category>)" "NEEDS_HUMAN.md: <one-line next human action>"`.
The body always names the item, the file, and the next action — never a bare "needs
attention". The unattended budget gate notifies from the stop-hook (F-002); delivery
notification is owned by skills/ship-deliver. Otherwise stay quiet.
