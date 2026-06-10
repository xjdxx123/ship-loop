#!/usr/bin/env bash
# ship-loop notify: best-effort human notification. Transport only — the CALLER owns
# the message. Body convention (DESIGN_SPEC): name the item, the file, and the next
# action; never "something needs your attention".
#
# usage: notify.sh <title> <body> | notify.sh --test
# env:   SHIP_LOOP_WEBHOOK  optional URL; adds a curl JSON POST after the desktop path
#
# Trigger points (who calls this):
#   1. gate budget-pause   scripts/ship-state.mjs stop-hook (via hooks/gate.sh)
#                          — wired by F-002, NOT here; this file stays caller-agnostic
#   2. NEEDS_HUMAN append  skills/conductor/SKILL.md, every new row
#   3. delivery handover   skills/ship-deliver/SKILL.md step 5
#
# Never fails the caller: every path exits 0, even when notification fails.

# Deliberately NO `set -e` (unlike relay.sh): no path here may abort the caller.

usage() {
  printf 'usage: notify.sh <title> <body> | notify.sh --test\n' >&2
}

# Escape for an AppleScript double-quoted string: backslash + double quote;
# newlines/CR flattened to spaces (the banner is single-line anyway).
osa_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/ }
  s=${s//$'\r'/ }
  printf '%s' "$s"
}

# Escape for a JSON string: backslash, double quote, newline, CR, tab.
json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

# Desktop path: try the detected transport; any failure (no GUI session, dead D-Bus)
# is suppressed and falls through to the dash-safe stderr echo. Always returns 0.
send_desktop() {
  local title=$1 body=$2 et eb
  case "$TRANSPORT" in
    osascript)
      et=$(osa_escape "$title")
      eb=$(osa_escape "$body")
      osascript -e "display notification \"$eb\" with title \"$et\"" >/dev/null 2>&1 && return 0
      ;;
    notify-send)
      notify-send -- "$title" "$body" >/dev/null 2>&1 && return 0
      ;;
  esac
  printf '[ship-loop notify] %s: %s\n' "$title" "$body" >&2
  return 0
}

# Optional webhook, additive after the desktop path; -m 5 bounds the wait and any
# failure is swallowed. Always returns 0.
send_webhook() {
  local title=$1 body=$2 ts payload
  [ "$WEBHOOK" = on ] || return 0
  ts=$(date -u +%FT%TZ)
  payload="{\"title\":\"$(json_escape "$title")\",\"body\":\"$(json_escape "$body")\",\"source\":\"ship-loop\",\"ts\":\"$ts\"}"
  curl -sS -m 5 -X POST -H 'Content-Type: application/json' -d "$payload" "$SHIP_LOOP_WEBHOOK" >/dev/null 2>&1
  return 0
}

# Arg parsing is positional and exact: --test only as the sole argument; two args are
# ALWAYS title+body (even a literal "--test" or dash-leading title); anything else
# prints the one-line usage to stderr — and still exits 0.
TEST=0
if [ $# -eq 1 ] && [ "$1" = "--test" ]; then
  TEST=1
  TITLE='ship-loop'
  BODY='notify self-test'
elif [ $# -eq 2 ]; then
  TITLE=$1
  BODY=$2
else
  usage
  exit 0
fi

# Platform detection: $OSTYPE is set by bash itself, so this needs no external
# binary and survives a stripped PATH (cron/hook contexts).
TRANSPORT=echo
case "$OSTYPE" in
  darwin*) command -v osascript >/dev/null 2>&1 && TRANSPORT=osascript ;;
  linux*) command -v notify-send >/dev/null 2>&1 && TRANSPORT=notify-send ;;
esac

WEBHOOK=off
[ -n "${SHIP_LOOP_WEBHOOK:-}" ] && command -v curl >/dev/null 2>&1 && WEBHOOK=on

send_desktop "$TITLE" "$BODY"
send_webhook "$TITLE" "$BODY"

[ "$TEST" -eq 1 ] && printf 'notify.sh self-test: path=%s webhook=%s\n' "$TRANSPORT" "$WEBHOOK"
exit 0
