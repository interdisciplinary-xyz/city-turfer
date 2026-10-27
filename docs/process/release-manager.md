---
status: canonical
verified: 2026-10-27
owner: founder
scope: [.github/workflows, .husky, .versionrc.json, commitlint.config.mjs, tools/release]
summary:
  Branch flow feat → scope → release → main, small changes straight to scope, PR titles,
  Conventional Commits, changelog, OTA vs native
---

# Branching, release & changelog policy

Adapted from empatalk's `docs/process/release-manager.md`. Repository:
`interdisciplinary-xyz/city-turfer`.

## Flow

```
feat/<domain>  ─PR→  scope/vX.Y.Z  ─PR→  release/vX.Y.Z  ─PR→  main  ─(release.yml)→  tag vX.Y.Z + CHANGELOG
```

- `feat/<domain>`, `fix/<slug>`, `chore/<slug>`, `test/<slug>`
  - Purpose: One domain / change. **Cut from and PR into the current `scope/vX.Y.Z`.**
  - Validation: Local: `pnpm run ci:quality`; recording changes also a simulator replay
- `scope/vX.Y.Z`
  - Purpose: Integration branch for the milestone version; target of all feature branches.
  - Validation: CI on every PR into `scope/**` (quality + commit naming), plus local
    `pnpm run test:e2e`; before the scope → release merge, "update all docs" (the `docs-engineer`
    agent: PR bodies, session log, CHANGELOG preview, stale docs)
- `release/vX.Y.Z`
  - Purpose: Stabilisation: cloud CI, e2e, real-device field test, OTA to testers.
  - Validation: CI (`.github/workflows/ci.yml`); "update all docs" again before the founder merges
    to `main`
- `main`
  - Purpose: Validated, releasable code only.
  - Validation: CI + release workflow tags it

## Hard rules

1. Always work against the current `scope/vX.Y.Z`. Feature branches are per **domain**
   (`feat/recording`, `feat/territory`, …) and PR into scope — never into `release/*` or `main`. The
   one exception is a **small change** committed straight to scope (next section).
2. `scope/vX.Y.Z` MUST target `release/vX.Y.Z`. Never merge `scope/*` directly into `main`.
3. `release/vX.Y.Z` MUST target `main`. Promotion is PR-based and **merged manually by the founder**
   — automation never merges to `main`.
4. PR titles MUST be `city-turfer - <branch-name>` (e.g. `city-turfer - feat/recording`).
5. Merge commits, not squash (keeps conventional commits for the changelog). Scope → release PRs
   start as **draft**.
6. **Pin at cut:** the first commit on `scope/vX.Y.0` sets `version` to `X.Y.0` in all ten
   `package.json` files: the root, `apps/admin`, `apps/api`, `apps/mobile`, `apps/storybook`,
   `apps/web`, `packages/brand`, `packages/config`, `packages/core` and `packages/ui` (as in
   `20431a7`; the two `@interdisciplinary/*` packages carry no version). On merge to `main`,
   `release.yml` runs `commit-and-tag-version --release-as X.Y.0`, writes `CHANGELOG.md` and pushes
   tag `vX.Y.0`. Tags are never created by hand.
   - **The release commit also bumps `apps/mobile/app.json`** `expo.version` (`.versionrc.json`
     `bumpFiles`, through `tools/release/app-json-version-updater.cjs`; v0.10.0's `8f21e57` touched
     only `CHANGELOG.md` and `app.json`). That field is part of the runtime fingerprint, so the
     release commit itself makes OTA updates stop matching builds installed before it (the
     fingerprint a release PR lists is the one from before the bump). Open risk, not yet decided:
     `docs/decisions/design-system-2026-10-19.md`.
   - **v0.11.0 (JS only), measured 2026-10-24 on `scope/v0.11.0`:** the fingerprint equals `main`'s
     (tag `v0.10.0`): iOS `06aca0e17e430961e1ccb2fd755db451c830efda`, Android
     `ab6e3dbbd0c2ab97a3bc6e8395b0b376a0bb4684`. The release commit's `app.json` bump to 0.11.0
     (`34b3d17`, 2026-10-24) changes it, so builds installed from `v0.10.0` get no OTA published
     from the `v0.11.0` tag. The founder chooses one of (not decided here):
     1. Publish the v0.11.0 OTA from the release head **before** the bump (fingerprint as above),
        then let the release commit land.
     2. Skip `SourceSkips.ExpoConfigVersions` in `apps/mobile/fingerprint.config.js` so the version
        no longer counts. Editing that config is itself a fingerprint change (measured: iOS moves to
        `066c88f8…`), so it cuts off every binary installed before it; only worth it together with a
        reinstall.
     3. Reinstall the phones from the `v0.11.0` tag after the release and publish later OTAs from
        there.
7. Fixes after promotion to release: short `fix/<slug>` branch PR'd into `release/vX.Y.0`, then
   merged back down into the next scope.
8. Hotfixes on `main` (`hotfix/*`) must be merged back down into the active `release/*` and
   `scope/*`.

