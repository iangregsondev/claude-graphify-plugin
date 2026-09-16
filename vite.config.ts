import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // The graph this repo's own hooks refresh. It is generated, and only a global
    // gitignore hides it, so the formatter would otherwise check it.
    ignorePatterns: ["graphify-out/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
    tasks: {
      // Uncached: the run takes under a second, and a cache that misses the
      // manifests replays a stale pass. Validates a copy of what git ships, so a
      // gitignored CLAUDE.local.md at the root cannot fail it — see the script.
      "validate:plugin": {
        command: "node scripts/validate-plugin.mjs",
        cache: false,
      },
      // What the release workflow runs to produce a release pull request.
      // Lives here rather than inline in the workflow so `release:dry-run` can
      // exercise the real thing instead of a copy of it.
      "release:version": {
        command: "vpx changeset version && node scripts/sync-plugin-version.mjs",
        cache: false,
      },
      "release:dry-run": {
        command: "node scripts/release-dry-run.mjs",
        cache: false,
      },
    },
  },
});
