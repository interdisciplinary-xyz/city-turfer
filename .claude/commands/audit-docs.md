---
description:
  Audit the docs for rot — run pnpm run audit:docs, verify the load-bearing claims against code,
  report findings and propose fixes (fix, demote, archive or delete)
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Audit docs

Check whether CityTurfer's docs still tell the truth. Conventions:
`docs/process/docs-conventions.md`.

Scope: `$ARGUMENTS` if given (a path, a folder or a topic), otherwise `docs/`, `README.md`,
`CLAUDE.md` and `.claude/**/*.md`.

## Steps

1. **Signals.** Run `pnpm run audit:docs` (one file: `pnpm run audit:docs -- --doc <path>`). It
   reports falsifiable signals only: frontmatter, dead-path, broken-link, probe-drift, filename,
   placement, review-debt, planned-path, index.
2. **Sanity-check the tool before trusting it.** Hand-verify two probes (`ls src/contexts`, count
   `flowsOrder` in `e2e/config.yaml`). A wrong probe makes every dependent finding noise.
3. **Triage records out first.** Session logs (`docs/sessions/`) and anything in docs/archive (once
   it exists) are point-in-time records: being out of date is their job. Make sure they are
   `historical` and leave their bodies alone.
4. **Rank by blast radius, not finding count.** First the docs people and agents act on: `CLAUDE.md`
   hard rules, skills and agents (they steer code changes), the release policy, the runbook. Ask
   what breaks if someone follows the doc today.
5. **Verify each load-bearing claim against code**, citing `file:line` from the implementation, not
   from another doc. Drop anything you can't substantiate.
6. **Propose a verdict, cheapest rung first:** delete > demote (`stale` / `historical`) > shrink >
   fix. Propose _fix_ only when you are re-verifying the claims now, and only then set `verified:`
   to today.
7. **Regenerate.** `pnpm run audit:docs -- --fix-probes`, then
   `pnpm run audit:docs -- --write-index`, then `pnpm exec prettier --write` on the changed files. A
   number corrected by hand instead of turned into a probe will rot again.

## Report

A ranked list, one item per doc: doc · status · proposed verdict · the wrong claim · the `file:line`
that proves it. Then **Not verified** (so silence isn't mistaken for health) and **Rot that will
recur** (hand-written numbers, missing `scope:`, docs nobody owns).

Ask before applying the fixes unless the user asked you to apply them. Don't headline the raw
finding count; it measures the scanner, not the docs.

## Hard rules

- Code wins over docs. If the code looks wrong, report it as a separate bug; don't change code to
  match a doc.
- Never bump `verified:` on claims you didn't re-read against code.
- Don't edit `CHANGELOG.md` (generated) or `docs/INDEX.md` by hand (run `--write-index`).
