#!/usr/bin/env bash
# SessionStart: put the graphify guidance into context — the job the CLAUDE.md
# section from `graphify claude install` would do, without touching shared files.
#
# The one hook that speaks when jq is missing. It fires once per session, so the
# warning is seen once rather than on every tool call; the other hooks skip quietly.

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=guard.sh
. "$here/guard.sh"

graphify_guard || exit 0

if ! graphify_have_jq; then
  # A fixed string, because the tool that would build the JSON is the one missing.
  echo '{"systemMessage":"graphify plugin: jq not found, so the graphify hooks are off for this session. Install jq (brew install jq, or apt install jq) and restart."}'
  exit 0
fi

jq -n --rawfile context "$here/../context/graphify.md" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $context}}'
