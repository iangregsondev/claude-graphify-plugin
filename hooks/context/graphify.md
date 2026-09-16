# graphify

This repo has a graphify knowledge graph in `graphify-out/`.

Ask the graph before reading or searching files — for structural questions (what calls X, what depends on Y, how A connects to B, where Z lives) and for overview questions (what is this repo, how does it fit together, where do I start). This holds however the files would be read: the Read, Grep and Glob tools, or `cat`, `grep`, `find` and `ls` in Bash.

- `graphify god-nodes` — the most connected nodes; start here for an overview
- `graphify query "<question>"` — traverse the graph for a question
- `graphify explain "<symbol>"` — a node and its neighbours
- `graphify path "<A>" "<B>"` — the shortest path between two nodes
- `graphify affected "<symbol>"` — what a change to a node would reach

If `graphify-out/wiki/index.md` exists, navigate it for broad questions instead of browsing source files.

`graphify-out/GRAPH_REPORT.md` is a full architecture overview, and a large one. Read it only for a broad architecture review, or when the commands above do not surface enough context.

Read files after the graph has pointed at them, not instead of asking it. Files you edited this session are the exception — Read them directly.

The graph is refreshed automatically before each of those commands, so code answers match the files on disk. If the refresh fails, the command is blocked with the reason — fall back to reading source. Code is re-parsed on every refresh; docs are not. The gate names any doc that changed since the graph last read it — being re-read in the background, or not re-read — and graph answers about those docs come from their older text.

The graph links code to code: imports and calls. It has no links from config (such as `hooks.json`), from tests that run a file by its path, or from docs to the code they describe. So `graphify affected` lists code dependents only; for what a change reaches, also search for the file or symbol name.
