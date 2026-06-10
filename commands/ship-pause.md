---
description: Pause the ship-loop run cleanly - kill switch for the loop, relay, and stop-hook gate
argument-hint: ""
---

Pause the ship-loop run in the current project. This is the kill switch; make it clean:

1. Disarm any pending relay: `bash "$CLAUDE_PLUGIN_ROOT/scripts/relay.sh" --disarm "$PWD"`.
2. Write `docs/ship-loop/PAUSED` (the Stop-hook gate stands down immediately; ACTIVE may
   stay — PAUSED outranks it).
3. Checkpoint: if any feature is `in_progress`, note its worktree state in
   `docs/ship-loop/HANDOFF.md` (one screen, templates/HANDOFF.template.md) so resume can
   reconcile. Commit state files.
4. Report: stats one-liner, parked count, where the baton is (HANDOFF), and that
   `/ship:resume` continues the run.

Do not delete worktrees or discard work — pause is reversible by design.
