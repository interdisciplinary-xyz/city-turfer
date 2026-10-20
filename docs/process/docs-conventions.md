---
status: canonical
verified: 2026-10-17
owner: founder
scope: [tools/docs-audit.mjs, docs, .claude/commands/audit-docs.md]
summary:
  How docs/ declares its own freshness — frontmatter, folders, filenames, probes and the audit
---

# Docs conventions

Canonical for: the frontmatter contract, where a doc lives, filenames, probes and the audit loop.
Adapted from empatalk's docs conventions (`process/DOCS_CONVENTIONS.md` in that repo). Enforcement:
`pnpm run audit:docs` (`tools/docs-audit.mjs`). Judgment layer: the `/audit-docs` command
(`.claude/commands/audit-docs.md`).

## The problem this solves

A doc that is wrong looks exactly like a doc that is right. Before this, nothing in `docs/` said
whether it was current: skills cited folders that no longer exist (apps/mobile/src/tracking,
apps/mobile/src/metrics, apps/mobile/src/db), and `CLAUDE.md` listed a platform logger and a zustand
store that don't exist. So: **status lives in the file, and every derived number is generated.**

## 1. Frontmatter — required on every doc in `docs/`

```yaml
---
status: canonical # canonical | superseded | historical | proposed | stale
verified: 2026-10-17 # the day someone last checked these claims AGAINST CODE
owner: founder
scope: [apps/mobile/src/contexts/recording, apps/mobile/modules/background-session] # repo paths this doc describes
summary: One line — what this doc is for, shown in the generated index
---
```

- ✅ `canonical`: Source of truth for its topic. Code still wins on conflict.
- ⚠️ `superseded`: Replaced. `summary:` must name the successor.
- 🕰️ `historical`: Point-in-time record (session logs, executed plans). Do **not** read as current.
- 🚧 `proposed`: Describes something not built.
- ❗ `stale`: Known-wrong, not yet fixed. Honest beats silent.

**`verified:` is a claim about work, not a timestamp.** It means someone compared the doc's
falsifiable claims to the code on that date. Don't bump it for a typo fix.

**`scope:` is the load-bearing key.** It drives _review debt_: the audit counts commits that touched
those paths since `verified:`. "The code this doc describes changed 12 times since anyone checked"
is a work item; "30 days old" is noise. A doc without `scope:` opts out of the only automatic
staleness signal.

Files outside `docs/` (`README.md`, `CLAUDE.md`, `.claude/**/*.md`) need no docs frontmatter (skills
and agents have their own), but the audit still checks their paths, links and probes.

## 2. Where a doc lives

`docs/` root holds only `README.md` (curated) and `INDEX.md` (generated). Everything else lives in a
folder named for the reader's job. Create a folder only when a doc goes into it.

- `engineering/`: How the system is built — architecture, decisions, feature inventory
- `product/`: What we build and why — direction, roadmap
- `operations/`: Running it — runbook, OTA releases, device diagnostics
- `quality/`: Testing and QA — e2e inventory, QA policy
- `process/`: How we work — release policy, session migration, these conventions
- `sessions/`: One session log per version, `vX.Y.Z.md` (CityTurfer-specific; `historical` once the
  version ships)
- `decisions/`: Decision records — the full write-up of one decision
- `plans/`: **Live** plans only
- `archive/`: Point-in-time records, out of date on purpose

A plan moves to `archive/` the moment the work ships or is abandoned. Archived docs are marked
`historical`, and the audit demotes their dead paths to info: their stale claims are the record, so
never "fix" their bodies.

**Exemption:** `docs/poc-plan.md` stays at the root for now. `CLAUDE.md`, `README.md` and most
skills and agents link to it; moving it into a folder is a follow-up.

## 3. Filenames

**CityTurfer uses kebab-case for every file**, docs included (the founder's "all files kebab-case"
rule, v0.1.0 day 2). empatalk marks canonical references with `SCREAMING_SNAKE.md`; here **status
lives in the frontmatter, never in the filename**.

- Reference or working doc: `kebab-case.md` (`process/release-manager.md`)
- Dated record: `slug-YYYY-MM-DD.md`, date last so repeats of one topic sort together
  (`decisions/<topic>-2026-10-15.md`)
