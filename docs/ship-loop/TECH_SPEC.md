# TECH SPEC — ship-loop (dogfood run)

> Frozen document. Architecture baseline: `docs/superpowers/specs/2026-06-10-ship-loop-design.md`.
> This file records Round-2 change decisions only.

## Round 2 decisions

### Language: JavaScript with checked types (NOT a TypeScript migration)
Decision: keep zero-dependency `.mjs` + add `// @ts-check` + JSDoc annotations; CI runs
`npx tsc --noEmit` (typescript is a CI-only tool, never a runtime or install dep).
Rationale (half-day-rework class): the plugin's contract is "git clone → runs on bare
Node 20+, hook executes instantly on every session stop" — a build step, committed
dist/, or a loader breaks that. The deterministic core is ~450 lines guarded by runtime
schema validation (which types cannot replace for external JSON) and 13 tests. Revisit
when the engine exceeds ~2k lines or gains external contributors.

### Cost accounting source of truth
The Stop hook already receives `transcript_path` in its stdin JSON. The session
transcript is JSONL whose assistant entries carry `message.usage` token counts.
New `ship-state.mjs cost` parses a transcript (tolerant: skip lines without usage),
returns cumulative input/output/total tokens. The stop-hook gains budget enforcement:
cumulative total > charter `token_budget_day` → write NEEDS_HUMAN escalation + create
`PAUSED` + allow stop (a paused run also disarms relay necromancy by existing rule).
Charter value reaches the hook via `docs/ship-loop/BUILD_CHARTER.md` parse of the
`token_budget_day` row (single source: the frozen charter).

### Notifications
`scripts/notify.sh <title> <body>`: `osascript` on darwin, `notify-send` on linux,
echo fallback; optional `SHIP_LOOP_WEBHOOK` env → curl JSON POST. No new deps.
Trigger points: gate budget-pause, conductor NEEDS_HUMAN appends (every new row, not
every 5th — notification replaces the old in-session counter), ship-deliver handover.

### PR merge mode
`BUILD_CHARTER` gains `merge_strategy: merge | pr` (default `merge`). In `pr` mode the
conductor pushes `ship/<id>` and runs `gh pr create` with the evaluator verdict
(evidence + commandsRun excerpt) as body; the feature is `passed` when the PR is
created — merging is the human's (or CI's) act. Rollback in pr mode = close PR.

### Rollback
`/ship:rollback <id>`: `git revert -m 1 <merge-commit>` (found via the feature id in
commit messages), `ship-state.mjs set --id <id> --status pending --note "rolled back"`,
append a learning. No engine changes needed beyond what exists.

### Directory/layout, stack, conventions
Unchanged from baseline.
