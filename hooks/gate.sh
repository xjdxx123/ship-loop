#!/usr/bin/env bash
# ship-loop Stop-hook gate. Delegates everything to the state engine, which
# exits 0 silently unless the session cwd has an ACTIVE, unpaused, unfinished
# ship-loop run. This script must never disturb unrelated sessions.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
exec node "$ROOT/scripts/ship-state.mjs" stop-hook
