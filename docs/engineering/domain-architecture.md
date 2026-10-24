---
status: canonical
verified: 2026-10-23
owner: founder
scope:
  [
    apps/mobile/.dependency-cruiser.cjs,
    packages/core/.dependency-cruiser.cjs,
    packages/core/src,
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

There are <!-- probe:contexts -->7<!-- /probe --> bounded contexts, one directory each in
`apps/mobile/src/contexts/`:

- **identity** (generic): `AuthGateway` port with two adapters, `MockAuthGateway` (the local `admin`
  and `demo` profiles) and `ApiAuthGateway` (accounts by e-mailed code or account password, account
  settings); session, credential and profile stores in `expo-secure-store`. Domain and application
  in core; the app holds `infrastructure/` and `ui/` (sign-in steps, the Account screens).
- **recording** (core): the `RecordingSession` aggregate (auto-pause included), Fix Filter,
  `TrackingProfile`, the background task and the iOS background session. Publishes
  `SessionFinished`.
- **activity-log** (supporting): the `Activity` aggregate, history, detail, splits, gap-route
  estimates, rename, demo and restore import. Publishes `ActivityRecorded`, `ActivityDeleted`,
  `ActivityRenamed`, `ActivityTrackCorrected`, `ActivityDistanceEstimated` (`contract.ts`).
- **territory** (core): the `Claim` aggregate, turf strength, the `ter_cells` projection, the Turf
  Map, the Home City. Publishes `TurfClaimed`, `TurfReleased`, `HomeCityChosen` (`contract.ts`). The
  API runs the same domain and use cases for its server turf (`apps/api/src/territory/`).
- **health-sync** (supporting): Apple Health import and export, an anti-corruption layer ("workout"
  never leaves it). `HealthStore` port (HealthKit adapter on iOS), links and anchor in `hs_links` /
  `hs_state`. Imports through Activity Log's `importActivity`; exports on `ActivityRecorded` with
  origin `recording`. Design: `docs/decisions/apple-health-2026-10-18.md`.
- **cloud-backup** (supporting): one-way, opt-in backup to the CityTurfer API. `ApiClient` port
  (fetch adapter = the anti-corruption layer for HTTP), device token in `expo-secure-store`, state
  in `cb_state` / `cb_activities`. Reads Activity Log's `archive` query and Territory's
  `homeCityChoice`; its outbox handlers on `ActivityRecorded`, `ActivityDeleted`, `ActivityRenamed`,
  `ActivityTrackCorrected`, `ActivityDistanceEstimated` and `HomeCityChosen` only queue work, which
  `RunBackup` sends in the foreground. Restore imports a backup onto a new phone through Activity
  Log (origin `restore`). `demo-*` never, except the demo profile's generated Gdańsk history
  (`demo-gdansk-n<i>`, to demo@'s own account; LP3 in
  `docs/decisions/local-profile-backup-2026-10-24.md`); `hk-*` only with its own consent.
- **achievements** (supporting): pure `evaluateAchievements` / `summarizeAchievements` and the
  getting-started steps over facts the UI passes in. Domain in core; the app holds `ui/` and
  `infrastructure/` (only the onboarding card's dismissal flag).

```
            SessionFinished                ActivityRecorded · ActivityDeleted
Recording ──────────────────▶ Activity Log ──── ActivityTrackCorrected ────▶ Territory
          ◀── FinishedTrackQuery ──────    ◀── ActivityTrackQuery ─────────
              (Activity Log pulls the track)    (Territory pulls the track)
Health Sync ── importActivity ──▶ Activity Log ── ActivityRecorded (origin recording) ──▶ Health Sync
Activity Log, Territory ── ActivityRecorded · Deleted · Renamed · TrackCorrected · DistanceEstimated · HomeCityChosen ──▶ Cloud Backup
          ◀── archive · homeCityChoice ── (Cloud Backup pulls the activity and the Home City, then PUTs them)
Cloud Backup ── restore import ──▶ Activity Log ── ActivityRecorded (origin restore) ──▶ Health Sync (remembers restored imports)
Identity: selects the user's database at sign-in; other contexts see only a user id.
Achievements: no events; screens pass it Activity Log and Territory facts.
```

**No context imports another context.** The edges above are wired in one place,
`apps/mobile/src/wiring.ts`: it subscribes each context's use cases to the other contexts' events on
the `EventDispatcher`, and injects the track queries as ports (`tracks: { trackOf: … }`). Screens
are where contexts meet in the UI: the Dashboard composes Identity, Activity Log, Territory,
Achievements, Recording and Cloud Backup (the restore card) through their `ui/` hooks; the Info
screen adds Health Sync's and Cloud Backup's cards.

Events travel through the transactional outbox (`apps/mobile/src/platform/outbox.ts`): an aggregate
change and its events commit in one SQLite transaction, and handlers are idempotent. Why: the outbox
entry in the architecture decisions (`docs/engineering/architecture-decisions.md`, added in #39).

## 2. Layers

Each context has some of `domain/`, `application/`, `infrastructure/`, `ui/`, plus a public
`index.ts` (and `contract.ts` for published types).

**`packages/core` (`@cityturfer/core`)** holds what the phone and the server both run: the shared
kernel, the core constants and the `domain/` + `application/` + `contract.ts` + `index.ts` of
Territory, Activity Log, Achievements and Identity, each with a `ports.ts` adapter SPI, plus the H3
adapter (`packages/core/src/h3/`) and the Gdańsk demo generator (`packages/core/src/demo/`, entry
`@cityturfer/core/demo`, shared with the API's local mock accounts). The app keeps those contexts'
adapters and UI, and `index.ts` / `contract.ts` as `export *` shims. Recording and Health Sync live
wholly in the app (device only). Outside the contexts:

- `packages/core/src/shared-kernel/`: pure value objects and maths in SI units (geo, track,
  track-analyzer, time, events, errors); `apps/mobile/src/shared-kernel/index.ts` re-exports it
- `packages/core/src/constants/` (core values) and `apps/mobile/src/constants/` (labels, colours,
  map styles, re-exports of core values): leaves any layer may import
- `apps/mobile/src/platform/`: database adapters, migrations, outbox + `EventDispatcher`, one-off
  jobs, diagnostics
- `apps/mobile/src/wiring.ts`: platform-independent wiring of all contexts (app and tests)
- `apps/mobile/src/composition-root.ts`: lazy, React-free container with the Expo adapters; used by
  the UI and the headless background task
- `apps/mobile/src/ui-kit/`: theme, formatting, shared components, `AppProvider`, the Me drawer
- `apps/mobile/src/app/`: expo-router screens, thin
- `apps/mobile/index.ts`: imports the background task first, then `expo-router/entry`

Allowed directions: `ui → application → domain → shared-kernel`; `infrastructure` implements ports
from `application`/`domain`; `wiring` and `composition-root` may import anything.

## 3. What dependency-cruiser enforces

`pnpm run test:arch` (also inside `pnpm test` and `pnpm run ci:quality`) runs each workspace's
`arch` script: depcruise over `apps/mobile/src/` with `apps/mobile/.dependency-cruiser.cjs` and over
`packages/core/src/` with `packages/core/.dependency-cruiser.cjs` (the same layer rules on
`packages/core/src/shared-kernel/` and `packages/core/src/contexts/`). Both resolve hoisted
`../../node_modules/…` paths and package `exports`. Every rule is severity `error`; test folders
(`__tests__/`, `test-support/`) are exempt from the first three.

- **`domain-is-pure`**: `apps/mobile/src/shared-kernel/` and every `domain/` import nothing from
  react, react-native, expo-\*, HealthKit or Nitro modules, zustand, h3-js (or core's `h3/`),
  MapLibre, better-sqlite3 or `@cityturfer/ui`, nor from `apps/mobile/src/platform`,
  `composition-root`, `wiring`, `apps/mobile/src/app`, `apps/mobile/src/ui-kit`, or any context's
  `application/`, `infrastructure/` or `ui/`.
- **`application-no-infra-or-ui`**: `application/` imports no react, react-native, expo-\*, h3-js or
  MapLibre, no `infrastructure/` or `ui/` of any context, and not `composition-root`, `wiring`,
  `apps/mobile/src/app` or `apps/mobile/src/ui-kit`.
- **`contexts-only-via-public-api`**: a context may not import another context's `domain/`,
  `application/`, `infrastructure/` or `ui/`; only its `index.ts` / `contract.ts`.
- **`screens-use-ui-layer`**: `apps/mobile/src/app/` may not import a context's `domain/`,
  `application/` or `infrastructure/`, nor `apps/mobile/src/platform/`. Screens use `ui/` hooks and
  components and the public API.
- **`constants-are-leaf`**: `apps/mobile/src/constants/` imports only other constants, the brand
  tokens and core constants; `packages/core/src/constants/` imports only other core constants.
- **`core-is-platform-free`** (core): nothing in `packages/core/src` imports react, react-native,
  expo, MapLibre, HealthKit, better-sqlite3, `@cityturfer/ui` / `@cityturfer/brand` or an app.
- **`h3-only-in-h3`** (core): only `packages/core/src/h3/` imports h3-js.
- **`core-via-entry-points`** (app): app code imports core only through its `exports` entries
  (`@cityturfer/core/<entry>`: constants, shared-kernel, h3, demo, `<ctx>` and `<ctx>/ports`), never
  files under `packages/core/src/` directly.
- **`core-ports-for-own-adapters`** / **`core-ports-only-of-own-context`** (app):
  `@cityturfer/core/<ctx>/ports` is imported only by that context's `infrastructure/`, test doubles,
  tests and the wiring.
- **`background-task-stays-offline`** (app): the background location task and its batch handler
  import no Cloud Backup, no `api-auth-gateway` or credential store, and no `fetch-`/`api-`/`osm-`
  adapter: they reach the rest only through `getContainer()`.
- **`no-circular`**: no import cycles anywhere.

Not enforced (by design or not yet):

- `wiring.ts` and `composition-root.ts` import context internals (repositories, adapters): they are
  the composition root and appear in no rule's `from`.
- `ui/` may import `@/composition-root` (e.g. `use-live-session.ts` reads `liveSessionStore`).
- `apps/mobile/index.ts` and `tools/` are outside the cruise (`exclude: '^tools'`, and depcruise
  runs on `src` only).
- Migration table prefixes per context (`rec_`, `log_`, `ter_`, `hs_`, `cb_`, `sys_`) are a
  convention in `apps/mobile/src/platform/migrations.ts`, not checked by a tool.

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
