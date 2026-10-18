---
status: canonical
verified: 2026-10-17
owner: founder
scope:
  [
    apps/mobile/.dependency-cruiser.cjs,
    apps/mobile/src/contexts,
    apps/mobile/src/wiring.ts,
    apps/mobile/src/composition-root.ts,
    apps/mobile/src/app,
    apps/mobile/src/platform,
  ]
summary:
  The bounded contexts, how they talk, the layer rules dependency-cruiser enforces, and how to
  change them
---

# Domain architecture

Canonical for: the context map, the layers, what `pnpm run test:arch` enforces, and the rules for
changing any of it. Adapted from empatalk's `DOMAIN_ARCHITECTURE.md`. The code patterns (aggregate,
value object, use case, repository templates) live in the `ddd-architecture` skill; the ubiquitous
language is `docs/poc-plan.md` §2. Where this doc and the code disagree, the code wins.

## 1. Context map

There are <!-- probe:contexts -->6<!-- /probe --> bounded contexts, one directory each in
`apps/mobile/src/contexts/`:

- **identity** (generic): `AuthGateway` port, `MockAuthGateway`, session in `expo-secure-store`.
  Layers: `domain/ application/ infrastructure/`, no `ui/`.
- **recording** (core): the `RecordingSession` aggregate (auto-pause included), Fix Filter,
  `TrackingProfile`, the background task and the iOS background session. Publishes
  `SessionFinished`.
- **activity-log** (supporting): the `Activity` aggregate, history, detail, splits, gap-route
  estimates, demo import. Publishes `ActivityRecorded`, `ActivityDeleted`, `ActivityTrackCorrected`
  (`contract.ts`).
- **territory** (core): the `Claim` aggregate, turf strength, the `ter_cells` projection, the Turf
  Map. Publishes `TurfClaimed`, `TurfReleased` (`contract.ts`).
- **health-sync** (supporting): Apple Health import and export, an anti-corruption layer ("workout"
  never leaves it). `HealthStore` port (HealthKit adapter on iOS), links and anchor in `hs_links` /
  `hs_state`. Imports through Activity Log's `importActivity`; exports on `ActivityRecorded` with
  origin `recording`. Design: `docs/decisions/apple-health-2026-10-18.md`.
- **achievements** (supporting): pure `evaluateAchievements` / `summarizeAchievements` over facts
  the UI passes in. Layers: `domain/ ui/`, no persistence.

```
            SessionFinished                ActivityRecorded · ActivityDeleted
Recording ──────────────────▶ Activity Log ──── ActivityTrackCorrected ────▶ Territory
          ◀── FinishedTrackQuery ──────    ◀── ActivityTrackQuery ─────────
              (Activity Log pulls the track)    (Territory pulls the track)
Health Sync ── importActivity ──▶ Activity Log ── ActivityRecorded (origin recording) ──▶ Health Sync
Identity: selects the user's database at sign-in; other contexts see only a user id.
Achievements: no events; screens pass it Activity Log and Territory facts.
```

**No context imports another context.** The edges above are wired in one place,
`apps/mobile/src/wiring.ts`: it subscribes each context's use cases to the other contexts' events on
the `EventDispatcher`, and injects the track queries as ports (`tracks: { trackOf: … }`). Screens
are where contexts meet in the UI: the Dashboard composes Identity, Activity Log, Territory,
Achievements and Recording through their `ui/` hooks; the Info screen adds Health Sync's card.