- Session log: `sessions/vX.Y.Z.md`

Exemptions: `README.md`, `INDEX.md`, `CHANGELOG.md` and friends keep their conventional spelling —
those names mean something to GitHub.

## 4. Probes — never hand-write a derived number

Any count that comes from the codebase goes in a probe:

```md
Bounded contexts: <!-- probe:contexts -->6<!-- /probe -->
```

`pnpm run audit:docs` flags drift; `-- --fix-probes` rewrites every probe from code. The registry is
`PROBES` in `tools/docs-audit.mjs`; add one there rather than typing a number into prose. Today:

- `contexts`: directories in `apps/mobile/src/contexts/` (<!-- probe:contexts -->6<!-- /probe -->)
- `achievements`: `id:` entries in `packages/core/src/contexts/achievements/domain/achievements.ts`
  (<!-- probe:achievements -->12<!-- /probe -->)
- `e2e-flows`: `flowsOrder` entries in `apps/mobile/e2e/config.yaml`
  (<!-- probe:e2e-flows -->13<!-- /probe -->)
- `migrations`: `version:` entries in `apps/mobile/src/platform/migrations.ts`
  (<!-- probe:migrations -->7<!-- /probe -->)
- `docs`: markdown files under `docs/` (<!-- probe:docs -->39<!-- /probe -->)
- `api-operations`: HTTP operations in `apps/api/openapi.json`
  (<!-- probe:api-operations -->22<!-- /probe -->)

**If a number is not probed, don't write it.** Write the derivation instead ("one per file in
`apps/mobile/e2e/`"). Numbers in session logs are fine: they are `historical` records of what was
true then.

## 5. The generated index

`docs/INDEX.md` is the complete inventory, generated from frontmatter by
`pnpm run audit:docs -- --write-index`. Don't hand-edit it: change the doc's `status:`/`summary:`
and re-run. The audit warns when the index is out of date.

## 6. The loop

```bash
pnpm run audit:docs                       # signals: what looks wrong and where
pnpm run audit:docs -- --doc <path>       # one file
pnpm run audit:docs -- --fix-probes       # rewrite derived numbers from code
pnpm run audit:docs -- --write-index      # regenerate docs/INDEX.md
pnpm run audit:docs -- --strict           # exit 1 on any error (for CI)
```

What it checks, in `docs/**`, `README.md`, `CLAUDE.md` and `.claude/**/*.md` (not `CHANGELOG.md`):

- **frontmatter** (docs only): present, all five keys, valid `status`, real date not in the future,
  `scope:` paths exist, superseded docs name a successor
- **dead-path**: an inline-code path (`apps/mobile/src/…`, `tools/…`, `docs/…`, `apps/mobile/e2e/…`,
  `.claude/…`, a context-relative `recording/domain/…`, or a stale root such as app/ at the repo
  root) that doesn't exist and isn't gitignored. Paths inside fenced code blocks and multi-word
  commands are skipped
- **broken-link**: a relative Markdown link whose file or `#anchor` doesn't exist
- **probe-drift**: a probe whose value no longer matches the code
- **filename / placement**: kebab-case, nothing loose in `docs/` root
- **review-debt**: commits touching `scope:` since `verified:`
- **planned-path** (info): a path a plan names on purpose before it exists (`PLANNED_PATHS`); a
  warning once the file exists, so the entry gets dropped

The script emits **signals, never verdicts**. Deciding whether a doc is fixed, demoted, archived or
deleted is the `/audit-docs` command's job, and the default for a rotten doc is _demote or delete_,
not _rewrite_. `audit:docs` is not part of `pnpm run ci:quality` yet; adding `--strict` to CI is a
follow-up once the docs are clean.

## 7. Rules that are easy to get wrong

- **Code wins over docs, always.** A doc that disagrees with code is wrong. Fix the doc, or file the
  bug — never "correct" the code to match.
- **Deleting beats rewriting.** A `historical` doc may be wrong; it may not be unlabelled.
- **Never set `verified:` to today unless you re-read the code.** The date is only worth something
  if it means that.
