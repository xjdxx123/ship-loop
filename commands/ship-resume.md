---
description: Resume an interrupted ship-loop build from its checkpoint (relay leg, crash, or new session)
argument-hint: "[--autonomous]"
---

Resume the ship-loop run in the current project: $ARGUMENTS

1. Preconditions: `docs/ship-loop/feature_list.json` exists and validates
   (`node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" validate --dir "$PWD"`). Missing →
   nothing to resume; point to `/ship`. If `PAUSED` exists, remove it (resuming
   un-pauses); ensure `ACTIVE` exists.
2. Read the baton, in order: `docs/ship-loop/HANDOFF.md` (next action + in-flight
   worktrees), the last 5 lines of `loop-run-log.md`, then
   `ship-state.mjs next --count 3` for what is eligible now.
3. Reconcile in-flight worktrees listed in HANDOFF: a worktree with committed work →
   re-dispatch its evaluator; an empty/dirty one → remove it and reset the feature to
   pending.
4. Re-enter `skills/conductor` at the round protocol and continue until the gate passes.
   `--autonomous` carries through to any intake-level questions (degraded mode: decide,
   log to ASSUMPTIONS.md, continue).
5. If the gate already passes, go straight to `skills/ship-deliver`.
