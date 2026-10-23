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

| Path                                                                                                                         | Owner                  | Skills it follows                |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------- |
| `packages/core/` (shared kernel, core contexts, constants, `h3/`)                                                            | `location-engineer`    | ddd-architecture, route-metrics  |
| `contexts/recording/{domain,application,infrastructure}`, `apps/mobile/modules/background-session/`                          | `location-engineer`    | ddd-architecture, gps-tracking   |
| `contexts/activity-log/{domain,application,infrastructure}`, `platform/`, `wiring.ts`, `composition-root.ts`                 | `location-engineer`    | ddd-architecture, route-storage  |
| `contexts/territory/{domain,application,infrastructure}`, `apps/mobile/tools/lib/`, `turf-preview.mjs`                       | `location-engineer`    | ddd-architecture, turf-territory |
| `contexts/{achievements,identity}/` (non-ui), `apps/mobile/src/constants/` (not `colors.ts`), `apps/mobile/src/dev/`         | `location-engineer`    | ddd-architecture                 |
| `apps/mobile/app.json` and `apps/mobile/plugins/`, except the entries named below                                            | `location-engineer`    | gps-tracking                     |
| `contexts/health-sync/` (all layers, incl. its card), the HealthKit plugin entry, `react-native.config.js`                   | `health-engineer`      | apple-health                     |
| `contexts/cloud-backup/{domain,application,infrastructure}`                                                                  | `api-engineer`         | api-design, ddd-architecture     |
| `apps/api/` (routes, schemas, server side of cloud backup and sync), its decision records                                    | `api-engineer`         | api-design                       |
| `apps/mobile/src/app/`, `contexts/*/ui/` (not health-sync), `ui-kit/`, maps, `apps/mobile/plugins/with-local-maplibre.js`    | `mobile-ui-engineer`   | turf-territory (Turf Map)        |
| `packages/ui/`, `apps/storybook/` config, app and ui stories                                                                 | `mobile-ui-engineer`   | design-system                    |
| `packages/brand/`, `constants/colors.ts`, icons and splash in `app.json`, `apps/mobile/tools/brand/`, copy                   | `brand-designer`       | brand-system, design-system      |
| `apps/web/`, `packages/dev-toolbar/`, website stories                                                                        | `web-engineer`         | web-motion                       |
| `apps/mobile/e2e/`, `apps/mobile/src/test-support/`, `apps/mobile/tools/` fixtures and replay scripts, `docs/quality/e2e.md` | `mobile-test-engineer` | mobile-testing                   |
| `docs/quality/quality-assurance.md`, `docs/quality/smoke-test.md`, the release QA report in the scope → release PR           | `qa-engineer`          | verify-change, mobile-testing    |
| `.claude/`, `tools/` (audits, harness, release), `packages/config/`, `packages/eslint-config/`, CI, `.husky/`                | `harness-engineer`     | ai-harness                       |
| `docs/product/`, product specs in `docs/plans/`                                                                              | `product-manager`      | product-knowledge                |

Other `docs/` files belong to the owner of the area they describe. **Integration:** the main session
commits and opens the PR (`ship-branch` skill); the founder merges. Cloud Backup belongs to
`api-engineer` on both sides (agree the contract first); only its `ui/` card is
`mobile-ui-engineer`'s. If an agent is unavailable, follow its skills directly in the main session.

Inside-out: shared kernel → domain → application → infrastructure → UI. Independent pieces (for
example, a metrics function and a UI component built against its typed signature) can run as
parallel agents.

## 3. Verify

Follow the `verify-change` skill: it picks the checks from what the diff touched (tsc, dependency
rules, Jest, oracle and turf vectors, privacy audit, fingerprint) and, for anything a user can see
or that touches tracking, a dev build with a replayed fixture (`mobile-testing` skill, layer 2) and
a simulator screenshot (`xcrun simctl io booted screenshot <session scratchpad>/shot.png`) you
actually look at.

## 4. Review

Run the `mobile-reviewer` agent on the diff. Fix the blocking findings and re-run the checks.

## 5. Close out

Tick the item in `NOTEBOOK.md`. Report what was verified (tests, simulator, device) and what wasn't.
When the user wants it shipped, follow the `ship-branch` skill (commit, push, PR into the active
scope).
