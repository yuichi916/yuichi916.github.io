#!/usr/bin/env bash
# Stop hook — runs at session end. Quick sanity scan of niwa.html for
# duplicate-declaration bugs (caught makeBridge/makeTelescope/makeFountain
# collisions previously). Logs warnings to .claude/last-stop.log so the
# audit trail is preserved.
set -u
LOG_DIR="$(dirname "$0")/.."
LOG_FILE="$LOG_DIR/last-stop.log"
NIWA="$LOG_DIR/../niwa.html"
VAL="C:/tmp/check_dup_const.py"
if [ -f "$NIWA" ] && [ -f "$VAL" ]; then
  if ! python "$VAL" "$NIWA" >> "$LOG_FILE" 2>&1; then
    echo "WARN: niwa.html has duplicate-declaration issues — see $LOG_FILE" >&2
  fi
fi
exit 0