## Small changes straight to scope

A small change may be committed and pushed directly to the active `scope/vX.Y.Z`, without a feature
branch or PR. Everything else takes the flow above. **Small** means all of:

- **One logical change in a handful of files, reviewable from the commit diff alone**: a copy tweak,
  a colour or token value, a CSS spacing fix, a doc correction, a one-function bug fix.
- **Nothing that needs a PR's scrutiny:** no native or runtime-fingerprint change (nothing in
  `apps/mobile/app.json`, `apps/mobile/plugins/`, `apps/mobile/modules/`, native dependencies or
  `packages/ui` dependencies), no SQLite or Postgres migration, no new dependency or lockfile
  change, no API contract or `apps/api/openapi.json` change, no auth, privacy or security-sensitive
  code, no change to hooks, guards or permissions (`.claude/settings.json`, `.claude/hooks/`,
  `tools/harness/`, `.husky/`, `.github/workflows/`).
- **The founder asked for it, or it is clearly trivial.** In doubt, use a branch and a PR.

How:

1. Commit on top of the current `origin/scope/vX.Y.Z`: `git fetch origin`, then
   `git switch scope/vX.Y.Z && git pull --ff-only`, or `git switch --detach origin/scope/vX.Y.Z`
   when another worktree has the scope checked out.
2. Run the full gate before the push: `TURBO_FORCE=true pnpm run ci:quality` passes.
3. Stage explicit paths, one Conventional Commit as usual (the hooks still run; never
   `--no-verify`).
4. Fast-forward push: `git push origin HEAD:refs/heads/scope/vX.Y.Z`. Never force: if it is
   rejected, `git pull --rebase origin scope/vX.Y.Z` on the local commit, rerun the gate, push
   again.

The commit lands in the CHANGELOG like any other (`release.yml` builds it from the Conventional
Commits on merge to `main`). It has no PR number: the session log and the scope → release PR body
list it by short SHA (`docs-engineer` reads them from `git log --first-parent`), and a reviewer can
be asked to review it after the fact by SHA. No CI runs on a direct push to `scope/*` (CI runs on
PRs and pushes to `main`), which is why the local full gate is required; the scope → release PR's CI
covers it once that PR is ready for review.

Never directly on `release/*` or `main`: fixes after promotion still go through a `fix/<slug>` PR
(rule 7).

## Commits

Conventional Commits, enforced by commitlint (`commitlint.config.mjs`) in the husky `commit-msg`
hook and in CI: `type(scope): description` — types: feat, fix, perf, refactor, docs, test, ci,
chore, style, build, revert. Scopes = bounded contexts / areas (commitlint doesn't restrict them):
`identity`, `recording`, `activity-log`, `territory`, `cloud-backup`, `health-sync`, `platform`,
`core`, `app`, `web`, `api`, `admin`, `brand`, `ui`, `e2e`, `tooling`, `harness`, `release`.

`CHANGELOG.md` is generated from these commits by `commit-and-tag-version` (`.versionrc.json`):
Features, Bug Fixes, Performance, Refactoring, Documentation, Tests, CI/CD (chore/style/build
hidden). Don't edit it by hand.

## Mobile specifics

- **OTA vs native:** JS-only changes ship as EAS Updates on channel `production`
  (`pnpm -C apps/mobile dlx eas-cli update --channel production --environment production`). Anything
  that changes the runtime fingerprint (native modules, `app.json` including its `version`, config
  plugins, permissions, icons, splash) needs a rebuild + reinstall — say so in the PR's "Risk &
  rollback".
- A release PR lists the runtime fingerprint it ships
  (`pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios`).

## Hooks

- `pre-commit`: the secret-file guard (`tools/check-secret-files.mjs`) first, then lint-staged
  (ESLint --fix, then Prettier).
- `commit-msg`: commitlint.
- `pre-push`: `pnpm exec turbo run typecheck arch test:unit` (CI also runs Prettier, ESLint, the
  builds and the audits).

## CI

`.github/workflows/ci.yml` runs on every non-draft pull request into `main`, `release/**` and
`scope/**` (feature to scope, scope to release, release to main), plus pushes to `main`:

- `quality`: the secret-file guard over tracked files, then `pnpm run ci:quality` (Prettier, ESLint,
  tsc, dependency rules, unit tests, builds, the admin's generated-files check, Node tool tests,
  log, harness, i18n and E2E audits). A throwaway Postgres service backs `apps/admin`'s Payload
  tests.
- `commitlint` lints every commit in the PR range, not only the last one.

Cost control is kept by: skipping draft PRs, skipping docs-only changes (`paths-ignore`), cancelling
superseded runs (`concurrency`), and keeping the heavy checks (Maestro E2E, device field test) out
of CI (`pnpm test:chain` and the portal E2E have no CI job yet). The earlier rule that skipped PRs
from `scope/*` heads is gone: the quality job is cheap and scope to release is the last gate before
stabilisation.
