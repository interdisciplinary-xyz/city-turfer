---
name: verify-change
description:
  Prove a CityTurfer change works before calling it done — pick the checks from what the diff
  touched (mobile app, shared kernel, turf, recording, health, packages/ui, web, tools, docs,
  .claude), run them fastest-first, run the mobile-reviewer agent, and report what was verified and
  what was not. Use after building or fixing anything, before committing or opening a PR, and
  whenever the user asks "does it work?", "is it done?" or "run the checks".
---

# Verify a change

The rule: **say only what you ran.** Tests passing never proves background tracking, maps or
HealthKit work on a device (CLAUDE.md). The report at the end separates "verified" from "not
verified".

## 1. What changed

```bash
git status --porcelain
git diff --stat "$(git merge-base HEAD origin/scope/vX.Y.Z)"   # active scope: see the session-start note
```

If the working tree holds the user's unrelated work in progress, verify only your paths and say so.

## 2. Pick the checks (fastest first, stop at the first failure and fix it)

- Any `apps/mobile/src/**`
  - `pnpm -C apps/mobile exec tsc --noEmit`
  - `pnpm -C apps/mobile run arch` (dependency rules)
  - `pnpm -C apps/mobile exec jest --findRelatedTests <changed files>`, then the full
    `pnpm -C apps/mobile exec jest`
  - `pnpm run audit:logs` (privacy: no unguarded console, no coordinates in diagnostics)
- `apps/mobile/src/shared-kernel/**` or `apps/mobile/tools/lib/geo.mjs`
  - Compare against the oracle: `node apps/mobile/tools/route-stats.mjs <fixture.gpx>` vs the app's
    numbers (route-metrics skill). `pnpm -C apps/mobile run test:tools`.
- `apps/mobile/src/contexts/territory/domain/**` or `apps/mobile/tools/turf-preview.mjs`
  - The turf vectors test (`apps/mobile/tools/fixtures/turf-vectors.json`) must pass unchanged
    unless the formula change is intended; then regenerate and say so. Optional look:
    `node apps/mobile/tools/turf-preview.mjs apps/mobile/tools/fixtures/history --out /tmp/turf.html`.
- `apps/mobile/src/contexts/recording/**`, permissions, background task
  - Jest is not enough: dev build + replayed route
    (`apps/mobile/tools/sim-location.sh ios apps/mobile/tools/fixtures/run-5k.gpx`), screen off /
    app backgrounded. Follow the mobile-testing skill or hand it to the `mobile-test-engineer`.
- Screens, maps, `contexts/*/ui/**`
  - Simulator screenshot (`xcrun simctl io booted screenshot /tmp/shot.png`) and look at it; the
    Maestro flow for that screen in `apps/mobile/e2e/` when one exists (`maestro test <flow>`).
- `apps/mobile/src/contexts/health-sync/**` — the apple-health skill's simulator checks (Maestro
  flow 11).
- `packages/ui/**` or `packages/brand/**`
  - `pnpm exec turbo run typecheck test:unit --filter=@cityturfer/ui --filter=@cityturfer/brand`
  - Runtime fingerprint unchanged (design-system skill):
    `pnpm -C apps/mobile exec expo-updates fingerprint:generate --platform ios`
  - `pnpm --filter @cityturfer/storybook build` when a story or component changed.
- `apps/web/**` — `pnpm exec turbo run typecheck lint build --filter=@cityturfer/web`
- `tools/**` — `pnpm run test:tools` and `pnpm exec eslint tools`
- `docs/**` or any `*.md` with paths — `pnpm run audit:docs`
- `.claude/**` or `CLAUDE.md` — `pnpm run audit:harness` and `pnpm run audit:docs`

Across workspaces at once: `pnpm exec turbo run typecheck arch test:unit --affected`
(`TURBO_SCM_BASE=origin/scope/vX.Y.Z` to compare against the active scope).

## 3. The full gate

Before pushing: `pnpm run ci:quality` (Prettier, ESLint, tsc, dependency rules, Jest, tool tests,
log audit, e2e audit) — the same job CI runs. For scope → release: `pnpm run test:e2e` too.

## 4. Review

Run the `mobile-reviewer` agent on the diff, for app and website changes alike (it has a website
section for `web-engineer` work). Fix **blocking** findings and re-run the affected checks.

## 5. Report

```
Verified:      tsc, depcruise, jest (412 passed), audit:logs, ci:quality
               simulator replay of run-5k.gpx: 5.02 km vs oracle 5.01 km
Not verified:  background tracking on a real device; Android
Review:        mobile-reviewer — no blocking findings (1 nit fixed)
```

Never write "works" for a layer you did not exercise.
