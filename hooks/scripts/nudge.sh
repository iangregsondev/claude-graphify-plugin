#!/usr/bin/env bash
# PreToolUse on Grep|Glob|Read: a one-line reminder, at the moment Claude reaches
# for a text search, that a graph answers structural questions better.

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=guard.sh
. "$here/guard.sh"

graphify_guard || exit 0
graphify_have_jq || exit 0

graphify_nudge
