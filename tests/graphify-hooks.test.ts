import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = new URL("..", import.meta.url).pathname;
const SCRIPTS = join(ROOT, "hooks/scripts");

/** Absolute path of a system binary, found on the test runner's own PATH. */
function which(bin: string): string {
  const found = spawnSync("/bin/sh", ["-c", `command -v ${bin}`], { encoding: "utf8" });
  if (found.status !== 0) throw new Error(`${bin} is needed to run these tests`);
  return found.stdout.trim();
}

interface Sandbox {
  project: string;
  log: string;
  run: (
    script: string,
    stdin?: string,
    env?: Record<string, string>,
  ) => ReturnType<typeof spawnSync>;
}

/**
 * A project directory plus a PATH holding only what the hooks may use. The hooks'
 * whole contract is how they behave when graphify, the graph, or jq is absent, so
 * each of those is switched on per test rather than inherited from the machine.
 */
function sandbox({
  graphify = true,
  graph = true,
  jq = true,
  manifest = undefined as Manifest | undefined,
} = {}): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), "graphify-hooks-"));
  const bin = join(dir, "bin");
  const project = join(dir, "project");
  const log = join(dir, "graphify.log");
  mkdirSync(bin);
  mkdirSync(project);

  for (const tool of ["dirname", "grep", "tail", "sleep", ...(jq ? ["jq"] : [])]) {
    symlinkSync(which(tool), join(bin, tool));
  }

  if (graphify) {
    // `extract` can be slowed down, and can mark every doc as re-read the way the
    // real one stamps semantic_hash, so a background refresh can succeed or fail.
    const stub = join(bin, "graphify");
    writeFileSync(
      stub,
      [
        "#!/bin/bash",
        'echo "$@" >> "$GRAPHIFY_LOG"',
        'if [ -n "$GRAPHIFY_FAIL" ]; then echo "rebuild exploded"; exit 1; fi',
        'if [ "$1" = extract ]; then',
        '  if [ -n "$GRAPHIFY_EXTRACT_SLEEP" ]; then sleep "$GRAPHIFY_EXTRACT_SLEEP"; fi',
        '  if [ -n "$GRAPHIFY_EXTRACT_REREADS" ]; then',
        '    m="$2/graphify-out/manifest.json"',
        '    fixed=$(jq \'map_values(.semantic_hash = .ast_hash)\' "$m") && printf \'%s\' "$fixed" > "$m"',
        "  fi",
        "fi",
        "exit 0",
        "",
      ].join("\n"),
    );
    chmodSync(stub, 0o755);
  }

  if (graph) {
    mkdirSync(join(project, "graphify-out"));
    writeFileSync(join(project, "graphify-out/graph.json"), "{}");
    if (manifest) writeManifest(project, manifest);
  }

  const bash = which("bash");
  return {
    project,
    log,
    run: (script, stdin = "{}", env = {}) =>
      spawnSync(bash, [join(SCRIPTS, script)], {
        input: stdin,
        encoding: "utf8",
        env: { PATH: bin, CLAUDE_PROJECT_DIR: project, GRAPHIFY_LOG: log, ...env },
      }),
  };
}

const bashCommand = (command: string) => JSON.stringify({ tool_input: { command } });

/** graphify-out/manifest.json: per file, the content hash at the last code and doc read. */
type Manifest = Record<string, { ast_hash: string; semantic_hash: string }>;

function writeManifest(project: string, manifest: Manifest): void {
  writeFileSync(join(project, "graphify-out/manifest.json"), JSON.stringify(manifest));
}

/** Read by both steps since the file last changed. */
const reread = (hash = "a1") => ({ ast_hash: hash, semantic_hash: hash });
/** Changed since the doc step last read it; `graphify update` clears semantic_hash. */
const changed = (hash = "b2") => ({ ast_hash: hash, semantic_hash: "" });

