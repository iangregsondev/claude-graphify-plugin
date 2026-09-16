# Sourced by every graphify hook, never run directly.
#
# The order is the contract: each check is cheaper than the next, and a repo that
# does not use graphify leaves at the first or second one without a trace. Only a
# repo with a graph reaches the jq check, so only that repo can ever see a warning.
#
# Sets GRAPHIFY_ROOT for the caller. Returns 1 when the hook should do nothing.

GRAPHIFY_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

graphify_guard() {
  command -v graphify >/dev/null 2>&1 || return 1
  [ -f "$GRAPHIFY_ROOT/graphify-out/graph.json" ] || return 1
  return 0
}

graphify_have_jq() {
  command -v jq >/dev/null 2>&1
}

# The PreToolUse reminder, shared so Read-tool and shell reads see the same words.
graphify_nudge() {
  jq -n '{hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: "This repo has a graphify graph. For structural or overview questions (what calls X, what depends on Y, how A reaches B, how the repo fits together) prefer `graphify query`, `graphify explain`, `graphify path`, `graphify affected` or `graphify god-nodes` over reading and searching files. Files edited this session: Read them directly."
  }}'
}
