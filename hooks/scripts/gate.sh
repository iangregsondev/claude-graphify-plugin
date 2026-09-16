#!/usr/bin/env bash
# PreToolUse on Bash: refresh the graph before any command that reads it, and
# nudge towards the graph before a shell command that reads or searches files.
#
# The nudge exists because `cat`, `grep` and friends in Bash skip the Grep|Glob|Read
# matcher that nudge.sh hangs on. It only counts a reader at the start of a command
# (not after a pipe, where it filters output), and skips `cat >` and `cat <<`, which
# write rather than read.
#
# Refreshing at read time, not write time, is what closes the staleness gap. A hook
# on Edit/Write misses changes made outside Claude, and a file watcher races the
# query. `graphify update` reads the disk, so it sees every change whoever made it,
# and its content-hash cache keeps an unchanged repo to a fraction of a second.
#
# If the refresh fails, exit 2 blocks the query and hands stderr to Claude, so a
# broken graph degrades to reading source rather than trusting stale answers.

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=guard.sh
. "$here/guard.sh"

graphify_guard || exit 0
graphify_have_jq || exit 0

command=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0

# Every subcommand that answers from graph.json. Anchored on a word boundary so a
# path such as `my-graphify query` does not match.
if ! printf '%s' "$command" |
  grep -Eq '(^|[^[:alnum:]_-])graphify[[:space:]]+(query|path|explain|affected|god-nodes)([[:space:]]|$)'; then
  start='(^|[;&(])[[:space:]]*'
  if printf '%s' "$command" |
    grep -Eq "${start}(cat|head|tail|less|grep|egrep|rg|ag|find|fd|ls|tree|sed|awk)([[:space:]]|$)" &&
    ! printf '%s' "$command" | grep -Eq "${start}cat[[:space:]]*(>|<<)"; then
    graphify_nudge
  fi
  exit 0
fi

if ! output=$(graphify update "$GRAPHIFY_ROOT" 2>&1); then
  {
    echo "graphify update failed, so the graph may be stale and this query was blocked."
    echo "Answer from the source files instead (Read, Grep)."
    echo "--- graphify update output (last 20 lines) ---"
    printf '%s\n' "$output" | tail -n 20
  } >&2
  exit 2
fi

# `graphify update` refreshed the code only. Start a background re-read of any doc
# that changed, and tell Claude which docs the graph still describes from old text.
# shellcheck source=doc-refresh.sh
. "$here/doc-refresh.sh"
graphify_refresh_docs

# Say so on success too. A silent refresh looks the same as no refresh, so the user
# cannot tell the gate ran. systemMessage shows the line to the user only;
# additionalContext reaches Claude.
docs="$GRAPHIFY_STALE_COUNT changed doc(s)"
case "$GRAPHIFY_DOCS_STATE" in
  started)
    message="graphify: graph refreshed. Started re-reading $docs in the background (graphify extract)."
    why="are being re-read in the background"
    ;;
  running)
    message="graphify: graph refreshed. Still re-reading $docs in the background (graphify extract)."
    why="are being re-read in the background"
    ;;
  finished)
    jq -n '{systemMessage: "graphify: graph refreshed. The background re-read of changed docs has finished."}'
    exit 0
    ;;
  no-backend)
    message="graphify: graph refreshed, but $docs were not re-read: no LLM backend is set. Set it with /plugin configure iangregson-graphify@iangregson (for example graphify_backend=claude-cli)."
    why="were not re-read (no LLM backend is set)"
    ;;
  no-backend-warned)
    message="graphify: graph refreshed before this query."
    why="were not re-read (no LLM backend is set)"
    ;;
  failed)
    message="graphify: graph refreshed, but re-reading $docs failed. See graphify-out/.doc-refresh.log."
    why="could not be re-read (the refresh failed)"
    ;;
  failed-warned)
    message="graphify: graph refreshed before this query."
    why="could not be re-read (the refresh failed)"
    ;;
  *)
    jq -n '{systemMessage: "graphify: graph refreshed before this query."}'
    exit 0
    ;;
esac

jq -n --arg message "$message" --arg why "$why" --arg docs "$GRAPHIFY_STALE_DOCS" '{
  systemMessage: $message,
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: ("graphify: these docs changed since the graph last read them, and " + $why + ". Graph answers about them come from their older text, so Read them directly:\n" + $docs)
  }
}'
exit 0