function graphifyCalls(box: Sandbox): string[] {
  try {
    return readFileSync(box.log, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

describe.each(["session-start.sh", "nudge.sh", "gate.sh"])("%s", (script) => {
  const stdin = script === "gate.sh" ? bashCommand('graphify query "x"') : "{}";

  it("does nothing when graphify is not installed", () => {
    const result = sandbox({ graphify: false }).run(script, stdin);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("does nothing when the repo has no graph", () => {
    const box = sandbox({ graph: false });
    const result = box.run(script, stdin);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(graphifyCalls(box)).toEqual([]);
  });

  it("does not check for jq in a repo without graphify", () => {
    // No graphify and no jq: the warning must not appear, because the jq check
    // is only reached once graphify and a graph are both present.
    const result = sandbox({ graphify: false, jq: false }).run(script, stdin);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("session-start.sh", () => {
  it("warns the user, once, when jq is missing", () => {
    const result = sandbox({ jq: false }).run("session-start.sh");
    expect(result.status).toBe(0);
    const output = JSON.parse(String(result.stdout));
    expect(output.systemMessage).toMatch(/jq not found/);
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  it("puts the guidance file into context", () => {
    const result = sandbox().run("session-start.sh");
    expect(result.status).toBe(0);
    const output = JSON.parse(String(result.stdout));
    const guidance = readFileSync(join(ROOT, "hooks/context/graphify.md"), "utf8");
    expect(output.hookSpecificOutput).toEqual({
      hookEventName: "SessionStart",
      additionalContext: guidance,
    });
  });
});

describe("nudge.sh", () => {
  it("skips quietly when jq is missing", () => {
    const result = sandbox({ jq: false }).run("nudge.sh");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("reminds Claude that the graph exists", () => {
    const result = sandbox().run("nudge.sh");
    expect(result.status).toBe(0);
    const output = JSON.parse(String(result.stdout));
    expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(output.hookSpecificOutput.additionalContext).toMatch(/graphify query/);
  });
});

describe("gate.sh", () => {
  it("skips quietly when jq is missing", () => {
    const box = sandbox({ jq: false });
    const result = box.run("gate.sh", bashCommand('graphify query "x"'));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(graphifyCalls(box)).toEqual([]);
  });

  it.each([
    'graphify query "what calls foo"',
    'graphify explain "Foo"',
    'graphify path "A" "B"',
    'graphify affected "foo"',
    "graphify god-nodes --top 5",
    'cd src && graphify query "x"',
  ])("refreshes the graph before %s, and tells the user", (command) => {
    const box = sandbox();
    const result = box.run("gate.sh", bashCommand(command));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(String(result.stdout));
    expect(output.systemMessage).toMatch(/graph refreshed/);
    expect(output.hookSpecificOutput).toBeUndefined();
    expect(graphifyCalls(box)).toEqual([`update ${box.project}`]);
  });

  // Reading files through Bash skips the Grep|Glob|Read matcher, so the gate
  // carries the same nudge for shell reads and searches.
  it.each([
    "cat README.md",
    "ls -la",
    'grep -r "foo" src',
    "rg foo",
    "find . -name '*.ts'",
    "head -n 20 package.json",
    "tail -n 5 CHANGELOG.md",
    "tree hooks",
    "cd hooks && cat hooks.json",
    "ls hooks; cat package.json",
    "sed -n '1,20p' README.md",
    "awk '{print $1}' file",
  ])("nudges towards the graph before %s", (command) => {
    const box = sandbox();
    const result = box.run("gate.sh", bashCommand(command));
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(String(result.stdout));
    expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(output.hookSpecificOutput.additionalContext).toMatch(/graphify query/);
    expect(graphifyCalls(box)).toEqual([]);
  });

  it("does not nudge when jq is missing", () => {
    const result = sandbox({ jq: false }).run("gate.sh", bashCommand("cat README.md"));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it.each([
    "git status",
    "git ls-files",
    "vp test",
    "echo cat",
    "cat > notes.md <<'EOF'\nhello\nEOF",
    "cat <<EOF | vp run x\nhi\nEOF",
    "git log | grep fix",
    "graphify update .",
    "graphify extract . --code-only",
    'my-graphify query "x"',
  ])("leaves %s alone", (command) => {
    const box = sandbox();
    const result = box.run("gate.sh", bashCommand(command));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(graphifyCalls(box)).toEqual([]);
  });

  it("does nothing for input with no command", () => {
    const box = sandbox();
    expect(box.run("gate.sh", "{}").status).toBe(0);
    expect(box.run("gate.sh", "not json").status).toBe(0);
    expect(graphifyCalls(box)).toEqual([]);
  });

  it("blocks the query with exit 2 when the refresh fails", () => {
    const box = sandbox();
    const result = box.run("gate.sh", bashCommand('graphify query "x"'), { GRAPHIFY_FAIL: "1" });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/graphify update failed/);
    expect(result.stderr).toMatch(/rebuild exploded/);
  });
});

// `graphify update` re-parses code only, so the gate re-reads changed docs itself,
// in the background, with `graphify extract`.
describe("gate.sh doc refresh", () => {
  const query = bashCommand('graphify query "x"');
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Wait until the background refresh the gate started has exited. */
  async function refreshExited(box: Sandbox): Promise<void> {
    const pid = Number(readFileSync(join(box.project, "graphify-out/.doc-refresh.pid"), "utf8"));
    for (const deadline = Date.now() + 10_000; Date.now() < deadline; await sleep(25)) {
      try {
        process.kill(pid, 0);
      } catch {
        return;
      }
    }
    throw new Error(`background refresh ${pid} did not exit`);
  }

  const extracts = (box: Sandbox) => graphifyCalls(box).filter((c) => c.startsWith("extract"));
  const output = (result: ReturnType<typeof spawnSync>) => JSON.parse(String(result.stdout));

  it("leaves docs alone when none changed", () => {
    // Code files carry an empty semantic_hash too; they are not docs.
    const box = sandbox({ manifest: { "README.md": reread(), "scripts/x.sh": changed() } });
    const result = box.run("gate.sh", query);
    expect(result.status).toBe(0);
    expect(output(result)).toEqual({
      systemMessage: "graphify: graph refreshed before this query.",
    });
    expect(graphifyCalls(box)).toEqual([`update ${box.project}`]);
  });

  const backend = (name: string) => ({ CLAUDE_PLUGIN_OPTION_GRAPHIFY_BACKEND: name });

  it("starts a background re-read of changed docs, and tells the user and Claude", async () => {
    const box = sandbox({
      manifest: { "README.md": changed(), "docs/ci.yml": changed(), "src/x.ts": changed() },
    });
    const result = box.run("gate.sh", query, backend("claude-cli"));
    expect(result.status).toBe(0);
    const { systemMessage, hookSpecificOutput } = output(result);
    expect(systemMessage).toMatch(/Started re-reading 2 changed doc\(s\) in the background/);
    expect(hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(hookSpecificOutput.additionalContext).toMatch(/README\.md\ndocs\/ci\.yml\n$/);
    await refreshExited(box);
    expect(extracts(box)).toEqual([`extract ${box.project} --backend claude-cli`]);
  });

  it("starts nothing when no backend is set, and tells the user once", () => {
    // graphify would pick a backend from the environment, which can send the docs to
    // a remote host the user never chose for this.
    const box = sandbox({ manifest: { "README.md": changed() } });
    const first = output(box.run("gate.sh", query));
    expect(first.systemMessage).toMatch(/1 changed doc\(s\) were not re-read: no LLM backend/);
    expect(first.systemMessage).toMatch(/graphify_backend/);
    expect(first.hookSpecificOutput.additionalContext).toMatch(/not re-read \(no LLM backend/);

    const second = output(box.run("gate.sh", query));
    expect(second.systemMessage).toBe("graphify: graph refreshed before this query.");
    expect(second.hookSpecificOutput.additionalContext).toMatch(/README\.md/);
    expect(extracts(box)).toEqual([]);
  });

  it("does not make the query wait for the re-read", async () => {
    const box = sandbox({ manifest: { "README.md": changed() } });
    const started = Date.now();
    const result = box.run("gate.sh", query, {
      ...backend("claude-cli"),
      GRAPHIFY_EXTRACT_SLEEP: "3",
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.status).toBe(0);
    await refreshExited(box);
  });

  it("starts one re-read at a time", async () => {
    const box = sandbox({ manifest: { "README.md": changed() } });
    const env = { ...backend("claude-cli"), GRAPHIFY_EXTRACT_SLEEP: "1" };
    box.run("gate.sh", query, env);
    const second = box.run("gate.sh", query, env);
    expect(output(second).systemMessage).toMatch(/Still re-reading 1 changed doc\(s\)/);
    await refreshExited(box);
    expect(extracts(box)).toHaveLength(1);
  });

  it("reports a finished re-read once", async () => {
    const box = sandbox({ manifest: { "README.md": changed() } });
    const env = { ...backend("claude-cli"), GRAPHIFY_EXTRACT_REREADS: "1" };
    box.run("gate.sh", query, env);
    await refreshExited(box);
    expect(output(box.run("gate.sh", query, env))).toEqual({
      systemMessage:
        "graphify: graph refreshed. The background re-read of changed docs has finished.",
    });
    expect(output(box.run("gate.sh", query, env))).toEqual({
      systemMessage: "graphify: graph refreshed before this query.",
    });
    expect(extracts(box)).toHaveLength(1);
  });

  it("reports a failed re-read once, and does not retry the same docs", async () => {
    const box = sandbox({ manifest: { "README.md": changed() } });
    const env = backend("claude-cli");
    box.run("gate.sh", query, env);
    await refreshExited(box);

    const first = output(box.run("gate.sh", query, env));
    expect(first.systemMessage).toMatch(/re-reading 1 changed doc\(s\) failed/);
    expect(first.systemMessage).toMatch(/\.doc-refresh\.log/);
    expect(first.hookSpecificOutput.additionalContext).toMatch(/could not be re-read/);

    // Claude still hears which docs are old; the user is not told again.
    const second = output(box.run("gate.sh", query, env));
    expect(second.systemMessage).toBe("graphify: graph refreshed before this query.");
    expect(second.hookSpecificOutput.additionalContext).toMatch(/README\.md/);
    expect(extracts(box)).toHaveLength(1);
  });

  it("retries once a doc changes again", async () => {
    const box = sandbox({ manifest: { "README.md": changed("b2") } });
    const env = backend("claude-cli");
    box.run("gate.sh", query, env);
    await refreshExited(box);
    box.run("gate.sh", query, env);

    writeManifest(box.project, { "README.md": changed("c3") });
    expect(output(box.run("gate.sh", query, env)).systemMessage).toMatch(/Started re-reading/);
    await refreshExited(box);
    expect(extracts(box)).toHaveLength(2);
  });

  it("starts once a backend is set, and retries once it changes", async () => {
    const box = sandbox({ manifest: { "README.md": changed() } });
    box.run("gate.sh", query);

    expect(output(box.run("gate.sh", query, backend("gemini"))).systemMessage).toMatch(
      /Started re-reading/,
    );
    await refreshExited(box);
    box.run("gate.sh", query, backend("gemini"));

    expect(output(box.run("gate.sh", query, backend("claude-cli"))).systemMessage).toMatch(
      /Started re-reading/,
    );
    await refreshExited(box);
    expect(extracts(box)).toEqual([
      `extract ${box.project} --backend gemini`,
      `extract ${box.project} --backend claude-cli`,
    ]);
  });

  it("reads the backend from the option the plugin declares", () => {
    // Claude Code exposes userConfig.<key> as CLAUDE_PLUGIN_OPTION_<KEY>; a renamed
    // key would leave the script reading a variable that is never set.
    const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8"));
    expect(manifest.userConfig.graphify_backend.type).toBe("string");
    expect(readFileSync(join(SCRIPTS, "doc-refresh.sh"), "utf8")).toContain(
      "CLAUDE_PLUGIN_OPTION_GRAPHIFY_BACKEND",
    );
  });
});
