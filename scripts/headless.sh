#!/usr/bin/env bash
# ship-loop headless runner: Ralph-style outer loop. Each iteration is a FRESH
# `claude -p` process (fresh context window) that re-enters the conductor via
# /ship:resume --autonomous. Exits when the state-engine gate passes or MAX iterations
# hit. Degraded mode: no human, all design bets logged to ASSUMPTIONS.md.
set -euo pipefail

DIR="${1:?usage: headless.sh <product_dir> [max_iterations]}"
MAX="${2:-25}"
DIR="$(cd "$DIR" && pwd)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/scripts/ship-state.mjs"

command -v claude >/dev/null 2>&1 || { echo "headless: claude CLI not found" >&2; exit 1; }
command -v node  >/dev/null 2>&1 || { echo "headless: node not found" >&2; exit 1; }

i=0
while true; do
  if node "$STATE" gate --dir "$DIR" >/dev/null 2>&1; then
    echo "headless: gate passed after $i iteration(s) — delivering"
    ( cd "$DIR" && claude --dangerously-skip-permissions -p "/ship:resume --autonomous" ) || true
    break
  fi
  i=$((i + 1))
  if [ "$i" -gt "$MAX" ]; then
    echo "headless: max iterations ($MAX) reached without gate pass — see docs/ship-loop/NEEDS_HUMAN.md" >&2
    node "$STATE" stats --dir "$DIR" || true
    exit 1
  fi
  echo "headless: iteration $i/$MAX (fresh context)"
  ( cd "$DIR" && claude --dangerously-skip-permissions -p "/ship:resume --autonomous" ) || \
    echo "headless: iteration $i exited non-zero; state engine will reconcile next round" >&2
  sleep 5
done

node "$STATE" stats --dir "$DIR"
