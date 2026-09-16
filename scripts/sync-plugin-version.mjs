// Sets `.claude-plugin/plugin.json`'s version to the package version.
//
// Claude Code uses the plugin version as the cache key for update detection: if
// it does not change, `/plugin update` reports users are already up to date and
// they never receive the new hooks. `changeset version` bumps package.json, and
// this copies that number across, so the plugin, its changelog and its tag all
// carry one version — and the first release is 1.0.0 in all three.
//
// Run by the release workflow immediately after `changeset version`, so the
// change lands in the same release pull request. Never edit either by hand.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MANIFEST = new URL("../.claude-plugin/plugin.json", import.meta.url);
const PACKAGE = new URL("../package.json", import.meta.url);

/**
 * Returns the plugin.json source with its version set to `version`. Throws on a
 * version that is not MAJOR.MINOR.PATCH, or a source with no version to replace.
 */
export function syncVersion(source, version) {
  if (!/^\d+\.\d+\.\d+$/.test(String(version ?? ""))) {
    throw new Error(
      `package.json version must be MAJOR.MINOR.PATCH, got ${JSON.stringify(version)}`,
    );
  }

  // Patch the one line rather than re-serialising: JSON.stringify would expand
  // the inline arrays the formatter keeps on one line, turning a one-line change
  // into a reformat that then fails `vp check`.
  const line = /"version": "[^"]*"/;
  if (!line.test(source)) throw new Error('could not find "version" in plugin.json');
  return source.replace(line, `"version": "${version}"`);
}

function main() {
  const version = JSON.parse(readFileSync(PACKAGE, "utf8")).version;
  const source = readFileSync(MANIFEST, "utf8");
  const from = JSON.parse(source).version;
  writeFileSync(MANIFEST, syncVersion(source, version));
  console.log(`plugin.json: ${from} -> ${version}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
