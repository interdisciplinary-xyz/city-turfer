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

Paths under `contexts/` are in `apps/mobile/src/contexts/`; the shared domain of Territory, Activity
Log, Achievements and Identity (domain + application) lives in `packages/core/src/contexts/`.

| Path                                                                     | Agent                  | Skills it follows                |
| ------------------------------------------------------------------------ | ---------------------- | -------------------------------- |
| `packages/core/` (shared kernel, core contexts, constants, `h3/`)        | `location-engineer`    | ddd-architecture, route-metrics  |
| `contexts/recording/{domain,application,infrastructure}`                 | `location-engineer`    | ddd-architecture, gps-tracking   |
| `contexts/activity-log/{domain,application,infrastructure}`, `platform/` | `location-engineer`    | ddd-architecture, route-storage  |
| `contexts/territory/{domain,application,infrastructure}`                 | `location-engineer`    | ddd-architecture, turf-territory |
| `contexts/achievements/infrastructure` (+ its domain in `packages/core`) | `location-engineer`    | ddd-architecture                 |
| `contexts/health-sync/` (all layers, incl. its card)                     | `health-engineer`      | apple-health                     |
| `contexts/cloud-backup/{domain,application,infrastructure}`              | `api-engineer`         | api-design, ddd-architecture     |
| `apps/api/` (routes, schemas, server side of cloud backup and sync)      | `api-engineer`         | api-design                       |
| `apps/mobile/src/app/`, `contexts/*/ui/`, maps (incl. Turf Map), styling | `mobile-ui-engineer`   | turf-territory (Turf Map)        |
| `packages/ui/`, Storybook stories                                        | `mobile-ui-engineer`   | design-system                    |
| `packages/brand/` (tokens, copy), user-facing copy                       | `brand-designer`       | brand-system, design-system      |
| `apps/web/`                                                              | `web-engineer`         | web-motion                       |
| tests, fixtures, simulator runs, Maestro                                 | `mobile-test-engineer` | mobile-testing                   |

Cloud Backup belongs to `api-engineer` on both sides (the app-side context and the API contract it
talks to; agree the contract first); only its `ui/` card is `mobile-ui-engineer`'s. If an agent is
unavailable, follow its skills directly in the main session.

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