Events travel through the transactional outbox (`apps/mobile/src/platform/outbox.ts`): an aggregate
change and its events commit in one SQLite transaction, and handlers are idempotent. Why: the outbox
entry in the architecture decisions (`docs/engineering/architecture-decisions.md`, added in #39).

## 2. Layers

Each context has some of `domain/`, `application/`, `infrastructure/`, `ui/`, plus a public
`index.ts` (and `contract.ts` for published types). Outside the contexts:

- `apps/mobile/src/shared-kernel/`: pure value objects and maths in SI units (geo, track,
  track-analyzer, time, events, errors)
- `apps/mobile/src/constants/`: plain shared values; a leaf any layer may import
- `apps/mobile/src/platform/`: database adapters, migrations, outbox + `EventDispatcher`, one-off
  jobs, diagnostics
- `apps/mobile/src/wiring.ts`: platform-independent wiring of all contexts (app and tests)
- `apps/mobile/src/composition-root.ts`: lazy, React-free container with the Expo adapters; used by
  the UI and the headless background task
- `apps/mobile/src/ui-kit/`: theme, formatting, shared components, `AppProvider`, the Me drawer
- `apps/mobile/src/app/`: expo-router screens, thin
- `index.ts` (repo root): imports the background task first, then `expo-router/entry`

Allowed directions: `ui → application → domain → shared-kernel`; `infrastructure` implements ports
from `application`/`domain`; `wiring` and `composition-root` may import anything.

## 3. What dependency-cruiser enforces

`pnpm run test:arch` (also inside `pnpm test` and `pnpm run ci:quality`) runs depcruise over
`apps/mobile/src/` with `.dependency-cruiser.cjs`. Every rule is severity `error`; test folders
(`__tests__/`, `test-support/`) are exempt from the first three.

- **`domain-is-pure`**: `apps/mobile/src/shared-kernel/` and every `domain/` import nothing from
  react, react-native, expo-\*, zustand, h3-js, MapLibre or better-sqlite3, nor from
  `apps/mobile/src/platform`, `composition-root`, `wiring`, `apps/mobile/src/app`,
  `apps/mobile/src/ui-kit`, or any context's `application/`, `infrastructure/` or `ui/`.
- **`application-no-infra-or-ui`**: `application/` imports no react, react-native, expo-\*, h3-js or
  MapLibre, no `infrastructure/` or `ui/` of any context, and not `composition-root`, `wiring`,
  `apps/mobile/src/app` or `apps/mobile/src/ui-kit`.
- **`contexts-only-via-public-api`**: a context may not import another context's `domain/`,
  `application/`, `infrastructure/` or `ui/`; only its `index.ts` / `contract.ts`.
- **`screens-use-ui-layer`**: `apps/mobile/src/app/` may not import a context's `domain/`,
  `application/` or `infrastructure/`, nor `apps/mobile/src/platform/`. Screens use `ui/` hooks and
  components and the public API.
- **`constants-are-leaf`**: `apps/mobile/src/constants/` imports only other constants.
- **`no-circular`**: no import cycles anywhere.

Not enforced (by design or not yet):

- `wiring.ts` and `composition-root.ts` import context internals (repositories, adapters): they are
  the composition root and appear in no rule's `from`.
- `ui/` may import `@/composition-root` (e.g. `use-live-session.ts` reads `liveSessionStore`).
- The root `index.ts` and `tools/` are outside the cruise (`exclude: '^tools'`, and depcruise runs
  on `src` only).
- Migration table prefixes per context (`rec_`, `log_`, `ter_`, `sys_`) are a convention in
  `apps/mobile/src/platform/migrations.ts`, not checked by a tool.

## 4. Maintenance rules

1. **New code conforms by default.** Put it in the context and layer the `ddd-architecture` skill
   says; don't rely on a later sweep.
2. **Touch it, conform it.** When you edit a file that breaks a convention, fix it in the same
   change unless that balloons the diff; then note it in the PR.
3. **Locked at zero.** `test:arch` has no warnings and no baseline: a PR that adds an illegal edge
   or a cycle fails the pre-push hook and CI.
4. **Legitimising an edge is a two-file change.** Change `.dependency-cruiser.cjs` **and** this doc
   **and** the dependency rule in `CLAUDE.md` together, in one PR. Drift between them is a bug.
5. **A new context** gets a directory in `apps/mobile/src/contexts/`, an `index.ts`, its wiring in
   `apps/mobile/src/wiring.ts`, a line in §1 and in `CLAUDE.md`'s layout. Published events go in its
   `contract.ts`.
6. **Never relax a rule to make a build pass.** Move the code instead; if the rule is wrong, change
   it deliberately under rule 4.
7. **Keep this doc honest.** It describes `.dependency-cruiser.cjs`; when the rules change, this doc
   changes in the same PR.
