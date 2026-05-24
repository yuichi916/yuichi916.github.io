#!/usr/bin/env bash
# PostToolUse hook for Write — BLOCK if a file just written contains a
# token that looks like an API key. The grep patterns intentionally match
# only well-known prefixes; refine as needed.
set -u
if echo "${TOOL_INPUT:-}" | grep -qE '(sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})'; then
  echo "BLOCK: Possible API-key shaped token detected in written file" >&2
  exit 1
fi
exit 0
