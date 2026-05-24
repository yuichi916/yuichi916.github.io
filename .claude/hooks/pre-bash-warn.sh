#!/usr/bin/env bash
# PreToolUse hook for Bash. The dangerous-command patterns
# (rm -rf, sudo, dd, mkfs, curl|sh, ...) are already in deny[] in
# settings.json — this hook just exists so future audit can hang on it.
# Exit 0 always.
exit 0
