import { accessSync, constants, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = new URL("..", import.meta.url).pathname;
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const manifest = readJson(".claude-plugin/plugin.json");
const config = readJson("hooks/hooks.json");
const commands: string[] = Object.values(config.hooks ?? {}).flatMap((groups) =>
  (groups as { hooks: { command?: string }[] }[]).flatMap((group) =>
    group.hooks.map((hook) => hook.command ?? ""),
  ),
);

describe(".claude-plugin/plugin.json", () => {
  it("is named after the package", () => {
    expect(manifest.name).toBe(readJson("package.json").name);
  });

  it("does not also list hooks/hooks.json", () => {
    // Claude Code loads hooks/hooks.json from the plugin root on its own, so a
    // copy listed here would register every hook a second time.
    expect(manifest.hooks).toBeUndefined();
  });
});

describe("hooks/hooks.json", () => {
  it("registers at least one hook", () => {
    expect(commands.length).toBeGreaterThan(0);
  });

  it.each(commands)("%s points at an executable script in the plugin", (command) => {
    // A script committed without its executable bit fails on a clean install with
    // "not found", and nothing before that moment notices.
    const match = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/.exec(command);
    expect(match, "command must resolve through ${CLAUDE_PLUGIN_ROOT}").not.toBeNull();
    const script = join(ROOT, match![1]);
    expect(() => accessSync(script, constants.X_OK)).not.toThrow();
  });

  it.each(commands.map((command) => basename(command.replace(/"/g, ""))))(
    "%s has a row in the README",
    (script) => {
      const readme = readFileSync(join(ROOT, "README.md"), "utf8");
      expect(readme).toContain(`| \`${script}\``);
    },
  );
});
