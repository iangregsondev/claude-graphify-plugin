# claude-graphify-plugin

[![CI](https://github.com/iangregsondev/claude-graphify-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/iangregsondev/claude-graphify-plugin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)

Claude Code hooks for [graphify](https://github.com/Graphify-Labs/graphify): graph-first answers, a fresh graph on every query, and silence in repos without one. The plugin is `iangregson-graphify`.

## Install

From the [iangregsondev/claude-marketplace](https://github.com/iangregsondev/claude-marketplace) marketplace:

```bash
claude plugin marketplace add iangregsondev/claude-marketplace
claude plugin install iangregson-graphify@iangregson --config graphify_backend=claude-cli
```

`--config graphify_backend=…` sets the LLM backend the plugin uses to re-read changed docs (see [Choosing the LLM backend](#hooks)). Install without it and the CLI says the option is not yet set; set or change it any time with `/plugin configure iangregson-graphify@iangregson` inside Claude Code.

Restart your Claude Code session afterwards — plugins load at session start.

A plugin installs to your user profile, so its hooks are yours alone. Nothing is written to a repo's `CLAUDE.md` or `.claude/settings.json`, and teammates who have not installed the plugin see no change.

## Hooks

Replaces `graphify claude install`, which writes a section into the repo's shared `CLAUDE.md` and hooks into its shared `.claude/settings.json`. This plugin does the same job from your user profile instead.

| Hook               | When                          | What it does                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-start.sh` | Session start                 | Adds [`context/graphify.md`](hooks/context/graphify.md) to Claude's context.                                                                                                                                                                                                                                                                                                                              |
| `nudge.sh`         | Before `Grep`, `Glob`, `Read` | Reminds Claude to ask the graph before text search.                                                                                                                                                                                                                                                                                                                                                       |
| `gate.sh`          | Before `Bash`                 | Runs `graphify update` before any `graphify query`, `explain`, `path`, `affected` or `god-nodes`, and shows a one-line message when the refresh works. If a doc changed, starts `graphify extract` in the background to re-read it, and tells Claude which docs are not re-read yet. Gives the same reminder as `nudge.sh` before a shell read or search (`cat`, `grep`, `rg`, `find`, `ls` and similar). |

**Why the gate.** A graph goes stale the moment a file changes. Hooks on `Edit`/`Write` miss changes made outside Claude, and a file watcher races the query. The gate refreshes at read time instead: `graphify update` reads the disk, so it sees every change whoever made it, and its content-hash cache makes an unchanged repo a sub-second no-op. If the refresh fails, the query is blocked and Claude is told to read source instead.

**Why docs refresh in the background.** `graphify update` re-parses code only; a changed doc keeps the nodes an LLM made from its old text. `graphify update` does mark such a doc in `graphify-out/manifest.json` (its `semantic_hash` no longer matches its `ast_hash`), so the gate finds those docs and starts `graphify extract`, which sends only them to an LLM. That takes seconds to minutes, so the query does not wait; the user sees when it starts and when it finishes. A refresh starts once for each set of changed docs. If it fails, the user is told once, with the log at `graphify-out/.doc-refresh.log`, and it is not retried until a doc or the backend changes.

**Choosing the LLM backend.** The plugin's `graphify_backend` option is the value passed to `graphify extract --backend`. `claude-cli` is the usual choice: it runs through the `claude` CLI you already have, billed to your Claude plan, with no API key. graphify also accepts `claude` (the Anthropic API, with `ANTHROPIC_API_KEY`), `bedrock` (Claude on AWS), `gemini`, `openai`, `azure`, `deepseek`, `kimi` and `ollama`. Each of those reads its own keys and endpoints from the environment, and the hooks see the environment Claude Code was started with, so set them there. graphify's [environment variables](https://github.com/Graphify-Labs/graphify#environment-variables) table lists what each backend needs. Set it at install with `--config graphify_backend=claude-cli`, or any time with `/plugin configure iangregson-graphify@iangregson`; Claude Code stores it in your user settings under `pluginConfigs`. Leave it empty and no background refresh starts: the user is told once that changed docs were not re-read. The gate never lets graphify pick a backend by itself, because graphify picks from whatever the environment holds — an `OLLAMA_BASE_URL` pointing at a remote host is enough for it to send your docs there.

**When it runs.** Every hook checks the same things, in this order, and stops at the first one that fails:

1. `graphify` is not on `PATH` — do nothing.
2. `graphify-out/graph.json` does not exist in the project — do nothing.
3. `jq` is not on `PATH` — the session-start hook shows a one-line warning; the others do nothing.

So in a repo without a graph, the plugin costs one short shell process per tool call and produces no output.

**Requirements.** [graphify](https://github.com/Graphify-Labs/graphify) and [jq](https://jqlang.org). Build a graph once per repo:

```bash
graphify extract . --backend claude-cli   # code and docs; an LLM reads the docs, here through your Claude plan
graphify extract . --code-only            # code only: no LLM and no API key, but no docs in the graph
```

Pass `--backend` yourself. Without it, graphify picks a backend from whatever API keys and endpoints your environment holds, so your docs can go to a provider you did not choose. A code-only graph does not stay code-only: once a doc changes, `graphify update` lists it as not yet read, and the gate re-reads it with the plugin's `graphify_backend` option if you have set one.

After that, the hooks keep the graph fresh. You do not need `graphify claude install` or `graphify hook install`.

**Keeping `graphify-out/` out of git.** The gate rewrites `graphify-out/` on every graph query, so in a repo that does not commit it, those changes show up in `git status`. If the graph is just for you, ignore it in your global gitignore rather than in each repo's `.gitignore`:

```bash
git config --global core.excludesFile   # prints your global gitignore, if one is set
echo 'graphify-out/' >> ~/.gitignore     # and run `git config --global core.excludesFile ~/.gitignore` if none was
```

If your team commits `graphify-out/` instead, as graphify's [team setup](https://github.com/Graphify-Labs/graphify#team-setup) suggests, still ignore the files this plugin keeps there for itself: `graphify-out/.doc-refresh.*`.

## Development

This repo uses [Vite+](https://viteplus.dev) — a single `vp` CLI wrapping runtime, package management and tooling. Use `vp`, not npm/pnpm/yarn.

```bash
vp install     # after cloning, and after pulling changes
vp check       # format, lint, type check
vp test        # run the hook scripts against every guard case
vp run ready   # all of the above, plus plugin validation
```

Try the plugin from a working copy without installing it:

```bash
CLAUDE_PLUGIN_OPTION_GRAPHIFY_BACKEND=claude-cli claude --plugin-dir .
```

A plugin loaded with `--plugin-dir` is not installed, so there is no `/plugin` entry to set `graphify_backend` in. Set it through the environment variable Claude Code would otherwise set for the hooks, as above. Leave it off and changed docs are not re-read.

Versioning is handled by [changesets](https://github.com/changesets/changesets). A change to the hooks needs one:

```bash
vpx changeset
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rest.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability privately.

## License

MIT — see [LICENSE.md](LICENSE.md).
