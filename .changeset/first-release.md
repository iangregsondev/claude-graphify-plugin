---
"iangregson-graphify": major
---

First release. Hooks that point Claude at a graphify knowledge graph: session guidance that tells Claude to ask the graph before reading or searching files, a query-first nudge before Grep, Glob and Read (and before shell reads such as `cat`, `grep` and `find`), and a gate that refreshes the graph before every `graphify` query and tells the user when it has. When a doc has changed, the gate re-reads it in the background with `graphify extract`, using the backend set in the plugin's `graphify_backend` option (nothing starts while it is empty), and tells Claude which docs are not re-read yet. All three do nothing in a repo without a graph.
