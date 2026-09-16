# Contributing

Thanks for considering a contribution. This repo is one Claude Code plugin, `iangregson-graphify`: hooks that point Claude at a [graphify](https://github.com/Graphify-Labs/graphify) knowledge graph, and switch on only in repos that have one.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before taking part.

## Ways to contribute

- **Improve the hooks** — a sharper guard, clearer guidance text, a case they miss.
- **Report a problem** — a hook that fires where it should not, fails, or gives Claude the wrong idea.

## Reporting issues

Search [existing issues](https://github.com/iangregsondev/claude-graphify-plugin/issues) first. If nothing matches, open a new one and pick the template that fits.

For a hook that misbehaves, include the hook, what you did, what the hook did, and the versions of Claude Code, graphify and jq.

**Do not open a public issue for a security vulnerability.** Follow [SECURITY.md](SECURITY.md) instead.

## Development setup

This repo uses [Vite+](https://viteplus.dev), a single `vp` CLI wrapping the runtime, package manager and tooling. **Use `vp` — not npm, pnpm, yarn or bun — and `vpx` in place of `npx`.** `devEngines.packageManager` pins the project to pnpm, and npm errors with `EBADDEVENGINES`.

Requires Node.js >= 22.18.0, plus [jq](https://jqlang.org) for the hook tests.

```bash
git clone https://github.com/iangregsondev/claude-graphify-plugin.git
cd claude-graphify-plugin
vp install
```

Run `vp install` again after pulling changes.

## Checks

```bash
vp run ready   # format, lint, type check, test, validate the plugin
```

CI runs the same steps. Plugin validation runs `claude plugin validate --strict` on a copy of the files git would ship, so a gitignored `CLAUDE.local.md` at the root cannot fail it.

To try the plugin in a real session without installing it:

```bash
CLAUDE_PLUGIN_OPTION_GRAPHIFY_BACKEND=claude-cli claude --plugin-dir .
```

There is no `/plugin` entry for a plugin loaded this way, so the `graphify_backend` option comes from that environment variable instead. Without it, the gate never starts a background doc re-read.

Hook changes need a restart (or `/reload-plugins`) to take effect.

## Changing the hooks

Everything the plugin ships lives under `hooks/`:

```
hooks/
  hooks.json        # the hook registrations, loaded by Claude Code on its own
  scripts/          # the hook commands, committed executable
  context/          # text a hook puts into Claude's context
```

1. **Guard first, and stay silent.** A plugin runs in every repo its user opens. Check the cheapest conditions first — is graphify installed, does this repo have a graph — and exit 0 with no output when either fails. Any check that can warn comes after those, so a repo without a graph never sees a warning. [`hooks/scripts/guard.sh`](hooks/scripts/guard.sh) holds the shared guards.

2. **Warn once, and never with an exit code.** A missing dependency is reported by the `SessionStart` hook, as a JSON `systemMessage`. Exit 2 would block the tool call and exit 1 reads as a broken plugin; a warning on every tool call is noise.

3. **Test every guard case.** The hook tests run the real scripts with a `PATH` holding only the binaries a case allows, so "the tool is missing" is exercised rather than assumed. Use the sandbox in [`tests/graphify-hooks.test.ts`](tests/graphify-hooks.test.ts).

4. **Register a new script.** Add it to `hooks/hooks.json`, reference it through `${CLAUDE_PLUGIN_ROOT}`, commit it executable, and add a row to the README's hooks table. Do not also list `hooks/hooks.json` in `.claude-plugin/plugin.json` — Claude Code loads that path on its own, so a listed copy would load twice. `tests/plugin.test.ts` checks all of this.

5. **Add a changeset.**

   ```bash
   vpx changeset
   ```

   The package starts at `0.0.0` and its first changeset is `major`, so the first release is `1.0.0`. After that, `patch` fixes, `minor` adds behaviour, and `major` is for a change that breaks anyone relying on the old behaviour.

**Never hand-edit a version.** Claude Code uses the plugin `version` as the cache key for update detection: if it does not change, `/plugin update` tells users they are up to date and they never receive the change. The release workflow bumps `package.json` through changesets and copies that version into `.claude-plugin/plugin.json`, in the same release pull request.

## Releases

Merging to `main` starts the release: the workflow runs `vp run release:version` — `changeset version`, then `scripts/sync-plugin-version.mjs` — and opens a "chore: version plugin" pull request. Merging that one applies the version and tags it.

Run the whole thing locally first:

```bash
vp run release:dry-run
```

It runs the same `release:version` task, prints the diff of what the release would produce, then reverts. It refuses to start unless the working tree is clean. Pass `--keep` to inspect the files instead; it prints how to clean up.

The workflow reads the repository variable `RELEASE_APP_CLIENT_ID` and the repository secret `RELEASE_APP_PRIVATE_KEY`, for the GitHub App that authors the release pull request. `iangregsondev` is a personal account, which has no organization-level variables or secrets, so both are set on this repository. The App must be installed on this repository with **Contents** and **Pull requests** set to read and write.

## Pull requests

Branch off `main` and target `main`. Branch names follow `<type>/<ticket>-<short-description>`, e.g. `feat/12-gate-tree-queries` or `chore/no-ticket-bump-deps`.

Fill in the PR template rather than leaving the body empty. Keep a PR to one coherent change.

### Keeping a branch current

**Rebase onto `main` rather than merging it in:**

```bash
git fetch origin && git rebase origin/main
git push --force-with-lease
```

GitHub's "Update branch" button writes a merge commit by default; use its "Update with rebase" option instead.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <short description>`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Imperative mood, lower case, no trailing period. The scope is usually the hook, as in `feat(gate): gate tree queries`.

## License

Contributions are accepted under the [MIT License](LICENSE.md).
