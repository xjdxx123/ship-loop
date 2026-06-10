---
description: Show the current ship-loop run - feature progress, parked items, budget, and the latest handoff
argument-hint: ""
---

Report the state of the ship-loop run in the current project, read-only:

1. `node "$CLAUDE_PLUGIN_ROOT/scripts/ship-state.mjs" stats --dir "$PWD"` — render the
   JSON as a one-line summary (done X/Y, in-progress, parked, open bugs, done?).
2. Markers: ACTIVE / PAUSED present in `docs/ship-loop/`? Say which mode the run is in.
3. Parked items: render the `NEEDS_HUMAN.md` table (if present) — these are the human's
   action items, ordered by unlock value.
4. Budget + history: tail the last 5 lines of `docs/ship-loop/loop-run-log.md`.
5. Relay: if `docs/ship-loop/.relay-at` exists, report when the run will auto-resume.
6. Current handoff: quote `docs/ship-loop/HANDOFF.md` "Next action" if present.

Do not modify any state. If `docs/ship-loop/` does not exist, say no run has been
started here and point to `/ship`.
