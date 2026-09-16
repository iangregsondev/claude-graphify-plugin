# Sourced by gate.sh after a successful `graphify update`, never run directly.
#
# `graphify update` re-parses code only. A doc that changed keeps the nodes the LLM
# made from its old text, and graphify gives no warning. It does clear the doc's
# semantic_hash in manifest.json, though, so a doc whose semantic_hash no longer
# matches its ast_hash is one the graph describes from an older version.
#
# `graphify extract` re-reads just those docs through an LLM. That takes seconds to
# minutes, so it runs in the background and the query goes ahead with a warning.
#
# The backend is the user's choice, set as the plugin's graphify_backend option, and
# nothing starts without it. Left to itself, graphify picks a backend from whatever
# the environment holds, and an OLLAMA_BASE_URL pointing at a remote host is enough
# for it to send the docs there. A background job must not make that choice.
#
# State lives next to the graph, in graphify-out/.doc-refresh.*:
#   .pid     the running refresh
#   .tried   the attempt (backend and stale set) the last refresh was started for
#   .warned  the attempt the user was last told about (failed, or no backend)
#   .log     that refresh's output
# A refresh starts once per attempt. If it ends and the same docs are still stale, it
# failed: the user is told once, and it is not retried until a doc or the backend
# changes.

# The extensions graphify sends to its LLM step: DOC_, PAPER_ and IMAGE_EXTENSIONS in
# graphify/detect.py. Code files carry an empty semantic_hash too, so without this
# filter every script would count as a stale doc.
GRAPHIFY_DOC_EXTS='md mdx qmd skill txt rst html yaml yml pdf png jpg jpeg gif webp svg'

# One line per stale doc: "<path> <ast_hash>". The hash makes a doc edited again
# count as a new attempt, so a failed refresh is retried after the next edit.
graphify_stale_docs() {
  jq -r --arg exts "$GRAPHIFY_DOC_EXTS" '
    ($exts | split(" ")) as $doc
    | to_entries[]
    | select(.value.semantic_hash != .value.ast_hash)
    | select((.key | ascii_downcase | split(".") | last) as $ext | $doc | index($ext))
    | "\(.key) \(.value.ast_hash)"
  ' "$GRAPHIFY_ROOT/graphify-out/manifest.json" 2>/dev/null
}

# Tells the user once per attempt: prints "new" the first time, "seen" after.
graphify_warn_once() {
  local out="$GRAPHIFY_ROOT/graphify-out"
  if [ -f "$out/.doc-refresh.warned" ] && [ "$(<"$out/.doc-refresh.warned")" = "$1" ]; then
    echo seen
  else
    printf '%s\n' "$1" >|"$out/.doc-refresh.warned"
    echo new
  fi
}

# Sets GRAPHIFY_DOCS_STATE to one of:
#   ""                   no stale docs, and nothing to report
#   finished             no stale docs, and a refresh finished since the last report
#   started              a refresh was just started
#   running              a refresh is still running
#   no-backend           docs are stale and no backend is set (report once)
#   failed               the last refresh ended with the docs still stale (report once)
#   no-backend-warned,
#   failed-warned        the same two, already reported
# and GRAPHIFY_STALE_DOCS to the stale paths, one per line, with
# GRAPHIFY_STALE_COUNT their number.
graphify_refresh_docs() {
  GRAPHIFY_DOCS_STATE=""
  GRAPHIFY_STALE_DOCS=""
  GRAPHIFY_STALE_COUNT=0
  local stale out pid backend attempt path
  out="$GRAPHIFY_ROOT/graphify-out"
  stale=$(graphify_stale_docs)
  if [ -z "$stale" ]; then
    # .tried is emptied once its refresh is reported, so it is reported once.
    if [ -s "$out/.doc-refresh.tried" ]; then
      : >|"$out/.doc-refresh.tried"
      GRAPHIFY_DOCS_STATE=finished
    fi
    return 0
  fi
  while read -r path _; do
    GRAPHIFY_STALE_DOCS+="$path"$'\n'
    GRAPHIFY_STALE_COUNT=$((GRAPHIFY_STALE_COUNT + 1))
  done <<<"$stale"

  if [ -f "$out/.doc-refresh.pid" ]; then
    pid=$(<"$out/.doc-refresh.pid")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      GRAPHIFY_DOCS_STATE=running
      return 0
    fi
  fi

  # The backend is part of the attempt, so setting it after a failure retries.
  backend="${CLAUDE_PLUGIN_OPTION_GRAPHIFY_BACKEND:-}"
  attempt="backend=$backend"$'\n'"$stale"

  if [ -z "$backend" ]; then
    if [ "$(graphify_warn_once "$attempt")" = new ]; then
      GRAPHIFY_DOCS_STATE=no-backend
    else
      GRAPHIFY_DOCS_STATE=no-backend-warned
    fi
    return 0
  fi

  if [ -f "$out/.doc-refresh.tried" ] && [ "$(<"$out/.doc-refresh.tried")" = "$attempt" ]; then
    if [ "$(graphify_warn_once "$attempt")" = new ]; then
      GRAPHIFY_DOCS_STATE=failed
    else
      GRAPHIFY_DOCS_STATE=failed-warned
    fi
    return 0
  fi

  printf '%s\n' "$attempt" >|"$out/.doc-refresh.tried"
  graphify extract "$GRAPHIFY_ROOT" --backend "$backend" \
    </dev/null >|"$out/.doc-refresh.log" 2>&1 &
  printf '%s\n' "$!" >|"$out/.doc-refresh.pid"
  disown 2>/dev/null
  GRAPHIFY_DOCS_STATE=started
}
