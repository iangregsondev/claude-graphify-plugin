## Summary

<!-- What does this change and why? One or two sentences. -->

## Related issue

<!-- e.g. #12 — use a plain reference, not a closing keyword. -->

## Type of change

- [ ] Hook behaviour
- [ ] Guidance text (`hooks/context/graphify.md`)
- [ ] Documentation
- [ ] Tooling / CI / repo config

## Checklist

- [ ] `vp run ready` passes
- [ ] If this changes anything under `hooks/`, a changeset is included (`vpx changeset`)
- [ ] Markdown prose is not hard-wrapped — one line per paragraph

For a new or changed hook:

- [ ] It exits 0 with no output in a repo without a graphify graph
- [ ] Every guard case has a test in `tests/`
- [ ] Scripts are committed with the executable bit set
- [ ] A new script is registered in `hooks/hooks.json`, and the README has a row for it
- [ ] Tried in a real session with `claude --plugin-dir .`
