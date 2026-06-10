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
3. Read BUILD_CHARTER run parameters: `max_parallel_pairs`, `K`, `negotiation_rounds_max`,
   `burst_threshold`, `token_budget_day`, `handoff_after_rounds`.
4. Read `HANDOFF.md` if present (you are a relay leg, not a fresh start).
5. Run capability scan if `capability-map.md` is missing (skills/capability-routing).

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
   - PASS → merge worktree (`git -C "$PRODUCT_DIR" merge --no-ff ship/<id>`), remove
     worktree, `$SHIP set --id <id> --status passed --passes true`, commit; implementer's
     `lesson` → `$SHIP learn`.
   - REJECT → `$SHIP set --id <id> --bump-attempts --note "<evidence>"`; attempts < K →
     re-dispatch implementer with the verdict's evidence; attempts ≥ K → **park**
     (`--status parked`, entry in NEEDS_HUMAN.md with diagnosis) or — if the verdict says
     `recommendReset` — **reset**: discard the worktree, `--status reset`, dispatch
     initializer to re-decompose that feature into smaller ones. Move on either way;
     never spin on a single feature.
   - `parked[]` items from the implementer → NEEDS_HUMAN.md rows (the four categories:
     money / withheld-secret / irreversible / deadlock).
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
After delivery: remove `docs/ship-loop/ACTIVE`. Notify the human every 5 newly parked
items (count rows in NEEDS_HUMAN.md), at budget pause, and at delivery — otherwise stay quiet.
