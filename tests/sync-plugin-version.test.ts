import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
// @ts-expect-error -- plain .mjs script, no type declarations
import { syncVersion } from "../scripts/sync-plugin-version.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

describe("syncVersion", () => {
  const source = '{\n  "name": "x",\n  "version": "0.0.0",\n  "keywords": ["a", "b"]\n}\n';

  it("sets the version and leaves the rest of the file as it was", () => {
    expect(syncVersion(source, "1.0.0")).toBe(source.replace('"0.0.0"', '"1.0.0"'));
  });

  it.each(["1.0", "1.0.0.0", "1.0.x", "v1.0.0", "", "1..0"])("rejects %o", (version) => {
    expect(() => syncVersion(source, version)).toThrow(/MAJOR\.MINOR\.PATCH/);
  });

  it("throws when there is no version to replace", () => {
    expect(() => syncVersion('{\n  "name": "x"\n}\n', "1.0.0")).toThrow(/version/);
  });
});

describe("plugin manifest", () => {
  it("carries the package version", () => {
    // They only move together through `release:version`. A hand edit to either
    // splits the plugin's update key from its changelog and tag.
    expect(readJson(".claude-plugin/plugin.json").version).toBe(readJson("package.json").version);
  });
});
