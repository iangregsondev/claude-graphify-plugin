# iangregson-graphify

## 1.0.0

### Major Changes

- [#1](https://github.com/iangregsondev/claude-graphify-plugin/pull/1) [`af01804`](https://github.com/iangregsondev/claude-graphify-plugin/commit/af0180410fe603905eec68bd46a3791284f05bc7) Thanks [@iangregsondev](https://github.com/iangregsondev)! - First release. Hooks that point Claude at a graphify knowledge graph: session guidance that tells Claude to ask the graph before reading or searching files, a query-first nudge before Grep, Glob and Read (and before shell reads such as `cat`, `grep` and `find`), and a gate that refreshes the graph before every `graphify` query and tells the user when it has. When a doc has changed, the gate re-reads it in the background with `graphify extract`, using the backend set in the plugin's `graphify_backend` option (nothing starts while it is empty), and tells Claude which docs are not re-read yet. All three do nothing in a repo without a graph.
