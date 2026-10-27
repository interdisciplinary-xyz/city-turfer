---
name: verify-change
description: >-
  Prove a change works before calling it done: pick checks from what the diff touched (app, core,
  API, web, packages, tools, .claude), run them fastest first, get a review, report verified vs not.
  Use before committing or a PR, or when asked "does it work?" or "run the checks".
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
- `packages/core/**` (`@cityturfer/core`: shared kernel, core constants, the domain and application
  layers of Territory, Activity Log, Achievements, Identity; used by the app and the API)
  - `pnpm exec turbo run typecheck arch test:unit --filter=@cityturfer/core --filter=@cityturfer/mobile --filter=@cityturfer/api`
    (core's own dependency rules plus both consumers)
- `packages/core/src/shared-kernel/**` or `apps/mobile/tools/lib/geo.mjs`
  - Compare against the oracle: `node apps/mobile/tools/route-stats.mjs <fixture.gpx>` vs the app's
    numbers (route-metrics skill). `pnpm -C apps/mobile run test:tools`.
- `packages/core/src/contexts/territory/domain/**` or `apps/mobile/tools/turf-preview.mjs`
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
- `apps/api/**`
  - `pnpm exec turbo run typecheck lint test:unit --filter=@cityturfer/api` (lint includes Redocly;
    the Vitest suite fails when the committed `apps/api/openapi.json` drifts from the routes)
  - Routes changed: `pnpm --filter @cityturfer/api run openapi`, commit the spec, and try them in
    Swagger (`pnpm --filter @cityturfer/api dev`, https://cityturfer.local/swagger) — api-design
    skill
  - Schema changed: `pnpm --filter @cityturfer/api run db:generate` and commit `apps/api/drizzle/`
- `apps/web/**` — `pnpm exec turbo run typecheck lint build --filter=@cityturfer/web`
  - Portal paths (account pages, `apps/web/src/api/`, portal E2E): also the `web-portal` skill's
    "How to verify" (unit tests, HTTPS E2E with the network allow-list, axe)
- `apps/mobile/messages/**` or `apps/web/messages/**` — `pnpm run audit:i18n` (mobile-i18n skill)
- `tools/**` — `pnpm run test:tools` and `pnpm exec eslint tools`
- `docs/**` or any `*.md` with paths — `pnpm run audit:docs`
- `.claude/**` or `CLAUDE.md` — `pnpm run audit:harness` and `pnpm run audit:docs`; for an edited
  agent or skill, confirm it shows up in the session's agent or skill list (ai-harness skill)

Across workspaces at once: `pnpm exec turbo run typecheck arch test:unit --affected`
(`TURBO_SCM_BASE=origin/scope/vX.Y.Z` to compare against the active scope).

## 3. The full gate

Before pushing: `pnpm run ci:quality` (Prettier, ESLint, tsc, dependency rules, Jest, tool tests,
log audit, e2e audit) — the same job CI runs. A small change pushed straight to scope gets no CI
run, so it needs `TURBO_FORCE=true pnpm run ci:quality` (no cached results) to pass first
(`ship-branch` skill, step 1a). For scope → release: `pnpm run test:e2e` too.

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
