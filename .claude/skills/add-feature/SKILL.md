---
name: add-feature
description: >-
  Use when the user asks to build, implement or add a user-facing feature, or says "next feature" /
  "continue the roadmap". End-to-end CityTurfer workflow: plan with rn-architect, delegate to
  specialist agents, test, verify on a simulator, review.
---

# Add a feature

## 0. Know where we are

Read `CLAUDE.md` and `docs/product/product-brief.md` (what the product is and promises; the
`product-knowledge` skill). The backlog is `NOTEBOOK.md` at the repo root, one block per version,
and the active `scope/v*` branch: work on the open version's unticked items. For a feature that
needs product shaping first (who it's for, copy, success criteria), ask the `product-manager` agent
for a spec. The PoC milestones in `docs/poc-plan.md` §6 are history; their exit checks still make
good acceptance criteria.

## 1. Plan (rn-architect)

Delegate to the `rn-architect` agent with the feature request. It returns: the user flow, files to
add or change, data/schema changes, which specialist owns each piece, and acceptance criteria. For a
feature that touches more than three files, show the plan to the user before writing code.

## 2. Build (specialists, in dependency order)

This table is the **ownership map**: one owner per path, and every agent's "what you own" points
here. Paths under `contexts/` are in `apps/mobile/src/contexts/`; the shared domain of Territory,
Activity Log, Achievements and Identity (domain + application) lives in
`packages/core/src/contexts/`. The implementing agent writes the unit tests for its own code.

| Path                                                                                                                                                                                        | Owner                  | Skills it follows                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------- |
| `packages/core/` (shared kernel, core contexts, constants, `h3/`)                                                                                                                           | `location-engineer`    | ddd-architecture, route-metrics  |
| `contexts/recording/{domain,application,infrastructure}`, `apps/mobile/modules/background-session/`                                                                                         | `location-engineer`    | ddd-architecture, gps-tracking   |
| `contexts/activity-log/{domain,application,infrastructure}`, `platform/`, `wiring.ts`, `composition-root.ts`                                                                                | `location-engineer`    | ddd-architecture, route-storage  |
| `contexts/territory/{domain,application,infrastructure}`, `apps/mobile/tools/lib/`, `turf-preview.mjs`                                                                                      | `location-engineer`    | ddd-architecture, turf-territory |
| `contexts/{achievements,goals,identity,route-planning}/` (non-ui), `apps/mobile/src/constants/` (not `colors.ts`), `apps/mobile/src/dev/`                                                   | `location-engineer`    | ddd-architecture                 |
| `apps/mobile/app.json` and `apps/mobile/plugins/`, except the entries named below (HealthKit, image picker, sharing, icons, splash, MapLibre)                                               | `location-engineer`    | gps-tracking                     |
| `contexts/health-sync/` (all layers, incl. its card), the HealthKit plugin entry, `react-native.config.js`                                                                                  | `health-engineer`      | apple-health                     |
| `contexts/share-photo/` (all layers), the `expo-image-picker` and `expo-sharing` plugin entries in `app.json`                                                                               | `mobile-ui-engineer`   | ddd-architecture, design-system  |
| `contexts/cloud-backup/{domain,application,infrastructure}`                                                                                                                                 | `api-engineer`         | api-design, ddd-architecture     |
| `apps/api/` (routes, schemas, server side of cloud backup and sync), its decision records                                                                                                   | `api-engineer`         | api-design                       |
| `apps/mobile/src/app/`, `contexts/*/ui/` (not health-sync), `ui-kit/`, maps, `apps/mobile/plugins/with-local-maplibre.js`                                                                   | `mobile-ui-engineer`   | turf-territory (Turf Map)        |
| `apps/mobile/src/i18n/`, `apps/mobile/messages/` (keys in every locale; the wording is `brand-designer`'s)                                                                                  | `mobile-ui-engineer`   | mobile-i18n                      |
| `packages/ui/`, `apps/storybook/` config, app and ui stories                                                                                                                                | `mobile-ui-engineer`   | design-system                    |
| `packages/brand/`, `constants/colors.ts`, icons and splash in `app.json`, `apps/mobile/tools/brand/`, copy, the surface map and known drift (`tools/brand/surfaces.mjs`, `known-drift.mjs`) | `brand-designer`       | brand-system, brand-surfaces     |
| `apps/web/` (landing, shared layout, `vercel.json`, `next.config.ts`) except the portal, `packages/dev-toolbar/`, website stories                                                           | `web-engineer`         | web-motion                       |
| the portal paths in the `web-portal` skill (account subtree, `apps/web/src/lib/api/`, portal stories and E2E, `portal.*` keys)                                                              | `portal-engineer`      | web-portal                       |
| `apps/mobile/e2e/`, `apps/mobile/src/test-support/`, `apps/mobile/tools/` fixtures and replay scripts, `docs/quality/e2e.md`                                                                | `mobile-test-engineer` | mobile-testing                   |
| `docs/quality/quality-assurance.md`, `docs/quality/smoke-test.md`, the release QA report in the scope → release PR                                                                          | `qa-engineer`          | verify-change, mobile-testing    |
| `.claude/`, `tools/` (audits incl. `brand-audit.mjs`, `tools/brand/snapshot.mjs`, harness, release), `packages/config/`, `packages/eslint-config/`, CI, `.husky/`                           | `harness-engineer`     | ai-harness                       |
| `docs/product/`, product specs in `docs/plans/`                                                                                                                                             | `product-manager`      | product-knowledge                |
| `docs/sessions/`, `docs/INDEX.md`, scope/release PR bodies (not the QA report), CHANGELOG preview, docs facts                                                                               | `docs-engineer`        | ship-branch                      |

Other `docs/` files belong to the owner of the area they describe. **Integration:** the main session
commits and opens the PR (`ship-branch` skill); the founder merges. Cloud Backup belongs to
`api-engineer` on both sides (agree the contract first); only its `ui/` card is
`mobile-ui-engineer`'s. On the website, `web-engineer` edits `apps/web/vercel.json` and
`next.config.ts`, including the portal's `/api/v1/*` route, CSP and headers, which `portal-engineer`
specifies and its E2E checks. If an agent is unavailable, follow its skills directly in the main
session.

Inside-out: shared kernel → domain → application → infrastructure → UI. Independent pieces (for
example, a metrics function and a UI component built against its typed signature) can run as
parallel agents.

### Async requests (every surface)

The founder's rule (2026-11-25, `docs/decisions/error-tracking-2026-11-25.md`): **try** loading on,
do the work, success message; **catch** report an _unexpected_ error, show an error message;
**finally** loading off. Narrowed: a success toast only for a mutation the user started whose result
the screen doesn't show by itself (none for reads, map loads, planner taps or background work).
Offline, API 4xx, `DomainError`, a denied permission and `ExpectedFailure` are expected: worded,
never reported. Reports carry no coordinates, Health data or e-mail (`audit:logs` flags coordinate
words in a report call; `packages/core/src/error-scrub` scrubs every event again).

- **App:** every action the Turfer starts runs through `useAsyncAction`
  (`apps/mobile/src/ui-kit/use-async-action.ts`), never a hand-rolled try/catch/finally or
  `isLoading` state. `run` never throws, runs once at a time (`busy`) and is safe after unmount:

  ```tsx
  // apps/mobile/src/app/activity/[id].tsx: deleting leaves the screen, so a toast confirms it
  const deletion = useAsyncAction<void>({
    area: 'activity-log',
    code: 'delete-activity',
    successKey: 'activity.toast.deleted',
  });
  if ((await deletion.run(remove)).status === 'done') {
    router.back();
  }
  // a button: <Button busy={deletion.isLoading} … />
  ```

  Options (`use-async-action.constants.ts`): `errorKey` replaces the generic message (`null` when a
  form shows its error inline), `isExpected` adds errors this action expects; what counts as
  expected is `classify-error.ts`. Background work (task, outbox, Health import) never toasts: it
  hands unexpected errors to the `ErrorReporter` port
  (`apps/mobile/src/platform/error-reporter.ts`).

- **API:** a route does the work and throws; no per-route try/catch. `app.onError`
  (`apps/api/src/app.ts`) answers `AppError`/`DomainError` with their problem+json; only the rest
  becomes `500 internal` plus one scrubbed report (`apps/api/src/sentry.ts`): the `api-design`
  skill.
- **Portal:** pending and error state come from the TanStack hooks
  (`apps/web/src/lib/api/hooks.ts`), errors worded inline; the query client hands every failure to
  `portalErrorReporter` (`apps/web/src/lib/api/query-client.ts`; `error-reports.ts` keeps only the
  unexpected): the `web-portal` skill. Public website pages load no Sentry.

## 3. Verify

Follow the `verify-change` skill: it picks the checks from what the diff touched (tsc, dependency
rules, Jest, oracle and turf vectors, privacy audit, fingerprint) and, for anything a user can see
or that touches tracking, a dev build with a replayed fixture (`mobile-testing` skill, layer 2) and
a simulator screenshot (`xcrun simctl io booted screenshot <session scratchpad>/shot.png`) you
actually look at.

## 4. Review

Run the `mobile-reviewer` agent on the diff (findings per the `verify-change` skill's "What a review
reports"). Fix the blockers and re-run the checks.

## 5. Close out

Tick the item in `NOTEBOOK.md`. Report what was verified (tests, simulator, device) and what wasn't.
When the user wants it shipped, follow the `ship-branch` skill (commit, push, PR into the active
scope; a small change by the policy in `docs/process/release-manager.md` may go straight to scope,
in doubt a PR).
