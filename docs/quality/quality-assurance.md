---
status: canonical
verified: 2026-10-23
owner: founder
scope: [package.json, .github/workflows, apps/mobile/e2e, tools/chain]
summary:
  QA charter for scope → release — the ci:quality gate, testing rules and the release checklist
---

# Quality assurance policy

Re-runnable QA charter. Run it before every `scope/vX.Y.Z` to `release/vX.Y.Z` promotion. It
complements [`docs/process/release-manager.md`](../process/release-manager.md) (branching and
release flow), [`e2e.md`](./e2e.md) (critical paths) and [`smoke-test.md`](./smoke-test.md) (device
checklist). The `qa-engineer` agent runs this charter. Adapted from empatalk's QA policy
(quality/QUALITY_ASSURANCE.md in that repo).

## 1. The quality gate

The single local gate, also run by CI (`.github/workflows/ci.yml`) on every PR into `scope/**`,
`release/**` and `main`:

```bash
pnpm run ci:quality   # format + lint + (typecheck, arch, unit, build via turbo) + admin types + tool tests + log, harness, i18n and e2e audits
```

| Check         | Command                                     | Pass bar                                                                          |
| ------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Format        | `pnpm run standard:format`                  | Prettier clean                                                                    |
| Lint          | `pnpm run standard:lint`                    | 0 errors (`tools/` and every workspace)                                           |
| Types         | `pnpm run test:types`                       | `tsc --noEmit` 0 errors (strict) in every workspace                               |
| Architecture  | `pnpm run test:arch`                        | dependency-cruiser: 0 violations (layers and context boundaries)                  |
| Unit          | `pnpm run test:unit`                        | all green: Jest in each workspace, plus the node tool tests in `tools/__tests__/` |
| Build         | `pnpm run build`                            | web export, admin and API builds succeed                                          |
| Audits        | `audit:logs`, `audit:harness`, `audit:i18n` | 0 errors                                                                          |
| E2E audit     | `pnpm run e2e:audit`                        | 0 errors: flows, `config.yaml`, CP table and `testID`s agree                      |
| Sync chain    | `pnpm test:chain` (`tools/chain/run.mjs`)   | every scenario green (phone → API → web portal); manual, no CI job yet            |
| E2E (manual)  | `pnpm run test:e2e`                         | every Maestro flow green on the iOS Simulator (needs a dev build)                 |
| Release smoke | [`smoke-test.md`](./smoke-test.md)          | every box ticked on a physical iPhone                                             |

The Maestro suite has <!-- probe:e2e-flows -->17<!-- /probe --> flows. It takes several minutes
because the demo-history seed step waits up to 240 seconds, and `15-account-settings` sleeps about 2
minutes on purpose; record the real figure of your run in the release PR. Record the Jest and tool
test counts of the gate run in the release PR too.

Test counts may only go up. A drop means tests were deleted and needs an explanation in the PR.

> Run one `tsc` or `ci:quality` at a time; concurrent runs thrash. Use the Node version from
> `.nvmrc`.

## 2. Code quality principles

- **DDD is a hard requirement.** Respect layers and contexts; use the ubiquitous language from
  `docs/poc-plan.md` section 2. `pnpm run test:arch` enforces the dependency rule.
- **Privacy:** location data is personal data. No raw coordinates in logs or analytics in production
  builds. Never commit GPX traces, SQLite files or e2e result folders.
- **Shared-kernel maths is pure and SI.** Expected numbers in metric tests come from
  `node apps/mobile/tools/route-stats.mjs <gpx> --json` or fixture `truth`, never from the code
  under test.
- **No dead or commented-out code**; no commented-out Maestro steps (the E2E audit enforces it).
- **Aggregate changes and domain events are saved in one SQLite transaction**; event handlers are
  idempotent.

## 3. Testing expectations

- **Unit (Jest, `babel-preset-expo`, node environment)**: co-located or under `__tests__`. Domain
  logic, use cases against real SQLite (better-sqlite3 adapter) and the background task handler
  through the mocked `expo-task-manager` `__tasks` handle, including overlapping, out-of-order and
  spiked batches.
- **Tool tests (`node --test tools/__tests__`)**: plain Node `.mjs` tools and parity with the shared
  turf vectors.
- **Sync chain (`pnpm test:chain`)**: phone → API → web portal scenarios against a local API (turf
  cell for cell, totals). Run it when a change touches backup, the API or the portal.
- **E2E (Maestro)**: user-facing flows. Critical paths and gaps in [`e2e.md`](./e2e.md).
- **Regression discipline:** a bug report gets a fixture (`apps/mobile/tools/gen-route.mjs`) and a
  failing test first, then the fix.
- **Never claim background tracking works from unit tests.** It needs a dev build on a simulator
  with simulated movement, and finally a real device.

## 4. Release readiness checklist (scope to release)

Copy into the `scope/vX.Y.Z` to `release/vX.Y.Z` PR description.

- [ ] `TURBO_FORCE=true pnpm run ci:quality` green on the scope branch head (record Jest count and
      runtime). Forced, because the Turbo cache is shared across worktrees and a cached pass may
      come from another checkout
- [ ] CI green on the PR (commit naming and quality jobs)
- [ ] `pnpm run test:e2e`: every flow green on the iOS Simulator; report path noted
      (`e2e-results/<timestamp>`, kept local and never committed)
- [ ] `pnpm run e2e:audit` clean; any new user-facing flow has a CP row in `e2e.md`
- [ ] `pnpm test:chain` green when backup, the API or the web portal changed (scenario count noted)
- [ ] Recording changes: simulator replay done (`apps/mobile/tools/sim-location.sh` with a
      `gen-route.mjs` fixture), point counts before and after backgrounding noted
- [ ] **Real-device field test** on a physical iPhone: [`smoke-test.md`](./smoke-test.md) sections
      2, 3 and 6 are mandatory (screen-off walk, kill mid-run, sign-out refused while recording)
- [ ] Native fingerprint check: if `app.json` plugins, permissions, native modules, icon or splash
      changed, a new native build is required instead of an OTA (see release-manager, Mobile
      specifics)
- [ ] **OTA smoke:** EAS Update published to channel `production`, received on the test iPhone (Me,
      Info, Check for updates), existing data intact
- [ ] Version pinned in `package.json` and `app.json`; `CHANGELOG.md` untouched (generated on
      `main`)
- [ ] Release PR opened as a draft; promotion to `main` is merged manually by the founder

## 5. Known gaps

- Kill-recovery (CP-4) is unit-only; turf release on delete (CP-6) is asserted on the History row
  only. See [`e2e.md`](./e2e.md) section 3.
- No Android Maestro run and no automated performance or battery budget; both are covered only by
  the manual smoke test.
- No CI job for `pnpm test:chain` or the web portal E2E yet; both run by hand.
