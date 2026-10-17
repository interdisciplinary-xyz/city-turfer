# Branching, release & changelog policy

Adapted from empatalk's `docs/process/release-manager.md`. Repository:
`interdisciplinary-xyz/city-turfer`.

## Flow

```
feat/<domain>  ─PR→  scope/vX.Y.Z  ─PR→  release/vX.Y.Z  ─PR→  main  ─(release.yml)→  tag vX.Y.Z + CHANGELOG
```

- `feat/<domain>`, `fix/<slug>`, `chore/<slug>`, `test/<slug>`
  - Purpose: One domain / change. **Cut from and PR into the current `scope/vX.Y.Z`.**
  - Validation: Local: `npm run ci:quality`; recording changes also a simulator replay
- `scope/vX.Y.Z`
  - Purpose: Integration branch for the milestone version; target of all feature branches.
  - Validation: CI on every PR into `scope/**` (quality + commit naming), plus local
    `npm run test:e2e`
- `release/vX.Y.Z`
  - Purpose: Stabilisation: cloud CI, e2e, real-device field test, OTA to testers.
  - Validation: CI (`.github/workflows/ci.yml`)
- `main`
  - Purpose: Validated, releasable code only.
  - Validation: CI + release workflow tags it

## Hard rules

1. Always work against the current `scope/vX.Y.Z`. Feature branches are per **domain**
   (`feat/recording`, `feat/territory`, …) and PR into scope — never into `release/*` or `main`.
2. `scope/vX.Y.Z` MUST target `release/vX.Y.Z`. Never merge `scope/*` directly into `main`.
3. `release/vX.Y.Z` MUST target `main`. Promotion is PR-based and **merged manually by the founder**
   — automation never merges to `main`.
4. PR titles MUST be `city-turfer - <branch-name>` (e.g. `city-turfer - feat/recording`).
5. Merge commits, not squash (keeps conventional commits for the changelog). Scope → release PRs
   start as **draft**.
6. **Pin at cut:** the first commit on `scope/vX.Y.0` sets `package.json` and `app.json` `version`
   to `X.Y.0`. On merge to `main`, `release.yml` runs `commit-and-tag-version --release-as X.Y.0`,
   writes `CHANGELOG.md` and pushes tag `vX.Y.0`. Tags are never created by hand.
7. Fixes after promotion to release: short `fix/<slug>` branch PR'd into `release/vX.Y.0`, then
   merged back down into the next scope.
8. Hotfixes on `main` (`hotfix/*`) must be merged back down into the active `release/*` and
   `scope/*`.

## Commits

Conventional Commits, enforced by commitlint (`commitlint.config.mjs`) in the husky `commit-msg`
hook and in CI: `type(scope): description` — types: feat, fix, perf, refactor, docs, test, ci,
chore, style, build, revert. Scopes = bounded contexts / areas: `identity`, `recording`,
`activity-log`, `territory`, `platform`, `shared-kernel`, `app`, `brand`, `e2e`, `tooling`,
`release`.

`CHANGELOG.md` is generated from these commits by `commit-and-tag-version` (`.versionrc.json`):
Features, Bug Fixes, Performance, Refactoring, Documentation, Tests, CI/CD (chore/style/build
hidden). Don't edit it by hand.

## Mobile specifics

- **OTA vs native:** JS-only changes ship as EAS Updates on channel `production`
  (`npx eas-cli update --channel production --environment production`). Anything that changes the
  runtime fingerprint (native modules, `app.json` plugins/permissions, icons, splash) needs a
  rebuild + reinstall — say so in the PR's "Risk & rollback".
- A release PR lists the runtime fingerprint it ships
  (`npx expo-updates fingerprint:generate --platform ios`).

## Hooks

- `pre-commit`: lint-staged (ESLint --fix, then Prettier).
- `commit-msg`: commitlint.
- `pre-push`: `npm run test:types && npm run test:arch && npm run test:unit` (~15 s; CI also runs
  Prettier and ESLint).

## CI

`.github/workflows/ci.yml` runs on every non-draft pull request into `main`, `release/**` and
`scope/**` (feature to scope, scope to release, release to main), plus pushes to `main`:

- `quality` (`npm run ci:quality`: Prettier, ESLint over `src`, `index.ts` and `tools`, tsc,
  dependency rules, Jest, Node tool tests). It takes under a minute.
- `commitlint` lints every commit in the PR range, not only the last one.

Cost control is kept by: skipping draft PRs, skipping docs-only changes (`paths-ignore`), cancelling
superseded runs (`concurrency`), and keeping the heavy checks (Maestro E2E, device field test) out
of CI. The earlier rule that skipped PRs from `scope/*` heads is gone: the quality job is cheap and
scope to release is the last gate before stabilisation.
