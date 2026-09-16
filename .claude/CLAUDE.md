# Where this file lives

This is `.claude/CLAUDE.md`, not a root `CLAUDE.md`, on purpose. The repo root is the plugin root, and `claude plugin validate --strict` fails on a `CLAUDE.md` there, because a plugin cannot ship project context that way. Claude Code loads this path as project instructions all the same. Do not move it to the root.

# Toolchain

This repo uses [Vite+](https://viteplus.dev). `vp` and `vpx` replace the whole npm/pnpm/yarn/bun surface. Translate before running anything:

| Instead of                                             | Use                      |
| ------------------------------------------------------ | ------------------------ |
| `npm install`, `pnpm install`, `yarn`, `bun install`   | `vp install`             |
| `npm install <pkg>`, `pnpm add`, `yarn add`, `bun add` | `vp add <pkg>`           |
| `npm run <task>`, `pnpm run`, `yarn <task>`, `bun run` | `vp run <task>`          |
| `npx <pkg>`, `pnpm dlx`, `yarn dlx`, `bunx`            | `vpx <pkg>` (= `vp dlx`) |

`devEngines.packageManager` pins this repo to pnpm, so npm and npx abort with `EBADDEVENGINES`, while yarn and bun would quietly resolve a different dependency tree.

Before calling a change done: `vp run ready` (format, lint, type check, tests, plugin validation). If setup looks wrong, run `vp env doctor`.

# What this repo is

One Claude Code plugin, `iangregson-graphify`, catalogued in [iangregsondev/claude-marketplace](https://github.com/iangregsondev/claude-marketplace). The catalogue fetches `.claude-plugin/plugin.json` from this repo's default branch, so the plugin must stay at the repo root, and whatever lands on `main` reaches users on their next update.

What ships lives under `hooks/`: `hooks.json`, the scripts in `hooks/scripts/`, and the guidance text in `hooks/context/`.

# The rule every hook follows: silent where it does not apply

A plugin installs to a person's user profile, so its hooks run in every repo they open. Every hook therefore guards first and exits 0 with no output wherever graphify is not in use. Order the guards cheapest first, and put any check that can warn after the checks that decide whether the plugin applies, so a repo without a graph never sees a warning. `hooks/scripts/guard.sh` holds the shared guards.

Only `SessionStart` warns about a missing dependency, because it fires once, not on every tool call. Warn with a JSON `systemMessage`, never a non-zero exit: exit 2 blocks the tool call and exit 1 reads as a broken plugin.

Every guard case gets a test. `tests/graphify-hooks.test.ts` runs the real scripts with a PATH holding only the binaries a case allows, so "tool missing" is tested rather than assumed.

# Registering a hook script

- Add it to `hooks/hooks.json`. Never also list that file in the `hooks` field of `.claude-plugin/plugin.json` — Claude Code auto-loads `hooks/hooks.json`, so it would load a second time.
- Reference scripts as `"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<script>.sh"`. Paths outside the plugin root are rejected.
- Commit scripts with the executable bit set. A missing bit fails only on a clean install.
- Add a row to the README's hooks table.

`tests/plugin.test.ts` checks all four, because each one fails silently at runtime.

# Versioning

One version, through changesets, and nothing about it is ever hand-edited.

- The package starts at `0.0.0`, and the first changeset is `major`, so the first release is `1.0.0`.
- Every change under `hooks/` needs a changeset, keyed by the root `package.json` name, `iangregson-graphify`. Without one the change ships no bump.
- Never touch the `version` in `package.json` or `.claude-plugin/plugin.json`, `CHANGELOG.md`, or a released version. The release workflow writes them: `changeset version` bumps the package, and `scripts/sync-plugin-version.mjs` copies that version into `plugin.json`, which Claude Code uses as the cache key for `/plugin update`.

# Writing Markdown here

Do not hard-wrap prose. One line per paragraph, per list item, per table row. `CODE_OF_CONDUCT.md` and `LICENSE.md` are verbatim upstream copies — leave their line breaks alone.

[CONTRIBUTING.md](../CONTRIBUTING.md) is the full account.
