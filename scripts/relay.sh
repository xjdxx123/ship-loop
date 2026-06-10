#!/usr/bin/env bash
# ship-loop relay: survive the usage window by scheduling an automatic /ship:resume.
# Strategy: a crontab line (marked, idempotent) ticks every 30 minutes; the tick fires
# /ship:resume once `now >= armed epoch` and the run is ACTIVE and not PAUSED, then
# disarms itself. macOS/Linux only.
set -euo pipefail

usage() {
  echo "usage: relay.sh --arm <product_dir> <resume_epoch> | --tick <product_dir> | --disarm <product_dir>" >&2
  exit 1
}

[ $# -ge 2 ] || usage
MODE="$1"
DIR="$(cd "$2" && pwd)"
SD="$DIR/docs/ship-loop"
MARK="# ship-loop-relay $DIR"
SELF="$(cd "$(dirname "$0")" && pwd)/relay.sh"

current_cron() { crontab -l 2>/dev/null || true; }

case "$MODE" in
  --arm)
    [ $# -eq 3 ] || usage
    EPOCH="$3"
    mkdir -p "$SD"
    echo "$EPOCH" > "$SD/.relay-at"
    if ! current_cron | grep -qF "$MARK"; then
      ( current_cron; echo "*/30 * * * * /usr/bin/env bash \"$SELF\" --tick \"$DIR\" $MARK" ) | crontab -
    fi
    echo "relay armed: will resume $DIR after $(date -r "$EPOCH" 2>/dev/null || date -d "@$EPOCH" 2>/dev/null || echo "epoch $EPOCH")"
    ;;
  --tick)
    [ -f "$SD/.relay-at" ] || exit 0
    NOW=$(date +%s)
    AT=$(cat "$SD/.relay-at")
    [ "$NOW" -ge "$AT" ] || exit 0
    [ -f "$SD/ACTIVE" ] || { "$SELF" --disarm "$DIR"; exit 0; }
    [ -f "$SD/PAUSED" ] && { "$SELF" --disarm "$DIR"; exit 0; }
    "$SELF" --disarm "$DIR"
    cd "$DIR"
    command -v claude >/dev/null 2>&1 || { echo "$(date -u +%FT%TZ) relay: claude CLI not on cron PATH" >> "$SD/relay.log"; exit 1; }
    echo "$(date -u +%FT%TZ) relay: resuming" >> "$SD/relay.log"
    claude --dangerously-skip-permissions -p "/ship:resume" >> "$SD/relay.log" 2>&1 || \
      echo "$(date -u +%FT%TZ) relay: resume exited non-zero" >> "$SD/relay.log"
    ;;
  --disarm)
    rm -f "$SD/.relay-at"
    if current_cron | grep -qF "$MARK"; then
      current_cron | grep -vF "$MARK" | crontab -
    fi
    echo "relay disarmed for $DIR"
    ;;
  *) usage ;;
esac
