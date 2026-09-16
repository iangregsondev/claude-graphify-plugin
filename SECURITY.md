# Security Policy

## Reporting a vulnerability

Please do **not** report security vulnerabilities through public GitHub issues, discussions, or pull requests — a public report is itself a disclosure.

Instead, use [GitHub's private vulnerability reporting](https://github.com/iangregsondev/claude-graphify-plugin/security/advisories/new) to open a draft advisory. It's private, and it lets us work on the fix and the advisory in the same place.

Please include:

- what the problem is and why it's a security issue rather than a bug;
- the hook affected, and the commit you're looking at;
- steps to reproduce, or a proof of concept;
- what an attacker could achieve with it.

## What counts as a vulnerability here

This plugin ships **hook scripts that run on your machine** every time Claude Code starts a session or calls a matching tool. They run with your user's permissions. The realistic threats are:

- **A hook that executes something it should not** — for example, input from a tool call reaching a shell unquoted. The graphify gate reads the Bash command Claude is about to run; it only pattern-matches that text and never executes it. When a doc in a graphify repo has changed, the gate starts `graphify extract` in the background, which sends the changed docs to the LLM backend set in the plugin's `graphify_backend` option. With that option empty, nothing is sent: the gate never lets graphify choose a backend from the environment.
- **A hook that runs where it should not** — the guards that keep a hook silent outside a graphify repo failing open.
- **A compromise of this repository's supply chain** — its workflows, its dependencies, or anything with write access to `main`. The marketplace entry for this plugin is not pinned to a commit, so whatever reaches `main` reaches users on their next update.

Reports about hooks giving poor guidance, or firing when they should not without a security impact, are bugs — open an issue.

## Supported versions

Only the latest release on `main` is supported. A fix ships as a new release, and users pick it up with `claude plugin update iangregson-graphify@iangregson`.

## What to expect

This repo is maintained by one person in their own time, so there's no guaranteed response time and no bug bounty. Reports are read and handled on a best-effort basis.

If a report is valid, the fix lands on `main` and a GitHub advisory is published. Credit is given to the reporter unless you'd rather stay anonymous — say which you prefer in the report.
