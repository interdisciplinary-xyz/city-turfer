---
name: add-feature
description:
  End-to-end workflow for building a CityTurfer feature (e.g. record screen, history list, activity
  detail map, GPX export, auto-pause, splits, settings) — plan with rn-architect, delegate to the
  specialist agents, test, verify on a simulator, review. Use when the user asks to build, implement
  or add a user-facing feature to the app, or says "next feature" / "continue the roadmap".
---

# Add a feature

## 0. Know where we are

Read `CLAUDE.md` and `docs/product/product-brief.md` (what the product is and promises; the
`product-knowledge` skill). The backlog is `NOTEBOOK.md` at the repo root, one block per version:
work on the open version's unticked items. For a feature that needs product shaping first (who it's
for, copy, success criteria), ask the `product-manager` agent for a spec. The PoC milestones in
`docs/poc-plan.md` §6 are history; their exit checks still make good acceptance criteria. If there's
no `package.json`, run the `scaffold-app` skill first.

## 1. Plan (rn-architect)

Delegate to the `rn-architect` agent with the feature request. It returns: the user flow, files to
add or change, data/schema changes, which specialist owns each piece, and acceptance criteria. For a
feature that touches more than three files, show the plan to the user before writing code.

## 2. Build (specialists, in dependency order)

- `contexts/recording/{domain,application,infrastructure}`
  - Agent: `location-engineer`
  - Skill it follows: ddd-architecture, gps-tracking
- `shared-kernel/`
  - Agent: `location-engineer`
  - Skill it follows: ddd-architecture, route-metrics
- `contexts/activity-log/{domain,application,infrastructure}`, `platform/`
  - Agent: `location-engineer`
  - Skill it follows: ddd-architecture, route-storage
- `contexts/territory/{domain,application,infrastructure}`
  - Agent: `location-engineer`
  - Skill it follows: ddd-architecture, turf-territory
- `apps/mobile/src/app/`, `contexts/*/ui/`, maps (incl. Turf Map), styling
  - Agent: `mobile-ui-engineer`
  - Skill it follows: turf-territory (for the Turf Map)
- **tests, fixtures, simulator runs, Maestro**
  - Agent: `mobile-test-engineer`
  - Skill it follows: mobile-testing

Inside-out: shared kernel → domain → application → infrastructure → UI. Independent pieces (for
example, a metrics function and a UI component built against its typed signature) can run as
parallel agents.

## 3. Verify

Follow the `verify-change` skill: it picks the checks from what the diff touched (tsc, dependency
rules, Jest, oracle and turf vectors, privacy audit, fingerprint) and, for anything a user can see
or that touches tracking, a dev build with a replayed fixture (`mobile-testing` skill, layer 2) and
a simulator screenshot (`xcrun simctl io booted screenshot /tmp/shot.png`) you actually look at.

## 4. Review

Run the `mobile-reviewer` agent on the diff. Fix the blocking findings and re-run the checks.

## 5. Close out

Tick the item in `NOTEBOOK.md`. Report what was verified (tests, simulator, device) and what wasn't.
When the user wants it shipped, follow the `ship-branch` skill (commit, push, PR into the active
scope).

## Roadmap (v1)

1. Scaffold + navigation shell + DB migrations
2. Permissions onboarding screen
3. Record screen: type picker (walk/run/cycle), start/pause/resume/stop, live map following the
   user, live stats
4. Background tracking + kill recovery
5. Save/discard, name the activity
6. History list (thumbnail, type icon, date, distance, duration) with infinite scroll
7. Activity detail: full map, stats, splits, elevation chart
8. **Turf**: claims from activities, Turf Map with glowing cells + overlapping tracks, "turf gained"
   (main feature — see turf-territory skill)
9. GPX export/share (+ hide start/end)
10. Settings: units, turf parameters, auto-pause, keep screen on, weight (for calories), delete all
    data
11. Polish: haptics on auto-pause/resume, km split announcements (expo-speech), dark mode,
    accessibility labels
