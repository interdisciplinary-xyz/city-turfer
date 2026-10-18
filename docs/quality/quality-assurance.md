# Quality assurance policy

**Last reviewed:** 2026-10-17

Re-runnable QA charter. Run it before every `scope/vX.Y.Z` to `release/vX.Y.Z` promotion. It
complements [`docs/process/release-manager.md`](../process/release-manager.md) (branching and
release flow), [`e2e.md`](./e2e.md) (critical paths) and [`smoke-test.md`](./smoke-test.md) (device
checklist). Adapted from empatalk's `docs/quality/QUALITY_ASSURANCE.md`.

## 1. The quality gate

The single local gate, also run by CI on every PR into `scope/**`, `release/**` and `main`:

```bash
pnpm run ci:quality   # standard (format + lint) + types + arch + unit (jest + node tool tests) + e2e:audit
```

| Check         | Command                            | Pass bar                                                                        |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| Format        | `pnpm run standard:format`         | Prettier clean                                                                  |
| Lint          | `pnpm run standard:lint`           | 0 errors (src, index.ts, tools)                                                 |
| Types         | `pnpm run test:types`              | `tsc --noEmit` 0 errors (strict)                                                |
| Architecture  | `pnpm run test:arch`               | dependency-cruiser: 0 violations (layers and context boundaries)                |
| Unit          | `pnpm run test:unit`               | all green. Baseline: **81 Jest tests in 7 suites**, plus **10 node tool tests** |
| E2E audit     | `pnpm run e2e:audit`               | 0 errors: flows, `config.yaml`, CP table and `testID`s agree                    |
| E2E (manual)  | `pnpm run test:e2e`                | all **10 Maestro flows** green on the iOS Simulator (needs a dev build)         |
| Release smoke | [`smoke-test.md`](./smoke-test.md) | every box ticked on a physical iPhone                                           |

Baselines measured on 2026-10-17 (Apple Silicon laptop, warm cache): `pnpm run ci:quality` takes
about 8-10 seconds. The Maestro suite takes several minutes because the demo-history seed step waits
up to 240 seconds; record the real figure of your run in the release PR.

Baselines are floors, not contracts: the count may only go up. A drop means tests were deleted and
needs an explanation in the PR.

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

- **Unit (Jest, `jest-expo`)**: co-located or under `__tests__`. Domain logic, use cases against
  real SQLite (better-sqlite3 adapter) and the background task handler through the mocked
  `expo-task-manager` `__tasks` handle, including overlapping, out-of-order and spiked batches.
- **Tool tests (`node --test tools/__tests__`)**: plain Node `.mjs` tools and parity with the shared
  turf vectors.
- **E2E (Maestro)**: user-facing flows. Critical paths and gaps in [`e2e.md`](./e2e.md).
- **Regression discipline:** a bug report gets a fixture (`apps/mobile/tools/gen-route.mjs`) and a
  failing test first, then the fix.
- **Never claim background tracking works from unit tests.** It needs a dev build on a simulator
  with simulated movement, and finally a real device.

## 4. Release readiness checklist (scope to release)

Copy into the `scope/vX.Y.Z` to `release/vX.Y.Z` PR description.

- [ ] `pnpm run ci:quality` green on the scope branch head (record Jest count and runtime)
- [ ] CI green on the PR (commit naming and quality jobs)
- [ ] `pnpm run test:e2e`: 10/10 flows green on the iOS Simulator; report path noted
      (`e2e-results/<timestamp>`, kept local and never committed)
- [ ] `pnpm run e2e:audit` clean; any new user-facing flow has a CP row in `e2e.md`
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
